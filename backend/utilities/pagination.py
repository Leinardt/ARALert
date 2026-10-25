"""
Standard pagination classes for ARALert API.
Enables clients to specify page_size up to max_page_size,
while maintaining a safe default of 30 items per page.
"""
from rest_framework.pagination import PageNumberPagination


class StandardResultsSetPagination(PageNumberPagination):
    """
    Standard pagination with configurable page_size.
    Default: 30 items per page.
    Query param: ?page_size=<number>
    Maximum allowed: 500 items per page.
    """
    page_size = 30
    page_size_query_param = 'page_size'
    max_page_size = 500
