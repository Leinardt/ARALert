"""
Academics API Serializers.
Produces the exact JSON shape the frontend types expect.
"""

from django.utils import timezone
from rest_framework import serializers

from apps.academics.models import (
    ApiAcademicRisk,
    ApiAralActivity,
    ApiAttendance,
    ApiAttendanceSession,
    ApiGrade,
    SchoolYear,
    StudentEnrollment,
    TutorAssignmentHistory,
    SummerRecord,
    TransitionAuditLog,
)


class GradeSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    tutor_name   = serializers.SerializerMethodField()
    component_type_display = serializers.SerializerMethodField()
    date_logged  = serializers.DateField(required=False, default=timezone.localdate)

    class Meta:
        model  = ApiGrade
        fields = [
            'id', 'student', 'student_name', 'tutor', 'tutor_name',
            'subject', 'quarter', 'score', 'total_score',
            'component_type', 'component_type_display',
            'remarks', 'date_logged', 'batch_id', 'created_at',
        ]
        read_only_fields = ['id', 'student_name', 'tutor_name', 'component_type_display', 'created_at']

    def get_student_name(self, obj):
        try:
            return obj.student.get_full_name() if obj.student else ''
        except Exception:
            return ''

    def get_tutor_name(self, obj):
        try:
            return obj.tutor.get_full_name() if obj.tutor else None
        except Exception:
            return None

    def get_component_type_display(self, obj):
        try:
            return obj.get_component_type_display()
        except Exception:
            return getattr(obj, 'component_type', '') or ''



class AralActivitySerializer(serializers.ModelSerializer):
    student_name   = serializers.SerializerMethodField()
    tutor_name     = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()

    class Meta:
        model  = ApiAralActivity
        fields = [
            'id', 'student', 'student_name', 'tutor', 'tutor_name',
            'title', 'description', 'status', 'status_display',
            'date_assigned', 'date_completed', 'remarks',
        ]
        read_only_fields = ['id', 'student_name', 'tutor_name', 'status_display']

    def get_student_name(self, obj):
        return obj.student.get_full_name() if obj.student_id else ''

    def get_tutor_name(self, obj):
        return obj.tutor.get_full_name() if obj.tutor_id else None

    def get_status_display(self, obj):
        return obj.get_status_display()


class AcademicRiskSerializer(serializers.ModelSerializer):
    student_name       = serializers.SerializerMethodField()
    risk_level_display = serializers.SerializerMethodField()

    class Meta:
        model  = ApiAcademicRisk
        fields = [
            'id', 'student', 'student_name',
            'risk_level', 'risk_level_display',
            'details', 'date_created', 'resolved', 'student_acknowledged',
        ]
        read_only_fields = ['id', 'student_name', 'risk_level_display', 'date_created']

    def get_student_name(self, obj):
        return obj.student.get_full_name() if obj.student_id else ''

    def get_risk_level_display(self, obj):
        return obj.get_risk_level_display()


class AttendanceSessionSerializer(serializers.ModelSerializer):
    creator_name        = serializers.SerializerMethodField()
    aral_activity_title = serializers.SerializerMethodField()
    time_left           = serializers.SerializerMethodField()

    class Meta:
        model  = ApiAttendanceSession
        fields = [
            'id', 'creator', 'creator_name',
            'session_type', 'action',
            'aral_activity', 'aral_activity_title',
            'expires_at', 'is_active', 'time_left',
        ]
        read_only_fields = ['id', 'creator_name', 'aral_activity_title', 'time_left']

    def get_creator_name(self, obj):
        return obj.creator.get_full_name() if obj.creator_id else ''

    def get_aral_activity_title(self, obj):
        return obj.aral_activity.title if obj.aral_activity_id else None

    def get_time_left(self, obj):
        """Seconds remaining until session expires."""
        delta = obj.expires_at - timezone.now()
        return max(0, int(delta.total_seconds()))


class AttendanceSerializer(serializers.ModelSerializer):
    user_name           = serializers.SerializerMethodField()
    user_lrn            = serializers.SerializerMethodField()
    tutor_name          = serializers.SerializerMethodField()
    aral_activity_title = serializers.SerializerMethodField()
    status_display      = serializers.SerializerMethodField()

    class Meta:
        model  = ApiAttendance
        fields = [
            'id', 'user', 'user_name', 'user_lrn',
            'role', 'date',
            'time_in', 'time_out',
            'arrival_am', 'departure_am', 'arrival_pm', 'departure_pm',
            'status', 'status_display',
            'tutor', 'tutor_name',
            'aral_activity', 'aral_activity_title',
            'session',
        ]
        read_only_fields = [
            'id', 'user_name', 'user_lrn', 'tutor_name',
            'aral_activity_title', 'status_display',
        ]

    def get_user_name(self, obj):
        return obj.user.get_full_name() if obj.user_id else ''

    def get_user_lrn(self, obj):
        return obj.user.lrn if obj.user_id else None

    def get_tutor_name(self, obj):
        return obj.tutor.get_full_name() if obj.tutor_id else None

    def get_aral_activity_title(self, obj):
        return obj.aral_activity.title if obj.aral_activity_id else None

    def get_status_display(self, obj):
        return obj.get_status_display()


class SchoolYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolYear
        fields = ['id', 'school_year', 'status', 'is_active', 'start_date', 'end_date', 'created_at', 'archived_at']


class StudentEnrollmentSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_lrn = serializers.SerializerMethodField()
    school_year_str = serializers.CharField(source='school_year.school_year', read_only=True)
    assigned_tutor_name = serializers.SerializerMethodField()

    class Meta:
        model = StudentEnrollment
        fields = [
            'id', 'student', 'student_name', 'student_lrn',
            'school_year', 'school_year_str', 'grade_level', 'program',
            'assigned_tutor', 'assigned_tutor_name',
            'enrollment_status', 'mosy_result', 'eosy_result',
            'final_result', 'evaluation_status', 'graduation_status',
            'summer_status', 'enrollment_date', 'completion_date',
            'created_at', 'updated_at',
        ]

    def get_student_name(self, obj):
        return obj.student.get_full_name() if obj.student else ''

    def get_student_lrn(self, obj):
        return obj.student.lrn if obj.student else ''

    def get_assigned_tutor_name(self, obj):
        return obj.assigned_tutor.get_full_name() if obj.assigned_tutor else 'Unassigned'


class TutorAssignmentHistorySerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_lrn = serializers.SerializerMethodField()
    tutor_name = serializers.SerializerMethodField()
    school_year_str = serializers.CharField(source='school_year.school_year', read_only=True)

    class Meta:
        model = TutorAssignmentHistory
        fields = [
            'id', 'student', 'student_name', 'student_lrn',
            'tutor', 'tutor_name', 'school_year', 'school_year_str',
            'period', 'program', 'assigned_by', 'start_date',
            'end_date', 'is_active', 'notes', 'created_at',
        ]

    def get_student_name(self, obj):
        return obj.student.get_full_name() if obj.student else ''

    def get_student_lrn(self, obj):
        return obj.student.lrn if obj.student else ''

    def get_tutor_name(self, obj):
        return obj.tutor.get_full_name() if obj.tutor else ''


class SummerRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_lrn = serializers.SerializerMethodField()
    evaluator_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_summer_status_display', read_only=True)
    reason_display = serializers.CharField(source='get_reason_display', read_only=True)

    class Meta:
        model = SummerRecord
        fields = [
            'id', 'student', 'student_name', 'student_lrn',
            'previous_enrollment', 'previous_program', 'previous_school_year',
            'reason', 'reason_display', 'summer_status', 'status_display',
            'summer_evaluation_status', 'summer_result',
            'start_date', 'completion_date', 'evaluating_tutor',
            'evaluator_name', 'notes', 'created_at',
        ]

    def get_student_name(self, obj):
        return obj.student.get_full_name() if obj.student else ''

    def get_student_lrn(self, obj):
        return obj.student.lrn if obj.student else ''

    def get_evaluator_name(self, obj):
        return obj.evaluating_tutor.get_full_name() if obj.evaluating_tutor else None


class TransitionAuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransitionAuditLog
        fields = '__all__'


class AssignTutorRequestSerializer(serializers.Serializer):
    student_id = serializers.UUIDField(required=True)
    tutor_id = serializers.UUIDField(required=False, allow_null=True)
    period = serializers.CharField(default='MOSY')
    notes = serializers.CharField(required=False, allow_blank=True, default='')


class SummerEvaluationRequestSerializer(serializers.Serializer):
    result = serializers.ChoiceField(choices=['passed', 'failed'])
    notes = serializers.CharField(required=False, allow_blank=True, default='')

