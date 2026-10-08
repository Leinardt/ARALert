"""
Evaluation, School Year Management, Archive, and Summer Remediation API Views.
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.academics.models import (
    SchoolYear,
    StudentEnrollment,
    TutorAssignmentHistory,
    SummerRecord,
    TransitionAuditLog,
)
from permissions.role_permissions import IsAdmin, IsSuperAdmin, IsTutor

from services.mosy_service import (
    get_mosy_monitoring_data,
    process_mosy_completion,
    get_mosy_assignment_dashboard_data,
)
from services.transition_service import (
    get_eosy_monitoring_data,
    get_transition_summary_preview,
    execute_school_year_transition,
)
from services.summer_service import (
    get_summer_dashboard_data,
    start_summer_participation,
    record_summer_evaluation,
)
from services.tutor_service import (
    get_available_tutors_data,
    assign_tutor_to_student,
    validate_tutor_compatibility,
)

from .serializers import (
    SchoolYearSerializer,
    StudentEnrollmentSerializer,
    TutorAssignmentHistorySerializer,
    SummerRecordSerializer,
    TransitionAuditLogSerializer,
    AssignTutorRequestSerializer,
    SummerEvaluationRequestSerializer,
)


# ---------------------------------------------------------------------------
# School Year Views
# ---------------------------------------------------------------------------

class SchoolYearListView(APIView):
    """GET /api/academics/school-years/ — List all school years."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        years = SchoolYear.objects.all().order_by('-created_at')
        return Response(SchoolYearSerializer(years, many=True).data, status=status.HTTP_200_OK)


class CurrentSchoolYearView(APIView):
    """GET /api/academics/school-years/current/ — Get active school year."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        sy = SchoolYear.objects.filter(is_active=True).first()
        if not sy:
            sy, _ = SchoolYear.objects.get_or_create(
                school_year='2025-2026',
                defaults={'status': 'ACTIVE', 'is_active': True}
            )
        data = SchoolYearSerializer(sy).data
        return Response(data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# MOSY Evaluation & Assignment Views
# ---------------------------------------------------------------------------

class MosyMonitoringView(APIView):
    """GET /api/academics/evaluations/mosy-monitoring/ — Admin MOSY monitoring metrics."""
    permission_classes = [IsAdmin]

    def get(self, request):
        data = get_mosy_monitoring_data()
        return Response(data, status=status.HTTP_200_OK)


class MosyProcessView(APIView):
    """POST /api/academics/evaluations/mosy-process/ — Finalize MOSY period & process statuses."""
    permission_classes = [IsAdmin]

    def post(self, request):
        result = process_mosy_completion(admin_user=request.user)
        return Response(result, status=status.HTTP_200_OK)


class MosyAssignmentsView(APIView):
    """GET /api/academics/evaluations/mosy-assignments/ — Unassigned Plus, Basic & Graduated lists."""
    permission_classes = [IsAdmin]

    def get(self, request):
        data = get_mosy_assignment_dashboard_data()
        return Response(data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# EOSY Monitoring, Gate & Transition Views
# ---------------------------------------------------------------------------

class EosyMonitoringView(APIView):
    """GET /api/academics/evaluations/eosy-monitoring/ — Admin EOSY progress & Gate status."""
    permission_classes = [IsAdmin]

    def get(self, request):
        data = get_eosy_monitoring_data()
        return Response(data, status=status.HTTP_200_OK)


class TransitionSummaryPreviewView(APIView):
    """GET /api/academics/evaluations/transition-summary/ — Preview transition stats before confirmation."""
    permission_classes = [IsAdmin]

    def get(self, request):
        data = get_transition_summary_preview()
        return Response(data, status=status.HTTP_200_OK)


class StartNewSchoolYearView(APIView):
    """
    POST /api/academics/evaluations/start-new-school-year/
    Executes the 11-step atomic database transition.
    Blocked if EOSY evaluations are incomplete.
    """
    permission_classes = [IsAdmin]

    def post(self, request):
        try:
            result = execute_school_year_transition(admin_user=request.user)
            return Response(result, status=status.HTTP_200_OK)
        except DjangoValidationError as e:
            if hasattr(e, 'message_dict') and 'error' in e.message_dict:
                err_val = e.message_dict['error']
                msg = err_val[0] if isinstance(err_val, list) and err_val else str(err_val)
            elif hasattr(e, 'messages') and e.messages:
                msg = e.messages[0]
            else:
                msg = str(e)
            return Response({'error': msg}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'Transition failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ---------------------------------------------------------------------------
# Tutor Assignment & Availability Views (NO CAPACITY)
# ---------------------------------------------------------------------------

class AvailableTutorsView(APIView):
    """GET /api/academics/tutors/available/?program=basic|plus"""
    permission_classes = [IsAdmin]

    def get(self, request):
        program = request.query_params.get('program')
        data = get_available_tutors_data(program=program)
        return Response(data, status=status.HTTP_200_OK)


class AssignTutorView(APIView):
    """
    POST /api/academics/tutors/assign/
    Assign compatible tutor to a student with historical recording.
    """
    permission_classes = [IsAdmin]

    def post(self, request):
        serializer = AssignTutorRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        student_id = serializer.validated_data['student_id']
        tutor_id = serializer.validated_data.get('tutor_id')
        period = serializer.validated_data.get('period', 'MOSY')
        notes = serializer.validated_data.get('notes', '')

        student = get_object_or_404(User, id=student_id, role='student')
        tutor = get_object_or_404(User, id=tutor_id, role='tutor') if tutor_id else None

        try:
            history = assign_tutor_to_student(
                student=student,
                tutor=tutor,
                assigned_by=request.user,
                period=period,
                notes=notes,
            )
            return Response({
                'message': f"Student {student.get_full_name()} successfully assigned to {tutor.get_full_name() if tutor else 'TBA'}.",
                'student_id': str(student.id),
                'tutor_id': str(tutor.id) if tutor else None,
                'tutor_name': tutor.get_full_name() if tutor else 'TBA',
            }, status=status.HTTP_200_OK)
        except DjangoValidationError as e:
            msg = e.message_dict if hasattr(e, 'message_dict') else str(e)
            return Response({'error': msg}, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Summer Remediation Views
# ---------------------------------------------------------------------------

class SummerListView(APIView):
    """GET /api/academics/summer/ — List all Summer remediation students."""
    permission_classes = [IsAdmin]

    def get(self, request):
        data = get_summer_dashboard_data()
        return Response(data, status=status.HTTP_200_OK)


class SummerStartView(APIView):
    """POST /api/academics/summer/<int:id>/start/ — Mark Summer student active."""
    permission_classes = [IsAdmin]

    def post(self, request, id):
        try:
            record = start_summer_participation(id)
            return Response({
                'message': f"Summer participation started for {record.student.get_full_name()}.",
                'record': SummerRecordSerializer(record).data,
            }, status=status.HTTP_200_OK)
        except SummerRecord.DoesNotExist:
            return Response({'error': 'Summer record not found.'}, status=status.HTTP_404_NOT_FOUND)


class SummerEvaluateView(APIView):
    """POST /api/academics/summer/<int:id>/evaluate/ — Record Summer evaluation."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        user = request.user
        if not user.is_superuser and user.role not in ('admin', 'tutor', 'principal'):
            return Response({'error': 'Unauthorized to evaluate summer student.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = SummerEvaluationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        res = serializer.validated_data['result']
        notes = serializer.validated_data.get('notes', '')

        try:
            record = record_summer_evaluation(
                summer_record_id=id,
                result=res,
                evaluator=user,
                notes=notes,
            )
            return Response({
                'message': f"Summer evaluation recorded as {res.upper()} for {record.student.get_full_name()}.",
                'record': SummerRecordSerializer(record).data,
            }, status=status.HTTP_200_OK)
        except DjangoValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except SummerRecord.DoesNotExist:
            return Response({'error': 'Summer record not found.'}, status=status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# School Year Archive Views
# ---------------------------------------------------------------------------

class SchoolYearArchiveListView(APIView):
    """GET /api/academics/archive/ — List archived school years."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        archived = SchoolYear.objects.filter(status='ARCHIVED').order_by('-created_at')
        return Response(SchoolYearSerializer(archived, many=True).data, status=status.HTTP_200_OK)


class SchoolYearArchiveDetailView(APIView):
    """GET /api/academics/archive/<str:school_year>/ — Read-only historical snapshot."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, school_year):
        sy = get_object_or_404(SchoolYear, school_year=school_year)
        enrollments = StudentEnrollment.objects.filter(school_year=sy).select_related(
            'student', 'assigned_tutor', 'school_year'
        )

        records = []
        for enr in enrollments:
            records.append({
                'enrollment_id': enr.id,
                'student_id': str(enr.student.id),
                'student_name': enr.student.get_full_name(),
                'lrn': enr.student.lrn,
                'grade_level': enr.grade_level,
                'program': enr.program.capitalize(),
                'assigned_tutor': enr.assigned_tutor.get_full_name() if enr.assigned_tutor else 'Unassigned',
                'tutor_id': str(enr.assigned_tutor.id) if enr.assigned_tutor else None,
                'mosy_result': enr.mosy_result.capitalize(),
                'eosy_result': enr.eosy_result.capitalize(),
                'final_result': enr.final_result or '—',
                'graduation_status': enr.get_graduation_status_display(),
                'summer_status': enr.get_summer_status_display(),
                'enrollment_status': enr.get_enrollment_status_display(),
            })

        return Response({
            'school_year': sy.school_year,
            'status': sy.status,
            'is_read_only': True,
            'total_students': enrollments.count(),
            'records': records,
        }, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Student Chronological History View
# ---------------------------------------------------------------------------

class StudentCompleteHistoryView(APIView):
    """GET /api/academics/students/<uuid:student_id>/history/ — Chronological history across years."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, student_id):
        student = get_object_or_404(User, id=student_id, role='student')

        # Enrollments across all school years
        enrollments = StudentEnrollment.objects.filter(
            student=student
        ).select_related('school_year', 'assigned_tutor').order_by('school_year__school_year')

        enrollment_history = []
        for enr in enrollments:
            enrollment_history.append({
                'school_year': enr.school_year.school_year,
                'grade_level': enr.grade_level,
                'program': enr.program.capitalize(),
                'tutor_name': enr.assigned_tutor.get_full_name() if enr.assigned_tutor else 'Unassigned',
                'mosy_result': enr.mosy_result.capitalize(),
                'eosy_result': enr.eosy_result.capitalize(),
                'final_result': enr.final_result or '—',
                'status': enr.get_enrollment_status_display(),
                'graduation_status': enr.get_graduation_status_display(),
                'summer_status': enr.get_summer_status_display(),
            })

        # Tutor assignment timeline
        tutor_history = TutorAssignmentHistory.objects.filter(
            student=student
        ).select_related('tutor', 'school_year').order_by('-start_date')

        tutor_history_list = []
        for th in tutor_history:
            tutor_history_list.append({
                'tutor_name': th.tutor.get_full_name(),
                'school_year': th.school_year.school_year,
                'period': th.period,
                'program': th.program.capitalize(),
                'start_date': str(th.start_date),
                'end_date': str(th.end_date) if th.end_date else 'Present',
                'is_active': th.is_active,
                'notes': th.notes,
            })

        # Summer remediation records
        summer_records = SummerRecord.objects.filter(
            student=student
        ).select_related('evaluating_tutor').order_by('-created_at')

        summer_list = []
        for sr in summer_records:
            summer_list.append({
                'school_year': sr.previous_school_year,
                'program': sr.previous_program.capitalize(),
                'reason': sr.get_reason_display(),
                'status': sr.get_summer_status_display(),
                'evaluation_status': sr.summer_evaluation_status.capitalize(),
                'result': sr.summer_result.capitalize() if sr.summer_result else 'Pending',
                'evaluator': sr.evaluating_tutor.get_full_name() if sr.evaluating_tutor else 'Pending',
                'start_date': str(sr.start_date) if sr.start_date else None,
                'completion_date': str(sr.completion_date) if sr.completion_date else None,
            })

        return Response({
            'student_id': str(student.id),
            'full_name': student.get_full_name(),
            'lrn': student.lrn,
            'current_level': (student.aral_level or 'basic').capitalize(),
            'current_tutor': student.assigned_tutor.get_full_name() if student.assigned_tutor else 'Unassigned',
            'enrollment_history': enrollment_history,
            'tutor_history': tutor_history_list,
            'summer_history': summer_list,
        }, status=status.HTTP_200_OK)
