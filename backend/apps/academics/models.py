import uuid
import uuid
from django.db import models
from django.utils import timezone
from django.conf import settings


class Grade(models.Model):
    """
    Component grades logged by tutors for assessment, weekly tasks, and attendance.
    """
    class ComponentType(models.TextChoices):
        ASSESSMENT = 'assessment', 'Assessment'
        WEEKLY_TASK = 'weekly_task', 'Weekly Task'
        ATTENDANCE = 'attendance', 'Attendance'

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='grades',
        limit_choices_to={'role': 'student'}
    )
    tutor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='logged_grades',
        limit_choices_to={'role': 'tutor'},
        null=True
    )
    subject = models.CharField(max_length=100)
    quarter = models.IntegerField(
        choices=[
            (1, '1st Quarter'),
            (2, '2nd Quarter'),
            (3, '3rd Quarter'),
            (4, '4th Quarter')
        ]
    )
    score = models.DecimalField(max_digits=5, decimal_places=2)  # Score out of 100
    total_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    component_type = models.CharField(
        max_length=20,
        choices=ComponentType.choices
    )
    remarks = models.TextField(blank=True, null=True)
    date_logged = models.DateTimeField(default=timezone.now)
    batch_id = models.UUIDField(default=uuid.uuid4, editable=False)

    class Meta:
        db_table = 'grades'
        ordering = ['-date_logged']

    def __str__(self):
        return f"{self.student.get_full_name()} - {self.subject} - Q{self.quarter} - {self.component_type}: {self.score}"


class AralActivity(models.Model):
    """
    ARAL intervention activities assigned to students by tutors.
    """
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='aral_activities',
        limit_choices_to={'role': 'student'}
    )
    tutor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='assigned_aral_activities',
        limit_choices_to={'role': 'tutor'}
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )
    date_assigned = models.DateTimeField(default=timezone.now)
    date_completed = models.DateTimeField(blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'aral_activities'
        verbose_name_plural = 'Aral Activities'
        ordering = ['-date_assigned']

    def __str__(self):
        return f"{self.title} - {self.student.get_full_name()}"


class AcademicRisk(models.Model):
    """
    Academic risk flags notification logged for students.
    """
    class RiskLevel(models.TextChoices):
        LOW = 'low', 'Low Risk'
        MEDIUM = 'medium', 'Medium Risk'
        HIGH = 'high', 'High Risk'

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='academic_risks',
        limit_choices_to={'role': 'student'}
    )
    risk_level = models.CharField(
        max_length=20,
        choices=RiskLevel.choices,
        default=RiskLevel.LOW
    )
    details = models.TextField()
    date_created = models.DateTimeField(default=timezone.now)
    resolved = models.BooleanField(default=False)

    class Meta:
        db_table = 'academic_risks'
        ordering = ['-date_created']

    def __str__(self):
        return f"{self.student.get_full_name()} - {self.risk_level.upper()} RISK"


class AttendanceSession(models.Model):
    """
    Active QR code scanning session model. Used to track generated QR codes
    and prevent unauthorized or double scans.
    """
    class SessionType(models.TextChoices):
        STUDENT = 'student', 'Student Session'
        STAFF = 'staff', 'Staff Session'

    class StaffAction(models.TextChoices):
        TIME_IN = 'time_in', 'Time In'
        TIME_OUT = 'time_out', 'Time Out'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_attendance_sessions'
    )
    session_type = models.CharField(
        max_length=20,
        choices=SessionType.choices
    )
    action = models.CharField(
        max_length=20,
        choices=StaffAction.choices,
        blank=True,
        null=True
    )
    aral_activity = models.ForeignKey(
        AralActivity,
        on_delete=models.SET_NULL,
        related_name='attendance_sessions',
        blank=True,
        null=True
    )
    expires_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    date_created = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'attendance_sessions'
        ordering = ['-date_created']

    def __str__(self):
        action_str = f" - {self.action}" if self.action else ""
        return f"{self.session_type.capitalize()} Session{action_str} by {self.creator.username}"


class Attendance(models.Model):
    """
    Attendance log for both students and employees (tutors, faculty, admin, principal).
    """
    class Status(models.TextChoices):
        PRESENT = 'present', 'Present'
        LATE = 'late', 'Late'
        ABSENT = 'absent', 'Absent'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )
    role = models.CharField(max_length=20)
    date = models.DateField(default=timezone.now)
    time_in = models.DateTimeField(blank=True, null=True)
    time_out = models.DateTimeField(blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PRESENT
    )
    tutor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='student_attendance_records',
        limit_choices_to={'role': 'tutor'},
        blank=True,
        null=True
    )
    aral_activity = models.ForeignKey(
        AralActivity,
        on_delete=models.SET_NULL,
        blank=True,
        null=True
    )
    session = models.ForeignKey(
        AttendanceSession,
        on_delete=models.SET_NULL,
        related_name='attendances',
        blank=True,
        null=True
    )

    class Meta:
        db_table = 'attendance'
        ordering = ['-date', '-time_in']
        unique_together = ('user', 'date')

    def __str__(self):
        return f"{self.user.get_full_name()} ({self.role}) - {self.date} - {self.status}"
