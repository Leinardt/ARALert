"""
MOSY Service for ARALert.
Handles MOSY Evaluation monitoring, tutor progress calculation, and MOSY completion processing
where Plus students become Unassigned awaiting Plus tutor assignment and Basic students retain their tutor.
"""

from django.db import transaction
from django.utils import timezone
from apps.accounts.models import User
from apps.academics.models import (
    SchoolYear,
    StudentEnrollment,
    TutorAssignmentHistory,
    ApiGrade,
)


def get_student_mosy_status(student: User, school_year: SchoolYear | None = None) -> tuple[str, str, float | None]:
    """
    Check MOSY evaluation status and grade for a student.
    Returns (status: 'completed' | 'pending', result: 'passed' | 'failed' | 'pending', score_pct).
    Passing score: >= 28/40 (70%).
    """
    grade = ApiGrade.objects.filter(
        student=student,
        subject__icontains='MOSY',
    ).order_by('-date_logged').first()

    if not grade:
        return 'pending', 'pending', None

    ts = float(grade.total_score or 40)
    sc = float(grade.score or 0)
    pct = round((sc / ts) * 100.0, 1)
    passed = sc >= 28.0 if ts == 40 else (sc / ts) >= 0.7
    result = 'passed' if passed else 'failed'
    return 'completed', result, pct


def get_mosy_monitoring_data(school_year: SchoolYear | None = None) -> dict:
    """
    Calculate tutor MOSY progress and institutional MOSY evaluation metrics.
    A tutor is Completed ONLY when every required assigned student has completed MOSY evaluation.
    """
    if not school_year:
        school_year = SchoolYear.objects.filter(is_active=True).first()

    tutors = User.objects.filter(role='tutor', is_active=True, is_superuser=False)

    completed_tutors_count = 0
    in_progress_tutors_count = 0
    pending_tutors_count = 0

    total_students_evaluated = 0
    students_remaining = 0
    total_assigned_students = 0

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
                'status': 'Completed',  # 0 students does not block
                'has_no_students': True,
                'incomplete_students': [],
            })
            completed_tutors_count += 1
            continue

        total_assigned_students += assigned_count
        evaluated_in_tutor = 0
        incomplete_students = []

        for student in assigned_students:
            status, result, pct = get_student_mosy_status(student, school_year)
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

    is_all_complete = (students_remaining == 0 and total_assigned_students > 0)

    return {
        'school_year': school_year.school_year if school_year else '2025-2026',
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
            school_year='2025-2026',
            defaults={'status': 'ACTIVE', 'is_active': True}
        )

    students = User.objects.filter(role='student', is_active=True)
    plus_unassigned_count = 0
    basic_retained_count = 0

    with transaction.atomic():
        for student in students:
            eval_status, result, pct = get_student_mosy_status(student, active_sy)

            enrollment = StudentEnrollment.objects.filter(
                student=student,
                school_year=active_sy,
            ).first()

            if not enrollment:
                enrollment = StudentEnrollment.objects.create(
                    student=student,
                    school_year=active_sy,
                    program=student.aral_level or 'basic',
                    assigned_tutor=student.assigned_tutor,
                    enrollment_status='active',
                )

            # Update MOSY result
            if eval_status == 'completed':
                enrollment.mosy_result = result
                # If basic passed MOSY, promoted to Plus level
                if enrollment.program == 'basic' and result == 'passed':
                    enrollment.program = 'plus'
                    student.aral_level = 'plus'

            # Rule 5.1: Plus Students After MOSY
            # Must become Unassigned / Awaiting Plus Tutor Assignment.
            if student.aral_level == 'plus' or enrollment.program == 'plus':
                previous_tutor = student.assigned_tutor
                if previous_tutor:
                    # Deactivate current assignment history but preserve record
                    TutorAssignmentHistory.objects.filter(
                        student=student,
                        school_year=active_sy,
                        is_active=True,
                    ).update(
                        is_active=False,
                        end_date=timezone.localdate(),
                        notes=f'Deassigned after MOSY for Plus tutor reassignment (Previously: {previous_tutor.get_full_name()})'
                    )

                student.assigned_tutor = None
                student.save(update_fields=['assigned_tutor', 'aral_level'])
                enrollment.assigned_tutor = None
                enrollment.save(update_fields=['assigned_tutor', 'program', 'mosy_result', 'updated_at'])
                plus_unassigned_count += 1

            # Rule 6: Basic Students After MOSY
            # Keep existing compatible Basic tutor
            elif student.aral_level == 'basic' or enrollment.program == 'basic':
                # Check if current tutor is still compatible
                current_tutor = student.assigned_tutor
                if current_tutor and current_tutor.tutor_type == 'plus':
                    # Incompatible: unassign
                    student.assigned_tutor = None
                    student.save(update_fields=['assigned_tutor'])
                    enrollment.assigned_tutor = None
                    enrollment.save(update_fields=['assigned_tutor', 'mosy_result', 'updated_at'])
                else:
                    enrollment.save(update_fields=['mosy_result', 'updated_at'])
                    basic_retained_count += 1

    return {
        'status': 'SUCCESS',
        'message': f'MOSY processing completed: {plus_unassigned_count} Plus student(s) awaiting Plus tutor assignment; {basic_retained_count} Basic student(s) retained with their tutor.',
        'plus_unassigned_count': plus_unassigned_count,
        'basic_retained_count': basic_retained_count,
    }


def get_mosy_assignment_dashboard_data(school_year: SchoolYear | None = None) -> dict:
    """
    Returns data for the Admin MOSY Tutor Assignment Dashboard:
    - Unassigned Plus Students
    - Basic Students (assigned and continuing)
    - Graduated Students
    """
    if not school_year:
        school_year = SchoolYear.objects.filter(is_active=True).first()

    active_sy_str = school_year.school_year if school_year else '2025-2026'

    # 1. Unassigned Plus Students
    unassigned_plus = []
    plus_students = User.objects.filter(
        role='student',
        aral_level='plus',
        assigned_tutor__isnull=True,
        is_active=True,
    )
    for s in plus_students:
        last_assignment = TutorAssignmentHistory.objects.filter(
            student=s
        ).order_by('-start_date', '-created_at').first()
        prev_tutor_name = last_assignment.tutor.get_full_name() if last_assignment else 'None'

        status, result, pct = get_student_mosy_status(s, school_year)

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
        })

    # 2. Basic Students
    basic_students_list = []
    basic_students = User.objects.filter(
        role='student',
        aral_level='basic',
        is_active=True,
    )
    for s in basic_students:
        status, result, pct = get_student_mosy_status(s, school_year)
        tutor_name = s.assigned_tutor.get_full_name() if s.assigned_tutor else 'Unassigned'

        basic_students_list.append({
            'id': str(s.id),
            'full_name': s.get_full_name(),
            'lrn': s.lrn,
            'program': 'Basic',
            'school_year': active_sy_str,
            'current_tutor': tutor_name,
            'tutor_id': str(s.assigned_tutor.id) if s.assigned_tutor else None,
            'mosy_status': 'Completed' if status == 'completed' else 'Pending',
            'mosy_result': result.capitalize() if result != 'pending' else 'Pending',
            'assignment_status': 'Assigned' if s.assigned_tutor else 'Unassigned',
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

    return {
        'school_year': active_sy_str,
        'unassigned_plus_students': unassigned_plus,
        'basic_students': basic_students_list,
        'graduated_students': graduated_list,
    }
