"""
Academic models for ARALert — mirrors the new SQL schema exactly.

Role profile tables (School, Admin, Principal, Tutor, Faculty, Student)
plus all attendance, assessment, grade, report, prediction and alert tables.
"""

from django.db import models
from django.utils import timezone


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class AccountStatus(models.TextChoices):
    ACTIVE   = 'ACTIVE',   'Active'
    INACTIVE = 'INACTIVE', 'Inactive'


class ActorRole(models.TextChoices):
    SUPERADMIN = 'SUPERADMIN', 'Super Admin'
    ADMIN      = 'ADMIN',      'Admin'
    PRINCIPAL  = 'PRINCIPAL',  'Principal'
    TUTOR      = 'TUTOR',      'Tutor'
    FACULTY    = 'FACULTY',    'Faculty'
    STUDENT    = 'STUDENT',    'Student'


class RecordsType(models.TextChoices):
    ATTENDANCE  = 'ATTENDANCE RECORDS', 'Attendance Records'
    ASSESSMENT  = 'ASSESSMENT SCORES',  'Assessment Scores'
    MOSY        = 'MOSY',               'MOSY'
    EOSY        = 'EOSY',               'EOSY'


# ---------------------------------------------------------------------------
# School
# ---------------------------------------------------------------------------

class School(models.Model):
    """A DepEd-registered school.  Mirrors the SCHOOL table."""

    depedsch_id  = models.CharField(max_length=50, unique=True, verbose_name='DepEd School ID')
    sch_name     = models.CharField(max_length=255, verbose_name='School Name')
    sch_address  = models.CharField(max_length=255, blank=True, default='', verbose_name='Address')
    sch_division = models.CharField(max_length=100, blank=True, default='', verbose_name='Division')
    sch_region   = models.CharField(max_length=100, blank=True, default='', verbose_name='Region')

    class Meta:
        db_table = 'school'
        verbose_name = 'School'
        verbose_name_plural = 'Schools'

    def __str__(self):
        return f'{self.sch_name} ({self.depedsch_id})'


# ---------------------------------------------------------------------------
# Role Profile models (one per role, each linked to a User via OneToOneField)
# ---------------------------------------------------------------------------

class SuperAdminProfile(models.Model):
    """SuperAdmin profile.  Mirrors the SUPER_ADMIN table."""

    user           = models.OneToOneField(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='superadmin_profile',
    )
    account_status = models.CharField(
        max_length=10,
        choices=AccountStatus.choices,
        default=AccountStatus.ACTIVE,
    )
    date_created   = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'super_admin'
        verbose_name = 'Super Admin Profile'

    def __str__(self):
        return f'SuperAdmin – {self.user.email}'


class AdminProfile(models.Model):
    """School Admin profile.  Mirrors the ADMIN table (with sch_id added)."""

    user           = models.OneToOneField(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='admin_profile',
    )
    school         = models.ForeignKey(
        School,
        on_delete=models.PROTECT,
        related_name='admins',
        null=True,
        blank=True,
        verbose_name='School',
    )
    account_status = models.CharField(
        max_length=10,
        choices=AccountStatus.choices,
        default=AccountStatus.ACTIVE,
    )
    date_created   = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'admin'
        verbose_name = 'Admin Profile'

    def __str__(self):
        return f'Admin – {self.user.email}'


class PrincipalProfile(models.Model):
    """Principal profile.  Mirrors the PRINCIPAL table."""

    user           = models.OneToOneField(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='principal_profile',
    )
    school         = models.ForeignKey(
        School,
        on_delete=models.PROTECT,
        related_name='principals',
        verbose_name='School',
    )
    account_status = models.CharField(
        max_length=10,
        choices=AccountStatus.choices,
        default=AccountStatus.ACTIVE,
    )
    date_created   = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'principal'
        verbose_name = 'Principal Profile'

    def __str__(self):
        return f'Principal – {self.user.get_full_name()}'


class TutorProfile(models.Model):
    """Tutor profile.  Mirrors the TUTOR table."""

    user           = models.OneToOneField(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='tutor_profile',
    )
    school         = models.ForeignKey(
        School,
        on_delete=models.PROTECT,
        related_name='tutors',
        verbose_name='School',
    )
    tut_aral_level = models.CharField(max_length=50, blank=True, default='', verbose_name='ARAL Level')
    subject        = models.CharField(max_length=100, blank=True, default='', verbose_name='Subject')
    account_status = models.CharField(
        max_length=10,
        choices=AccountStatus.choices,
        default=AccountStatus.ACTIVE,
    )
    date_created   = models.DateTimeField(default=timezone.now)

    # Grading weights (used in prediction scoring)
    assessment_weight   = models.IntegerField(default=50, verbose_name='Assessment Weight (%)')
    weekly_tasks_weight = models.IntegerField(default=30, verbose_name='Weekly Tasks Weight (%)')
    attendance_weight   = models.IntegerField(default=20, verbose_name='Attendance Weight (%)')

    class Meta:
        db_table = 'tutor'
        verbose_name = 'Tutor Profile'

    def __str__(self):
        return f'Tutor – {self.user.get_full_name()}'


class FacultyProfile(models.Model):
    """Faculty profile.  Mirrors the FACULTY table."""

    user           = models.OneToOneField(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='faculty_profile',
    )
    school         = models.ForeignKey(
        School,
        on_delete=models.PROTECT,
        related_name='faculty_members',
        verbose_name='School',
    )
    fac_type       = models.CharField(max_length=50, blank=True, default='', verbose_name='Faculty Type')
    account_status = models.CharField(
        max_length=10,
        choices=AccountStatus.choices,
        default=AccountStatus.ACTIVE,
    )
    date_created   = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'faculty'
        verbose_name = 'Faculty Profile'

    def __str__(self):
        return f'Faculty – {self.user.get_full_name()}'


# ---------------------------------------------------------------------------
# Student (standalone — not a Django auth user)
# ---------------------------------------------------------------------------

class Student(models.Model):
    """
    Student record.  Mirrors the STUDENT table.
    Students authenticate via Full Name + LRN (not Google OAuth).
    Linked to a Django User for JWT auth purposes.
    """

    user           = models.OneToOneField(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='student_profile',
        null=True,
        blank=True,
        help_text='Linked Django user for JWT authentication.',
    )
    tutor          = models.ForeignKey(
        TutorProfile,
        on_delete=models.PROTECT,
        related_name='students',
        verbose_name='Assigned Tutor',
    )
    stu_fname      = models.CharField(max_length=100, verbose_name='First Name')
    stu_mname      = models.CharField(max_length=100, blank=True, default='', verbose_name='Middle Name')
    stu_lname      = models.CharField(max_length=100, verbose_name='Last Name')
    age            = models.IntegerField(null=True, blank=True)
    gender         = models.CharField(max_length=10, blank=True, default='')
    lrn            = models.CharField(
        max_length=12,
        unique=True,
        verbose_name='LRN',
        help_text='12-digit Learner Reference Number.',
    )
    aral_level     = models.CharField(max_length=50, blank=True, default='', verbose_name='ARAL Level')
    subject        = models.CharField(max_length=100, blank=True, default='', verbose_name='Subject')
    account_status = models.CharField(
        max_length=10,
        choices=AccountStatus.choices,
        default=AccountStatus.ACTIVE,
    )
    date_created   = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'student'
        verbose_name = 'Student'
        verbose_name_plural = 'Students'

    def get_full_name(self) -> str:
        fn = self.stu_fname.upper().strip() if self.stu_fname else ''
        ln = self.stu_lname.upper().strip() if self.stu_lname else ''
        mi = ''
        if self.stu_mname and self.stu_mname.strip():
            mi = f'{self.stu_mname.strip()[0].upper()}.'
        if ln and fn:
            return f"{ln}, {fn} {mi}".strip() if mi else f"{ln}, {fn}".strip()
        elif ln:
            return ln
        elif fn:
            return f"{fn} {mi}".strip() if mi else fn
        return ''

    def __str__(self):
        return f'{self.get_full_name()} (LRN: {self.lrn})'


# ---------------------------------------------------------------------------
# ARAL Enrollment
# ---------------------------------------------------------------------------

class AralEnrollment(models.Model):
    """Mirrors the ARAL_ENROLLMENT table."""

    admin       = models.ForeignKey(AdminProfile, on_delete=models.PROTECT, related_name='enrollments')
    tutor       = models.ForeignKey(TutorProfile, on_delete=models.PROTECT, related_name='enrollments')
    school      = models.ForeignKey(School, on_delete=models.PROTECT, related_name='enrollments')
    student     = models.ForeignKey(Student, on_delete=models.PROTECT, related_name='enrollments')
    school_year = models.CharField(max_length=20)
    status      = models.CharField(max_length=50, default='ACTIVE')

    class Meta:
        db_table = 'aral_enrollment'
        unique_together = [('student', 'school_year')]
        verbose_name = 'ARAL Enrollment'

    def __str__(self):
        return f'{self.student} — {self.school_year}'


# ---------------------------------------------------------------------------
# Attendance
# ---------------------------------------------------------------------------

class TutorAttendance(models.Model):
    """Mirrors TUTOR_ATTENDANCE."""

    tutor     = models.ForeignKey(TutorProfile, on_delete=models.PROTECT, related_name='attendance_records')
    principal = models.ForeignKey(PrincipalProfile, on_delete=models.PROTECT, related_name='tutor_attendance_records')
    status    = models.CharField(max_length=50)
    date      = models.DateField()

    class Meta:
        db_table = 'tutor_attendance'
        unique_together = [('tutor', 'date')]
        verbose_name = 'Tutor Attendance'

    def __str__(self):
        return f'{self.tutor} – {self.date} ({self.status})'


class FacultyAttendance(models.Model):
    """Mirrors FACULTY_ATTENDANCE."""

    faculty   = models.ForeignKey(FacultyProfile, on_delete=models.PROTECT, related_name='attendance_records')
    principal = models.ForeignKey(PrincipalProfile, on_delete=models.PROTECT, related_name='faculty_attendance_records')
    status    = models.CharField(max_length=50)
    date      = models.DateField()

    class Meta:
        db_table = 'faculty_attendance'
        unique_together = [('faculty', 'date')]
        verbose_name = 'Faculty Attendance'

    def __str__(self):
        return f'{self.faculty} – {self.date} ({self.status})'


class StudentAttendance(models.Model):
    """Mirrors STUDENT_ATTENDANCE."""

    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name='attendance_records')
    tutor   = models.ForeignKey(TutorProfile, on_delete=models.PROTECT, related_name='student_attendance_records')
    status  = models.CharField(max_length=50)
    date    = models.DateField()

    class Meta:
        db_table = 'student_attendance'
        unique_together = [('student', 'date')]
        verbose_name = 'Student Attendance'

    def __str__(self):
        return f'{self.student} – {self.date} ({self.status})'


# ---------------------------------------------------------------------------
# Grades
# ---------------------------------------------------------------------------

class MosyGrade(models.Model):
    """Middle of School Year grade.  Mirrors MOSY_GRADE."""

    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name='mosy_grades')
    grade   = models.DecimalField(max_digits=5, decimal_places=2)
    date    = models.DateField()

    class Meta:
        db_table = 'mosy_grade'
        unique_together = [('student', 'date')]
        verbose_name = 'MOSY Grade'

    def __str__(self):
        return f'{self.student} – MOSY {self.date}: {self.grade}'


class EosyGrade(models.Model):
    """End of School Year grade.  Mirrors EOSY_GRADE."""

    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name='eosy_grades')
    grade   = models.DecimalField(max_digits=5, decimal_places=2)
    date    = models.DateField()

    class Meta:
        db_table = 'eosy_grade'
        unique_together = [('student', 'date')]
        verbose_name = 'EOSY Grade'

    def __str__(self):
        return f'{self.student} – EOSY {self.date}: {self.grade}'


# ---------------------------------------------------------------------------
# Assessment Scores
# ---------------------------------------------------------------------------

class AssessmentScore(models.Model):
    """Mirrors ASSESSMENT_SCORE."""

    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name='assessment_scores')
    score   = models.DecimalField(max_digits=5, decimal_places=2)
    date    = models.DateField()

    class Meta:
        db_table = 'assessment_score'
        verbose_name = 'Assessment Score'

    def __str__(self):
        return f'{self.student} – score {self.score} on {self.date}'


class AssessScoreSummary(models.Model):
    """Mirrors ASSESSSCORE_SUMMARY."""

    assessment_score = models.ForeignKey(AssessmentScore, on_delete=models.PROTECT, related_name='summaries')
    student          = models.ForeignKey(Student, on_delete=models.PROTECT, related_name='score_summaries')
    total_weeks      = models.IntegerField()
    avg_score        = models.DecimalField(max_digits=5, decimal_places=2)
    passing_status   = models.CharField(max_length=50)
    date_computed    = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'assessscore_summary'
        verbose_name = 'Assessment Score Summary'

    def __str__(self):
        return f'{self.student} – avg {self.avg_score} ({self.passing_status})'


class StudentAttSummary(models.Model):
    """Mirrors STUDENTATT_SUMMARY."""

    student_attendance = models.ForeignKey(
        StudentAttendance, on_delete=models.PROTECT, related_name='summaries',
    )
    student         = models.ForeignKey(Student, on_delete=models.PROTECT, related_name='att_summaries')
    total_days      = models.IntegerField()
    days_present    = models.IntegerField()
    days_absent     = models.IntegerField()
    attendance_rate = models.DecimalField(max_digits=5, decimal_places=2)
    date_computed   = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'studentatt_summary'
        verbose_name = 'Student Attendance Summary'

    def __str__(self):
        return f'{self.student} – {self.attendance_rate}% attendance'


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

class Report(models.Model):
    """Mirrors the REPORT table."""

    tutor          = models.ForeignKey(TutorProfile, on_delete=models.PROTECT, related_name='reports')
    principal      = models.ForeignKey(PrincipalProfile, on_delete=models.PROTECT, related_name='reports')
    records_type   = models.CharField(max_length=30, choices=RecordsType.choices)
    records_id     = models.IntegerField()
    file_name      = models.CharField(max_length=255, blank=True, default='')
    date_generated = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'report'
        verbose_name = 'Report'

    def __str__(self):
        return f'Report [{self.records_type}] – {self.date_generated.date()}'


# ---------------------------------------------------------------------------
# Predictions & Alerts
# ---------------------------------------------------------------------------

class Prediction(models.Model):
    """Mirrors the PREDICTION table."""

    student_att_summary  = models.ForeignKey(
        StudentAttSummary, on_delete=models.PROTECT, related_name='predictions',
    )
    assess_score_summary = models.ForeignKey(
        AssessScoreSummary, on_delete=models.PROTECT, related_name='predictions',
    )
    predicted_results = models.CharField(max_length=50)
    date_predicted    = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'prediction'
        verbose_name = 'Prediction'

    def __str__(self):
        return f'Prediction – {self.predicted_results} ({self.date_predicted.date()})'


class TutorAlert(models.Model):
    """Mirrors TUTOR_ALERT."""

    prediction     = models.ForeignKey(Prediction, on_delete=models.PROTECT, related_name='tutor_alerts')
    tutor          = models.ForeignKey(TutorProfile, on_delete=models.PROTECT, related_name='alerts')
    message        = models.CharField(max_length=255)
    date_generated = models.DateTimeField(default=timezone.now)
    date_received  = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'tutor_alert'
        verbose_name = 'Tutor Alert'

    def __str__(self):
        return f'TutorAlert – {self.tutor} – {self.date_generated.date()}'


class PrincipalAlert(models.Model):
    """Mirrors PRINCIPAL_ALERT."""

    prediction     = models.ForeignKey(Prediction, on_delete=models.PROTECT, related_name='principal_alerts')
    principal      = models.ForeignKey(PrincipalProfile, on_delete=models.PROTECT, related_name='alerts')
    message        = models.CharField(max_length=255)
    date_generated = models.DateTimeField(default=timezone.now)
    date_received  = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'principal_alert'
        verbose_name = 'Principal Alert'

    def __str__(self):
        return f'PrincipalAlert – {self.principal} – {self.date_generated.date()}'


class StudentAlert(models.Model):
    """Mirrors STUDENT_ALERT."""

    prediction     = models.ForeignKey(Prediction, on_delete=models.PROTECT, related_name='student_alerts')
    student        = models.ForeignKey(Student, on_delete=models.PROTECT, related_name='alerts')
    message        = models.CharField(max_length=255)
    date_generated = models.DateTimeField(default=timezone.now)
    date_received  = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'student_alert'
        verbose_name = 'Student Alert'

    def __str__(self):
        return f'StudentAlert – {self.student} – {self.date_generated.date()}'


# ---------------------------------------------------------------------------
# Activity Log
# ---------------------------------------------------------------------------

class UserActivityLog(models.Model):
    """Mirrors USER_ACTIVITY_LOG.  Tracks all actions in the system."""

    # Either supadmin_id OR (actor_role + actor_id) is set — never both.
    supadmin    = models.ForeignKey(
        SuperAdminProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='activity_logs',
    )
    actor_role  = models.CharField(
        max_length=20,
        choices=ActorRole.choices,
        null=True,
        blank=True,
    )
    actor_id    = models.IntegerField(null=True, blank=True)
    action      = models.CharField(max_length=255)
    timestamp   = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'user_activity_log'
        verbose_name = 'User Activity Log'
        ordering = ['-timestamp']

    def __str__(self):
        actor = f'SuperAdmin #{self.supadmin_id}' if self.supadmin_id else f'{self.actor_role} #{self.actor_id}'
        return f'[{self.timestamp:%Y-%m-%d %H:%M}] {self.action} by {actor}'


# ---------------------------------------------------------------------------
# Legacy model aliases — keep so existing views that import `Attendance`,
# `AcademicRisk`, and `Grade` don't immediately break.
# ---------------------------------------------------------------------------

class Attendance(models.Model):
    """Legacy stub — use StudentAttendance / TutorAttendance / FacultyAttendance instead."""

    user   = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='legacy_attendance')
    status = models.CharField(max_length=50, default='present')
    date   = models.DateField()

    class Meta:
        db_table  = 'legacy_attendance'
        managed   = False

    def __str__(self):
        return f'{self.user} – {self.date} ({self.status})'


class AcademicRisk(models.Model):
    """Legacy stub — use Prediction instead."""

    student    = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='legacy_risks')
    risk_level = models.CharField(max_length=20, default='low')
    resolved   = models.BooleanField(default=False)

    class Meta:
        db_table = 'legacy_academic_risk'
        managed  = False

    def __str__(self):
        return f'{self.student} – {self.risk_level}'


class Grade(models.Model):
    """Legacy stub — use AssessmentScore / MosyGrade / EosyGrade instead."""

    student        = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='legacy_grades')
    component_type = models.CharField(max_length=50, default='assessment')
    score          = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    total_score    = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = 'legacy_grade'
        managed  = False

    def __str__(self):
        return f'{self.student} – {self.component_type}: {self.score}'


# ---------------------------------------------------------------------------
# API-layer models — managed=False, map to the api_* tables created by
# the original migration. These power the academics REST API endpoints.
# ---------------------------------------------------------------------------

class ApiGrade(models.Model):
    """Maps to the api_grade table. Used by the academics REST API."""

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
        db_table = 'api_grade'
        managed  = False
        ordering = ['-date_logged', '-id']

    def __str__(self):
        return f'{self.student} – {self.subject} Q{self.quarter}: {self.score}'


# Ensure unmanaged api_grade table has created_at column if missing (e.g. SQLite legacy DB)
try:
    from django.db import connection
    if 'api_grade' in connection.introspection.table_names():
        with connection.cursor() as _cur:
            if connection.vendor == 'sqlite':
                _cur.execute("PRAGMA table_info(api_grade)")
                _cols = [row[1] for row in _cur.fetchall()]
                if _cols and 'created_at' not in _cols:
                    _cur.execute("ALTER TABLE api_grade ADD COLUMN created_at datetime")
                    _cur.execute("UPDATE api_grade SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL")
except Exception:
    pass



class ApiAralActivity(models.Model):
    """Maps to the api_aral_activity table."""

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
        db_table = 'api_aral_activity'
        managed  = False

    def __str__(self):
        return f'{self.title} – {self.student}'


class ApiAcademicRisk(models.Model):
    """Maps to the api_academic_risk table."""

    class RiskLevel(models.TextChoices):
        LOW    = 'low',    'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH   = 'high',   'High'

    student               = models.ForeignKey(
        'accounts.User', on_delete=models.CASCADE,
        related_name='api_academic_risks', db_column='student_id',
    )
    risk_level            = models.CharField(max_length=10, choices=RiskLevel.choices)
    details               = models.TextField()
    date_created          = models.DateTimeField()
    resolved              = models.BooleanField(default=False)
    student_acknowledged  = models.BooleanField(default=False)

    class Meta:
        db_table = 'api_academic_risk'
        managed  = False

    def __str__(self):
        return f'{self.student} – {self.risk_level}'


class ApiAttendanceSession(models.Model):
    """Maps to the api_attendance_session table."""

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
        db_table = 'api_attendance_session'
        managed  = False

    def __str__(self):
        return f'Session {self.id} ({self.session_type})'


class ApiAttendance(models.Model):
    """Maps to the api_attendance table."""

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
        db_table     = 'api_attendance'
        managed      = False
        unique_together = [('user', 'date')]

    def __str__(self):
        return f'{self.user} – {self.date} ({self.status})'
