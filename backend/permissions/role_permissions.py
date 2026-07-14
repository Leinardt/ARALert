"""
Custom DRF Permission Classes for Role-Based Access Control.
"""

from rest_framework.permissions import BasePermission


class IsSuperAdmin(BasePermission):
    """
    Allow access only to the SuperAdmin (is_superuser=True).
    Used for user management endpoints.
    """

    message = 'Access restricted to SuperAdmin only.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_superuser
        )


class IsAdmin(BasePermission):
    """Allow access to Admin role users."""

    message = 'Access restricted to Admin users.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_superuser or request.user.role == 'admin')
        )


def role_required(*roles):
    """
    Factory that returns a permission class restricting access to specific roles.
    SuperAdmin always has access.

    Usage:
        permission_classes = [role_required('principal', 'faculty')]
    """

    class RolePermission(BasePermission):
        message = f'Access restricted to: {", ".join(roles)}.'

        def has_permission(self, request, view):
            if not request.user or not request.user.is_authenticated:
                return False
            if request.user.is_superuser:
                return True
            return request.user.role in roles

    RolePermission.__name__ = f'RolePermission_{"_".join(roles)}'
    return RolePermission
