"""
Auth API Serializers.
"""

from rest_framework import serializers
from django.contrib.auth import authenticate
from apps.accounts.models import User


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

