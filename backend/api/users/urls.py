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
    TutorListView,
    AuditLogListView,
)

urlpatterns = [
    path('stats/', UserStatsView.as_view(), name='user-stats'),
    path('tutors/', TutorListView.as_view(), name='tutor-list'),
    path('audit-logs/', AuditLogListView.as_view(), name='audit-log-list'),
    path('', UserListCreateView.as_view(), name='user-list'),
    path('<uuid:id>/', UserDetailView.as_view(), name='user-detail'),
    path('<uuid:id>/activate/', UserActivateView.as_view(), name='user-activate'),
    path('<uuid:id>/deactivate/', UserDeactivateView.as_view(), name='user-deactivate'),
    path('<uuid:id>/reset-password/', ResetPasswordView.as_view(), name='user-reset-password'),
]
