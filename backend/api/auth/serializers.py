"""
Auth API Serializers.
"""

import re

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import User
from services.token_service import is_token_valid

# Allowed characters for username: letters, digits, underscore, hyphen, dot
_USERNAME_RE = re.compile(r'^[a-zA-Z0-9._-]+$')


class LoginSerializer(serializers.Serializer):
    """Serializer for login: accepts username or email + password."""

    username_or_email = serializers.CharField(
        required=True,
        help_text='Username or email address.',
    )
    password = serializers.CharField(
        required=True,
        write_only=True,
    )
    remember_me = serializers.BooleanField(
        default=False,
        required=False,
    )

    def validate(self, data):
        username_or_email = data.get('username_or_email', '').strip()
        password = data.get('password', '')

        if not username_or_email or not password:
            raise serializers.ValidationError(
                'Both username/email and password are required.'
            )

        # Use our custom EmailOrUsernameBackend
        user = authenticate(
            request=self.context.get('request'),
            username=username_or_email,
            password=password,
        )

        if user is None:
            raise serializers.ValidationError(
                'Invalid username/email or password.'
            )

        if not user.is_active:
            raise serializers.ValidationError(
                'This account has been deactivated. Please contact your administrator.'
            )

        data['user'] = user
        return data


class UserProfileSerializer(serializers.ModelSerializer):
    """Read-only serializer for the authenticated user's profile."""

    full_name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'full_name', 'role', 'is_active', 'is_superuser',
            'date_joined', 'last_login', 'avatar', 'mfa_enabled',
        ]
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_avatar(self, obj):
        if obj.avatar:
            request = self.context.get('request')
            avatar_url = obj.avatar.url
            if request is not None:
                return request.build_absolute_uri(avatar_url)
            return avatar_url
        return None


class StudentLoginSerializer(serializers.Serializer):
    """Serializer for student login using Full Name and LRN."""

    full_name = serializers.CharField(required=True)
    lrn = serializers.CharField(required=True)

    def validate(self, data):
        full_name = data.get('full_name', '').strip()
        lrn = data.get('lrn', '').strip()

        if not full_name or not lrn:
            raise serializers.ValidationError(
                'Both Full Name and LRN are required.'
            )

        try:
            # Query by LRN and student role
            user = User.objects.get(lrn=lrn, role='student')
        except User.DoesNotExist:
            raise serializers.ValidationError(
                'Invalid Full Name or LRN.'
            )

        # Validate that the full name matches (space-insensitive & case-insensitive)
        entered_name_clean = " ".join(full_name.split()).lower()
        db_name_clean = " ".join(user.get_full_name().split()).lower()
        if entered_name_clean != db_name_clean:
            raise serializers.ValidationError(
                'Invalid Full Name or LRN.'
            )

        if not user.is_active:
            raise serializers.ValidationError(
                'This account has been deactivated. Please contact your administrator.'
            )

        data['user'] = user
        return data


def _run_password_validators(password: str, user=None) -> None:
    """Run Django AUTH_PASSWORD_VALIDATORS and raise DRF ValidationError on failure."""
    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError({'password': list(exc.messages)})


class ActivateAccountSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)
    username = serializers.CharField(required=True, min_length=3, max_length=150)
    password = serializers.CharField(required=True, write_only=True, min_length=8)
    confirm_password = serializers.CharField(required=True, write_only=True)

    def validate_username(self, value):
        value = value.strip()
        if not _USERNAME_RE.match(value):
            raise serializers.ValidationError(
                'Username may only contain letters, digits, dots, underscores, and hyphens.'
            )
        return value

    def validate(self, data):
        token = data.get('token')
        user = User.objects.filter(activation_token=token).first()
        if not user:
            raise serializers.ValidationError({'token': 'Invalid or already used activation token.'})
        if not is_token_valid(token, user.activation_token_expires_at):
            raise serializers.ValidationError({'token': 'This activation link has expired. Please contact your administrator to resend the invitation.'})
        if not user.password_setup_required:
            raise serializers.ValidationError({'token': 'This account has already been set up. Please log in.'})
        if data.get('password') != data.get('confirm_password'):
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})

        username = data.get('username', '').strip()
        if User.objects.filter(username__iexact=username).exists():
            raise serializers.ValidationError({'username': 'This username is already taken. Please choose a different one.'})

        # Run Django password validators (common-password, numeric-only, similarity)
        _run_password_validators(data.get('password'), user=user)

        data['username'] = username
        data['user'] = user
        return data


class ProfileUpdateSerializer(serializers.Serializer):
    """Allow only a small safe set of profile updates from the user-facing profile endpoint.

    Users are NOT allowed to change their email or full name via this endpoint; those
    attributes are read-only for regular users and must be changed by admins if needed.
    When changing password, the user must supply their current password to confirm identity.
    """
    username = serializers.CharField(required=False, allow_blank=False)
    current_password = serializers.CharField(required=False, write_only=True, allow_blank=False)
    password = serializers.CharField(required=False, write_only=True, allow_blank=False, min_length=8)
    confirm_password = serializers.CharField(required=False, write_only=True, allow_blank=False)
    avatar = serializers.FileField(required=False, allow_null=True)

    def validate_username(self, value):
        value = value.strip()
        if not _USERNAME_RE.match(value):
            raise serializers.ValidationError(
                'Username may only contain letters, digits, dots, underscores, and hyphens.'
            )
        user = self.context.get('user')
        if not user:
            return value
        if User.objects.filter(username__iexact=value).exclude(id=user.id).exists():
            raise serializers.ValidationError('This username is already taken.')
        return value

    def validate(self, data):
        user = self.context.get('user')
        password = data.get('password')
        confirm_password = data.get('confirm_password')
        current_password = data.get('current_password')

        if password or confirm_password or current_password:
            # All three must be present when changing password
            if not current_password:
                raise serializers.ValidationError(
                    {'current_password': 'Please enter your current password to set a new one.'}
                )
            if not password:
                raise serializers.ValidationError(
                    {'password': 'Please enter a new password.'}
                )
            if not confirm_password:
                raise serializers.ValidationError(
                    {'confirm_password': 'Please confirm your new password.'}
                )
            # Verify current password
            if user and not user.check_password(current_password):
                raise serializers.ValidationError(
                    {'current_password': 'Your current password is incorrect.'}
                )
            if password != confirm_password:
                raise serializers.ValidationError(
                    {'confirm_password': 'Passwords do not match.'}
                )
            # Run Django password validators
            _run_password_validators(password, user=user)

        return data

    def validate_avatar(self, value):
        if value is None:
            return value
        allowed_types = ['image/jpeg', 'image/png', 'image/webp']
        if getattr(value, 'content_type', None) not in allowed_types:
            raise serializers.ValidationError('Only JPEG, PNG, and WEBP images are allowed.')
        max_size = 2 * 1024 * 1024  # 2MB
        if value.size > max_size:
            raise serializers.ValidationError('Avatar images must be 2MB or smaller.')
        # Basic extension check as a second layer
        allowed_extensions = ('.jpg', '.jpeg', '.png', '.webp')
        name = getattr(value, 'name', '')
        if name and not name.lower().endswith(allowed_extensions):
            raise serializers.ValidationError('Only JPEG, PNG, and WEBP images are allowed.')
        return value

    def update(self, instance, validated_data):
        # Only allow username, password and avatar updates from this endpoint
        if 'username' in validated_data:
            instance.username = validated_data['username']
        if validated_data.get('password'):
            instance.set_password(validated_data['password'])
        if 'avatar' in validated_data:
            instance.avatar = validated_data['avatar']

        update_fields = [f for f in ['username', 'password', 'avatar'] if f in validated_data]
        instance.save(update_fields=update_fields)
        return instance


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

    def validate(self, data):
        # Resolve the user internally but do NOT reveal whether the email exists.
        # The view will only send the email if user is not None.
        try:
            user = User.objects.get(email__iexact=data['email'])
        except User.DoesNotExist:
            user = None
        data['user'] = user
        return data


class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True, min_length=8)
    confirm_password = serializers.CharField(required=True, write_only=True)

    def validate(self, data):
        token = data.get('token')
        user = User.objects.filter(password_reset_token=token).first()
        if not user:
            raise serializers.ValidationError({'token': 'Invalid or already used password reset token.'})
        if not is_token_valid(token, user.password_reset_token_expires_at):
            raise serializers.ValidationError({'token': 'This password reset link has expired. Please request a new one.'})
        if data.get('password') != data.get('confirm_password'):
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})

        # Run Django password validators
        _run_password_validators(data.get('password'), user=user)

        data['user'] = user
        return data


class MFAToggleSerializer(serializers.Serializer):
    enable = serializers.BooleanField(required=True)


class VerifyOTPSerializer(serializers.Serializer):
    user_id = serializers.UUIDField(required=True)
    code = serializers.CharField(required=True, min_length=6, max_length=6)
    remember_device = serializers.BooleanField(default=False, required=False)
    device_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_code(self, value):
        if not value.isdigit():
            raise serializers.ValidationError('The verification code must consist of 6 digits.')
        return value

    def validate(self, data):
        # Basic validation only; view will enforce OTP lifecycle checks.
        return data
