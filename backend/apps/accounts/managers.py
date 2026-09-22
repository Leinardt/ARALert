"""
Custom User Manager for ARALert.
All accounts use Google OAuth — no passwords are stored or required.
"""

from django.contrib.auth.models import BaseUserManager


class CustomUserManager(BaseUserManager):
    """Custom manager for the User model.  Email is the unique identifier."""

    def create_user(self, email, password=None, **extra_fields):
        """Create and return a user.  Password is always set to unusable."""
        if not email:
            raise ValueError('Email is required.')

        email = self.normalize_email(email)

        # Auto-generate username from email if not provided
        if not extra_fields.get('username'):
            extra_fields['username'] = email

        user = self.model(email=email, **extra_fields)
        # All accounts use Google OAuth — no real password is stored
        user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """Create and return a SuperAdmin with is_superuser=True and role=None."""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('role', None)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)
