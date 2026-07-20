from django.urls import path
from .views import (
    GradeListCreateView,
    GradeDetailView,
    AralActivityListCreateView,
    AralActivityDetailView,
    AcademicRiskListCreateView,
    AcademicRiskDetailView,
    AttendanceSessionCreateView,
    AttendanceScanView,
    AttendanceManualLogView,
    AttendanceHistoryView,
    PrincipalDashboardView,
    StudentAcademicProfileView,
)

urlpatterns = [
    path('grades/', GradeListCreateView.as_view(), name='grade-list-create'),
    path('grades/<int:id>/', GradeDetailView.as_view(), name='grade-detail'),
    
    path('aral-activities/', AralActivityListCreateView.as_view(), name='aral-list-create'),
    path('aral-activities/<int:id>/', AralActivityDetailView.as_view(), name='aral-detail'),
    
    path('risks/', AcademicRiskListCreateView.as_view(), name='risk-list-create'),
    path('risks/<int:id>/', AcademicRiskDetailView.as_view(), name='risk-detail'),
    
    path('attendance/session/', AttendanceSessionCreateView.as_view(), name='attendance-session-create'),
    path('attendance/scan/', AttendanceScanView.as_view(), name='attendance-scan'),
    path('attendance/manual/', AttendanceManualLogView.as_view(), name='attendance-manual'),
    path('attendance/history/', AttendanceHistoryView.as_view(), name='attendance-history'),
    path('principal-dashboard/', PrincipalDashboardView.as_view(), name='principal-dashboard'),
    
    path('student-profile/<uuid:student_id>/', StudentAcademicProfileView.as_view(), name='student-profile-detail'),
    path('student-profile/', StudentAcademicProfileView.as_view(), name='student-profile-self'),
]
