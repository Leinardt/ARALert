"""
Auth API URL configuration.
"""

from django.urls import path

from .views import (
    ActivateAccountView,
    CustomTokenRefreshView,
    ForgotPasswordView,
    LoginView,
    LogoutView,
    ResetPasswordView,
    MFAToggleView,
    VerifyOTPView,
    StudentLoginView,
)

urlpatterns = [
    path('login/', LoginView.as_view(), name='auth-login'),
    path('student-login/', StudentLoginView.as_view(), name='auth-student-login'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('refresh/', CustomTokenRefreshView.as_view(), name='auth-refresh'),
    path('activate/', ActivateAccountView.as_view(), name='auth-activate'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='auth-forgot-password'),
    path('reset-password/', ResetPasswordView.as_view(), name='auth-reset-password'),
    path('mfa/', MFAToggleView.as_view(), name='auth-mfa-toggle'),
    path('verify-otp/', VerifyOTPView.as_view(), name='auth-verify-otp'),
]

