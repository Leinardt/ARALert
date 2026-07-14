"""
Custom DRF Exception Handler.
Returns consistent JSON error responses; never exposes Django debug pages.
"""

from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    """
    Custom handler that ensures all errors return clean JSON.
    Falls through to DRF's default handler first, then wraps unhandled cases.
    """
    response = exception_handler(exc, context)

    if response is not None:
        # Standardize error response format
        custom_data = {
            'status_code': response.status_code,
            'errors': response.data,
        }
        response.data = custom_data
        return response

    # Handle any unhandled exception (500)
    return Response(
        {
            'status_code': 500,
            'errors': {'detail': 'An unexpected error occurred. Please try again later.'},
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
