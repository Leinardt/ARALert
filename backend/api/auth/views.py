"""
Auth API Views.
Handles Google OAuth login for all staff roles and LRN-based login for students.
"""

import logging

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

from apps.accounts.models import AllowedEmail, User
from utilities.audit import log_audit_event
from utilities.helpers import get_client_ip
from utilities.rate_limit import (
    clear_login_attempts,
    is_login_rate_limited,
    record_failed_login,
)

from .serializers import (
    GoogleLoginSerializer,
    StudentLoginSerializer,
    UserProfileSerializer,
    ProfileUpdateSerializer,
    AllowedEmailSerializer,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Google OAuth Login (staff only)
# ---------------------------------------------------------------------------

class GoogleLoginView(GenericAPIView):
    """
    POST /api/auth/google/
    Verify a Google ID token issued by the frontend, enforce email domain rules,
    find-or-create the User, and return JWT tokens.

    Allowed domains: @edu.ph, @deped.gov.ph
    Personal or other domain emails must be in the AllowedEmail whitelist.
    """

    permission_classes = [AllowAny]
    serializer_class = GoogleLoginSerializer

    def post(self, request):
        client_ip = get_client_ip(request)

        if is_login_rate_limited(client_ip):
            log_audit_event('GOOGLE_LOGIN_RATE_LIMITED', request=request)
            return Response(
                {'detail': 'Too many failed login attempts. Please wait 15 minutes before trying again.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            record_failed_login(client_ip)
            log_audit_event('GOOGLE_LOGIN_INVALID_TOKEN', request=request,
                            details={'errors': serializer.errors})
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        google_data = serializer.validated_data  # {email, sub, name, given_name, family_name}
        email = google_data['email']
        sub   = google_data['sub']

        # ── Strict Pre-Registration Verification (Option A) ───────────────
        user = User.objects.filter(email__iexact=email).first()

        if user is None:
            record_failed_login(client_ip)
            log_audit_event('GOOGLE_LOGIN_UNREGISTERED_EMAIL', request=request, details={'email': email})
            return Response(
                {
                    'detail': 'Your account is not registered in ARALert. Please contact your Super Admin to be added to the system.'
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Update Google sub and name fields from Google token if missing
        update_fields = []
        if user.google_sub != sub:
            user.google_sub = sub
            update_fields.append('google_sub')

        google_fn = google_data.get('given_name', '').strip()
        google_ln = google_data.get('family_name', '').strip()

        if google_fn and not user.first_name:
            user.first_name = google_fn
            update_fields.append('first_name')
        if google_ln and not user.last_name:
            user.last_name = google_ln
            update_fields.append('last_name')

        if update_fields:
            user.save(update_fields=update_fields)

        if not user.is_active:
            return Response(
                {'detail': 'Your account has been deactivated. Please contact your administrator.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        clear_login_attempts(client_ip)
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        refresh = RefreshToken.for_user(user)
        log_audit_event('GOOGLE_LOGIN_SUCCESS', user=user, request=request,
                        details={'role': user.role or 'superadmin'})

        return Response({
            'access':   str(refresh.access_token),
            'refresh':  str(refresh),
            'user':     UserProfileSerializer(user).data,
            'redirect': _get_redirect_path(user),
        }, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Student Login (Full Name [3 fields] + LRN)
# ---------------------------------------------------------------------------

class StudentLoginView(GenericAPIView):
    """
    POST /api/auth/student-login/
    Authenticate student by First Name, Middle Name (optional), Last Name, and LRN.
    Returns JWT tokens.
    """

    permission_classes = [AllowAny]
    serializer_class = StudentLoginSerializer

    def post(self, request):
        client_ip = get_client_ip(request)
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
            log_audit_event('STUDENT_LOGIN_FAILED', username=lrn, request=request,
                            details={'errors': serializer.errors})
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.validated_data['user']
        clear_login_attempts(client_ip)

        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        refresh = RefreshToken.for_user(user)
        log_audit_event('STUDENT_LOGIN_SUCCESS', user=user, request=request)

        return Response({
            'access':   str(refresh.access_token),
            'refresh':  str(refresh),
            'user':     UserProfileSerializer(user).data,
            'redirect': '/student',
        }, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------

class LogoutView(GenericAPIView):
    """POST /api/auth/logout/ — Blacklist the refresh token."""

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
            return Response({'detail': 'Successfully logged out.'}, status=status.HTTP_200_OK)
        except TokenError:
            log_audit_event('LOGOUT_FAILED', user=request.user, request=request,
                            details={'reason': 'invalid_token'})
            return Response(
                {'detail': 'Invalid or expired refresh token.'},
                status=status.HTTP_400_BAD_REQUEST,
            )


# ---------------------------------------------------------------------------
# Token Refresh
# ---------------------------------------------------------------------------

class CustomTokenRefreshView(TokenRefreshView):
    """POST /api/auth/refresh/ — Refresh the access token."""
    pass


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------

class ProfileView(GenericAPIView):
    """GET/PATCH /api/profile/ — Return or update the authenticated user's profile."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    serializer_class = UserProfileSerializer

    def get(self, request):
        serializer = self.get_serializer(request.user, context={'request': request})
        return Response(serializer.data)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(
            data=request.data,
            context={'user': request.user, 'request': request},
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.update(request.user, serializer.validated_data)
        log_audit_event(
            'PROFILE_UPDATED',
            user=user,
            request=request,
            details={'fields': list(serializer.validated_data.keys())},
        )
        return Response(UserProfileSerializer(user, context={'request': request}).data)


# ---------------------------------------------------------------------------
# Allowed Email Management (SuperAdmin only)
# ---------------------------------------------------------------------------

class AllowedEmailListCreateView(GenericAPIView):
    """
    GET  /api/auth/allowed-emails/  — List all whitelisted emails.
    POST /api/auth/allowed-emails/  — Add an email to the whitelist.
    SuperAdmin only.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = AllowedEmailSerializer

    def _check_superadmin(self, user):
        if not user.is_superuser:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return None

    def get(self, request):
        err = self._check_superadmin(request.user)
        if err:
            return err
        qs = AllowedEmail.objects.all().order_by('-date_added')
        serializer = AllowedEmailSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        err = self._check_superadmin(request.user)
        if err:
            return err
        serializer = AllowedEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        allowed = serializer.save(added_by=request.user)
        log_audit_event('ALLOWED_EMAIL_ADDED', user=request.user, request=request,
                        details={'email': allowed.email})
        return Response(AllowedEmailSerializer(allowed).data, status=status.HTTP_201_CREATED)


class AllowedEmailDestroyView(GenericAPIView):
    """
    DELETE /api/auth/allowed-emails/{id}/ — Remove an email from the whitelist.
    SuperAdmin only.
    """

    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        if not request.user.is_superuser:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            obj = AllowedEmail.objects.get(pk=pk)
        except AllowedEmail.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        email = obj.email
        obj.delete()
        log_audit_event('ALLOWED_EMAIL_REMOVED', user=request.user, request=request,
                        details={'email': email})
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _get_redirect_path(user) -> str:
    if user.is_superuser:
        return '/superadmin'
    role_redirects = {
        'admin':     '/admin',
        'principal': '/principal',
        'faculty':   '/faculty',
        'tutor':     '/tutor',
        'student':   '/student',
    }
    return role_redirects.get(user.role, '/login')
