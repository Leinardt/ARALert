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

from .evaluation_views import (
    SchoolYearListView,
    CurrentSchoolYearView,
    MosyMonitoringView,
    MosyProcessView,
    MosyAssignmentsView,
    EosyMonitoringView,
    TransitionSummaryPreviewView,
    StartNewSchoolYearView,
    AvailableTutorsView,
    AssignTutorView,
    SummerListView,
    SummerStartView,
    SummerEvaluateView,
    SchoolYearArchiveListView,
    SchoolYearArchiveDetailView,
    StudentCompleteHistoryView,
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

    # School Year Management
    path('school-years/', SchoolYearListView.as_view(), name='school-year-list'),
    path('school-years/current/', CurrentSchoolYearView.as_view(), name='current-school-year'),

    # MOSY Evaluation & Tutor Assignment
    path('evaluations/mosy-monitoring/', MosyMonitoringView.as_view(), name='mosy-monitoring'),
    path('evaluations/mosy-process/', MosyProcessView.as_view(), name='mosy-process'),
    path('evaluations/mosy-assignments/', MosyAssignmentsView.as_view(), name='mosy-assignments'),

    # EOSY Evaluation & Transition
    path('evaluations/eosy-monitoring/', EosyMonitoringView.as_view(), name='eosy-monitoring'),
    path('evaluations/transition-summary/', TransitionSummaryPreviewView.as_view(), name='transition-summary'),
    path('evaluations/start-new-school-year/', StartNewSchoolYearView.as_view(), name='start-new-school-year'),

    # Available Tutors (No Capacity) & Assignment
    path('tutors/available/', AvailableTutorsView.as_view(), name='tutors-available'),
    path('tutors/assign/', AssignTutorView.as_view(), name='tutor-assign'),

    # Summer Remediation Program
    path('summer/', SummerListView.as_view(), name='summer-list'),
    path('summer/<int:id>/start/', SummerStartView.as_view(), name='summer-start'),
    path('summer/<int:id>/evaluate/', SummerEvaluateView.as_view(), name='summer-evaluate'),

    # School Year Archive
    path('archive/', SchoolYearArchiveListView.as_view(), name='archive-list'),
    path('archive/<str:school_year>/', SchoolYearArchiveDetailView.as_view(), name='archive-detail'),

    # Student Full Academic, Tutor & Summer History
    path('students/<uuid:student_id>/history/', StudentCompleteHistoryView.as_view(), name='student-complete-history'),
]

