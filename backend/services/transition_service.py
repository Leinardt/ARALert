"""
School Year Transition Service for ARALert.
Implements EOSY Gate validation, Transition Summary Preview, and the 11-step atomic database transition
with full rollback safety and transition audit logging.
"""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from apps.accounts.models import User
from apps.academics.models import (
    SchoolYear,
    StudentEnrollment,
    TutorAssignmentHistory,
    TransitionAuditLog,
    ApiGrade,
)
from services.summer_service import (
    check_and_create_summer_record_if_eligible,
    count_historical_basic_failures,
)


def get_student_eosy_status(student: User, school_year: SchoolYear | None = None) -> tuple[str, str, float | None]:
    """
    Check EOSY evaluation status and grade for a student.
    Returns (status: 'completed' | 'pending', result: 'passed' | 'failed' | 'pending', score_pct).
    Passing score: >= 28/40 (70%).
    """
    grade = ApiGrade.objects.filter(
        student=student,
        subject__icontains='EOSY',
    ).order_by('-date_logged').first()

    if not grade:
        return 'pending', 'pending', None

    ts = float(grade.total_score or 40)
    sc = float(grade.score or 0)
    pct = round((sc / ts) * 100.0, 1)
    passed = sc >= 28.0 if ts == 40 else (sc / ts) >= 0.7
    result = 'passed' if passed else 'failed'
    return 'completed', result, pct


def get_next_school_year_string(current_sy_str: str) -> str:
    """e.g. '2025-2026' -> '2026-2027'"""
    try:
        parts = current_sy_str.split('-')
        start_year = int(parts[0])
        end_year = int(parts[1])
        return f"{start_year + 1}-{end_year + 1}"
    except Exception:
        year = timezone.now().year
        return f"{year}-{year + 1}"


def get_eosy_monitoring_data(school_year: SchoolYear | None = None) -> dict:
    """
    Calculate tutor EOSY progress and check EOSY Gate readiness.
    A tutor is Completed ONLY when every required student assigned to them has completed EOSY evaluation.
    """
    if not school_year:
        school_year = SchoolYear.objects.filter(is_active=True).first()

    tutors = User.objects.filter(role='tutor', is_active=True, is_superuser=False)

    completed_tutors_count = 0
    in_progress_tutors_count = 0
    pending_tutors_count = 0

    total_assigned_students = 0
    total_students_evaluated = 0
    students_remaining = 0

    tutors_progress_list = []
    incomplete_tutors_list = []

    for tutor in tutors:
        assigned_students = tutor.assigned_students.filter(is_active=True)
        assigned_count = assigned_students.count()

        if assigned_count == 0:
            tutors_progress_list.append({
                'tutor_id': str(tutor.id),
                'tutor_name': tutor.get_full_name(),
                'email': tutor.email,
                'tutor_type': tutor.tutor_type or 'basic',
                'assigned_students_count': 0,
                'evaluated_count': 0,
                'remaining_count': 0,
                'status': 'Completed',
                'has_no_students': True,
                'incomplete_students': [],
            })
            completed_tutors_count += 1
            continue

        total_assigned_students += assigned_count
        evaluated_in_tutor = 0
        incomplete_students = []

        for student in assigned_students:
            status, result, pct = get_student_eosy_status(student, school_year)
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

    current_sy_str = school_year.school_year if school_year else '2025-2026'
    next_sy_str = get_next_school_year_string(current_sy_str)
    can_transition = (students_remaining == 0 and total_assigned_students > 0)

    return {
        'current_school_year': current_sy_str,
        'next_school_year': next_sy_str,
        'current_school_year_status': school_year.status if school_year else 'ACTIVE',
        'eosy_completion_status': 'Complete' if can_transition else f'Incomplete ({students_remaining} remaining)',
        'can_transition': can_transition,
        'warning_message': None if can_transition else 'EOSY evaluations are incomplete. The next school year cannot be started yet.',
        'total_tutors': tutors.count(),
        'completed_tutors': completed_tutors_count,
        'in_progress_tutors': in_progress_tutors_count,
        'pending_tutors': pending_tutors_count,
        'total_assigned_students': total_assigned_students,
        'total_students_evaluated': total_students_evaluated,
        'students_remaining': students_remaining,
        'tutors_progress': tutors_progress_list,
        'incomplete_tutors': incomplete_tutors_list,
    }


def get_transition_summary_preview() -> dict:
    """
    Generate transition preview breakdown for Admin confirmation modal.
    No capacity or vacant slot numbers are displayed.
    """
    active_sy = SchoolYear.objects.filter(is_active=True).first()
    current_sy_str = active_sy.school_year if active_sy else '2025-2026'
    next_sy_str = get_next_school_year_string(current_sy_str)

    students = User.objects.filter(role='student', is_active=True)

    basic_to_plus = 0
    plus_to_graduated = 0
    basic_to_basic = 0
    basic_to_summer = 0
    plus_to_summer = 0
    dropped_inactive = 0

    for s in students:
        prog = (s.aral_level or 'basic').lower().strip()
        status, result, pct = get_student_eosy_status(s, active_sy)

        if prog == 'basic':
            if result == 'passed':
                basic_to_plus += 1
            elif result == 'failed':
                failures = count_historical_basic_failures(s)
                # If this failure is >= 2, goes to Summer
                if failures >= 2:
                    basic_to_summer += 1
                else:
                    basic_to_basic += 1
            else:
                basic_to_basic += 1
        elif prog == 'plus':
            if result == 'passed':
                plus_to_graduated += 1
            elif result == 'failed':
                plus_to_summer += 1
            else:
                # Continuing in Plus
                pass

    dropped_inactive = User.objects.filter(role='student', is_active=False).count()

    # Tutor metrics (single ARAL level handled per tutor)
    basic_tutors = User.objects.filter(role='tutor', tutor_type='basic', is_active=True)
    plus_tutors = User.objects.filter(role='tutor', tutor_type='plus', is_active=True)

    # Basic available count
    basic_tutors_count = basic_tutors.count()
    available_basic_tutors_count = basic_tutors.filter(is_available_for_students=True).count()

    # Plus available count
    plus_tutors_count = plus_tutors.count()
    available_plus_tutors_count = plus_tutors.filter(is_available_for_students=True).count()

    return {
        'current_school_year': current_sy_str,
        'next_school_year': next_sy_str,
        'student_movement': {
            'basic_to_plus': basic_to_plus,
            'plus_to_graduated': plus_to_graduated,
            'basic_to_basic': basic_to_basic,
            'basic_to_summer_required': basic_to_summer,
            'plus_to_summer_required': plus_to_summer,
            'dropped_inactive': dropped_inactive,
        },
        'tutor_assignment': {
            'basic_tutors': basic_tutors_count,
            'basic_tutors_available_for_additional_students': available_basic_tutors_count,
            'unassigned_basic_students': 0,  # Continuing Basic keep their tutor
            'plus_tutors': plus_tutors_count,
            'plus_tutors_available_for_additional_students': available_plus_tutors_count,
            'unassigned_plus_students': basic_to_plus,  # Promoted Plus students await Plus tutor
        }
    }


def execute_school_year_transition(admin_user: User | None = None) -> dict:
    """
    Executes the 11-step atomic database transition.
    If anything fails, rolls back completely.
    """
    active_sy = SchoolYear.objects.filter(is_active=True).first()
    if not active_sy:
        raise ValidationError({'error': 'No active school year found to transition.'})

    current_sy_str = active_sy.school_year
    next_sy_str = get_next_school_year_string(current_sy_str)

    # STEP 1: Validate EOSY Evaluations
    monitoring = get_eosy_monitoring_data(active_sy)
    if not monitoring['can_transition']:
        raise ValidationError({
            'error': f"Cannot start School Year {next_sy_str}. All required EOSY evaluations must be completed first."
        })

    summary_stats = {
        'basic_to_plus': 0,
        'plus_to_graduated': 0,
        'basic_continuing': 0,
        'sent_to_summer': 0,
        'inactive_dropped': 0,
        'tutor_changes': 0,
        'unassigned_students': 0,
    }

    with transaction.atomic():
        # STEP 2: Close Previous School Year (prepare for closure)
        # STEP 3: Process EOSY Results & STEP 4/5/6: Process Students and Create New Enrollments

        # Get or create next SchoolYear
        new_sy, _ = SchoolYear.objects.get_or_create(
            school_year=next_sy_str,
            defaults={
                'status': 'ACTIVE',
                'is_active': True,
                'start_date': timezone.localdate(),
            }
        )

        all_students = User.objects.filter(role='student')

        for student in all_students:
            if not student.is_active:
                summary_stats['inactive_dropped'] += 1
                continue

            current_enrollment = StudentEnrollment.objects.filter(
                student=student,
                school_year=active_sy,
            ).first()

            if not current_enrollment:
                continue

            prog = current_enrollment.program.lower().strip()
            eval_status, eosy_result, pct = get_student_eosy_status(student, active_sy)

            # Update current enrollment completion details
            current_enrollment.eosy_result = eosy_result
            current_enrollment.evaluation_status = 'completed'
            current_enrollment.completion_date = timezone.localdate()
            current_enrollment.save(update_fields=['eosy_result', 'evaluation_status', 'completion_date', 'updated_at'])

            # STEP 4: Process Basic Students
            if prog == 'basic':
                if eosy_result == 'passed':
                    # Basic + Passed -> Plus
                    current_enrollment.final_result = 'Promoted to Plus'
                    current_enrollment.enrollment_status = 'completed'
                    current_enrollment.save()

                    # Create new enrollment for Next School Year: Program = Plus, Status = Active
                    StudentEnrollment.objects.create(
                        student=student,
                        school_year=new_sy,
                        program='plus',
                        assigned_tutor=None,  # Awaiting Plus tutor assignment
                        enrollment_status='active',
                        grade_level='Grade 8',
                    )
                    student.aral_level = 'plus'
                    student.assigned_tutor = None
                    student.save(update_fields=['aral_level', 'assigned_tutor'])

                    summary_stats['basic_to_plus'] += 1
                    summary_stats['unassigned_students'] += 1
                    summary_stats['tutor_changes'] += 1

                elif eosy_result == 'failed':
                    # Check failure count
                    failures = count_historical_basic_failures(student)
                    if failures >= 2:
                        # Basic + Failed Twice -> Summer Required
                        current_enrollment.final_result = 'Summer Remediation Required'
                        current_enrollment.enrollment_status = 'completed'
                        current_enrollment.save()

                        check_and_create_summer_record_if_eligible(
                            student, current_enrollment, 'failed', current_sy_str
                        )
                        summary_stats['sent_to_summer'] += 1
                    else:
                        # Basic + Failed 1x -> Retained in Basic
                        current_enrollment.final_result = 'Retained in Basic'
                        current_enrollment.enrollment_status = 'completed'
                        current_enrollment.save()

                        # Check if current tutor is still compatible Basic tutor
                        tutor = student.assigned_tutor
                        tutor_compatible = (
                            tutor and (tutor.tutor_type == 'basic' or tutor.aral_level == 'basic')
                        )
                        next_tutor = tutor if tutor_compatible else None

                        StudentEnrollment.objects.create(
                            student=student,
                            school_year=new_sy,
                            program='basic',
                            assigned_tutor=next_tutor,
                            enrollment_status='active',
                            grade_level='Grade 8',
                        )
                        if not tutor_compatible:
                            student.assigned_tutor = None
                            student.save(update_fields=['assigned_tutor'])
                            summary_stats['unassigned_students'] += 1
                            summary_stats['tutor_changes'] += 1

                        summary_stats['basic_continuing'] += 1

            # STEP 5: Process Plus Students
            elif prog == 'plus':
                if eosy_result == 'passed':
                    # Plus + Passed -> Graduated
                    current_enrollment.final_result = 'Graduated'
                    current_enrollment.graduation_status = 'graduated'
                    current_enrollment.enrollment_status = 'completed'
                    current_enrollment.save()

                    student.aral_level = 'graduated'
                    student.assigned_tutor = None
                    student.save(update_fields=['aral_level', 'assigned_tutor'])

                    summary_stats['plus_to_graduated'] += 1
                    summary_stats['tutor_changes'] += 1
                    # Do NOT create another active school-year enrollment for a graduated student.

                elif eosy_result == 'failed':
                    # Plus + Failed -> Summer Required
                    current_enrollment.final_result = 'Summer Remediation Required'
                    current_enrollment.enrollment_status = 'completed'
                    current_enrollment.save()

                    check_and_create_summer_record_if_eligible(
                        student, current_enrollment, 'failed', current_sy_str
                    )
                    summary_stats['sent_to_summer'] += 1

        # STEP 7: Clean-Slate Reset — conclude all active assignments for the archived school year.
        # All students (Basic, Plus) become unassigned. Tutors become fully vacant.
        # Admin will build fresh cohorts for the new school year.
        TutorAssignmentHistory.objects.filter(
            school_year=active_sy,
            is_active=True,
        ).update(
            is_active=False,
            end_date=timezone.localdate(),
            notes='Concluded at EOSY — all pairings reset for new school year cohort reassignment.'
        )

        # Unassign ALL non-graduated active students (reset for Admin to reassign)
        for student in User.objects.filter(role='student', is_active=True).exclude(aral_level='graduated'):
            if student.assigned_tutor:
                student.assigned_tutor = None
                student.save(update_fields=['assigned_tutor'])
                summary_stats['unassigned_students'] += 1
                summary_stats['tutor_changes'] += 1

        # STEP 8: Identify Available Tutors (handled dynamically via get_available_tutors_data)
        # STEP 9: Identify Unassigned Students (handled dynamically)

        # STEP 10: Archive Previous School Year
        active_sy.status = 'ARCHIVED'
        active_sy.is_active = False
        active_sy.archived_at = timezone.now()
        active_sy.save(update_fields=['status', 'is_active', 'archived_at'])

        # STEP 11: Activate New School Year
        new_sy.status = 'ACTIVE'
        new_sy.is_active = True
        new_sy.save(update_fields=['status', 'is_active'])

        # Create Transition Audit Log
        TransitionAuditLog.objects.create(
            admin=admin_user,
            admin_name=admin_user.get_full_name() if admin_user else 'System Admin',
            previous_school_year=current_sy_str,
            new_school_year=next_sy_str,
            basic_to_plus=summary_stats['basic_to_plus'],
            plus_to_graduated=summary_stats['plus_to_graduated'],
            basic_continuing=summary_stats['basic_continuing'],
            sent_to_summer=summary_stats['sent_to_summer'],
            inactive_dropped=summary_stats['inactive_dropped'],
            tutor_changes=summary_stats['tutor_changes'],
            unassigned_students=summary_stats['unassigned_students'],
            transition_result='SUCCESS',
            details=summary_stats,
        )

    return {
        'status': 'SUCCESS',
        'message': f"School Year {next_sy_str} successfully activated. Previous School Year {current_sy_str} has been archived.",
        'previous_school_year': current_sy_str,
        'new_school_year': next_sy_str,
        'summary': summary_stats,
    }
