"""
Auth API URL configuration.
"""

from django.urls import path
from .views import LoginView, LogoutView, CustomTokenRefreshView, StudentLoginView

urlpatterns = [
    path('login/', LoginView.as_view(), name='auth-login'),
    path('student-login/', StudentLoginView.as_view(), name='auth-student-login'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('refresh/', CustomTokenRefreshView.as_view(), name='auth-refresh'),
]

