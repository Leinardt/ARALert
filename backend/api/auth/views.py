"""
Auth API Views.
Handles login, logout, token refresh, and profile retrieval.
"""

from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.exceptions import TokenError
from django.utils import timezone

from .serializers import LoginSerializer, UserProfileSerializer, StudentLoginSerializer


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

