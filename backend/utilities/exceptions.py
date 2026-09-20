import traceback
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    """Custom DRF exception handler with consistent JSON shape."""
    response = exception_handler(exc, context)

    if response is not None:
        errors = response.data
        if isinstance(errors, dict) and 'detail' in errors:
            errors = {'detail': errors['detail']}
        return Response(errors, status=response.status_code)

    print("=== UNHANDLED EXCEPTION IN API VIEW ===")
    traceback.print_exc()
    print("========================================")

    return Response(
        {'detail': 'An unexpected error occurred.'},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )

