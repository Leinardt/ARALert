"""
Academics API URL configuration.
"""

from django.urls import path

from .views import (
    AcademicRiskDetailView,
    AcademicRiskListCreateView,
    AralActivityDetailView,
    AralActivityListCreateView,
    AralLevelProgressionView,
    AttendanceHistoryView,
    AttendanceManualLogView,
    AttendanceScanView,
    AttendanceSessionCloseView,
    AttendanceSessionCreateView,
    GradeDetailView,
    GradeListCreateView,
    PrincipalDashboardView,
    StudentAcademicProfileView,
)

urlpatterns = [
    # Grades
    path('grades/', GradeListCreateView.as_view(), name='grade-list-create'),
    path('grades/<int:id>/', GradeDetailView.as_view(), name='grade-detail'),

    # ARAL Activities
    path('aral-activities/', AralActivityListCreateView.as_view(), name='aral-list-create'),
    path('aral-activities/<int:id>/', AralActivityDetailView.as_view(), name='aral-detail'),

    # Academic Risks
    path('risks/', AcademicRiskListCreateView.as_view(), name='risk-list-create'),
    path('risks/<int:id>/', AcademicRiskDetailView.as_view(), name='risk-detail'),

    # Attendance
    path('attendance/session/', AttendanceSessionCreateView.as_view(), name='attendance-session-create'),
    path('attendance/session/<uuid:session_id>/close/', AttendanceSessionCloseView.as_view(), name='attendance-session-close'),
    path('attendance/scan/', AttendanceScanView.as_view(), name='attendance-scan'),
    path('attendance/manual/', AttendanceManualLogView.as_view(), name='attendance-manual'),
    path('attendance/history/', AttendanceHistoryView.as_view(), name='attendance-history'),

    # ARAL Level Progression
    path('level-up/evaluate/', AralLevelProgressionView.as_view(), name='aral-level-up-evaluate'),

    # Student Profile
    path('student-profile/<uuid:student_id>/', StudentAcademicProfileView.as_view(), name='student-profile-detail'),
    path('student-profile/', StudentAcademicProfileView.as_view(), name='student-profile-self'),

    # Principal Dashboard
    path('principal-dashboard/', PrincipalDashboardView.as_view(), name='principal-dashboard'),
]

