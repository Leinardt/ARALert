"""
Summer Remediation Service for ARALert.
Tracks Summer eligibility (Basic failed twice historically, Plus failed EOSY),
Summer intervention lifecycle, and Summer evaluations without modifying normal school year enrollments.
"""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from apps.accounts.models import User
from apps.academics.models import (
    SchoolYear,
    StudentEnrollment,
    SummerRecord,
    ApiGrade,
)


def count_historical_basic_failures(student: User) -> int:
    """
    Count total times this student has failed a Basic evaluation across all historical enrollments and grades.
    Does NOT reset across school years.
    """
    failed_years = set(
        StudentEnrollment.objects.filter(
            student=student,
            program='basic',
            eosy_result='failed',
        ).values_list('school_year__school_year', flat=True)
    )

    for g in ApiGrade.objects.filter(student=student, subject__icontains='EOSY'):
        ts = float(g.total_score or 40)
        sc = float(g.score or 0)
        passed = sc >= 28.0 if ts == 40 else (sc / ts) >= 0.7
        if not passed:
            failed_years.add(f"grade-year-{g.date_logged.year}")

    return len(failed_years)


def check_and_create_summer_record_if_eligible(
    student: User,
    enrollment: StudentEnrollment,
    eosy_result: str,
    school_year_str: str,
) -> SummerRecord | None:
    """
    Evaluate if student requires Summer remediation based on EOSY result.
    - Basic student: requires Summer if this is their 2nd Basic failure.
    - Plus student: requires Summer if they failed EOSY.
    """
    if eosy_result != 'failed':
        return None

    program = enrollment.program.lower().strip()
    reason = None

    if program == 'basic':
        failures = count_historical_basic_failures(student)
        # Note: If current enrollment just failed, it counts towards the total
        if failures >= 2:
            reason = SummerRecord.Reason.BASIC_FAILED_TWICE
    elif program == 'plus':
        reason = SummerRecord.Reason.PLUS_FAILED

    if not reason:
        return None

    # Check if a SummerRecord already exists for this enrollment
    existing = SummerRecord.objects.filter(
        student=student,
        previous_enrollment=enrollment,
    ).first()

    if existing:
        return existing

    summer_rec = SummerRecord.objects.create(
        student=student,
        previous_enrollment=enrollment,
        previous_program=enrollment.program,
        previous_school_year=school_year_str,
        reason=reason,
        summer_status=SummerRecord.Status.REQUIRED,
        summer_evaluation_status=SummerRecord.EvaluationStatus.PENDING,
    )

    # Update enrollment summer_status
    enrollment.summer_status = StudentEnrollment.SummerStatus.REQUIRED
    enrollment.save(update_fields=['summer_status', 'updated_at'])

    return summer_rec


def start_summer_participation(summer_record_id: int) -> SummerRecord:
    """
    Transition Summer record from 'summer_required' to 'summer_active'.
    """
    record = SummerRecord.objects.get(id=summer_record_id)
    record.summer_status = SummerRecord.Status.ACTIVE
    record.start_date = timezone.localdate()
    record.save(update_fields=['summer_status', 'start_date'])

    if record.previous_enrollment:
        record.previous_enrollment.summer_status = StudentEnrollment.SummerStatus.ACTIVE
        record.previous_enrollment.save(update_fields=['summer_status', 'updated_at'])

    return record


def record_summer_evaluation(
    summer_record_id: int,
    result: str,
    evaluator: User | None = None,
    notes: str = '',
) -> SummerRecord:
    """
    Record Summer evaluation (Passed / Failed) and update status accordingly.
    """
    res = result.lower().strip()
    if res not in ('passed', 'failed'):
        raise ValidationError({'result': 'Summer result must be either "passed" or "failed".'})

    with transaction.atomic():
        record = SummerRecord.objects.get(id=summer_record_id)
        record.summer_evaluation_status = SummerRecord.EvaluationStatus.COMPLETED
        record.summer_result = res
        record.summer_status = (
            SummerRecord.Status.PASSED if res == 'passed' else SummerRecord.Status.FAILED
        )
        record.completion_date = timezone.localdate()
        if evaluator:
            record.evaluating_tutor = evaluator
        if notes:
            record.notes = notes
        record.save()

        # Update enrollment summer status
        if record.previous_enrollment:
            enr_status = (
                StudentEnrollment.SummerStatus.PASSED
                if res == 'passed'
                else StudentEnrollment.SummerStatus.FAILED
            )
            record.previous_enrollment.summer_status = enr_status
            record.previous_enrollment.save(update_fields=['summer_status', 'updated_at'])

        # Create corresponding ApiGrade entry for Summer milestone
        student = record.student
        eval_score = 30.0 if res == 'passed' else 20.0
        ApiGrade.objects.create(
            student=student,
            tutor=evaluator,
            subject='ARAL Summer Assessment',
            quarter=4,
            score=eval_score,
            total_score=40.0,
            component_type='assessment',
            remarks=f'Summer Evaluation: {res.upper()}',
            date_logged=timezone.localdate(),
            batch_id=f'summer-{record.id}',
        )

    return record


def get_summer_dashboard_data() -> list[dict]:
    """
    List all students requiring or undergoing Summer intervention for Admin Summer Dashboard.
    """
    records = SummerRecord.objects.select_related(
        'student', 'previous_enrollment', 'evaluating_tutor'
    ).order_by('-created_at')

    results = []
    for rec in records:
        student = rec.student
        evaluator_name = rec.evaluating_tutor.get_full_name() if rec.evaluating_tutor else 'Pending Assignment'

        status_display = {
            'summer_required': 'Summer Required',
            'summer_active': 'Summer Active',
            'evaluation_pending': 'Summer Evaluation Pending',
            'summer_passed': 'Summer Passed',
            'summer_failed': 'Summer Failed',
            'summer_completed': 'Summer Completed',
        }.get(rec.summer_status, rec.summer_status)

        results.append({
            'id': rec.id,
            'student_id': str(student.id),
            'student_name': student.get_full_name(),
            'lrn': student.lrn,
            'program': rec.previous_program.capitalize(),
            'previous_school_year': rec.previous_school_year,
            'reason': rec.get_reason_display(),
            'reason_code': rec.reason,
            'status': rec.summer_status,
            'status_display': status_display,
            'evaluation_status': rec.summer_evaluation_status,
            'result': rec.summer_result.capitalize() if rec.summer_result else 'Pending',
            'start_date': str(rec.start_date) if rec.start_date else None,
            'completion_date': str(rec.completion_date) if rec.completion_date else None,
            'evaluator_name': evaluator_name,
            'notes': rec.notes,
        })

    return results
