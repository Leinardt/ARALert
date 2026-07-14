"""
Users API Serializers.
Handles validation for user CRUD, password reset, and dashboard stats.
"""

from rest_framework import serializers
from apps.accounts.models import User


class UserListSerializer(serializers.ModelSerializer):
    """Serializer for user list display (table view)."""

    full_name = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'full_name', 'first_name', 'last_name',
            'username', 'email', 'role', 'lrn', 'status', 'is_active',
            'date_joined', 'last_login',
        ]

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_status(self, obj):
        return 'Active' if obj.is_active else 'Inactive'


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a new user with password confirmation."""

    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    confirm_password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'username', 'email',
            'password', 'confirm_password', 'role', 'lrn', 'is_active',
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
        """Check for duplicate usernames."""
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('A user with this username already exists.')
        return value

    def validate_email(self, value):
        """Check for duplicate emails."""
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value

    def validate(self, data):
        """Validate password confirmation and LRN requirement."""
        password = data.get('password')
        confirm_password = data.get('confirm_password')

        # Auto-generate default password if not provided or empty
        if not password:
            first_name = data.get('first_name', '')
            last_name = data.get('last_name', '')
            username = data.get('username', '')

            # Extract alphanumeric characters and format capitalization
            clean_last = "".join(c for c in last_name if c.isalnum()).capitalize()
            clean_first = "".join(c for c in first_name if c.isalnum()).capitalize()
            first_initial = clean_first[0] if clean_first else 'X'
            clean_username = "".join(c for c in username if c.isalnum())

            generated_pwd = f"{clean_last}{first_initial}@{clean_username}"
            if len(generated_pwd) < 8:
                generated_pwd = generated_pwd + "123"[:8 - len(generated_pwd)]

            data['password'] = generated_pwd
            data['confirm_password'] = generated_pwd
        else:
            if password != confirm_password:
                raise serializers.ValidationError(
                    {'confirm_password': 'Passwords do not match.'}
                )
            if len(password) < 8:
                raise serializers.ValidationError(
                    {'password': 'Password must be at least 8 characters.'}
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
        """Create user with hashed password."""
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for editing a user (no password field)."""

    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'username', 'email',
            'role', 'lrn', 'is_active',
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
        """Validate LRN requirement for students."""
        role = data.get('role', getattr(self.instance, 'role', None))
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
        return data


class ResetPasswordSerializer(serializers.Serializer):
    """Serializer for resetting a user's password."""

    new_password = serializers.CharField(min_length=8, write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError(
                {'confirm_password': 'Passwords do not match.'}
            )
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
