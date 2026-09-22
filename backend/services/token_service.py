"""
Token Service for ARALert.
Handles secure token generation and validation for activation and password-reset flows.
"""

import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone


def generate_secure_token(nbytes: int = 32) -> str:
    """
    Generate a cryptographically secure URL-safe token string.

    Args:
        nbytes: Number of random bytes (default 32 → 43-char base64url string).

    Returns:
        A URL-safe base64-encoded random token string.
    """
    return secrets.token_urlsafe(nbytes)


def get_token_expiration(minutes: int | None = None) -> object:
    """
    Return a timezone-aware datetime representing when a token should expire.

    Args:
        minutes: Lifetime in minutes. Defaults to TOKEN_EXPIRATION_TIME from settings (default 60).

    Returns:
        A timezone-aware datetime object.
    """
    lifetime = minutes if minutes is not None else int(getattr(settings, 'TOKEN_EXPIRATION_TIME', 60))
    return timezone.now() + timedelta(minutes=lifetime)


def is_token_valid(token: str | None, expires_at) -> bool:
    """
    Check whether a token string is non-empty and has not expired.

    Args:
        token: The token string to validate.
        expires_at: A timezone-aware datetime representing the expiry time.

    Returns:
        True if the token is non-empty and the current time is before expires_at.
    """
    if not token:
        return False
    if expires_at is None:
        return False
    return timezone.now() < expires_at
