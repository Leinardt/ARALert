"""
Role Middleware.
Attaches role information to every authenticated request.
"""

from django.utils.deprecation import MiddlewareMixin


class RoleMiddleware(MiddlewareMixin):
    """
    Middleware that adds convenience role attributes to the request object.
    Available after AuthenticationMiddleware runs.
    """

    def process_request(self, request):
        if hasattr(request, 'user') and request.user.is_authenticated:
            request.user_role = getattr(request.user, 'role', None)
            request.is_superadmin = request.user.is_superuser
        else:
            request.user_role = None
            request.is_superadmin = False
