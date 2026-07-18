"""
Auth API Serializers.
"""

from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import User
from services.token_service import is_token_valid


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

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'full_name', 'role', 'is_active', 'is_superuser',
            'date_joined', 'last_login',
        ]
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.get_full_name()


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


class ActivateAccountSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)
    username = serializers.CharField(required=True, min_length=3)
    password = serializers.CharField(required=True, write_only=True, min_length=8)
    confirm_password = serializers.CharField(required=True, write_only=True)

    def validate(self, data):
        token = data.get('token')
        user = User.objects.filter(activation_token=token).first()
        if not user:
            raise serializers.ValidationError({'token': 'Invalid or already used activation token.'})
        if not is_token_valid(token, user.activation_token_expires_at):
            raise serializers.ValidationError({'token': 'This activation link has expired.'})
        if not user.password_setup_required:
            raise serializers.ValidationError({'token': 'This account is already set up.'})
        if data.get('password') != data.get('confirm_password'):
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        username = data.get('username', '').strip()
        if User.objects.filter(username__iexact=username).exists():
            raise serializers.ValidationError({'username': 'This username is already taken.'})
        data['username'] = username
        data['user'] = user
        return data


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

    def validate(self, data):
        try:
            user = User.objects.get(email__iexact=data['email'])
        except User.DoesNotExist:
            raise serializers.ValidationError({'email': 'No account was found for that email.'})
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
            raise serializers.ValidationError({'token': 'This password reset link has expired.'})
        if data.get('password') != data.get('confirm_password'):
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        data['user'] = user
        return data

