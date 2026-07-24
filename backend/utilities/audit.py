"""
Audit Logging Utility for ARALert.

Provides structured event recording for security accountability, auditing, and non-repudiation.
"""

import logging
from apps.accounts.models import AuditLog
from utilities.helpers import get_client_ip

logger = logging.getLogger('aralert.audit')


def log_audit_event(action: str, user=None, username: str = '', request=None, details: dict = None):
    """
    Record an audit log entry in the database and Python logging.

    :param action: High-level action name (e.g. 'USER_LOGIN_SUCCESS', 'PASSWORD_RESET_REQUEST').
    :param user: User instance if authenticated or identified.
    :param username: Fallback username string for non-repudiation if user is None or deleted later.
    :param request: Django HttpRequest object to extract IP and User-Agent.
    :param details: Additional structured context dictionary.
    """
    if details is None:
        details = {}

    ip_address = None
    user_agent = ''

    if request is not None:
        ip_address = get_client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')

    if user is not None and user.is_authenticated:
        resolved_username = getattr(user, 'username', username)
    else:
        resolved_username = username

    try:
        log_entry = AuditLog.objects.create(
            user=user if (user and getattr(user, 'is_authenticated', False)) else None,
            username=resolved_username or 'Anonymous',
            action=action,
            ip_address=ip_address,
            user_agent=user_agent[:500] if user_agent else '',
            details=details,
        )
        logger.info(
            f"[AUDIT] action={action} user={resolved_username} ip={ip_address} details={details}"
        )
        return log_entry
    except Exception as exc:
        logger.error(f"Failed to record audit log for action={action}: {exc}")
        return None
