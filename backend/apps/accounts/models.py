"""
Custom User Model for ARALert.
Single unified model with UUID primary key and role-based access.
"""

import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

from .managers import CustomUserManager


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User model for ARALert.

    Application roles: Admin, Principal, Faculty, Tutor, Student.
    SuperAdmin is identified by is_superuser=True and role=None.
    """

    class Role(models.TextChoices):
        ADMIN = 'admin', 'Admin'
        PRINCIPAL = 'principal', 'Principal'
        FACULTY = 'faculty', 'Faculty'
        TUTOR = 'tutor', 'Tutor'
        STUDENT = 'student', 'Student'

    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    # Identity fields
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(max_length=254, unique=True)
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)

    # Role — nullable for SuperAdmin
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        null=True,
        blank=True,
    )

    # Status flags
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    password_set = models.BooleanField(default=True)
    email_verified = models.BooleanField(default=True)
    password_setup_required = models.BooleanField(default=False)

    # Authentication abuse protection
    failed_login_attempts = models.IntegerField(default=0)
    locked_until = models.DateTimeField(blank=True, null=True)

    # Invitation and password recovery tokens
    activation_token = models.CharField(max_length=255, blank=True, null=True)
    activation_token_expires_at = models.DateTimeField(blank=True, null=True)
    password_reset_token = models.CharField(max_length=255, blank=True, null=True)
    password_reset_token_expires_at = models.DateTimeField(blank=True, null=True)

    # Student-specific fields
    lrn = models.CharField(
        max_length=12,
        unique=True,
        null=True,
        blank=True,
        verbose_name='Learner Reference Number (LRN)',
        help_text='12-digit LRN. Required for student accounts.',
    )

    class AralLevel(models.TextChoices):
        BASIC = 'basic', 'Basic'
        PLUS = 'plus', 'Plus'
        SUMMER = 'summer', 'Summer'

    aral_level = models.CharField(
        max_length=10,
        choices=AralLevel.choices,
        default=AralLevel.BASIC,
        verbose_name='ARAL Level',
        help_text='Student ARAL program level.'
    )

    # Tutor Assignment for Students
    assigned_tutor = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_students',
        limit_choices_to={'role': 'tutor'},
        verbose_name='Assigned Tutor',
        help_text='The tutor assigned to this student.'
    )

    # Attendance QR window settings
    attendance_qr_start_time = models.CharField(
        max_length=5,
        blank=True,
        default='08:00',
        verbose_name='Attendance QR Start Time',
        help_text='Default time when the QR attendance window begins.',
    )
    attendance_qr_end_time = models.CharField(
        max_length=5,
        blank=True,
        default='09:00',
        verbose_name='Attendance QR End Time',
        help_text='Default time when the QR attendance window ends.',
    )

    # Tutor-customizable grading weights (only used if role='tutor')
    assessment_weight = models.IntegerField(
        default=50,
        verbose_name='Assessment Weight (%)',
        help_text='Tutor custom weight for Assessments.'
    )
    weekly_tasks_weight = models.IntegerField(
        default=30,
        verbose_name='Weekly Tasks Weight (%)',
        help_text='Tutor custom weight for Weekly Tasks.'
    )
    attendance_weight = models.IntegerField(
        default=20,
        verbose_name='Attendance Weight (%)',
        help_text='Tutor custom weight for Attendance.'
    )

    # Timestamps
    date_joined = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(null=True, blank=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email', 'first_name', 'last_name']

    class Meta:
        db_table = 'users'
        ordering = ['-date_joined']
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return f"{self.username} ({self.get_full_name()})"

    def get_full_name(self):
        """Return first_name + last_name."""
        return f"{self.first_name} {self.last_name}".strip()

    def get_short_name(self):
        """Return first_name."""
        return self.first_name

    @property
    def is_superadmin(self):
        """Check if this user is the SuperAdmin."""
        return self.is_superuser and self.role is None
