import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone


def generate_secure_token(length=32):
    return secrets.token_urlsafe(length)


def build_expiration_delta():
    token_expiration = getattr(settings, 'TOKEN_EXPIRATION_TIME', 60)
    try:
        minutes = int(token_expiration)
    except (TypeError, ValueError):
        minutes = 60
    return timedelta(minutes=minutes)


def get_token_expiration():
    return timezone.now() + build_expiration_delta()


def is_token_valid(token_value, expires_at):
    if not token_value or not expires_at:
        return False
    return timezone.now() <= expires_at
