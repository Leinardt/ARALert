"""
Users API URL configuration.
"""

from django.urls import path
from .views import (
    UserListCreateView,
    UserDetailView,
    UserActivateView,
    UserDeactivateView,
    ResetPasswordView,
    UserStatsView,
)

urlpatterns = [
    path('stats/', UserStatsView.as_view(), name='user-stats'),
    path('', UserListCreateView.as_view(), name='user-list-create'),
    path('<uuid:id>/', UserDetailView.as_view(), name='user-detail'),
    path('<uuid:id>/activate/', UserActivateView.as_view(), name='user-activate'),
    path('<uuid:id>/deactivate/', UserDeactivateView.as_view(), name='user-deactivate'),
    path('<uuid:id>/reset-password/', ResetPasswordView.as_view(), name='user-reset-password'),
]
