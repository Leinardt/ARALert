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
    - Basic Tutor: can only teach Basic students.
    - Plus Tutor: can only teach Plus students.
    - Basic & Plus Tutor: can teach Basic or Plus students.
    Invalid assignments raise ValidationError.
    """
    if not tutor:
        return

    # Check tutor role
    if tutor.role != 'tutor':
        raise ValidationError({'tutor': 'Assigned user is not a tutor.'})

    t_type = getattr(tutor, 'tutor_type', None) or getattr(tutor, 'aral_level', 'basic')
    t_type = str(t_type).lower().strip()
    s_prog = str(student_program).lower().strip() if student_program else 'basic'

    if s_prog == 'basic':
        if t_type == 'plus':
            raise ValidationError({
                'tutor': 'This tutor cannot be assigned to this student because the tutor is assigned to the Plus program only.'
            })
    elif s_prog == 'plus':
        if t_type == 'basic':
            raise ValidationError({
                'tutor': 'This tutor cannot be assigned to this student because the tutor is assigned to the Basic program only.'
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
                school_year='2025-2026',
                defaults={'status': 'ACTIVE', 'is_active': True}
            )

    student_prog = student.aral_level or 'basic'

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
    NO fixed capacity limits or vacant-slot metrics are returned.
    """
    tutors_qs = User.objects.filter(role='tutor', is_active=True, is_superuser=False)

    if program:
        prog = program.lower().strip()
        if prog == 'basic':
            tutors_qs = tutors_qs.filter(tutor_type__in=['basic', 'basic_plus'])
        elif prog == 'plus':
            tutors_qs = tutors_qs.filter(tutor_type__in=['plus', 'basic_plus'])

    results = []
    for tutor in tutors_qs:
        assigned_count = tutor.assigned_students.filter(is_active=True).count()
        t_type = tutor.tutor_type or 'basic'

        type_display = (
            'Basic Tutor' if t_type == 'basic'
            else 'Plus Tutor' if t_type == 'plus'
            else 'Basic & Plus Tutor'
        )

        results.append({
            'id': str(tutor.id),
            'full_name': tutor.get_full_name(),
            'email': tutor.email,
            'subject': tutor.subject or 'General',
            'tutor_type': t_type,
            'tutor_type_display': type_display,
            'current_students_count': assigned_count,
            'has_students': assigned_count > 0,
            'is_available': tutor.is_available_for_students,
            'availability_status': 'Available' if tutor.is_available_for_students else 'Unavailable',
        })

    return results
