"""
User Service Layer.
Business logic for user management operations.
Future sprints can extend this with more complex workflows.
"""

from apps.accounts.models import User


class UserService:
    """Service class encapsulating user management business logic."""

    ASSIGNABLE_ROLES = [r[0] for r in User.Role.choices]

    @staticmethod
    def get_application_users():
        """Return queryset of all non-SuperAdmin users."""
        return User.objects.filter(is_superuser=False)

    @staticmethod
    def create_user(validated_data: dict) -> User:
        """Create a new application user with hashed password."""
        password = validated_data.pop('password')
        validated_data.pop('confirm_password', None)
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    @staticmethod
    def activate_user(user: User) -> User:
        """Activate a user account."""
        if user.is_superuser:
            raise ValueError('Cannot modify the SuperAdmin account.')
        user.is_active = True
        user.save(update_fields=['is_active'])
        return user

    @staticmethod
    def deactivate_user(user: User) -> User:
        """Deactivate a user account."""
        if user.is_superuser:
            raise ValueError('Cannot modify the SuperAdmin account.')
        user.is_active = False
        user.save(update_fields=['is_active'])
        return user

    @staticmethod
    def reset_password(user: User, new_password: str) -> User:
        """Reset a user's password."""
        if user.is_superuser:
            raise ValueError('Cannot modify the SuperAdmin account.')
        user.set_password(new_password)
        user.save(update_fields=['password'])
        return user

    @classmethod
    def validate_role(cls, role: str) -> bool:
        """Check if a role is assignable (not SuperAdmin)."""
        return role in cls.ASSIGNABLE_ROLES
