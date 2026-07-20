"""
Auth API Views.
Handles login, logout, token refresh, and profile retrieval.
"""

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import FormParser, MultiPartParser, JSONParser
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.models import User
from apps.accounts.models import EmailOTP
from services.email_service import send_account_invitation_email, send_password_reset_email
from services.token_service import generate_secure_token, get_token_expiration, is_token_valid
import secrets
from datetime import timedelta

from .serializers import (
    ActivateAccountSerializer,
    ForgotPasswordSerializer,
    LoginSerializer,
    ProfileUpdateSerializer,
    ResetPasswordSerializer,
    StudentLoginSerializer,
    UserProfileSerializer,
)


class LoginView(GenericAPIView):
    """
    POST /api/auth/login/
    Authenticate by username or email, return JWT tokens and user data.
    """

    permission_classes = [AllowAny]
    serializer_class = LoginSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']

        # Update last login timestamp
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        # If user has MFA enabled, generate and send OTP and require verification
        if getattr(user, 'mfa_enabled', False):
            # generate secure numeric OTP (6 digits)
            otp_code = str(secrets.randbelow(10**6)).zfill(6)
            expires_at = timezone.now() + timedelta(minutes=5)
            EmailOTP.objects.filter(user=user, used=False).update(used=True)
            EmailOTP.objects.create(user=user, code=otp_code, expires_at=expires_at)
            # send OTP email
            subject = 'Your ARALert login code'
            body = f"Your one-time login code is: {otp_code}\nThis code expires in 5 minutes. Do not share this code with anyone."
            # best-effort send
            from services.email_service import send_mail_with_smtp
            send_mail_with_smtp(subject, body, user.email, user.get_full_name())

            return Response({
                'mfa_required': True,
                'user_id': str(user.id),
                'message': 'An OTP has been sent to your registered email address.'
            }, status=status.HTTP_200_OK)

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)

        # Determine role-based redirect path
        if user.is_superuser:
            redirect_path = '/superadmin'
        else:
            role_redirects = {
                'admin': '/admin',
                'principal': '/principal',
                'faculty': '/faculty',
                'tutor': '/tutor',
                'student': '/student',
            }
            redirect_path = role_redirects.get(user.role, '/login')

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserProfileSerializer(user).data,
            'redirect': redirect_path,
        }, status=status.HTTP_200_OK)


class LogoutView(GenericAPIView):
    """
    POST /api/auth/logout/
    Blacklist the refresh token to invalidate the session.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            return Response(
                {'detail': 'Successfully logged out.'},
                status=status.HTTP_200_OK,
            )
        except TokenError:
            return Response(
                {'detail': 'Invalid or expired token.'},
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
        serializer = ProfileUpdateSerializer(data=request.data, context={'user': request.user})
        serializer.is_valid(raise_exception=True)
        user = serializer.update(request.user, serializer.validated_data)
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
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']

        # Update last login timestamp
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)

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

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserProfileSerializer(user).data,
            'redirect': self._get_redirect_path(user),
        }, status=status.HTTP_200_OK)

    def _get_redirect_path(self, user):
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


class MFAToggleView(GenericAPIView):
    """POST /api/auth/mfa/ - enable or disable MFA for the authenticated user."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        enable = request.data.get('enable')
        if enable is None:
            return Response({'detail': 'Missing "enable" boolean.'}, status=status.HTTP_400_BAD_REQUEST)
        request.user.mfa_enabled = bool(enable)
        request.user.save(update_fields=['mfa_enabled'])
        return Response({'mfa_enabled': request.user.mfa_enabled}, status=status.HTTP_200_OK)


class VerifyOTPView(GenericAPIView):
    """POST /api/auth/verify-otp/ - verify an emailed OTP and return tokens."""

    permission_classes = [AllowAny]

    def post(self, request):
        user_id = request.data.get('user_id')
        code = request.data.get('code')
        if not user_id or not code:
            return Response({'detail': 'user_id and code are required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'Invalid user.'}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        otp_qs = EmailOTP.objects.filter(user=user, code=code, used=False, expires_at__gt=now).order_by('-created_at')
        if not otp_qs.exists():
            return Response({'detail': 'Invalid or expired code.'}, status=status.HTTP_400_BAD_REQUEST)
        otp = otp_qs.first()
        otp.used = True
        otp.save(update_fields=['used'])

        # Issue tokens now
        refresh = RefreshToken.for_user(user)
        profile = UserProfileSerializer(user).data
        # Determine redirect path
        if user.is_superuser:
            redirect_path = '/superadmin'
        else:
            role_redirects = {
                'admin': '/admin',
                'principal': '/principal',
                'faculty': '/faculty',
                'tutor': '/tutor',
                'student': '/student',
            }
            redirect_path = role_redirects.get(user.role, '/login')

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': profile,
            'redirect': redirect_path,
        }, status=status.HTTP_200_OK)


class ForgotPasswordView(GenericAPIView):
    """POST /api/auth/forgot-password/ - send a password reset link."""

    permission_classes = [AllowAny]
    serializer_class = ForgotPasswordSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        token = generate_secure_token()
        user.password_reset_token = token
        user.password_reset_token_expires_at = get_token_expiration()
        user.save(update_fields=['password_reset_token', 'password_reset_token_expires_at'])

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        reset_link = f"{frontend_url}/reset-password?token={token}"
        send_password_reset_email(user, reset_link)
        return Response({'detail': 'Password reset instructions sent to your email.'}, status=status.HTTP_200_OK)


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

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserProfileSerializer(user).data,
            'redirect': self._get_redirect_path(user),
        }, status=status.HTTP_200_OK)

    def _get_redirect_path(self, user):
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

