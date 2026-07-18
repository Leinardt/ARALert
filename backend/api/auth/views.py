"""
Auth API Views.
Handles login, logout, token refresh, and profile retrieval.
"""

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.models import User
from services.email_service import send_account_invitation_email, send_password_reset_email
from services.token_service import generate_secure_token, get_token_expiration, is_token_valid

from .serializers import (
    ActivateAccountSerializer,
    ForgotPasswordSerializer,
    LoginSerializer,
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
    GET /api/profile/
    Return the authenticated user's profile.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = UserProfileSerializer

    def get(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)


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

