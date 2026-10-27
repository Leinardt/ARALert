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
SECTION_PATTERN = re.compile(r"^[a-zA-Z0-9\s\-,]+$")
PHONE_PATTERN = re.compile(r"^[0-9+\-\s()]+$")
DANGEROUS_INJECTION_PATTERN = re.compile(
    r"(--|;|\/\*|\*\/|@@|<script|<\/script>)",
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
    baseline_program = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'full_name', 'first_name', 'middle_name', 'last_name',
            'username', 'email', 'role', 'is_superuser', 'lrn', 'status', 'is_active',
            'date_joined', 'last_login', 'has_logged_in',
            'assigned_tutor', 'assigned_tutor_name', 'assessment_weight', 'weekly_tasks_weight',
            'attendance_weight', 'aral_level', 'subject', 'tutor_type', 'is_available_for_students',
            'grade_level', 'parent_guardian_name', 'contact_number', 'has_bosy', 'has_mosy', 'has_eosy', 'has_summer',
            'baseline_program'
        ]

    def get_baseline_program(self, obj):
        if getattr(obj, 'role', None) == 'student':
            request = self.context.get('request')
            enr_map = getattr(request, '_cached_enrollments_map', None)
            if enr_map is not None:
                enr = enr_map.get(obj.id)
                if enr and enr.program:
                    return enr.program.lower()
                return (getattr(obj, 'aral_level', None) or 'basic').lower()

            try:
                from apps.academics.models import StudentEnrollment, SchoolYear
                active_sy = getattr(request, '_cached_active_sy', None) if request else None
                if not active_sy:
                    active_sy = SchoolYear.objects.filter(is_active=True).first()
                    if request:
                        request._cached_active_sy = active_sy
                if active_sy:
                    enr = StudentEnrollment.objects.filter(student=obj, school_year=active_sy).first()
                    if enr and enr.program:
                        return enr.program.lower()
            except Exception:
                pass
            return (getattr(obj, 'aral_level', None) or 'basic').lower()
        return None

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_status(self, obj):
        return 'Active' if obj.is_active else 'Inactive'

    def get_assigned_tutor_name(self, obj):
        if obj.role == 'student':
            if obj.assigned_tutor:
                return obj.assigned_tutor.get_full_name()

            request = self.context.get('request')
            enr_map = getattr(request, '_cached_enrollments_map', None)
            hist_map = getattr(request, '_cached_history_map', None)
            if enr_map is not None:
                enr = enr_map.get(obj.id)
                if enr and enr.assigned_tutor:
                    return enr.assigned_tutor.get_full_name()
                if hist_map and obj.id in hist_map and hist_map[obj.id].tutor:
                    return hist_map[obj.id].tutor.get_full_name()
                return 'TBA'

            try:
                from apps.academics.models import StudentEnrollment, TutorAssignmentHistory
                hist = TutorAssignmentHistory.objects.filter(
                    student=obj, is_active=True
                ).order_by('-start_date', '-id').first()
                if hist and hist.tutor:
                    return hist.tutor.get_full_name()

                enr = StudentEnrollment.objects.filter(
                    student=obj, assigned_tutor__isnull=False
                ).order_by('-school_year__start_date', '-id').first()
                if enr and enr.assigned_tutor:
                    return enr.assigned_tutor.get_full_name()
            except Exception:
                pass
            return 'TBA'
        return None

    def get_has_logged_in(self, obj):
        return bool(obj.google_sub or obj.last_login)


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for pre-creating a staff account or enrolling a student."""

    username = serializers.CharField(write_only=True, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    aral_level = serializers.CharField(required=False, allow_null=True, allow_blank=True, default='basic')
    tutor_type = serializers.CharField(required=False, allow_null=True, allow_blank=True, default='basic')
    grade_level = serializers.CharField(required=False, allow_null=True, allow_blank=True, default='')
    subject = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None)
    assigned_tutor = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role='tutor', is_superuser=False),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = User
        fields = [
            'first_name', 'middle_name', 'last_name', 'username', 'email',
            'role', 'is_superuser', 'lrn', 'is_active',
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
        v = sanitize_input_text(value).strip()
        if v:
            if not v.isdigit() or len(v) != 11:
                raise serializers.ValidationError('Contact number must be exactly 11 digits (e.g., 09123456789).')
            if DANGEROUS_INJECTION_PATTERN.search(v):
                raise serializers.ValidationError('Invalid characters detected.')
        return v

    def validate_grade_level(self, value):
        if not value:
            return ''
        v = sanitize_input_text(value)
        if v and (not SECTION_PATTERN.match(v) or DANGEROUS_INJECTION_PATTERN.search(v)):
            raise serializers.ValidationError('Grade level / Section contains invalid characters.')
        return v.upper()

    def validate_aral_level(self, value):
        if not value:
            return 'basic'
        v = sanitize_input_text(value).lower()
        if v in ('basic_plus', 'basic,plus') or ('basic' in v and 'plus' in v):
            return 'basic,plus'
        valid_parts = {'basic', 'plus', 'graduated'}
        parts = [p.strip() for p in v.replace('_', ',').split(',') if p.strip()]
        if any(p not in valid_parts for p in parts):
            raise serializers.ValidationError('Invalid ARAL level.')
        return v

    def validate_tutor_type(self, value):
        if not value:
            return 'basic'
        v = sanitize_input_text(value).lower()
        if v in ('basic_plus', 'basic,plus') or ('basic' in v and 'plus' in v):
            return 'basic,plus'
        valid_types = {'basic', 'plus', 'basic_plus', 'basic,plus'}
        if v not in valid_types:
            raise serializers.ValidationError('Invalid tutor type.')
        return v

    def validate_role(self, value):
        """Allow roles and permit None/empty if is_superuser is set."""
        if value is None or value == '' or value == 'superadmin':
            return None
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
        elif role == 'tutor':
            data['lrn'] = None
            data['assigned_tutor'] = None
            data['parent_guardian_name'] = ''
            data['contact_number'] = ''
            if not data.get('email'):
                raise serializers.ValidationError({'email': 'Email is required for staff accounts.'})
        else:
            # Faculty, Principal, Admin, SuperAdmin:
            # Strictly no LRN, tutor assignment, subject, section/grade, or aral level
            data['lrn'] = None
            data['assigned_tutor'] = None
            data['parent_guardian_name'] = ''
            data['contact_number'] = ''
            data['subject'] = None
            data['grade_level'] = ''
            data['aral_level'] = 'basic'
            data['tutor_type'] = 'basic'
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
        is_superuser = validated_data.get('is_superuser', False)
        email = validated_data.get('email', '').strip().lower()

        if not email and role == 'student':
            email = f"student-{validated_data.get('lrn')}@aralert.local"

        validated_data['email'] = email
        validated_data['username'] = email
        validated_data['is_active'] = True

        if is_superuser:
            validated_data['role'] = None
            validated_data['is_staff'] = True
            validated_data['is_superuser'] = True

        user = User(**validated_data)
        user.set_unusable_password()
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for editing a user profile or assigning a tutor."""

    aral_level = serializers.CharField(required=False, allow_null=True, allow_blank=True, default='basic')
    tutor_type = serializers.CharField(required=False, allow_null=True, allow_blank=True, default='basic')
    grade_level = serializers.CharField(required=False, allow_null=True, allow_blank=True, default='')
    lrn = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None)
    subject = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'first_name', 'middle_name', 'last_name', 'email', 'role',
            'is_active', 'assigned_tutor', 'assessment_weight',
            'weekly_tasks_weight', 'attendance_weight', 'aral_level', 'lrn', 'subject',
            'tutor_type', 'is_available_for_students',
            'grade_level', 'parent_guardian_name', 'contact_number', 'has_bosy', 'has_mosy', 'has_eosy', 'has_summer'
        ]
        extra_kwargs = {
            'lrn': {'validators': []},
        }

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
        v = sanitize_input_text(value).strip()
        if v:
            if not v.isdigit() or len(v) != 11:
                raise serializers.ValidationError('Contact number must be exactly 11 digits (e.g., 09123456789).')
            if DANGEROUS_INJECTION_PATTERN.search(v):
                raise serializers.ValidationError('Invalid characters detected.')
        return v

    def validate_grade_level(self, value):
        if not value:
            return ''
        v = sanitize_input_text(value)
        if v and (not SECTION_PATTERN.match(v) or DANGEROUS_INJECTION_PATTERN.search(v)):
            raise serializers.ValidationError('Grade level / Section contains invalid characters.')
        return v.upper()

    def validate_aral_level(self, value):
        if not value:
            return 'basic'
        v = sanitize_input_text(value).lower()
        if v in ('basic_plus', 'basic,plus') or ('basic' in v and 'plus' in v):
            return 'basic,plus'
        valid_parts = {'basic', 'plus', 'graduated'}
        parts = [p.strip() for p in v.replace('_', ',').split(',') if p.strip()]
        if any(p not in valid_parts for p in parts):
            raise serializers.ValidationError('Invalid ARAL level.')
        return v

    def validate_tutor_type(self, value):
        if not value:
            return 'basic'
        v = sanitize_input_text(value).lower()
        if v in ('basic_plus', 'basic,plus') or ('basic' in v and 'plus' in v):
            return 'basic,plus'
        valid_types = {'basic', 'plus', 'basic_plus', 'basic,plus'}
        if v not in valid_types:
            raise serializers.ValidationError('Invalid tutor type.')
        return v

    def validate_subject(self, value):
        if not value:
            return 'Filipino'
        v = sanitize_input_text(value).strip()
        parts = [p.strip() for p in v.replace(';', ',').split(',') if p.strip()]
        valid_map = {
            'filipino': 'Filipino',
            'reading': 'Filipino',
            'english': 'English',
            'science': 'Science',
            'math': 'Math',
        }
        cleaned = []
        for p in parts:
            matched = valid_map.get(p.lower())
            if matched and matched not in cleaned:
                cleaned.append(matched)

        if cleaned:
            combined = ', '.join(cleaned)
            if len(combined) <= 20:
                return combined
            return cleaned[0]
        return 'Filipino'

    def validate_lrn(self, value):
        if not value:
            return None
        v = str(value).strip()
        if not v.isdigit() or len(v) != 12:
            raise serializers.ValidationError('LRN must be exactly 12 digits (numbers only).')
        return v

    def validate(self, data):
        target_role = data.get('role', getattr(self.instance, 'role', None))
        if target_role == 'student':
            lrn = data.get('lrn', getattr(self.instance, 'lrn', None))
            if not lrn:
                raise serializers.ValidationError({'lrn': 'LRN is required for student accounts.'})
            lrn = str(lrn).strip()
            if not lrn.isdigit() or len(lrn) != 12:
                raise serializers.ValidationError({'lrn': 'LRN must be exactly 12 digits (numbers only).'})
            if User.objects.filter(lrn=lrn).exclude(pk=self.instance.pk).exists():
                raise serializers.ValidationError({'lrn': 'A student with this LRN already exists.'})
            data['lrn'] = lrn
        elif target_role == 'tutor':
            data['lrn'] = None
            data['assigned_tutor'] = None
            data['parent_guardian_name'] = ''
            data['contact_number'] = ''
        else:
            # For non-students and non-tutors (faculty, principal, admin, superadmin):
            # Strictly no LRN, tutor assignment, subject, section/grade, or aral level
            data['lrn'] = None
            data['assigned_tutor'] = None
            data['parent_guardian_name'] = ''
            data['contact_number'] = ''
            data['subject'] = None
            data['grade_level'] = None
            data['aral_level'] = None
            data['tutor_type'] = None
        return data

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
    """Full detail and list serializer for student and staff profile edit requests."""

    student_name = serializers.SerializerMethodField()
    requested_by_name = serializers.SerializerMethodField()
    requested_by_role = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    reviewed_by_role = serializers.SerializerMethodField()
    reviewed_by_first_name = serializers.SerializerMethodField()

    current_first_name = serializers.SerializerMethodField()
    current_middle_name = serializers.SerializerMethodField()
    current_last_name = serializers.SerializerMethodField()
    current_lrn = serializers.SerializerMethodField()
    current_aral_level = serializers.SerializerMethodField()

    class Meta:
        model = StudentEditRequest
        fields = [
            'id',
            'request_type',
            'required_reviewer_role',
            'student',
            'student_name',
            'current_first_name',
            'current_middle_name',
            'current_last_name',
            'current_lrn',
            'current_aral_level',
            'requested_by',
            'requested_by_name',
            'requested_by_role',
            'proposed_first_name',
            'proposed_middle_name',
            'proposed_last_name',
            'proposed_lrn',
            'proposed_aral_level',
            'status',
            'reviewed_by',
            'reviewed_by_name',
            'reviewed_by_role',
            'reviewed_by_first_name',
            'rejection_reason',
            'created_at',
            'reviewed_at',
        ]

    def get_student_name(self, obj):
        if obj.student:
            return obj.student.get_full_name()
        return obj.requested_by.get_full_name() if obj.requested_by else ''

    def get_requested_by_name(self, obj):
        return obj.requested_by.get_full_name() if obj.requested_by else ''

    def get_requested_by_role(self, obj):
        return getattr(obj.requested_by, 'role', 'admin') if obj.requested_by else ''

    def get_reviewed_by_name(self, obj):
        return obj.reviewed_by.get_full_name() if obj.reviewed_by else None

    def get_reviewed_by_role(self, obj):
        if not obj.reviewed_by:
            return None
        if obj.reviewed_by.is_superuser:
            return 'Super Admin'
        return 'Admin'

    def get_reviewed_by_first_name(self, obj):
        if not obj.reviewed_by:
            return None
        fn = (obj.reviewed_by.first_name or '').strip()
        if not fn and obj.reviewed_by.get_full_name():
            fn = obj.reviewed_by.get_full_name().split()[0]
        return fn

    def _get_before_snapshot(self, obj):
        if hasattr(obj, '_cached_before_snapshot'):
            return obj._cached_before_snapshot

        snapshot = None
        if obj.reason and obj.reason.strip().startswith('{'):
            try:
                import json
                data = json.loads(obj.reason)
                if isinstance(data, dict) and 'before' in data:
                    snapshot = data['before']
            except Exception:
                pass

        if not snapshot:
            target = obj.student or obj.requested_by
            if obj.status == 'pending':
                snapshot = {
                    'first_name': getattr(target, 'first_name', '') or '',
                    'middle_name': getattr(target, 'middle_name', '') or '',
                    'last_name': getattr(target, 'last_name', '') or '',
                    'lrn': getattr(target, 'lrn', '') or '',
                    'aral_level': getattr(target, 'aral_level', '') or '',
                }
            else:
                # For approved/rejected requests without a frozen snapshot, check the creation audit log
                try:
                    request = self.context.get('request')
                    audit_map = getattr(request, '_cached_edit_audit_logs', None)
                    sub_log = None
                    if audit_map is not None:
                        sub_log = audit_map.get(str(obj.id))
                    else:
                        from apps.accounts.models import AuditLog
                        sub_log = AuditLog.objects.filter(
                            action='PROFILE_EDIT_REQUEST_SUBMITTED',
                            details__request_id=str(obj.id),
                        ).first()
                    if sub_log:
                        target_name = sub_log.details.get('target_name', '')
                        if obj.request_type == 'student' and ',' in target_name:
                            parts = target_name.split(',', 1)
                            ln = parts[0].strip()
                            given = parts[1].strip().split()
                            fn = given[0] if given else ''
                            mi = given[1].rstrip('.') if len(given) > 1 else ''
                            snapshot = {
                                'first_name': fn or getattr(target, 'first_name', '') or '',
                                'middle_name': mi or getattr(target, 'middle_name', '') or '',
                                'last_name': ln or getattr(target, 'last_name', '') or '',
                                'lrn': getattr(target, 'lrn', '') or '',
                                'aral_level': getattr(target, 'aral_level', '') or '',
                            }
                        elif target_name:
                            parts = target_name.strip().split()
                            if len(parts) >= 2:
                                fn = parts[0]
                                ln = parts[-1]
                                mn = ' '.join(parts[1:-1]).rstrip('.')
                                snapshot = {
                                    'first_name': fn,
                                    'middle_name': mn,
                                    'last_name': ln,
                                    'lrn': getattr(target, 'lrn', '') or '',
                                    'aral_level': getattr(target, 'aral_level', '') or '',
                                }
                except Exception:
                    pass

                if not snapshot:
                    snapshot = {
                        'first_name': getattr(target, 'first_name', '') or '',
                        'middle_name': getattr(target, 'middle_name', '') or '',
                        'last_name': getattr(target, 'last_name', '') or '',
                        'lrn': getattr(target, 'lrn', '') or '',
                        'aral_level': getattr(target, 'aral_level', '') or '',
                    }

                # Cache into obj.reason permanently if it was missing
                if snapshot and not (obj.reason and obj.reason.strip().startswith('{')):
                    try:
                        import json
                        obj.reason = json.dumps({'before': snapshot, 'reason': obj.reason or ''})
                        obj.save(update_fields=['reason'])
                    except Exception:
                        pass

        obj._cached_before_snapshot = snapshot
        return snapshot

    def get_current_first_name(self, obj):
        snap = self._get_before_snapshot(obj)
        return snap.get('first_name', '') if snap else ''

    def get_current_middle_name(self, obj):
        snap = self._get_before_snapshot(obj)
        return snap.get('middle_name', '') if snap else ''

    def get_current_last_name(self, obj):
        snap = self._get_before_snapshot(obj)
        return snap.get('last_name', '') if snap else ''

    def get_current_lrn(self, obj):
        snap = self._get_before_snapshot(obj)
        return snap.get('lrn', '') if snap else ''

    def get_current_aral_level(self, obj):
        snap = self._get_before_snapshot(obj)
        return snap.get('aral_level', '') if snap else ''


class StudentEditRequestCreateSerializer(serializers.ModelSerializer):
    """Serializer for submitting student and staff profile edit requests."""

    student = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True,
        default=None,
    )

    class Meta:
        model = StudentEditRequest
        fields = [
            'student',
            'request_type',
            'required_reviewer_role',
            'proposed_first_name',
            'proposed_middle_name',
            'proposed_last_name',
            'proposed_lrn',
            'proposed_aral_level',
        ]
        extra_kwargs = {
            'student': {'required': False, 'allow_null': True},
            'request_type': {'required': False},
            'required_reviewer_role': {'required': False},
            'proposed_aral_level': {'required': False},
        }

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

    def validate(self, data):
        student = data.get('student')
        request_type = data.get('request_type', 'student')

        if request_type == 'student' and student:
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

