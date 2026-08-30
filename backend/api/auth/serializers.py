"""
Auth API Serializers.
Google OAuth token verification + 3-field student login.
"""

import logging

from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import AllowedEmail, User

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Google ID Token Verification
# ---------------------------------------------------------------------------

def _verify_google_id_token(id_token: str) -> dict:
    """
    Verify a Google ID token and return its payload.
    Requires google-auth to be installed.
    Falls back to a direct HTTP request to Google's tokeninfo endpoint when
    google-auth is not available (useful during development).
    """
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        from django.conf import settings

        client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '')
        if not client_id:
            raise ValueError('GOOGLE_CLIENT_ID is not configured in settings.')

        idinfo = google_id_token.verify_oauth2_token(
            id_token,
            google_requests.Request(),
            client_id,
        )
        return idinfo

    except ImportError:
        # Fallback: call Google's tokeninfo endpoint
        import urllib.request, json, urllib.error
        url = f'https://oauth2.googleapis.com/tokeninfo?id_token={id_token}'
        try:
            with urllib.request.urlopen(url, timeout=5) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            raise ValueError(f'Google token verification failed: {exc}') from exc


class GoogleLoginSerializer(serializers.Serializer):
    """Serializer that validates a Google ID token from the frontend."""

    id_token = serializers.CharField(required=True, write_only=True)

    def validate(self, data):
        token = data.get('id_token', '').strip()
        if not token:
            raise serializers.ValidationError({'id_token': 'Google ID token is required.'})

        try:
            payload = _verify_google_id_token(token)
        except (ValueError, Exception) as exc:
            logger.warning('Google ID token verification failed: %s', exc)
            raise serializers.ValidationError(
                {'id_token': 'Invalid or expired Google token. Please sign in again.'}
            )

        email = payload.get('email', '').strip().lower()
        if not email:
            raise serializers.ValidationError({'id_token': 'Could not retrieve email from Google token.'})

        if not payload.get('email_verified', False):
            raise serializers.ValidationError(
                {'id_token': 'Your Google email address has not been verified. Please verify it with Google first.'}
            )

        return {
            'email':       email,
            'sub':         payload.get('sub', ''),
            'given_name':  payload.get('given_name', ''),
            'family_name': payload.get('family_name', ''),
            'name':        payload.get('name', ''),
        }


# ---------------------------------------------------------------------------
# Student Login (3 name fields + LRN)
# ---------------------------------------------------------------------------

class StudentLoginSerializer(serializers.Serializer):
    """Serializer for student login using LRN (First Name, Middle Name, Last Name are optional)."""

    first_name  = serializers.CharField(required=False, allow_blank=True, default='')
    middle_name = serializers.CharField(required=False, allow_blank=True, default='')
    last_name   = serializers.CharField(required=False, allow_blank=True, default='')
    full_name   = serializers.CharField(required=False, allow_blank=True, default='')
    lrn         = serializers.CharField(required=True, help_text='12-digit LRN.')

    def validate_lrn(self, value):
        value = value.strip()
        if not value.isdigit() or len(value) != 12:
            raise serializers.ValidationError('LRN must be exactly 12 digits.')
        return value

    def validate(self, data):
        first_name  = data.get('first_name',  '').strip()
        middle_name = data.get('middle_name', '').strip()
        last_name   = data.get('last_name',   '').strip()
        full_name   = data.get('full_name',   '').strip()
        lrn         = data.get('lrn',         '').strip()

        if not lrn:
            raise serializers.ValidationError('LRN is required.')

        # Look up by LRN
        try:
            user = User.objects.get(lrn=lrn, role='student')
        except User.DoesNotExist:
            raise serializers.ValidationError('Invalid student LRN. Please try again.')

        # If name fields were supplied (e.g. legacy/testing request), check them
        entered_name = ''
        if first_name or last_name:
            mi_part = f'{middle_name[0].upper()}.' if middle_name else ''
            entered_name = ' '.join(
                p for p in [
                    first_name.upper(),
                    mi_part,
                    last_name.upper(),
                ] if p
            ).strip()
        elif full_name:
            entered_name = full_name.upper().strip()

        if entered_name:
            db_name = user.get_full_name().strip()
            entered_normalized = ' '.join(entered_name.lower().split())
            db_normalized = ' '.join(db_name.lower().split())
            if entered_normalized != db_normalized:
                raise serializers.ValidationError('Invalid name or LRN. Please try again.')

        if not user.is_active:
            raise serializers.ValidationError(
                'This account has been deactivated. Please contact your administrator.'
            )

        data['user'] = user
        return data


# ---------------------------------------------------------------------------
# User Profile
# ---------------------------------------------------------------------------

class UserProfileSerializer(serializers.ModelSerializer):
    """Read-only serializer for the authenticated user's profile."""

    full_name = serializers.SerializerMethodField()
    avatar    = serializers.SerializerMethodField()
    faculty_type = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'middle_name', 'last_name',
            'full_name', 'role', 'is_active', 'is_superuser',
            'date_joined', 'last_login', 'avatar', 'lrn', 'faculty_type',
        ]
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_avatar(self, obj):
        # avatar field removed; return None for compatibility
        return None

    def get_faculty_type(self, obj):
        if obj.role != 'faculty':
            return None
        try:
            return obj.faculty_profile.fac_type
        except AttributeError:
            return None


# ---------------------------------------------------------------------------
# Profile Update
# ---------------------------------------------------------------------------

class ProfileUpdateSerializer(serializers.Serializer):
    """Allow updating name fields from the user-facing profile endpoint."""

    first_name  = serializers.CharField(max_length=100, required=False, allow_blank=True)
    middle_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    last_name   = serializers.CharField(max_length=100, required=False, allow_blank=True)
    avatar      = serializers.FileField(required=False, allow_null=True)

    def validate_avatar(self, value):
        if value is None:
            return value
        allowed_types = ['image/jpeg', 'image/png', 'image/webp']
        if getattr(value, 'content_type', None) not in allowed_types:
            raise serializers.ValidationError('Only JPEG, PNG, and WEBP images are allowed.')
        max_size = 2 * 1024 * 1024  # 2 MB
        if value.size > max_size:
            raise serializers.ValidationError('Avatar images must be 2 MB or smaller.')
        return value

    def update(self, instance, validated_data):
        if 'first_name' in validated_data and validated_data['first_name'] is not None:
            instance.first_name = validated_data['first_name'].strip()
        if 'middle_name' in validated_data and validated_data['middle_name'] is not None:
            instance.middle_name = validated_data['middle_name'].strip()
        if 'last_name' in validated_data and validated_data['last_name'] is not None:
            instance.last_name = validated_data['last_name'].strip()
        instance.save()
        return instance


# ---------------------------------------------------------------------------
# Allowed Email
# ---------------------------------------------------------------------------

class AllowedEmailSerializer(serializers.ModelSerializer):
    """Serializer for the AllowedEmail whitelist entries."""

    class Meta:
        model  = AllowedEmail
        fields = ['id', 'email', 'note', 'added_by', 'date_added']
        read_only_fields = ['id', 'added_by', 'date_added']

    def validate_email(self, value):
        value = value.strip().lower()
        if AllowedEmail.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('This email is already in the whitelist.')
        return value
