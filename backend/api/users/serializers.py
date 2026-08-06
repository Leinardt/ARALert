"""
Users API Serializers.
Handles validation for user CRUD, bulk tutor assignment, and directory listings.
"""

import uuid

from django.conf import settings
from rest_framework import serializers

from apps.accounts.models import User


class UserListSerializer(serializers.ModelSerializer):
    """Serializer for user list display (table view)."""

    full_name = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    assigned_tutor_name = serializers.SerializerMethodField()
    has_logged_in = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'full_name', 'first_name', 'middle_name', 'last_name',
            'username', 'email', 'role', 'lrn', 'status', 'is_active',
            'date_joined', 'last_login', 'has_logged_in',
            'assigned_tutor', 'assigned_tutor_name', 'assessment_weight', 'weekly_tasks_weight',
            'attendance_weight', 'aral_level'
        ]

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_status(self, obj):
        return 'Active' if obj.is_active else 'Inactive'

    def get_assigned_tutor_name(self, obj):
        if obj.role == 'student':
            if obj.assigned_tutor:
                return obj.assigned_tutor.get_full_name()
            return 'TBA'
        return None

    def get_has_logged_in(self, obj):
        return bool(obj.google_sub or obj.last_login)


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for pre-creating a staff account or enrolling a student."""

    username = serializers.CharField(write_only=True, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    assigned_tutor = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role='tutor', is_superuser=False),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = User
        fields = [
            'first_name', 'middle_name', 'last_name', 'username', 'email',
            'role', 'lrn', 'is_active',
            'assigned_tutor', 'assessment_weight', 'weekly_tasks_weight', 'attendance_weight',
            'aral_level'
        ]

    def validate_role(self, value):
        """Prevent SuperAdmin role assignment via API."""
        allowed_roles = [r[0] for r in User.Role.choices]
        if value not in allowed_roles:
            raise serializers.ValidationError(
                f'Invalid role. Allowed roles: {", ".join(allowed_roles)}'
            )
        return value

    def validate_email(self, value):
        """Check for duplicate emails for staff roles."""
        value = value.strip().lower() if value else ''
        if value and User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value

    def validate(self, data):
        """Validate role and LRN requirement."""
        role = data.get('role')

        if role == 'student':
            lrn = data.get('lrn')
            if not lrn:
                raise serializers.ValidationError({'lrn': 'LRN is required for student accounts.'})
            lrn = str(lrn).strip()
            if not lrn.isdigit() or len(lrn) != 12:
                raise serializers.ValidationError({'lrn': 'LRN must be exactly 12 digits.'})
            if User.objects.filter(lrn=lrn, role='student').exists():
                raise serializers.ValidationError({'lrn': 'A student with this LRN already exists.'})
        else:
            data['lrn'] = None
            data['assigned_tutor'] = None
            if not data.get('email'):
                raise serializers.ValidationError({'email': 'Email is required for staff accounts.'})

        return data

    def create(self, validated_data):
        """
        Create a user account.
        Staff: created pre-registered with assigned role (log in via Google).
        Students: created with LRN (log in via Name + LRN). Can be assigned to a tutor or set to TBA.
        """
        role = validated_data.get('role')
        email = validated_data.get('email', '').strip().lower()

        if not email and role == 'student':
            email = f"student-{validated_data.get('lrn')}@aralert.local"

        validated_data['email'] = email
        validated_data['username'] = email
        validated_data['is_active'] = True

        user = User(**validated_data)
        user.set_unusable_password()
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for editing a user profile or assigning a tutor."""

    class Meta:
        model = User
        fields = [
            'first_name', 'middle_name', 'last_name', 'email', 'role',
            'is_active', 'assigned_tutor', 'assessment_weight',
            'weekly_tasks_weight', 'attendance_weight', 'aral_level', 'lrn'
        ]

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class BulkAssignTutorSerializer(serializers.Serializer):
    """Serializer for multi-selecting students and assigning them to a tutor (or clearing to TBA)."""

    student_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        help_text='List of Student User UUIDs to update.',
    )
    tutor_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text='UUID of the Tutor User to assign. Pass null or blank to clear assignment to TBA.',
    )

    def validate_tutor_id(self, value):
        if value:
            try:
                tutor = User.objects.get(id=value, role='tutor')
                return tutor
            except User.DoesNotExist:
                raise serializers.ValidationError('Selected tutor does not exist or is not a tutor.')
        return None
