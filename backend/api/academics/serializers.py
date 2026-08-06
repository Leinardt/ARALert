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
)


class GradeSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    tutor_name   = serializers.SerializerMethodField()
    component_type_display = serializers.SerializerMethodField()

    class Meta:
        model  = ApiGrade
        fields = [
            'id', 'student', 'student_name', 'tutor', 'tutor_name',
            'subject', 'quarter', 'score', 'total_score',
            'component_type', 'component_type_display',
            'remarks', 'date_logged', 'batch_id',
        ]
        read_only_fields = ['id', 'student_name', 'tutor_name', 'component_type_display']

    def get_student_name(self, obj):
        return obj.student.get_full_name() if obj.student_id else ''

    def get_tutor_name(self, obj):
        return obj.tutor.get_full_name() if obj.tutor_id else None

    def get_component_type_display(self, obj):
        return obj.get_component_type_display()


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
