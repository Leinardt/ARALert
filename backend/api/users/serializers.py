"""
Users API Serializers.
Handles validation for user CRUD, bulk tutor assignment, and directory listings.
"""

import re
import uuid

from django.conf import settings
from rest_framework import serializers

from apps.accounts.models import User, StudentEditRequest

NAME_PATTERN = re.compile(r"^[a-zA-Z\s.\-ñÑ']+$")
SECTION_PATTERN = re.compile(r"^[a-zA-Z0-9\s\-]+$")
PHONE_PATTERN = re.compile(r"^[0-9+\-\s()]+$")
DANGEROUS_INJECTION_PATTERN = re.compile(
    r"(--|;|\/\*|\*\/|@@|char|nchar|varchar|nvarchar|alter|begin|cast|create|cursor|declare|delete|drop|end|exec|execute|fetch|insert|kill|open|select|sys|sysobjects|syscolumns|table|update|<script|<\/script>)",
    re.IGNORECASE
)


def sanitize_input_text(value: str) -> str:
    """Strip HTML tags and normalize whitespace."""
    if not value:
        return ''
    cleaned = re.sub(r'<[^>]*>', '', str(value))
    return re.sub(r'\s+', ' ', cleaned).strip()


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
            'attendance_weight', 'aral_level', 'subject', 'tutor_type', 'is_available_for_students',
            'grade_level', 'parent_guardian_name', 'contact_number', 'has_bosy', 'has_mosy', 'has_eosy', 'has_summer'
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
            'aral_level', 'subject', 'tutor_type', 'is_available_for_students',
            'grade_level', 'parent_guardian_name', 'contact_number', 'has_bosy', 'has_mosy', 'has_eosy', 'has_summer'
        ]

    def validate_first_name(self, value):
        v = sanitize_input_text(value)
        if not v:
            raise serializers.ValidationError('First name cannot be empty.')
        if not NAME_PATTERN.match(v) or DANGEROUS_INJECTION_PATTERN.search(v):
            raise serializers.ValidationError('First name can only contain letters, spaces, hyphens, and periods.')
        return v.upper()

    def validate_middle_name(self, value):
        if not value:
            return ''
        v = sanitize_input_text(value)
        if v and (not NAME_PATTERN.match(v) or DANGEROUS_INJECTION_PATTERN.search(v)):
            raise serializers.ValidationError('Middle name can only contain letters, spaces, hyphens, and periods.')
        return v.upper()

    def validate_last_name(self, value):
        v = sanitize_input_text(value)
        if not v:
            raise serializers.ValidationError('Last name cannot be empty.')
        if not NAME_PATTERN.match(v) or DANGEROUS_INJECTION_PATTERN.search(v):
            raise serializers.ValidationError('Last name can only contain letters, spaces, hyphens, and periods.')
        return v.upper()

    def validate_parent_guardian_name(self, value):
        if not value:
            return ''
        v = sanitize_input_text(value)
        if v and (not NAME_PATTERN.match(v) or DANGEROUS_INJECTION_PATTERN.search(v)):
            raise serializers.ValidationError('Parent / Guardian name can only contain letters, spaces, hyphens, and periods.')
        return v.upper()

    def validate_contact_number(self, value):
        if not value:
            return ''
        v = sanitize_input_text(value)
        if v and (not PHONE_PATTERN.match(v) or DANGEROUS_INJECTION_PATTERN.search(v)):
            raise serializers.ValidationError('Contact number can only contain digits, spaces, hyphens, and plus sign (+).')
        return v

    def validate_grade_level(self, value):
        if not value:
            return ''
        v = sanitize_input_text(value)
        if v and (not SECTION_PATTERN.match(v) or DANGEROUS_INJECTION_PATTERN.search(v)):
            raise serializers.ValidationError('Grade level / Section contains invalid characters.')
        return v.upper()

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
                raise serializers.ValidationError({'lrn': 'LRN must be exactly 12 digits (numbers only).'})
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
            'weekly_tasks_weight', 'attendance_weight', 'aral_level', 'lrn', 'subject',
            'tutor_type', 'is_available_for_students',
            'grade_level', 'parent_guardian_name', 'contact_number', 'has_bosy', 'has_mosy', 'has_eosy', 'has_summer'
        ]

    def validate_first_name(self, value):
        v = sanitize_input_text(value)
        if not v:
            raise serializers.ValidationError('First name cannot be empty.')
        if not NAME_PATTERN.match(v) or DANGEROUS_INJECTION_PATTERN.search(v):
            raise serializers.ValidationError('First name can only contain letters, spaces, hyphens, and periods.')
        return v.upper()

    def validate_middle_name(self, value):
        if not value:
            return ''
        v = sanitize_input_text(value)
        if v and (not NAME_PATTERN.match(v) or DANGEROUS_INJECTION_PATTERN.search(v)):
            raise serializers.ValidationError('Middle name can only contain letters, spaces, hyphens, and periods.')
        return v.upper()

    def validate_last_name(self, value):
        v = sanitize_input_text(value)
        if not v:
            raise serializers.ValidationError('Last name cannot be empty.')
        if not NAME_PATTERN.match(v) or DANGEROUS_INJECTION_PATTERN.search(v):
            raise serializers.ValidationError('Last name can only contain letters, spaces, hyphens, and periods.')
        return v.upper()

    def validate_parent_guardian_name(self, value):
        if not value:
            return ''
        v = sanitize_input_text(value)
        if v and (not NAME_PATTERN.match(v) or DANGEROUS_INJECTION_PATTERN.search(v)):
            raise serializers.ValidationError('Parent / Guardian name can only contain letters, spaces, hyphens, and periods.')
        return v.upper()

    def validate_contact_number(self, value):
        if not value:
            return ''
        v = sanitize_input_text(value)
        if v and (not PHONE_PATTERN.match(v) or DANGEROUS_INJECTION_PATTERN.search(v)):
            raise serializers.ValidationError('Contact number can only contain digits, spaces, hyphens, and plus sign (+).')
        return v

    def validate_grade_level(self, value):
        if not value:
            return ''
        v = sanitize_input_text(value)
        if v and (not SECTION_PATTERN.match(v) or DANGEROUS_INJECTION_PATTERN.search(v)):
            raise serializers.ValidationError('Grade level / Section contains invalid characters.')
        return v.upper()

    def validate_lrn(self, value):
        if value:
            v = str(value).strip()
            if not v.isdigit() or len(v) != 12:
                raise serializers.ValidationError('LRN must be exactly 12 digits (numbers only).')
            return v
        return value

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


class StudentEditRequestSerializer(serializers.ModelSerializer):
    """Full detail and list serializer for student edit requests."""

    student_name = serializers.SerializerMethodField()
    requested_by_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()

    current_first_name = serializers.CharField(source='student.first_name', read_only=True)
    current_middle_name = serializers.CharField(source='student.middle_name', read_only=True)
    current_last_name = serializers.CharField(source='student.last_name', read_only=True)
    current_lrn = serializers.CharField(source='student.lrn', read_only=True)
    current_aral_level = serializers.CharField(source='student.aral_level', read_only=True)

    class Meta:
        model = StudentEditRequest
        fields = [
            'id',
            'student',
            'student_name',
            'current_first_name',
            'current_middle_name',
            'current_last_name',
            'current_lrn',
            'current_aral_level',
            'requested_by',
            'requested_by_name',
            'proposed_first_name',
            'proposed_middle_name',
            'proposed_last_name',
            'proposed_lrn',
            'proposed_aral_level',
            'reason',
            'status',
            'reviewed_by',
            'reviewed_by_name',
            'rejection_reason',
            'created_at',
            'reviewed_at',
        ]

    def get_student_name(self, obj):
        return obj.student.get_full_name() if obj.student else ''

    def get_requested_by_name(self, obj):
        return obj.requested_by.get_full_name() if obj.requested_by else ''

    def get_reviewed_by_name(self, obj):
        return obj.reviewed_by.get_full_name() if obj.reviewed_by else None


class StudentEditRequestCreateSerializer(serializers.ModelSerializer):
    """Serializer for tutor submission of student edit request."""

    class Meta:
        model = StudentEditRequest
        fields = [
            'student',
            'proposed_first_name',
            'proposed_middle_name',
            'proposed_last_name',
            'proposed_lrn',
            'proposed_aral_level',
            'reason',
        ]

    def validate_proposed_first_name(self, value):
        v = value.strip().upper()
        if not v:
            raise serializers.ValidationError('Proposed first name cannot be empty.')
        return v

    def validate_proposed_middle_name(self, value):
        return value.strip().upper() if value else ''

    def validate_proposed_last_name(self, value):
        v = value.strip().upper()
        if not v:
            raise serializers.ValidationError('Proposed last name cannot be empty.')
        return v

    def validate_proposed_lrn(self, value):
        if value:
            v = str(value).strip()
            if not v.isdigit() or len(v) != 12:
                raise serializers.ValidationError('Proposed LRN must be exactly 12 digits.')
            return v
        return None

    def validate_reason(self, value):
        v = value.strip()
        if not v:
            raise serializers.ValidationError('A reason for the edit request is required.')
        return v

    def validate(self, data):
        student = data.get('student')
        if student.role != 'student':
            raise serializers.ValidationError({'student': 'Target user must be a student.'})

        # Check for existing pending request
        if StudentEditRequest.objects.filter(student=student, status='pending').exists():
            raise serializers.ValidationError({
                'student': f'There is already an active pending edit request for {student.get_full_name()}.'
            })

        proposed_lrn = data.get('proposed_lrn')
        if proposed_lrn and proposed_lrn != student.lrn:
            if User.objects.filter(lrn=proposed_lrn, role='student').exclude(id=student.id).exists():
                raise serializers.ValidationError({'proposed_lrn': 'A student with this LRN already exists.'})

        return data


class StudentEditRequestReviewSerializer(serializers.Serializer):
    """Serializer for admin review (approval / rejection)."""

    action = serializers.ChoiceField(choices=['approve', 'reject'])
    rejection_reason = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, data):
        if data.get('action') == 'reject' and not data.get('rejection_reason', '').strip():
            raise serializers.ValidationError({'rejection_reason': 'Please provide a reason for rejecting this request.'})
        return data

