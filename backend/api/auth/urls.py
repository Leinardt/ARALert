"""
Auth API URL configuration.
All staff authenticate via Google OAuth.
Students authenticate via Full Name (3 fields) + LRN.
"""

from django.urls import path

from .views import (
    AllowedEmailDestroyView,
    AllowedEmailListCreateView,
    CustomTokenRefreshView,
    GoogleLoginView,
    LogoutView,
    StudentLoginView,
    ConsentAcceptView,
)

urlpatterns = [
    # Google OAuth login (staff — Admin, Principal, Tutor, Faculty, SuperAdmin)
    path('google/', GoogleLoginView.as_view(), name='auth-google-login'),

    # Student login (First Name + Middle Name + Last Name + LRN)
    path('student-login/', StudentLoginView.as_view(), name='auth-student-login'),

    # Privacy consent acceptance
    path('consent/', ConsentAcceptView.as_view(), name='auth-consent'),

    # Common endpoints
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('refresh/', CustomTokenRefreshView.as_view(), name='auth-refresh'),

    # SuperAdmin — Allowed Email whitelist management
    path('allowed-emails/', AllowedEmailListCreateView.as_view(), name='allowed-email-list'),
    path('allowed-emails/<int:pk>/', AllowedEmailDestroyView.as_view(), name='allowed-email-destroy'),
]
