"""
Users API URL configuration.
"""

from django.urls import path

from .views import (
    AuditLogListView,
    BulkAssignTutorView,
    CheckExistingLrnsView,
    StudentEditRequestListCreateView,
    StudentEditRequestReviewView,
    TutorListView,
    UserActivateView,
    UserActivityHistoryView,
    UserDeactivateView,
    UserDetailView,
    UserListCreateView,
    UserStatsView,
)

urlpatterns = [
    path('check-lrns/', CheckExistingLrnsView.as_view(), name='check-lrns'),
    path('stats/', UserStatsView.as_view(), name='user-stats'),
    path('tutors/', TutorListView.as_view(), name='tutor-list'),
    path('bulk-assign-tutor/', BulkAssignTutorView.as_view(), name='bulk-assign-tutor'),
    path('audit-logs/', AuditLogListView.as_view(), name='audit-log-list'),
    path('student-edit-requests/', StudentEditRequestListCreateView.as_view(), name='student-edit-requests-list'),
    path('student-edit-requests/<uuid:id>/review/', StudentEditRequestReviewView.as_view(), name='student-edit-requests-review'),
    path('', UserListCreateView.as_view(), name='user-list'),
    path('<uuid:id>/', UserDetailView.as_view(), name='user-detail'),
    path('<uuid:id>/activity/', UserActivityHistoryView.as_view(), name='user-activity-history'),
    path('<uuid:id>/activate/', UserActivateView.as_view(), name='user-activate'),
    path('<uuid:id>/deactivate/', UserDeactivateView.as_view(), name='user-deactivate'),
]
