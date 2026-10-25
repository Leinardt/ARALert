"""
MOSY Service for ARALert.
Handles MOSY Evaluation monitoring, tutor progress calculation, and MOSY completion processing
where Plus students become Unassigned awaiting Plus tutor assignment and Basic students retain their tutor.
"""

import logging
from django.db import transaction
from django.utils import timezone
from apps.accounts.models import User
from apps.academics.models import (
    SchoolYear,
    StudentEnrollment,
    TutorAssignmentHistory,
    ApiGrade,
)

logger = logging.getLogger(__name__)


def parse_mosy_grade_status(grade: ApiGrade | None) -> tuple[str, str, float | None]:
    if not grade:
        return 'pending', 'pending', None

    try:
        ts = float(grade.total_score) if grade.total_score is not None else 40.0
    except (ValueError, TypeError):
        ts = 40.0
    if ts <= 0:
        ts = 40.0

    try:
        sc = float(grade.score) if grade.score is not None else 0.0
    except (ValueError, TypeError):
        sc = 0.0

    pct = round((sc / ts) * 100.0, 1)
    passed = sc >= 28.0 if ts == 40 else (sc / ts) >= 0.7
    result = 'passed' if passed else 'failed'
    return 'completed', result, pct


def _get_safe_assigned_tutor(student: User) -> User | None:
    """Safely retrieves the assigned tutor without raising User.DoesNotExist if orphaned."""
    if not getattr(student, 'assigned_tutor_id', None):
        return None
    try:
        tutor = student.assigned_tutor
        if tutor and getattr(tutor, 'role', '') == 'tutor':
            return tutor
        return None
    except Exception:
        return None


def get_student_mosy_status(student: User, school_year: SchoolYear | None = None, grade_obj: ApiGrade | None = None) -> tuple[str, str, float | None]:
    """
    Check MOSY evaluation status and grade for a student.
    Returns (status: 'completed' | 'pending', result: 'passed' | 'failed' | 'pending', score_pct).
    Passing score: >= 28/40 (70%).
    """
    if grade_obj is not None:
        return parse_mosy_grade_status(grade_obj)

    grade = ApiGrade.objects.filter(
        student=student,
        subject__icontains='MOSY',
    ).order_by('-date_logged').first()

    return parse_mosy_grade_status(grade)


def get_mosy_monitoring_data(school_year: SchoolYear | None = None) -> dict:
    """
    Calculate tutor MOSY progress and institutional MOSY evaluation metrics.
    A tutor is Completed ONLY when every required assigned student has completed MOSY evaluation.
    """
    if not school_year:
        school_year = SchoolYear.objects.filter(is_active=True).first()

    tutors = User.objects.filter(role='tutor', is_active=True, is_superuser=False).prefetch_related('assigned_students')

    # Bulk preload latest MOSY grade for all students in 1 query
    mosy_grades = ApiGrade.objects.filter(subject__icontains='MOSY').order_by('student_id', '-date_logged')
    mosy_grade_by_student = {}
    for g in mosy_grades:
        if g.student_id not in mosy_grade_by_student:
            mosy_grade_by_student[g.student_id] = g

    completed_tutors_count = 0
    in_progress_tutors_count = 0
    pending_tutors_count = 0

    total_students_evaluated = 0
    students_remaining = 0
    total_assigned_students = 0

    tutors_progress_list = []
    incomplete_tutors_list = []

    for tutor in tutors:
        assigned_students = [s for s in tutor.assigned_students.all() if s.is_active]
        assigned_count = len(assigned_students)

        if assigned_count == 0:
            tutor_data = {
                'tutor_id': str(tutor.id),
                'tutor_name': tutor.get_full_name(),
                'email': tutor.email,
                'tutor_type': tutor.tutor_type or 'basic',
                'assigned_students_count': 0,
                'evaluated_count': 0,
                'remaining_count': 0,
                'status': 'Pending',  # 0 students is Pending until students are assigned and evaluated
                'has_no_students': True,
                'incomplete_students': [],
            }
            tutors_progress_list.append(tutor_data)
            pending_tutors_count += 1
            incomplete_tutors_list.append(tutor_data)
            continue

        total_assigned_students += assigned_count
        evaluated_in_tutor = 0
        incomplete_students = []

        for student in assigned_students:
            grade = mosy_grade_by_student.get(student.id)
            status, result, pct = get_student_mosy_status(student, school_year, grade_obj=grade)
            if status == 'completed':
                evaluated_in_tutor += 1
                total_students_evaluated += 1
            else:
                students_remaining += 1
                incomplete_students.append({
                    'id': str(student.id),
                    'full_name': student.get_full_name(),
                    'lrn': student.lrn,
                    'program': student.aral_level or 'basic',
                })

        rem = assigned_count - evaluated_in_tutor
        if rem == 0:
            tutor_status = 'Completed'
            completed_tutors_count += 1
        elif evaluated_in_tutor > 0:
            tutor_status = 'In Progress'
            in_progress_tutors_count += 1
        else:
            tutor_status = 'Pending'
            pending_tutors_count += 1

        tutor_data = {
            'tutor_id': str(tutor.id),
            'tutor_name': tutor.get_full_name(),
            'email': tutor.email,
            'tutor_type': tutor.tutor_type or 'basic',
            'assigned_students_count': assigned_count,
            'evaluated_count': evaluated_in_tutor,
            'remaining_count': rem,
            'status': tutor_status,
            'has_no_students': False,
            'incomplete_students': incomplete_students,
        }
        tutors_progress_list.append(tutor_data)

        if rem > 0:
            incomplete_tutors_list.append(tutor_data)

    is_all_complete = (
        students_remaining == 0 and total_assigned_students > 0 and pending_tutors_count == 0 and in_progress_tutors_count == 0
    )

    return {
        'school_year': school_year.school_year if school_year else '2026-2027',
        'total_tutors': tutors.count(),
        'completed_tutors': completed_tutors_count,
        'in_progress_tutors': in_progress_tutors_count,
        'pending_tutors': pending_tutors_count,
        'total_assigned_students': total_assigned_students,
        'total_students_evaluated': total_students_evaluated,
        'students_remaining': students_remaining,
        'is_all_complete': is_all_complete,
        'tutors_progress': tutors_progress_list,
        'incomplete_tutors': incomplete_tutors_list,
    }


def process_mosy_completion(admin_user: User | None = None) -> dict:
    """
    Execute MOSY completion processing:
    1. Synchronize student MOSY grades into StudentEnrollment.
    2. Students who are Plus after MOSY become:
       'Unassigned / Awaiting Plus Tutor Assignment'.
       Their previous tutor is preserved in TutorAssignmentHistory.
    3. Basic students remain assigned to their compatible Basic tutor.
    """
    active_sy = SchoolYear.objects.filter(is_active=True).first()
    if not active_sy:
        active_sy, _ = SchoolYear.objects.get_or_create(
            school_year='2026-2027',
            defaults={'status': 'ACTIVE', 'is_active': True}
        )

    students = list(User.objects.filter(role='student', is_active=True).select_related('assigned_tutor'))
    plus_unassigned_count = 0
    basic_retained_count = 0

    # Preload latest MOSY grade for all students in 1 query
    mosy_grades = ApiGrade.objects.filter(subject__icontains='MOSY').order_by('student_id', '-date_logged')
    mosy_grade_by_student = {}
    for g in mosy_grades:
        if g.student_id not in mosy_grade_by_student:
            mosy_grade_by_student[g.student_id] = g

    # Preload enrollments for active school year in 1 query
    existing_enrollments = {
        e.student_id: e
        for e in StudentEnrollment.objects.filter(school_year=active_sy, student__in=students)
    }

    with transaction.atomic():
        for student in students:
            grade_obj = mosy_grade_by_student.get(student.id)
            eval_status, result, pct = get_student_mosy_status(student, active_sy, grade_obj=grade_obj)

            enrollment = existing_enrollments.get(student.id)
            raw_level = (student.aral_level or 'basic').lower()
            enrollment_prog = raw_level if raw_level in ('basic', 'plus', 'summer') else ('plus' if raw_level == 'graduated' else 'basic')
            current_tutor = _get_safe_assigned_tutor(student)

            if not enrollment:
                enrollment = StudentEnrollment.objects.create(
                    student=student,
                    school_year=active_sy,
                    program=enrollment_prog,
                    assigned_tutor=current_tutor,
                    enrollment_status='completed' if raw_level == 'graduated' else 'active',
                    graduation_status='graduated' if raw_level == 'graduated' else 'not_eligible',
                )
                existing_enrollments[student.id] = enrollment

            # Update MOSY result
            if eval_status == 'completed':
                enrollment.mosy_result = result
                # Basic passed MOSY -> Promoted to Plus level
                if enrollment.program == 'basic' and result == 'passed':
                    enrollment.program = 'plus'
                    student.aral_level = 'plus'
                    if (student.subject or '').strip().lower() in ('filipino', 'reading', ''):
                        student.subject = 'English'
                # Plus passed MOSY -> Graduated
                elif enrollment.program == 'plus' and result == 'passed':
                    enrollment.graduation_status = 'graduated'
                    enrollment.enrollment_status = 'completed'
                    student.aral_level = 'graduated'

            # CLEAN-SLATE RESET: All students (Plus and Basic) are unassigned after MOSY.
            # Every active TutorAssignmentHistory record is concluded with an end date.
            # Admin will reassign fresh cohorts to all tutors (who become fully vacant).
            previous_tutor = current_tutor
            mosy_result_label = result if eval_status == 'completed' else 'pending'

            if previous_tutor:
                prev_name = previous_tutor.get_full_name() or previous_tutor.username
                updated_count = TutorAssignmentHistory.objects.filter(
                    student=student,
                    school_year=active_sy,
                    is_active=True,
                ).update(
                    is_active=False,
                    end_date=timezone.localdate(),
                    period='MOSY',
                    notes=f'Concluded after MOSY period — MOSY result: {mosy_result_label}. (Previously: {prev_name})'
                )
                if updated_count == 0:
                    try:
                        TutorAssignmentHistory.objects.create(
                            student=student,
                            tutor=previous_tutor,
                            school_year=active_sy,
                            period='MOSY',
                            program=enrollment.program or 'basic',
                            start_date=timezone.localdate(),
                            end_date=timezone.localdate(),
                            is_active=False,
                            notes=f'Concluded after MOSY period — MOSY result: {mosy_result_label}.'
                        )
                    except Exception as hist_err:
                        logger.warning('Failed to create history for student %s: %s', student.id, hist_err)

            student.assigned_tutor = None
            student.save()
            enrollment.assigned_tutor = None
            enrollment.save()

            if student.aral_level == 'plus' or enrollment.program == 'plus':
                plus_unassigned_count += 1
            else:
                basic_retained_count += 1

    return {
        'status': 'SUCCESS',
        'message': f'MOSY period finalized. All student-tutor pairings concluded: {plus_unassigned_count} Plus student(s) and {basic_retained_count} Basic student(s) are now unassigned and ready for cohort reassignment by Admin.',
        'plus_unassigned_count': plus_unassigned_count,
        'basic_unassigned_count': basic_retained_count,
    }


def get_mosy_assignment_dashboard_data(school_year: SchoolYear | None = None) -> dict:
    """
    Returns data for the Admin MOSY Tutor Assignment Dashboard after clean-slate reset:
    - Unassigned Plus Students (leveled up from Basic, or already Plus)
    - Unassigned Basic Students (failed MOSY retake, or pending evaluation)
    - Graduated Students
    All tutors are vacant; Admin assigns fresh cohorts of 15-25 mixed-grade students.
    """
    if not school_year:
        school_year = SchoolYear.objects.filter(is_active=True).first()

    active_sy_str = school_year.school_year if school_year else '2026-2027'

    # 1. Unassigned Plus & Basic Students (bulk loaded)
    plus_students = list(User.objects.filter(
        role='student',
        aral_level='plus',
        assigned_tutor__isnull=True,
        is_active=True,
    ))
    basic_students = list(User.objects.filter(
        role='student',
        aral_level='basic',
        assigned_tutor__isnull=True,
        is_active=True,
    ))

    all_unassigned_ids = [s.id for s in plus_students + basic_students]
    last_assignment_map = {}
    mosy_grade_map = {}

    if all_unassigned_ids:
        all_assignments = (
            TutorAssignmentHistory.objects.filter(student_id__in=all_unassigned_ids)
            .select_related('tutor')
            .order_by('student_id', '-start_date', '-created_at')
        )
        for a in all_assignments:
            if a.student_id not in last_assignment_map:
                last_assignment_map[a.student_id] = a

        unassigned_grades = (
            ApiGrade.objects.filter(student_id__in=all_unassigned_ids, subject__icontains='MOSY')
            .order_by('student_id', '-date_logged')
        )
        for g in unassigned_grades:
            if g.student_id not in mosy_grade_map:
                mosy_grade_map[g.student_id] = g

    unassigned_plus = []
    for s in plus_students:
        last_assignment = last_assignment_map.get(s.id)
        prev_tutor_name = 'None'
        if last_assignment:
            try:
                if last_assignment.tutor:
                    prev_tutor_name = last_assignment.tutor.get_full_name() or last_assignment.tutor.username
            except Exception:
                prev_tutor_name = 'None'
        grade = mosy_grade_map.get(s.id)
        status, result, pct = get_student_mosy_status(s, school_year, grade_obj=grade)

        # Determine retake status badge
        prev_program = last_assignment.program if last_assignment else 'basic'
        if prev_program == 'basic' and result == 'passed':
            status_badge = 'Leveled Up to PLUS'
            status_color = 'green'
        else:
            status_badge = 'Ready for Q3/Q4 PLUS Cohort'
            status_color = 'blue'

        unassigned_plus.append({
            'id': str(s.id),
            'full_name': s.get_full_name(),
            'lrn': s.lrn,
            'program': 'Plus',
            'school_year': active_sy_str,
            'mosy_status': 'Completed' if status == 'completed' else 'Pending',
            'mosy_result': result.capitalize() if result != 'pending' else 'Pending',
            'mosy_score_pct': pct,
            'previous_tutor': prev_tutor_name,
            'assignment_status': 'Awaiting Plus Tutor Assignment',
            'status_badge': status_badge,
            'status_color': status_color,
        })

    unassigned_basic = []
    for s in basic_students:
        grade = mosy_grade_map.get(s.id)
        status, result, pct = get_student_mosy_status(s, school_year, grade_obj=grade)
        last_assignment = last_assignment_map.get(s.id)
        prev_tutor_name = 'None'
        if last_assignment:
            try:
                if last_assignment.tutor:
                    prev_tutor_name = last_assignment.tutor.get_full_name() or last_assignment.tutor.username
            except Exception:
                prev_tutor_name = 'None'

        if result == 'failed':
            status_badge = 'Needs Basic Retake (Q3/Q4 or Summer)'
            status_color = 'yellow'
        elif result == 'passed':
            # Passed but not yet promoted — edge case (process not yet finalized)
            status_badge = 'Passed MOSY — Awaiting Level-Up'
            status_color = 'green'
        else:
            status_badge = 'Pending MOSY Evaluation'
            status_color = 'gray'

        unassigned_basic.append({
            'id': str(s.id),
            'full_name': s.get_full_name(),
            'lrn': s.lrn,
            'program': 'Basic',
            'school_year': active_sy_str,
            'mosy_status': 'Completed' if status == 'completed' else 'Pending',
            'mosy_result': result.capitalize() if result != 'pending' else 'Pending',
            'mosy_score_pct': pct,
            'previous_tutor': prev_tutor_name,
            'assignment_status': 'Awaiting Basic Tutor Reassignment',
            'status_badge': status_badge,
            'status_color': status_color,
        })

    # 3. Graduated Students
    graduated_list = []
    graduated_students = User.objects.filter(
        role='student',
        aral_level='graduated',
    )
    for s in graduated_students:
        graduated_list.append({
            'id': str(s.id),
            'full_name': s.get_full_name(),
            'lrn': s.lrn,
            'program': 'Graduated',
            'school_year': active_sy_str,
            'status': 'Graduated',
            'requires_tutor': False,
        })

    total_unassigned = len(unassigned_plus) + len(unassigned_basic)

    return {
        'school_year': active_sy_str,
        'unassigned_plus_students': unassigned_plus,
        'unassigned_basic_students': unassigned_basic,
        # Keep for backward compat
        'basic_students': unassigned_basic,
        'graduated_students': graduated_list,
        'total_unassigned': total_unassigned,
    }



def get_unified_assignment_queue(school_year=None):
    """
    Returns a unified view of ALL non-graduated, unassigned students categorized
    by their required program level and progression status reason.

    Used by the Admin Post-Milestone Reassignment Queue panel.

    Returns:
    {
        school_year: str,
        total_unassigned: int,
        plus_queue: [
            {id, full_name, lrn, required_program, mosy_result, eosy_result, status_reason,
             status_badge, status_color, previous_tutor, mosy_score_pct}
        ],
        basic_queue: [...],
        summary: {
            total_plus_queue: int,
            total_basic_queue: int,
            needs_plus_tutor: int,
            needs_basic_tutor: int,
        }
    }
    """
    from apps.academics.models import TutorAssignmentHistory, StudentEnrollment, SummerRecord
    from apps.accounts.models import User
    from apps.academics.models import SchoolYear

    if not school_year:
        school_year = SchoolYear.objects.filter(is_active=True).first()

    active_sy_str = school_year.school_year if school_year else '2026-2027'

    plus_queue = []
    basic_queue = []

    # --- All unassigned non-graduated active students ---
    unassigned_students = list(User.objects.filter(
        role='student',
        is_active=True,
        assigned_tutor__isnull=True,
    ).exclude(aral_level='graduated'))

    student_ids = [s.id for s in unassigned_students]
    last_assignment_map = {}
    enrollment_map = {}
    summer_map = {}

    if student_ids:
        assignments = (
            TutorAssignmentHistory.objects.filter(student_id__in=student_ids)
            .select_related('tutor')
            .order_by('student_id', '-start_date', '-created_at')
        )
        for a in assignments:
            if a.student_id not in last_assignment_map:
                last_assignment_map[a.student_id] = a

        enrollments = (
            StudentEnrollment.objects.filter(student_id__in=student_ids, school_year=school_year)
            .order_by('student_id', '-created_at')
        )
        for e in enrollments:
            if e.student_id not in enrollment_map:
                enrollment_map[e.student_id] = e

        summer_records = (
            SummerRecord.objects.filter(student_id__in=student_ids)
            .order_by('student_id', '-created_at')
        )
        for sr in summer_records:
            if sr.student_id not in summer_map:
                summer_map[sr.student_id] = sr

    for s in unassigned_students:
        level = (s.aral_level or 'basic').lower()

        last_assignment = last_assignment_map.get(s.id)
        prev_tutor = 'None'
        if last_assignment:
            try:
                if last_assignment.tutor:
                    prev_tutor = last_assignment.tutor.get_full_name() or last_assignment.tutor.username
            except Exception:
                prev_tutor = 'None'
        prev_program = (last_assignment.program or 'basic').lower() if last_assignment else 'basic'

        # Enrollment data for result context
        enrollment = enrollment_map.get(s.id)

        mosy_result = (enrollment.mosy_result or 'pending').lower() if enrollment else 'pending'
        eosy_result = (enrollment.eosy_result or 'pending').lower() if enrollment else 'pending'

        # Summer context
        summer_rec = summer_map.get(s.id)
        summer_status = summer_rec.summer_status if summer_rec else None

        # Determine status reason and badge
        if level == 'plus':
            if prev_program == 'basic' and mosy_result == 'passed':
                status_reason = 'Leveled up from Basic after MOSY'
                status_badge = 'Leveled Up to PLUS'
                status_color = 'green'
            elif summer_status in ('summer_failed',):
                status_reason = 'Failed Summer — eligible for early Q1/Q2 Plus retake'
                status_badge = 'Early Plus Retake (Q1/Q2)'
                status_color = 'orange'
            elif eosy_result == 'failed':
                status_reason = 'Failed EOSY — enrolled in Summer remediation'
                status_badge = 'Summer Remediation Queued'
                status_color = 'red'
            else:
                status_reason = 'Continuing Plus student — ready for Q3/Q4 cohort'
                status_badge = 'Ready for Q3/Q4 PLUS Cohort'
                status_color = 'blue'

            plus_queue.append({
                'id': str(s.id),
                'full_name': s.get_full_name(),
                'lrn': s.lrn,
                'required_program': 'plus',
                'mosy_result': mosy_result.capitalize(),
                'eosy_result': eosy_result.capitalize(),
                'mosy_score_pct': None,
                'previous_tutor': prev_tutor,
                'status_reason': status_reason,
                'status_badge': status_badge,
                'status_color': status_color,
            })

        elif level == 'basic':
            if mosy_result == 'failed':
                status_reason = 'Failed MOSY — eligible for Q3/Q4 Basic retake or Summer'
                status_badge = 'Needs Basic Retake (Q3/Q4 or Summer)'
                status_color = 'yellow'
            elif mosy_result == 'passed':
                status_reason = 'Passed MOSY — awaiting level-up confirmation'
                status_badge = 'Passed MOSY - Awaiting Levelup'
                status_color = 'green'
            elif summer_status in ('summer_failed',):
                status_reason = 'Failed Summer — eligible for early Plus retake'
                status_badge = 'Failed Summer Retake'
                status_color = 'orange'
            else:
                status_reason = 'Pending MOSY evaluation or new enrollment'
                status_badge = 'Pending Evaluation'
                status_color = 'gray'

            basic_queue.append({
                'id': str(s.id),
                'full_name': s.get_full_name(),
                'lrn': s.lrn,
                'required_program': 'basic',
                'mosy_result': mosy_result.capitalize(),
                'eosy_result': eosy_result.capitalize(),
                'mosy_score_pct': None,
                'previous_tutor': prev_tutor,
                'status_reason': status_reason,
                'status_badge': status_badge,
                'status_color': status_color,
            })

    total_unassigned = len(plus_queue) + len(basic_queue)

    return {
        'school_year': active_sy_str,
        'total_unassigned': total_unassigned,
        'plus_queue': plus_queue,
        'basic_queue': basic_queue,
        'summary': {
            'total_plus_queue': len(plus_queue),
            'total_basic_queue': len(basic_queue),
            'needs_plus_tutor': len(plus_queue),
            'needs_basic_tutor': len(basic_queue),
        },
    }
