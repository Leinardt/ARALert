"""
Rate limiting utilities for ARALert.

Uses Django's cache framework (LocMemCache by default; swap for Redis in production).
Tracks failed attempts per IP (login) and per user ID (OTP).
"""

from django.core.cache import cache


# ── Constants ─────────────────────────────────────────────────────────────────

LOGIN_MAX_ATTEMPTS = 10          # per IP
LOGIN_WINDOW_SECONDS = 900       # 15 minutes

OTP_MAX_ATTEMPTS = 5             # per user_id
OTP_WINDOW_SECONDS = 900         # 15 minutes

# ── Helpers ───────────────────────────────────────────────────────────────────


def _login_key(ip: str) -> str:
    return f"rl:login:{ip}"


def _login_lock_key(ip: str) -> str:
    return f"rl:login:lock:{ip}"


def _otp_key(user_id: str) -> str:
    return f"rl:otp:{user_id}"


def _otp_lock_key(user_id: str) -> str:
    return f"rl:otp:lock:{user_id}"


# ── Login rate limiting ────────────────────────────────────────────────────────


def is_login_rate_limited(ip: str) -> bool:
    """Return True if this IP has exceeded the login attempt threshold."""
    return bool(cache.get(_login_lock_key(ip)))


def record_failed_login(ip: str) -> None:
    """Increment the failed-login counter for *ip*. Lock if threshold reached."""
    key = _login_key(ip)
    attempts = cache.get(key, 0) + 1
    cache.set(key, attempts, LOGIN_WINDOW_SECONDS)
    if attempts >= LOGIN_MAX_ATTEMPTS:
        cache.set(_login_lock_key(ip), True, LOGIN_WINDOW_SECONDS)


def clear_login_attempts(ip: str) -> None:
    """Clear counters on successful login from *ip*."""
    cache.delete(_login_key(ip))
    cache.delete(_login_lock_key(ip))


# ── OTP rate limiting ─────────────────────────────────────────────────────────


def is_otp_rate_limited(user_id: str) -> bool:
    """Return True if this user has exceeded the OTP attempt threshold."""
    return bool(cache.get(_otp_lock_key(user_id)))


def record_failed_otp(user_id: str) -> None:
    """Increment the failed-OTP counter for *user_id*. Lock if threshold reached."""
    key = _otp_key(user_id)
    attempts = cache.get(key, 0) + 1
    cache.set(key, attempts, OTP_WINDOW_SECONDS)
    if attempts >= OTP_MAX_ATTEMPTS:
        cache.set(_otp_lock_key(user_id), True, OTP_WINDOW_SECONDS)


def clear_otp_attempts(user_id: str) -> None:
    """Clear OTP counters on successful verification."""
    cache.delete(_otp_key(user_id))
    cache.delete(_otp_lock_key(user_id))
