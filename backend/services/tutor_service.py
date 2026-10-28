"""
Tutor Service for ARALert.
Handles tutor compatibility validation, manual assignments with historical tracking,
and available tutor queries without artificial capacity limits.
"""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from apps.accounts.models import User
from apps.academics.models import (
    SchoolYear,
    StudentEnrollment,
    TutorAssignmentHistory,
)


def validate_tutor_compatibility(tutor: User, student_program: str) -> None:
    """
    Validate that tutor can teach the student's program level.
    Rules:
    - Basic Tutor: can teach Basic students.
    - Plus Tutor: can teach Plus students.
    - Summer Tutor: can teach Summer students.
    - Tutors handling both Basic and Plus can teach Basic students AND Plus students.
    Invalid assignments raise ValidationError.
    """
    if not tutor:
        return

    # Check tutor role
    if tutor.role != 'tutor':
        raise ValidationError({'tutor': 'Assigned user is not a tutor.'})

    combined = f"{getattr(tutor, 'tutor_type', '') or ''} {getattr(tutor, 'aral_level', '') or ''}".lower().strip()
    s_prog = str(student_program).lower().strip() if student_program else 'basic'

    handles_basic = 'basic' in combined or not combined
    handles_plus = 'plus' in combined
    handles_summer = 'summer' in combined

    if s_prog == 'basic' and not handles_basic:
        raise ValidationError({
            'tutor': 'This tutor cannot be assigned to this student because the tutor does not handle the Basic level.'
        })
    elif s_prog == 'plus' and not handles_plus:
        raise ValidationError({
            'tutor': 'This tutor cannot be assigned to this student because the tutor does not handle the Plus level.'
        })
    elif s_prog == 'summer' and not handles_summer:
        raise ValidationError({
            'tutor': 'This tutor cannot be assigned to this student because the tutor does not handle the Summer level.'
        })


def assign_tutor_to_student(
    student: User,
    tutor: User | None,
    school_year: SchoolYear | None = None,
    assigned_by: User | None = None,
    period: str = 'MOSY',
    notes: str = ''
) -> TutorAssignmentHistory | None:
    """
    Assign a tutor to a student with historical preservation and compatibility enforcement.
    Never overwrites previous tutor assignment records.
    """
    if not school_year:
        school_year = SchoolYear.objects.filter(is_active=True).first()
        if not school_year:
            school_year, _ = SchoolYear.objects.get_or_create(
                school_year='2026-2027',
                defaults={'status': 'ACTIVE', 'is_active': True}
            )

    student_prog = (student.aral_level or 'basic').lower().strip()

    if tutor:
        validate_tutor_compatibility(tutor, student_prog)

    with transaction.atomic():
        # Deactivate any currently active tutor assignment for this student in this school year
        TutorAssignmentHistory.objects.filter(
            student=student,
            school_year=school_year,
            is_active=True,
        ).update(
            is_active=False,
            end_date=timezone.localdate(),
        )

        history_record = None
        if tutor:
            history_record = TutorAssignmentHistory.objects.create(
                student=student,
                tutor=tutor,
                school_year=school_year,
                period=period,
                program=student_prog,
                assigned_by=assigned_by,
                start_date=timezone.localdate(),
                is_active=True,
                notes=notes,
            )

        # Update User model
        student.assigned_tutor = tutor
        student.save(update_fields=['assigned_tutor'])

        # Update current SchoolYear StudentEnrollment
        enrollment = StudentEnrollment.objects.filter(
            student=student,
            school_year=school_year,
        ).first()

        if enrollment:
            enrollment.assigned_tutor = tutor
            enrollment.save(update_fields=['assigned_tutor', 'updated_at'])
        else:
            StudentEnrollment.objects.create(
                student=student,
                school_year=school_year,
                program=student_prog,
                assigned_tutor=tutor,
                enrollment_status='active',
            )

    return history_record


def get_available_tutors_data(program: str | None = None) -> list[dict]:
    """
    Return active tutors available for additional compatible students.
    After any milestone reset (MOSY/EOSY/Summer), all tutors will show 0 students
    and full slot availability (up to 25 per cohort).
    """
    MAX_COHORT = 25
    from django.db.models import Count, Q
    tutors_qs = User.objects.filter(role='tutor', is_active=True, is_superuser=False)

    if program:
        prog = program.lower().strip()
        tutors_qs = tutors_qs.filter(
            Q(tutor_type=prog) | Q(tutor_type__icontains=prog) |
            Q(aral_level=prog) | Q(aral_level__icontains=prog)
        )

    tutors_qs = tutors_qs.annotate(
        assigned_count=Count('assigned_students', filter=Q(assigned_students__is_active=True))
    )

    results = []
    for tutor in tutors_qs:
        assigned_count = getattr(tutor, 'assigned_count', 0)
        available_slots = max(0, MAX_COHORT - assigned_count)
        t_type = tutor.tutor_type or tutor.aral_level or 'basic'

        comb = f"{tutor.tutor_type or ''} {tutor.aral_level or ''}".lower()
        is_basic_plus = ('basic' in comb and 'plus' in comb) or 'basic_plus' in comb

        type_display = (
            'BASIC & PLUS' if is_basic_plus
            else 'BASIC' if t_type == 'basic'
            else 'PLUS' if t_type == 'plus'
            else 'SUMMER' if t_type == 'summer'
            else t_type.upper()
        )

        if assigned_count == 0:
            load_status = f'Open (0/{MAX_COHORT} students — {MAX_COHORT} Slots Available)'
        elif assigned_count < 15:
            load_status = f'Light Load ({assigned_count}/{MAX_COHORT} — {available_slots} Slots Available)'
        elif assigned_count <= MAX_COHORT:
            load_status = f'Optimal Cohort ({assigned_count}/{MAX_COHORT} — {available_slots} Slots Available)'
        elif assigned_count <= 30:
            load_status = f'High Capacity ({assigned_count}/30)'
        else:
            load_status = f'Full ({assigned_count} students — 0 Slots Available)'

        results.append({
            'id': str(tutor.id),
            'full_name': tutor.get_full_name(),
            'email': tutor.email,
            'subject': tutor.subject or 'General',
            'tutor_type': t_type,
            'tutor_type_display': type_display,
            'current_students_count': assigned_count,
            'total_slots': MAX_COHORT,
            'available_slots': available_slots,
            'has_students': assigned_count > 0,
            'cohort_load_status': load_status,
            'is_available': tutor.is_available_for_students,
            'availability_status': 'Available' if tutor.is_available_for_students else 'Unavailable',
        })

    return results



def assign_students_to_tutor_bulk(
    student_ids,
    tutor_id,
    school_year=None,
    assigned_by=None,
    period='MOSY',
    notes='',
):
    """
    Bulk assign a list of students to a single tutor (cohort dispatch).
    Returns a dispatch report with assigned/skipped lists.
    """
    from django.core.exceptions import ValidationError

    if not school_year:
        school_year = SchoolYear.objects.filter(is_active=True).first()

    tutor = User.objects.filter(id=tutor_id, role='tutor', is_active=True).first()
    if not tutor:
        raise ValidationError({'tutor': f'Tutor ID {tutor_id} not found or inactive.'})

    MAX_COHORT = 25
    assigned_count = tutor.assigned_students.filter(is_active=True).count()
    available_slots = max(0, MAX_COHORT - assigned_count)

    assigned = []
    skipped = []

    students_map = {
        str(s.id): s
        for s in User.objects.filter(id__in=student_ids, role='student', is_active=True)
    }

    for sid in student_ids:
        student = students_map.get(str(sid))
        if not student:
            skipped.append({'student_id': sid, 'reason': 'Not found or inactive.'})
            continue

        if len(assigned) >= available_slots:
            skipped.append({
                'student_id': sid,
                'student_name': student.get_full_name(),
                'reason': f'Cohort full ({MAX_COHORT} limit).',
            })
            continue

        try:
            history = assign_tutor_to_student(
                student=student,
                tutor=tutor,
                school_year=school_year,
                assigned_by=assigned_by,
                period=period,
                notes=notes,
            )
            assigned.append({
                'student_id': str(student.id),
                'student_name': student.get_full_name(),
                'lrn': student.lrn,
                'program': student.aral_level or 'basic',
                'history_id': history.id if history else None,
            })
        except ValidationError as e:
            msg = e.message_dict if hasattr(e, 'message_dict') else str(e)
            skipped.append({
                'student_id': str(student.id),
                'student_name': student.get_full_name(),
                'reason': str(msg),
            })

    return {
        'tutor_id': str(tutor.id),
        'tutor_name': tutor.get_full_name(),
        'period': period,
        'assigned': assigned,
        'skipped': skipped,
        'total_assigned': len(assigned),
        'total_skipped': len(skipped),
    }


def get_tutor_cohort_history(tutor_id, school_year_str=None):
    """
    Returns complete cohort history for a tutor:
    - Current active students
    - Past cohorts organized by School Year and Milestone Period (MOSY, EOSY, SUMMER)
    - Grades/Evaluations logged for those students
    """
    from apps.academics.models import ApiGrade
    from django.core.exceptions import ValidationError

    tutor = User.objects.filter(id=tutor_id, role='tutor').first()
    if not tutor:
        raise ValidationError({'tutor': f'Tutor with ID {tutor_id} not found.'})

    # Query all assignment histories for this tutor
    histories_qs = TutorAssignmentHistory.objects.filter(
        tutor=tutor
    ).select_related('student', 'school_year').order_by('-start_date')

    if school_year_str:
        histories_qs = histories_qs.filter(school_year__school_year=school_year_str)

    # Currently active students from user relationship
    active_students_qs = tutor.assigned_students.filter(is_active=True)
    active_cohort = []
    for st in active_students_qs:
        active_cohort.append({
            'student_id': str(st.id),
            'student_name': st.get_full_name(),
            'lrn': st.lrn,
            'email': st.email,
            'program': (st.aral_level or 'basic').capitalize(),
            'grade_level': 'Grade 8',
            'is_active': True,
        })

    # Historical assignments
    past_records = []
    student_ids = [h.student_id for h in histories_qs]
    latest_grades = {}
    if student_ids:
        all_grades = ApiGrade.objects.filter(
            student_id__in=student_ids,
            tutor=tutor,
        ).order_by('student_id', '-date_logged')
        for g in all_grades:
            if g.student_id not in latest_grades:
                latest_grades[g.student_id] = g

    for h in histories_qs:
        st = h.student
        grade_obj = latest_grades.get(st.id)

        score_display = None
        if grade_obj and grade_obj.total_score:
            pct = round((float(grade_obj.score or 0) / float(grade_obj.total_score or 40)) * 100, 1)
            score_display = f"{grade_obj.score}/{grade_obj.total_score} ({pct}%)"

        past_records.append({
            'history_id': h.id,
            'student_id': str(st.id),
            'student_name': st.get_full_name(),
            'lrn': st.lrn,
            'email': st.email,
            'school_year': h.school_year.school_year,
            'period': h.period,
            'program': h.program.capitalize(),
            'start_date': str(h.start_date),
            'end_date': str(h.end_date) if h.end_date else 'Present',
            'is_active': h.is_active,
            'notes': h.notes,
            'latest_score': score_display,
            'latest_grade_remarks': grade_obj.remarks if grade_obj else None,
        })

    return {
        'tutor_id': str(tutor.id),
        'tutor_name': tutor.get_full_name(),
        'email': tutor.email,
        'tutor_type': tutor.tutor_type or 'basic',
        'active_students_count': len(active_cohort),
        'active_cohort': active_cohort,
        'past_records': past_records,
        'total_historical_students': len(past_records),
    }
