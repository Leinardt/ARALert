from rest_framework import serializers
from apps.accounts.models import User
from apps.academics.models import Grade, AralActivity, AcademicRisk, AttendanceSession, Attendance


class GradeSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.get_full_name')
    tutor_name = serializers.ReadOnlyField(source='tutor.get_full_name')
    component_type_display = serializers.CharField(source='get_component_type_display', read_only=True)

    class Meta:
        model = Grade
        fields = [
            'id', 'student', 'student_name', 'tutor', 'tutor_name',
            'subject', 'quarter', 'score', 'total_score', 'component_type', 'component_type_display',
            'remarks', 'date_logged', 'batch_id'
        ]
        read_only_fields = ['id', 'date_logged', 'tutor']


class AralActivitySerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.get_full_name')
    tutor_name = serializers.ReadOnlyField(source='tutor.get_full_name')
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = AralActivity
        fields = [
            'id', 'student', 'student_name', 'tutor', 'tutor_name',
            'title', 'description', 'status', 'status_display',
            'date_assigned', 'date_completed', 'remarks'
        ]
        read_only_fields = ['id', 'date_assigned', 'tutor']


class AcademicRiskSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.get_full_name')
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)

    class Meta:
        model = AcademicRisk
        fields = [
            'id', 'student', 'student_name', 'risk_level', 'risk_level_display',
            'details', 'date_created', 'resolved'
        ]
        read_only_fields = ['id', 'date_created']


class AttendanceSessionSerializer(serializers.ModelSerializer):
    creator_name = serializers.ReadOnlyField(source='creator.get_full_name')
    aral_activity_title = serializers.ReadOnlyField(source='aral_activity.title')
    time_left = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceSession
        fields = [
            'id', 'creator', 'creator_name', 'session_type', 'action',
            'aral_activity', 'aral_activity_title', 'expires_at', 'is_active', 'time_left'
        ]
        read_only_fields = ['id', 'creator']

    def get_time_left(self, obj):
        from django.utils import timezone
        delta = obj.expires_at - timezone.now()
        seconds = max(0, int(delta.total_seconds()))
        return seconds


class AttendanceSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.get_full_name')
    user_lrn = serializers.ReadOnlyField(source='user.lrn')
    tutor_name = serializers.ReadOnlyField(source='tutor.get_full_name')
    aral_activity_title = serializers.ReadOnlyField(source='aral_activity.title')
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Attendance
        fields = [
            'id', 'user', 'user_name', 'user_lrn', 'role', 'date', 'time_in', 'time_out',
            'morning_time_in', 'morning_time_out', 'afternoon_time_in', 'afternoon_time_out',
            'status', 'status_display', 'tutor', 'tutor_name', 'aral_activity', 'aral_activity_title', 'session'
        ]
        read_only_fields = ['id', 'role']
