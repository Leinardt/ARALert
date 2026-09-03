"""
Audit Logging Utility for ARALert.
Provides a helper to write structured audit log entries to the AuditLog model.
"""

import logging

logger = logging.getLogger(__name__)


def log_audit_event(
    action: str,
    user=None,
    username: str = '',
    request=None,
    details: dict | None = None,
) -> None:
    """
    Write an audit log entry to the AuditLog model.

    Args:
        action:   A short, ALL_CAPS string identifying the event (e.g. 'LOGIN_SUCCESS').
        user:     The authenticated User instance, if available.
        username: A fallback string identifier used when user is None.
        request:  The Django HttpRequest object (used to extract IP and user-agent).
        details:  Optional dict of additional context to store as JSON.
    """
    try:
        from apps.accounts.models import AuditLog

        ip_address = _get_client_ip(request) if request else None
        user_agent = ''
        if request:
            user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]

        resolved_username = username
        if not resolved_username and user:
            # Prefer email for Google OAuth accounts; fall back to username attribute
            resolved_username = getattr(user, 'email', '') or getattr(user, 'username', '') or str(user)

        AuditLog.objects.create(
            user=user if (user and getattr(user, 'pk', None)) else None,
            username=resolved_username,
            action=action,
            ip_address=ip_address,
            user_agent=user_agent,
            details=details or {},
        )
    except Exception as exc:
        # Never let audit logging break the main request flow
        logger.error('Failed to write audit log [%s]: %s', action, exc)


def _get_client_ip(request) -> str | None:
    """Extract the real client IP, honoring X-Forwarded-For."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')
