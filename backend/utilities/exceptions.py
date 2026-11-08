import logging
from django.conf import settings
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """Custom DRF exception handler with consistent JSON shape."""
    response = exception_handler(exc, context)

    if response is not None:
        errors = response.data
        if isinstance(errors, dict) and 'detail' in errors:
            errors = {'detail': errors['detail']}
        return Response(errors, status=response.status_code)

    view_name = context.get('view', 'unknown') if context else 'unknown'
    logger.exception("Unhandled API exception in %s: %s", view_name, exc)

    if settings.DEBUG:
        err_msg = str(exc)
        detail_text = f"An unexpected error occurred: {err_msg}" if err_msg else "An unexpected error occurred."
    else:
        detail_text = "An unexpected server error occurred. Please contact system support if the issue persists."

    return Response(
        {'detail': detail_text},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )

