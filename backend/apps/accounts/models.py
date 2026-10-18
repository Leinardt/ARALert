"""
Custom User Model for ARALert.
Single unified model with UUID primary key and role-based access.
All authentication is handled via Google OAuth (no passwords).
Students authenticate via Full Name + LRN.
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

    All staff authenticate via Google OAuth — no passwords are stored.
    Students authenticate via Full Name + LRN.
    """

    class Role(models.TextChoices):
        ADMIN     = 'admin',     'Admin'
        PRINCIPAL = 'principal', 'Principal'
        FACULTY   = 'faculty',   'Faculty'
        TUTOR     = 'tutor',     'Tutor'
        STUDENT   = 'student',   'Student'

    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    # Identity fields
    email      = models.EmailField(max_length=254, unique=True)
    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True, default='')
    last_name  = models.CharField(max_length=100)

    # Internal username — auto-generated from email; kept for Django compatibility
    username = models.CharField(max_length=254, unique=True, blank=True)

    # Google OAuth subject identifier
    google_sub = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
        verbose_name='Google Subject ID',
        help_text='Unique Google account identifier (sub claim from ID token).',
    )

    # Role — nullable for SuperAdmin
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        null=True,
        blank=True,
    )

    # Status flags
    is_active = models.BooleanField(default=True)
    is_staff  = models.BooleanField(default=False)

    # Student-specific fields — kept here for JWT-based student auth
    lrn = models.CharField(
        max_length=12,
        unique=True,
        null=True,
        blank=True,
        verbose_name='Learner Reference Number (LRN)',
        help_text='12-digit LRN. Required for student accounts.',
    )

    class AralLevel(models.TextChoices):
        BASIC     = 'basic',     'Basic'
        PLUS      = 'plus',      'Plus'
        SUMMER    = 'summer',    'Summer'
        GRADUATED = 'graduated', 'Graduated'

    aral_level = models.CharField(
        max_length=15,
        choices=AralLevel.choices,
        default=AralLevel.BASIC,
        verbose_name='ARAL Level',
        help_text='Student ARAL program level.',
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
    )

    class Subject(models.TextChoices):
        FILIPINO = 'Filipino', 'Filipino'
        SCIENCE  = 'Science',  'Science'
        MATH     = 'Math',     'Math'
        ENGLISH  = 'English',  'English'

    class TutorType(models.TextChoices):
        BASIC  = 'basic',  'Basic Tutor'
        PLUS   = 'plus',   'Plus Tutor'
        SUMMER = 'summer', 'Summer Tutor'

    # Subject handled by the tutor or student subject focus (Filipino, Science, Math, English)
    subject = models.CharField(
        max_length=20,
        choices=Subject.choices,
        null=True,
        blank=True,
        verbose_name='Assigned Subject / Focus',
        help_text='Subject handled by the tutor or student subject focus.',
    )

    # Additional student details for DepEd / ARAL Program compliance
    grade_level = models.CharField(
        max_length=100,
        blank=True,
        default='',
        verbose_name='Grade Level / Section',
        help_text='e.g. 7 - HYACINTH',
    )
    parent_guardian_name = models.CharField(
        max_length=200,
        blank=True,
        default='',
        verbose_name='Parent / Guardian Name',
    )
    contact_number = models.CharField(
        max_length=50,
        blank=True,
        default='',
        verbose_name='Contact Number',
    )
    has_bosy = models.BooleanField(
        default=True,
        verbose_name='Undergone BOSY Assessment',
    )
    has_mosy = models.BooleanField(
        default=False,
        verbose_name='Undergone MOSY Assessment',
    )
    has_eosy = models.BooleanField(
        default=False,
        verbose_name='Undergone EOSY Assessment',
    )
    has_summer = models.BooleanField(
        default=False,
        verbose_name='Undergone ARAL Summer Assessment',
    )

    tutor_type = models.CharField(
        max_length=20,
        choices=TutorType.choices,
        default=TutorType.BASIC,
        verbose_name='Tutor Type',
        help_text='Tutor specialization program level (Basic, Plus, or Summer).',
    )

    is_available_for_students = models.BooleanField(
        default=True,
        verbose_name='Available for Additional Students',
        help_text='Eligibility indicator indicating if tutor is accepting compatible students.',
    )

    # Tutor-customisable grading weights (only used if role='tutor')
    assessment_weight   = models.IntegerField(default=50, verbose_name='Assessment Weight (%)')
    weekly_tasks_weight = models.IntegerField(default=30, verbose_name='Weekly Tasks Weight (%)')
    attendance_weight   = models.IntegerField(default=20, verbose_name='Attendance Weight (%)')

    # Timestamps & Regulatory Consent
    date_joined = models.DateTimeField(default=timezone.now)
    last_login  = models.DateTimeField(null=True, blank=True)
    privacy_consent_accepted_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Privacy Consent Accepted At',
        help_text='Timestamp when the user accepted the ARALert Data Privacy Statement & Terms.',
    )

    objects = CustomUserManager()

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    class Meta:
        db_table         = 'users'
        ordering         = ['-date_joined']
        verbose_name     = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return f'{self.email} ({self.get_full_name()})'

    def get_full_name(self):
        """
        Return name formatted according to role:
        - student: LASTNAME, FIRSTNAME M.I. (e.g. 'DELA CRUZ, JUAN P.')
        - staff / faculty / others: FIRST_NAME [MIDDLE_INITIAL.] LAST_NAME
        All uppercase.
        """
        fn = self.first_name.upper().strip() if self.first_name else ''
        ln = self.last_name.upper().strip()  if self.last_name  else ''
        mi = ''
        if self.middle_name and self.middle_name.strip():
            mi = f'{self.middle_name.strip()[0].upper()}.'

        if self.role == 'student':
            if ln and fn:
                return f"{ln}, {fn} {mi}".strip() if mi else f"{ln}, {fn}".strip()
            elif ln:
                return ln
            elif fn:
                return f"{fn} {mi}".strip() if mi else fn
            return ''

        return ' '.join(part for part in [fn, mi, ln] if part).strip()

    def get_short_name(self):
        return self.first_name.upper().strip() if self.first_name else ''

    def clean(self):
        super().clean()
        if self.role == 'tutor':
            level = (self.tutor_type or self.aral_level or 'basic').lower()
            if level not in ('basic', 'plus', 'summer', 'basic_plus', 'basic,plus'):
                level = 'basic'
            self.aral_level = level
            self.tutor_type = level

    def save(self, *args, **kwargs):
        """Normalise name fields to uppercase; auto-generate username from email; enforce valid tutor level."""
        if self.first_name:
            self.first_name = self.first_name.upper().strip()
        if self.middle_name:
            self.middle_name = self.middle_name.upper().strip()
        if self.last_name:
            self.last_name = self.last_name.upper().strip()
        if self.role == 'tutor':
            level = (self.tutor_type or self.aral_level or 'basic').lower()
            if level in ('basic', 'plus', 'summer', 'basic_plus', 'basic,plus'):
                self.aral_level = level
                self.tutor_type = level
        if self.subject and self.subject.strip().lower() == 'reading':
            self.subject = 'Filipino'
        # Auto-generate username from email for Django internal compatibility
        if not self.username:
            self.username = self.email
        super().save(*args, **kwargs)

    @property
    def is_superadmin(self):
        """Check if this user is the SuperAdmin."""
        return self.is_superuser and self.role is None


class AllowedEmail(models.Model):
    """
    Personal or non-standard emails that the SuperAdmin has explicitly approved
    for Google OAuth login access.
    """
    email         = models.EmailField(unique=True, verbose_name='Allowed Email')
    note          = models.CharField(
        max_length=255,
        blank=True,
        default='',
        verbose_name='Note',
        help_text='Optional reason this email was approved.',
    )
    added_by      = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='allowed_emails_added',
        limit_choices_to={'is_superuser': True},
    )
    date_added    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table     = 'allowed_emails'
        verbose_name = 'Allowed Email'
        verbose_name_plural = 'Allowed Emails'
        ordering     = ['-date_added']

    def __str__(self):
        return self.email


class EmailOTP(models.Model):
    """One-time password records sent to user email for MFA (retained for compatibility)."""
    user       = models.ForeignKey('User', on_delete=models.CASCADE, related_name='email_otps')
    code       = models.CharField(max_length=16)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used       = models.BooleanField(default=False)

    class Meta:
        indexes = [models.Index(fields=['user', 'code'])]

    def __str__(self):
        return f'OTP for {self.user_id} (used={self.used})'


class TrustedDevice(models.Model):
    """Trusted devices that skip MFA verification for 30 days."""
    user      = models.ForeignKey('User', on_delete=models.CASCADE, related_name='trusted_devices')
    device_id = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        indexes = [models.Index(fields=['user', 'device_id'])]

    def __str__(self):
        return f'Trusted device for {self.user_id}'


class AuditLog(models.Model):
    """
    Audit Log model for accountability, security auditing, and non-repudiation.
    """
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
    )
    username   = models.CharField(max_length=254, blank=True, default='')
    action     = models.CharField(max_length=100, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default='')
    details    = models.JSONField(default=dict, blank=True)
    timestamp  = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-timestamp']

    def __str__(self):
        actor = self.username or (str(self.user) if self.user else 'Anonymous')
        return f'[{self.timestamp:%Y-%m-%d %H:%M:%S}] {self.action} by {actor}'


class StudentEditRequest(models.Model):
    """
    Formal change request for student identity and program level information.
    Submitted by tutors and approved/rejected by School Admin or Super Admin.
    Prevents unauthorized or fraudulent alterations of student records.
    """

    class Status(models.TextChoices):
        PENDING  = 'pending',  'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='edit_requests',
        limit_choices_to={'role': 'student'},
        verbose_name='Student',
    )
    requested_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='requested_student_edits',
        verbose_name='Requested By (Tutor)',
    )
    proposed_first_name = models.CharField(max_length=100, verbose_name='Proposed First Name')
    proposed_middle_name = models.CharField(max_length=100, blank=True, default='', verbose_name='Proposed Middle Name')
    proposed_last_name = models.CharField(max_length=100, verbose_name='Proposed Last Name')
    proposed_lrn = models.CharField(max_length=12, blank=True, null=True, verbose_name='Proposed LRN')
    proposed_aral_level = models.CharField(
        max_length=15,
        choices=User.AralLevel.choices,
        default=User.AralLevel.BASIC,
        verbose_name='Proposed ARAL Level',
    )
    reason = models.TextField(blank=True, default='', verbose_name='Reason for Edit Request')
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
        verbose_name='Status',
    )
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_student_edits',
        verbose_name='Reviewed By',
    )
    rejection_reason = models.TextField(blank=True, default='', verbose_name='Rejection Reason')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'student_edit_requests'
        ordering = ['-created_at']
        verbose_name = 'Student Edit Request'
        verbose_name_plural = 'Student Edit Requests'

    def __str__(self):
        return f'Edit Request for {self.student.get_full_name()} ({self.status}) by {self.requested_by.get_full_name()}'

