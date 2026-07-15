from django.contrib import admin
from .models import Grade, AralActivity, AcademicRisk, AttendanceSession, Attendance


@admin.register(Grade)
class GradeAdmin(admin.ModelAdmin):
    list_display = ('student', 'subject', 'quarter', 'component_type', 'score', 'date_logged')
    list_filter = ('quarter', 'component_type', 'subject')
    search_fields = ('student__first_name', 'student__last_name', 'subject')


@admin.register(AralActivity)
class AralActivityAdmin(admin.ModelAdmin):
    list_display = ('title', 'student', 'tutor', 'status', 'date_assigned', 'date_completed')
    list_filter = ('status', 'date_assigned')
    search_fields = ('title', 'student__first_name', 'student__last_name', 'tutor__first_name', 'tutor__last_name')


@admin.register(AcademicRisk)
class AcademicRiskAdmin(admin.ModelAdmin):
    list_display = ('student', 'risk_level', 'resolved', 'date_created')
    list_filter = ('risk_level', 'resolved')
    search_fields = ('student__first_name', 'student__last_name', 'details')


@admin.register(AttendanceSession)
class AttendanceSessionAdmin(admin.ModelAdmin):
    list_display = ('id', 'creator', 'session_type', 'action', 'expires_at', 'is_active')
    list_filter = ('session_type', 'action', 'is_active')


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'date', 'time_in', 'time_out', 'status')
    list_filter = ('role', 'status', 'date')
    search_fields = ('user__first_name', 'user__last_name')
