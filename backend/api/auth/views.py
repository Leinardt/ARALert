"""
Auth API Views.
Handles login, logout, token refresh, and profile retrieval with full audit logging.
"""

import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.models import EmailOTP, User
from services.email_service import (
    send_account_invitation_email,
    send_password_reset_email,
)
from services.token_service import (
    generate_secure_token,
    get_token_expiration,
    is_token_valid,
)
from utilities.audit import log_audit_event
from utilities.helpers import get_client_ip
from utilities.rate_limit import (
    clear_login_attempts,
    clear_otp_attempts,
    is_login_rate_limited,
    is_otp_rate_limited,
    record_failed_login,
    record_failed_otp,
)

from .serializers import (
    ActivateAccountSerializer,
    ForgotPasswordSerializer,
    LoginSerializer,
    ProfileUpdateSerializer,
    ResetPasswordSerializer,
    StudentLoginSerializer,
    UserProfileSerializer,
    VerifyOTPSerializer,
)


class LoginView(GenericAPIView):
    """
    POST /api/auth/login/
    Authenticate by username or email, return JWT tokens and user data.
    """

    permission_classes = [AllowAny]
    serializer_class = LoginSerializer

    def post(self, request):
        client_ip = get_client_ip(request)
        identifier = request.data.get('username_or_email', '')

        # ── Rate-limit check ───────────────────────────────────────────────────
        if is_login_rate_limited(client_ip):
            log_audit_event('LOGIN_RATE_LIMITED', username=identifier, request=request)
            return Response(
                {'detail': 'Too many failed login attempts. Please wait 15 minutes before trying again.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            record_failed_login(client_ip)
            log_audit_event('LOGIN_FAILED', username=identifier, request=request, details={'reason': 'invalid_credentials'})
            raise serializers_validation_error(serializer.errors)

        user = serializer.validated_data['user']
        device_id = request.data.get('device_id')

        # Successful login credential check — clear failed-attempt counter
        clear_login_attempts(client_ip)

        # Update last login timestamp
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        # Check if this device is trusted (skips MFA for 30 days)
        from apps.accounts.models import TrustedDevice
        device_trusted = False
        if device_id:
            now = timezone.now()
            device_qs = TrustedDevice.objects.filter(
                user=user,
                device_id=device_id,
                expires_at__gt=now
            )
            device_trusted = device_qs.exists()

        # If user has MFA enabled and device is not trusted, require verification
        if getattr(user, 'mfa_enabled', False) and not device_trusted:
            otp_code = str(secrets.randbelow(10**6)).zfill(6)
            expires_at = timezone.now() + timedelta(minutes=5)
            EmailOTP.objects.filter(user=user, used=False).update(used=True)
            EmailOTP.objects.create(user=user, code=otp_code, expires_at=expires_at)
            
            subject = 'Your ARALert login code'
            body = f"Your one-time login code is: {otp_code}\nThis code expires in 5 minutes. Do not share this code with anyone."
            from services.email_service import send_mail_with_smtp
            send_mail_with_smtp(subject, body, user.email, user.get_full_name())

            log_audit_event('LOGIN_MFA_CHALLENGE_ISSUED', user=user, request=request)

            return Response({
                'mfa_required': True,
                'user_id': str(user.id),
                'message': 'An OTP has been sent to your registered email address.',
            }, status=status.HTTP_200_OK)

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)

        log_audit_event('LOGIN_SUCCESS', user=user, request=request, details={'role': user.role or 'superadmin'})

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserProfileSerializer(user).data,
            'redirect': _get_redirect_path(user),
        }, status=status.HTTP_200_OK)


class LogoutView(GenericAPIView):
    """
    POST /api/auth/logout/
    Blacklist the refresh token to invalidate the session.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'detail': 'Refresh token is required to log out.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            log_audit_event('LOGOUT_SUCCESS', user=request.user, request=request)
            return Response(
                {'detail': 'Successfully logged out.'},
                status=status.HTTP_200_OK,
            )
        except TokenError:
            log_audit_event('LOGOUT_FAILED', user=request.user, request=request, details={'reason': 'invalid_token'})
            return Response(
                {'detail': 'Invalid or expired refresh token.'},
                status=status.HTTP_400_BAD_REQUEST,
            )


class CustomTokenRefreshView(TokenRefreshView):
    """
    POST /api/auth/refresh/
    Refresh the access token using a valid refresh token.
    """

    pass


class ProfileView(GenericAPIView):
    """
    GET/PATCH /api/profile/
    Return or update the authenticated user's profile.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    serializer_class = UserProfileSerializer

    def get(self, request):
        serializer = self.get_serializer(request.user, context={'request': request})
        return Response(serializer.data)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(
            data=request.data,
            context={'user': request.user, 'request': request}
        )
        serializer.is_valid(raise_exception=True)
        password_changed = bool(serializer.validated_data.get('password'))
        user = serializer.update(request.user, serializer.validated_data)
        
        log_audit_event(
            'PROFILE_UPDATED',
            user=user,
            request=request,
            details={'password_changed': password_changed, 'fields': list(serializer.validated_data.keys())}
        )

        profile_serializer = UserProfileSerializer(user, context={'request': request})
        return Response(profile_serializer.data)


class StudentLoginView(GenericAPIView):
    """
    POST /api/auth/student-login/
    Authenticate student by Full Name and LRN, return JWT tokens and user data.
    """

    permission_classes = [AllowAny]
    serializer_class = StudentLoginSerializer

    def post(self, request):
        client_ip = get_client_ip(request)
        full_name = request.data.get('full_name', '')
        lrn = request.data.get('lrn', '')

        if is_login_rate_limited(client_ip):
            log_audit_event('STUDENT_LOGIN_RATE_LIMITED', username=lrn, request=request)
            return Response(
                {'detail': 'Too many failed login attempts. Please wait 15 minutes before trying again.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            record_failed_login(client_ip)
            log_audit_event('STUDENT_LOGIN_FAILED', username=lrn, request=request, details={'full_name': full_name})
            raise serializers_validation_error(serializer.errors)

        user = serializer.validated_data['user']
        clear_login_attempts(client_ip)

        # Update last login timestamp
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)

        log_audit_event('STUDENT_LOGIN_SUCCESS', user=user, request=request)

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserProfileSerializer(user).data,
            'redirect': '/student',
        }, status=status.HTTP_200_OK)


class ActivateAccountView(GenericAPIView):
    """POST /api/auth/activate/ - set a password for a pending account."""

    permission_classes = [AllowAny]
    serializer_class = ActivateAccountSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        user.username = username
        user.set_password(password)
        user.is_active = True
        user.password_set = True
        user.password_setup_required = False
        user.email_verified = True
        user.activation_token = None
        user.activation_token_expires_at = None
        user.last_login = timezone.now()
        user.save(update_fields=[
            'username', 'password', 'password_set', 'is_active', 'password_setup_required', 'email_verified',
            'activation_token', 'activation_token_expires_at', 'last_login'
        ])

        log_audit_event('ACCOUNT_ACTIVATED', user=user, request=request)

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserProfileSerializer(user).data,
            'redirect': _get_redirect_path(user),
        }, status=status.HTTP_200_OK)


class MFAToggleView(GenericAPIView):
    """POST /api/auth/mfa/ - enable or disable MFA for the authenticated user."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        enable = request.data.get('enable')
        if enable is None:
            return Response(
                {'detail': 'The "enable" boolean field is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not isinstance(enable, bool):
            return Response(
                {'detail': '"enable" must be a boolean (true or false).'},
                status=status.HTTP_400_BAD_REQUEST
            )
        request.user.mfa_enabled = enable
        request.user.save(update_fields=['mfa_enabled'])

        log_audit_event('MFA_TOGGLED', user=request.user, request=request, details={'mfa_enabled': enable})

        return Response({'mfa_enabled': request.user.mfa_enabled}, status=status.HTTP_200_OK)


class VerifyOTPView(GenericAPIView):
    """POST /api/auth/verify-otp/ - verify an emailed OTP and return tokens."""

    permission_classes = [AllowAny]
    serializer_class = VerifyOTPSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_id = str(serializer.validated_data['user_id'])
        code = serializer.validated_data['code']
        remember_device = serializer.validated_data.get('remember_device', False)
        device_id = serializer.validated_data.get('device_id')

        # ── OTP brute-force protection ─────────────────────────────────────────
        if is_otp_rate_limited(user_id):
            log_audit_event('MFA_OTP_RATE_LIMITED', username=user_id, request=request)
            return Response(
                {'detail': 'Too many incorrect attempts. Please wait 15 minutes or request a new code by signing in again.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            log_audit_event('MFA_OTP_INVALID_USER', username=user_id, request=request)
            return Response(
                {'detail': 'Verification failed. Please sign in again.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        now = timezone.now()
        otp_qs = EmailOTP.objects.filter(
            user=user, code=code, used=False, expires_at__gt=now
        ).order_by('-created_at')

        if not otp_qs.exists():
            record_failed_otp(user_id)
            log_audit_event('MFA_OTP_FAILED', user=user, request=request)

            from django.core.cache import cache
            attempts = cache.get(f"rl:otp:{user_id}", 0)
            from utilities.rate_limit import OTP_MAX_ATTEMPTS
            remaining = max(OTP_MAX_ATTEMPTS - attempts, 0)
            detail = 'Invalid or expired verification code.'
            if remaining > 0:
                detail += f' You have {remaining} attempt(s) remaining.'
            else:
                detail = 'Too many incorrect attempts. Please wait 15 minutes or request a new code by signing in again.'
            return Response({'detail': detail}, status=status.HTTP_400_BAD_REQUEST)

        otp = otp_qs.first()
        otp.used = True
        otp.save(update_fields=['used'])

        clear_otp_attempts(user_id)

        if remember_device and device_id:
            from apps.accounts.models import TrustedDevice
            TrustedDevice.objects.get_or_create(
                user=user,
                device_id=device_id,
                defaults={'expires_at': timezone.now() + timedelta(days=30)},
            )

        refresh = RefreshToken.for_user(user)
        profile = UserProfileSerializer(user).data

        log_audit_event('MFA_OTP_SUCCESS', user=user, request=request, details={'remember_device': remember_device})

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': profile,
            'redirect': _get_redirect_path(user),
        }, status=status.HTTP_200_OK)


class ForgotPasswordView(GenericAPIView):
    """POST /api/auth/forgot-password/ - send a password reset link."""

    permission_classes = [AllowAny]
    serializer_class = ForgotPasswordSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data.get('user')
        email = request.data.get('email', '')

        if user is not None:
            token = generate_secure_token()
            user.password_reset_token = token
            user.password_reset_token_expires_at = get_token_expiration()
            user.save(update_fields=['password_reset_token', 'password_reset_token_expires_at'])

            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
            reset_link = f"{frontend_url}/reset-password?token={token}"
            send_password_reset_email(user, reset_link)
            log_audit_event('PASSWORD_RESET_REQUESTED', user=user, request=request)
        else:
            log_audit_event('PASSWORD_RESET_REQUESTED_UNKNOWN_EMAIL', username=email, request=request)

        return Response(
            {'detail': 'If an account with that email address exists, password reset instructions have been sent to it.'},
            status=status.HTTP_200_OK,
        )


class ResetPasswordView(GenericAPIView):
    """POST /api/auth/reset-password/ - reset a password using a token."""

    permission_classes = [AllowAny]
    serializer_class = ResetPasswordSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        password = serializer.validated_data['password']
        user.set_password(password)
        user.password_set = True
        user.password_reset_token = None
        user.password_reset_token_expires_at = None
        user.last_login = timezone.now()
        user.save(update_fields=['password', 'password_set', 'password_reset_token', 'password_reset_token_expires_at', 'last_login'])

        log_audit_event('PASSWORD_RESET_COMPLETED', user=user, request=request)

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserProfileSerializer(user).data,
            'redirect': _get_redirect_path(user),
        }, status=status.HTTP_200_OK)


# ── Private helpers ────────────────────────────────────────────────────────────

def _get_redirect_path(user) -> str:
    if user.is_superuser:
        return '/superadmin'
    role_redirects = {
        'admin': '/admin',
        'principal': '/principal',
        'faculty': '/faculty',
        'tutor': '/tutor',
        'student': '/student',
    }
    return role_redirects.get(user.role, '/login')


def serializers_validation_error(errors):
    from rest_framework.exceptions import ValidationError
    raise ValidationError(errors)
