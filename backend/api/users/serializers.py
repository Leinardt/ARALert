"""
Users API Serializers.
Handles validation for user CRUD, password reset, and dashboard stats.
"""

import uuid

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.models import User
from services.email_service import send_account_invitation_email
from services.token_service import generate_secure_token, get_token_expiration


class UserListSerializer(serializers.ModelSerializer):
    """Serializer for user list display (table view)."""

    full_name = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    assigned_tutor_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'full_name', 'first_name', 'middle_name', 'last_name',
            'username', 'email', 'role', 'lrn', 'status', 'is_active',
            'password_setup_required', 'email_verified', 'date_joined', 'last_login',
            'assigned_tutor', 'assigned_tutor_name', 'assessment_weight', 'weekly_tasks_weight',
            'attendance_weight', 'aral_level'
        ]

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_status(self, obj):
        return 'Active' if obj.is_active else 'Inactive'

    def get_assigned_tutor_name(self, obj):
        if obj.assigned_tutor:
            return obj.assigned_tutor.get_full_name()
        return None


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a new pending staff account without username/password."""

    username = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    confirm_password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'first_name', 'middle_name', 'last_name', 'username', 'email',
            'password', 'confirm_password', 'role', 'lrn', 'is_active',
            'assigned_tutor', 'assessment_weight', 'weekly_tasks_weight', 'attendance_weight',
            'aral_level'
        ]

    def validate_role(self, value):
        """Prevent SuperAdmin role assignment."""
        allowed_roles = [r[0] for r in User.Role.choices]
        if value not in allowed_roles:
            raise serializers.ValidationError(
                f'Invalid role. Allowed roles: {", ".join(allowed_roles)}'
            )
        return value

    def validate_username(self, value):
        """Check for duplicate usernames when one is supplied."""
        if value and User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('A user with this username already exists.')
        return value

    def validate_email(self, value):
        """Check for duplicate emails."""
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value

    def validate(self, data):
        """Validate role and LRN requirement for the invitation-based flow."""
        if data.get('password') and data.get('confirm_password') and data.get('password') != data.get('confirm_password'):
            raise serializers.ValidationError(
                {'confirm_password': 'Passwords do not match.'}
            )

        # LRN is required for students
        if data.get('role') == 'student':
            lrn = data.get('lrn')
            if not lrn:
                raise serializers.ValidationError(
                    {'lrn': 'LRN is required for student accounts.'}
                )
            if not lrn.isdigit() or len(lrn) != 12:
                raise serializers.ValidationError(
                    {'lrn': 'LRN must be exactly 12 digits.'}
                )
        else:
            # Clear LRN for non-student roles
            data['lrn'] = None
        return data

    def create(self, validated_data):
        """Create a pending account that requires setup via email invitation."""
        validated_data.pop('confirm_password', None)
        validated_data.pop('password', None)

        if not validated_data.get('username'):
            generated_username = f"pending-{uuid.uuid4().hex[:10]}"
            while User.objects.filter(username__iexact=generated_username).exists():
                generated_username = f"pending-{uuid.uuid4().hex[:10]}"
            validated_data['username'] = generated_username

        validated_data['is_active'] = False
        validated_data['password_set'] = False
        validated_data['email_verified'] = False
        validated_data['password_setup_required'] = True
        validated_data['activation_token'] = generate_secure_token()
        validated_data['activation_token_expires_at'] = get_token_expiration()

        user = User(**validated_data)
        user.set_unusable_password()
        user.save()

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        activation_link = f"{frontend_url}/activate?token={user.activation_token}"
        user.activation_link = activation_link
        user.email_sent = bool(send_account_invitation_email(user, activation_link))
        user.save(update_fields=['activation_link', 'email_sent'])
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for editing a user (no password field)."""

    class Meta:
        model = User
        fields = [
            'first_name', 'middle_name', 'last_name', 'username', 'email',
            'role', 'lrn', 'is_active', 'assigned_tutor',
            'assessment_weight', 'weekly_tasks_weight', 'attendance_weight',
            'aral_level'
        ]

    def validate_role(self, value):
        """Prevent SuperAdmin role assignment."""
        allowed_roles = [r[0] for r in User.Role.choices]
        if value not in allowed_roles:
            raise serializers.ValidationError(
                f'Invalid role. Allowed roles: {", ".join(allowed_roles)}'
            )
        return value

    def validate_username(self, value):
        """Check for duplicate usernames, excluding self."""
        user = self.instance
        if User.objects.filter(username__iexact=value).exclude(id=user.id).exists():
            raise serializers.ValidationError('A user with this username already exists.')
        return value

    def validate_email(self, value):
        """Check for duplicate emails, excluding self."""
        user = self.instance
        if User.objects.filter(email__iexact=value).exclude(id=user.id).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value

    def validate(self, data):
        """Validate LRN requirement for students and weights for tutors."""
        role = data.get('role', getattr(self.instance, 'role', None))
        request = self.context.get('request')
        if request and getattr(request.user, 'role', None) == 'tutor':
            forbidden = {'role', 'assigned_tutor', 'is_active', 'assessment_weight', 'weekly_tasks_weight', 'attendance_weight'}
            if any(field in data for field in forbidden):
                raise serializers.ValidationError(
                    {'detail': 'Tutors may only edit student personal details.'}
                )

        if role == 'student':
            lrn = data.get('lrn', getattr(self.instance, 'lrn', None))
            if not lrn:
                raise serializers.ValidationError(
                    {'lrn': 'LRN is required for student accounts.'}
                )
            if not lrn.isdigit() or len(lrn) != 12:
                raise serializers.ValidationError(
                    {'lrn': 'LRN must be exactly 12 digits.'}
                )
        else:
            # Clear LRN for non-student roles
            data['lrn'] = None

        if role == 'tutor':
            aw = data.get('assessment_weight', getattr(self.instance, 'assessment_weight', 50))
            ww = data.get('weekly_tasks_weight', getattr(self.instance, 'weekly_tasks_weight', 30))
            atw = data.get('attendance_weight', getattr(self.instance, 'attendance_weight', 20))
            if aw + ww + atw != 100:
                raise serializers.ValidationError(
                    {'assessment_weight': 'Grading weights (Assessment + Weekly Tasks + Attendance) must sum to 100%.'}
                )
        return data


class ResetPasswordSerializer(serializers.Serializer):
    """Serializer for resetting a user's password (admin-side)."""

    new_password = serializers.CharField(min_length=8, write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError(
                {'confirm_password': 'Passwords do not match.'}
            )
        # Run Django's full AUTH_PASSWORD_VALIDATORS suite
        try:
            validate_password(data['new_password'])
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'new_password': list(exc.messages)})
        return data


class UserStatsSerializer(serializers.Serializer):
    """Serializer for dashboard stats cards."""

    total_users = serializers.IntegerField()
    active_users = serializers.IntegerField()
    inactive_users = serializers.IntegerField()
    admins = serializers.IntegerField()
    principals = serializers.IntegerField()
    faculty = serializers.IntegerField()
    tutors = serializers.IntegerField()
    students = serializers.IntegerField()
