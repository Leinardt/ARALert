"""
Academic models for ARALert.

Contains the active school-year lifecycle tables (SchoolYear, StudentEnrollment,
TutorAssignmentHistory, SummerRecord, TransitionAuditLog) and the active REST API
academic record tables (ApiGrade, ApiAralActivity, ApiAcademicRisk,
ApiAttendanceSession, ApiAttendance).
"""

import uuid
from django.db import models
from django.utils import timezone


# ---------------------------------------------------------------------------
# School Year & Student Enrollment History
# ---------------------------------------------------------------------------

class SchoolYear(models.Model):
    """Represents an academic school year (e.g., 2025-2026)."""
    class Status(models.TextChoices):
        ACTIVE   = 'ACTIVE',   'Active'
        ARCHIVED = 'ARCHIVED', 'Archived'

    class Semester(models.TextChoices):
        FIRST  = '1st',    '1st'
        SECOND = '2nd',    '2nd'
        SUMMER = 'summer', 'summer'

    school_year      = models.CharField(max_length=20, unique=True, verbose_name='School Year')
    status           = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    current_semester = models.CharField(max_length=10, choices=Semester.choices, default=Semester.SECOND, verbose_name='Current Semester')
    is_active        = models.BooleanField(default=True)
    start_date  = models.DateField(null=True, blank=True)
    end_date    = models.DateField(null=True, blank=True)
    created_at  = models.DateTimeField(default=timezone.now)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'school_years'
        verbose_name = 'School Year'
        verbose_name_plural = 'School Years'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.school_year} ({self.status})'


class StudentEnrollment(models.Model):
    """
    Every school year has its own StudentEnrollment record.
    Historical records must never be overwritten.
    """
    class Program(models.TextChoices):
        BASIC  = 'basic',  'Basic'
        PLUS   = 'plus',   'Plus'
        SUMMER = 'summer', 'Summer'

    class EnrollmentStatus(models.TextChoices):
        ACTIVE    = 'active',    'Active'
        COMPLETED = 'completed', 'Completed'
        DROPPED   = 'dropped',   'Dropped'
        INACTIVE  = 'inactive',  'Inactive'

    class EvaluationResult(models.TextChoices):
        PENDING   = 'pending',   'Pending'
        PASSED    = 'passed',    'Passed'
        FAILED    = 'failed',    'Failed'
        EXEMPTED  = 'exempted',  'Exempted'
        NOT_TAKEN = 'not_taken', 'Not Taken'

    class EvaluationStatus(models.TextChoices):
        PENDING     = 'pending',     'Pending'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED   = 'completed',   'Completed'

    class GraduationStatus(models.TextChoices):
        NOT_ELIGIBLE = 'not_eligible', 'Not Eligible'
        ELIGIBLE     = 'eligible',     'Eligible'
        GRADUATED    = 'graduated',    'Graduated'

    class SummerStatus(models.TextChoices):
        NONE      = 'none',               'None'
        REQUIRED  = 'summer_required',    'Summer Required'
        ACTIVE    = 'summer_active',      'Summer Active'
        PENDING   = 'evaluation_pending', 'Summer Evaluation Pending'
        PASSED    = 'summer_passed',      'Summer Passed'
        FAILED    = 'summer_failed',      'Summer Failed'
        COMPLETED = 'summer_completed',   'Summer Completed'

    student           = models.ForeignKey(
        'accounts.User', on_delete=models.PROTECT, related_name='enrollments',
        limit_choices_to={'role': 'student'}
    )
    school_year       = models.ForeignKey(
        SchoolYear, on_delete=models.PROTECT, related_name='enrollments'
    )
    grade_level       = models.CharField(max_length=50, default='Grade 8')
    program           = models.CharField(max_length=20, choices=Program.choices, default=Program.BASIC)
    assigned_tutor    = models.ForeignKey(
        'accounts.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='tutor_enrollments',
        limit_choices_to={'role': 'tutor'}
    )
    enrollment_status = models.CharField(
        max_length=30, choices=EnrollmentStatus.choices, default=EnrollmentStatus.ACTIVE
    )
    mosy_result       = models.CharField(
        max_length=20, choices=EvaluationResult.choices, default=EvaluationResult.PENDING
    )
    eosy_result       = models.CharField(
        max_length=20, choices=EvaluationResult.choices, default=EvaluationResult.PENDING
    )
    final_result      = models.CharField(max_length=50, null=True, blank=True, default='')
    evaluation_status = models.CharField(
        max_length=20, choices=EvaluationStatus.choices, default=EvaluationStatus.PENDING
    )
    graduation_status = models.CharField(
        max_length=20, choices=GraduationStatus.choices, default=GraduationStatus.NOT_ELIGIBLE
    )
    summer_status     = models.CharField(
        max_length=30, choices=SummerStatus.choices, default=SummerStatus.NONE
    )
    enrollment_date   = models.DateField(default=timezone.localdate)
    completion_date   = models.DateField(null=True, blank=True)
    created_at        = models.DateTimeField(default=timezone.now)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'student_enrollments'
        unique_together = [('student', 'school_year')]
        verbose_name = 'Student Enrollment'
        verbose_name_plural = 'Student Enrollments'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.student.get_full_name()} – {self.school_year.school_year} ({self.program})'


class TutorAssignmentHistory(models.Model):
    """
    Every tutor assignment must be historical and tied to the correct school year or evaluation period.
    Never overwrite previous tutor assignments.
    """
    class Period(models.TextChoices):
        MOSY      = 'MOSY',      'MOSY'
        EOSY      = 'EOSY',      'EOSY'
        FULL_YEAR = 'FULL_YEAR', 'Full School Year'

    student     = models.ForeignKey(
        'accounts.User', on_delete=models.CASCADE, related_name='tutor_assignment_histories',
        limit_choices_to={'role': 'student'}
    )
    tutor       = models.ForeignKey(
        'accounts.User', on_delete=models.PROTECT, related_name='student_assignment_histories',
        limit_choices_to={'role': 'tutor'}
    )
    school_year = models.ForeignKey(
        SchoolYear, on_delete=models.PROTECT, related_name='tutor_assignments'
    )
    period      = models.CharField(max_length=20, choices=Period.choices, default=Period.FULL_YEAR)
    program     = models.CharField(max_length=20, default='basic')
    assigned_by = models.ForeignKey(
        'accounts.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='assignments_made'
    )
    start_date  = models.DateField(default=timezone.localdate)
    end_date    = models.DateField(null=True, blank=True)
    is_active   = models.BooleanField(default=True)
    notes       = models.TextField(blank=True, default='')
    created_at  = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'tutor_assignment_histories'
        verbose_name = 'Tutor Assignment History'
        verbose_name_plural = 'Tutor Assignment Histories'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.student.get_full_name()} -> {self.tutor.get_full_name()} [{self.school_year.school_year} {self.period}]'


class SummerRecord(models.Model):
    """
    Summer must be tracked as a separate program/intervention record.
    It must NOT simply overwrite the student's normal school-year enrollment.
    """
    class Reason(models.TextChoices):
        BASIC_FAILED_TWICE = 'BASIC_FAILED_TWICE', 'Basic Failed Twice'
        PLUS_FAILED        = 'PLUS_FAILED',        'Plus Evaluation Failed'
        ADMIN_REFERRED     = 'ADMIN_REFERRED',     'Admin Intervention Referral'

    class Status(models.TextChoices):
        REQUIRED           = 'summer_required',    'Summer Required'
        ACTIVE             = 'summer_active',      'Summer Active'
        EVALUATION_PENDING = 'evaluation_pending', 'Summer Evaluation Pending'
        PASSED             = 'summer_passed',      'Summer Passed'
        FAILED             = 'summer_failed',      'Summer Failed'
        COMPLETED          = 'summer_completed',   'Summer Completed'

    class EvaluationStatus(models.TextChoices):
        PENDING   = 'pending',   'Pending'
        COMPLETED = 'completed', 'Completed'

    class EvaluationResult(models.TextChoices):
        PASSED = 'passed', 'Passed'
        FAILED = 'failed', 'Failed'

    student                  = models.ForeignKey(
        'accounts.User', on_delete=models.PROTECT, related_name='summer_records',
        limit_choices_to={'role': 'student'}
    )
    previous_enrollment      = models.ForeignKey(
        StudentEnrollment, on_delete=models.PROTECT, related_name='summer_followups',
        null=True, blank=True
    )
    previous_program         = models.CharField(max_length=20, default='basic')
    previous_school_year     = models.CharField(max_length=20)
    reason                   = models.CharField(max_length=100, choices=Reason.choices)
    summer_status            = models.CharField(max_length=30, choices=Status.choices, default=Status.REQUIRED)
    summer_evaluation_status = models.CharField(max_length=20, choices=EvaluationStatus.choices, default=EvaluationStatus.PENDING)
    summer_result            = models.CharField(max_length=20, choices=EvaluationResult.choices, null=True, blank=True)
    start_date               = models.DateField(null=True, blank=True)
    completion_date          = models.DateField(null=True, blank=True)
    evaluating_tutor         = models.ForeignKey(
        'accounts.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='evaluated_summer_students',
        limit_choices_to={'role': 'tutor'}
    )
    notes                    = models.TextField(blank=True, default='')
    created_at               = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'summer_records'
        verbose_name = 'Summer Record'
        verbose_name_plural = 'Summer Records'
        ordering = ['-created_at']

    def __str__(self):
        return f'Summer: {self.student.get_full_name()} ({self.reason}) - {self.summer_status}'


class TransitionAuditLog(models.Model):
    """
    Detailed audit log whenever Admin starts a new school year transition.
    """
    id                   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    admin                = models.ForeignKey(
        'accounts.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='transitions_executed'
    )
    admin_name           = models.CharField(max_length=255, blank=True, default='')
    previous_school_year = models.CharField(max_length=20)
    new_school_year      = models.CharField(max_length=20)
    timestamp            = models.DateTimeField(default=timezone.now)
    basic_to_plus        = models.IntegerField(default=0)
    plus_to_graduated    = models.IntegerField(default=0)
    basic_continuing     = models.IntegerField(default=0)
    sent_to_summer       = models.IntegerField(default=0)
    inactive_dropped     = models.IntegerField(default=0)
    tutor_changes        = models.IntegerField(default=0)
    unassigned_students  = models.IntegerField(default=0)
    transition_result    = models.CharField(max_length=50, default='SUCCESS')
    error_message        = models.TextField(blank=True, default='')
    details              = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'transition_audit_logs'
        verbose_name = 'Transition Audit Log'
        verbose_name_plural = 'Transition Audit Logs'
        ordering = ['-timestamp']

    def __str__(self):
        return f'Transition {self.previous_school_year} -> {self.new_school_year} by {self.admin_name} ({self.transition_result})'


# ---------------------------------------------------------------------------
# API-layer academic record models — managed=False (renamed in place via migration)
# ---------------------------------------------------------------------------

class ApiGrade(models.Model):
    """Maps to the student_grades table. Used by the academics REST API."""

    class ComponentType(models.TextChoices):
        ASSESSMENT  = 'assessment',  'Assessment'
        WEEKLY_TASK = 'weekly_task', 'Weekly Task'
        ATTENDANCE  = 'attendance',  'Attendance'

    student        = models.ForeignKey(
        'accounts.User', on_delete=models.CASCADE,
        related_name='api_grades', db_column='student_id',
    )
    tutor          = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='api_graded',
        db_column='tutor_id',
    )
    subject        = models.CharField(max_length=100)
    quarter        = models.IntegerField()
    score          = models.DecimalField(max_digits=5, decimal_places=2)
    total_score    = models.DecimalField(max_digits=5, decimal_places=2)
    component_type = models.CharField(max_length=20, choices=ComponentType.choices)
    remarks        = models.TextField(null=True, blank=True)
    date_logged    = models.DateField()
    batch_id       = models.CharField(max_length=50)
    created_at     = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'student_grades'
        managed  = False
        ordering = ['-date_logged', '-id']

    def __str__(self):
        return f'{self.student} – {self.subject} Q{self.quarter}: {self.score}'


class ApiAralActivity(models.Model):
    """Maps to the aral_activities table."""

    class Status(models.TextChoices):
        PENDING     = 'pending',     'Pending'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED   = 'completed',   'Completed'

    student       = models.ForeignKey(
        'accounts.User', on_delete=models.CASCADE,
        related_name='api_aral_activities', db_column='student_id',
    )
    tutor         = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='api_assigned_activities',
        db_column='tutor_id',
    )
    title         = models.CharField(max_length=255)
    description   = models.TextField(null=True, blank=True)
    status        = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    date_assigned = models.DateField()
    date_completed = models.DateField(null=True, blank=True)
    remarks       = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'aral_activities'
        managed  = False

    def __str__(self):
        return f'{self.title} – {self.student}'


class ApiAcademicRisk(models.Model):
    """Maps to the academic_risks table."""

    class RiskLevel(models.TextChoices):
        LOW      = 'low',      'Low'
        MODERATE = 'moderate', 'Moderate'
        MEDIUM   = 'medium',   'Medium'
        HIGH     = 'high',     'High'

    student               = models.ForeignKey(
        'accounts.User', on_delete=models.CASCADE,
        related_name='api_academic_risks', db_column='student_id',
    )
    risk_level            = models.CharField(max_length=10, choices=RiskLevel.choices)
    details               = models.TextField()
    date_created          = models.DateTimeField()
    resolved              = models.BooleanField(default=False)
    student_acknowledged  = models.BooleanField(default=False)
    acknowledged_at       = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'academic_risks'
        managed  = False

    def __str__(self):
        return f'{self.student} – {self.risk_level}'


class ApiAttendanceSession(models.Model):
    """Maps to the attendance_sessions table."""

    id           = models.UUIDField(primary_key=True)
    creator      = models.ForeignKey(
        'accounts.User', on_delete=models.CASCADE,
        related_name='api_created_sessions', db_column='creator_id',
    )
    session_type = models.CharField(max_length=10)
    action       = models.CharField(max_length=20, null=True, blank=True)
    aral_activity = models.ForeignKey(
        ApiAralActivity, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='api_sessions',
        db_column='aral_activity_id',
    )
    expires_at   = models.DateTimeField()
    is_active    = models.BooleanField(default=True)

    class Meta:
        db_table = 'attendance_sessions'
        managed  = False

    def __str__(self):
        return f'Session {self.id} ({self.session_type})'


class ApiAttendance(models.Model):
    """Maps to the attendance_records table."""

    class Status(models.TextChoices):
        PRESENT = 'present', 'Present'
        ABSENT  = 'absent',  'Absent'

    user          = models.ForeignKey(
        'accounts.User', on_delete=models.CASCADE,
        related_name='api_attendance_records', db_column='user_id',
    )
    tutor         = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='api_student_attendance',
        db_column='tutor_id',
    )
    session       = models.ForeignKey(
        ApiAttendanceSession, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='api_attendances',
        db_column='session_id',
    )
    aral_activity = models.ForeignKey(
        ApiAralActivity, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='api_attendances',
        db_column='aral_activity_id',
    )
    school_year   = models.ForeignKey(
        SchoolYear, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='api_attendance_records',
        db_column='school_year_id',
    )
    role         = models.CharField(max_length=20)
    date         = models.DateField()
    time_in      = models.TimeField(null=True, blank=True)
    time_out     = models.TimeField(null=True, blank=True)
    arrival_am   = models.TimeField(null=True, blank=True)
    departure_am = models.TimeField(null=True, blank=True)
    arrival_pm   = models.TimeField(null=True, blank=True)
    departure_pm = models.TimeField(null=True, blank=True)
    status       = models.CharField(max_length=10, choices=Status.choices)

    class Meta:
        db_table     = 'attendance_records'
        managed      = False
        unique_together = [('user', 'date')]

    def __str__(self):
        return f'{self.user} – {self.date} ({self.status})'
