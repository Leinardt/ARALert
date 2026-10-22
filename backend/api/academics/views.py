"""
Academics API Views.
Handles grades, ARAL activities, academic risks, attendance, student profiles,
and the principal dashboard.
"""

import uuid
from datetime import timedelta

from django.db.models import Avg, Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import (
    ApiAcademicRisk,
    ApiAralActivity,
    ApiAttendance,
    ApiAttendanceSession,
    ApiGrade,
)
from apps.accounts.models import User
from utilities.audit import log_audit_event

from .serializers import (
    AcademicRiskSerializer,
    AralActivitySerializer,
    AttendanceSerializer,
    AttendanceSessionSerializer,
    GradeSerializer,
)



# ---------------------------------------------------------------------------
# ARAL Level Progression Helper
# ---------------------------------------------------------------------------

def evaluate_student_aral_progression(student):
    """
    Automatically evaluates student's MOSY, EOSY, or ARAL Summer Assessment scores
    and updates student.aral_level accordingly.
    Rules:
    - Basic level: Evaluated by MOSY score. If pass (>= 28/40) -> Promoted to Plus. If fail -> Retains Basic.
    - Plus level: Evaluated by EOSY score. If pass (>= 28/40) -> Graduated. If fail -> Assigned to Summer.
    - Summer level: Evaluated by ARAL Summer Assessment score. If pass (>= 28/40) -> Graduated. If fail -> Retains Summer.
    """
    curr_level = student.aral_level or 'basic'
    if curr_level == 'graduated':
        return {
            'student_id': str(student.id),
            'student_name': student.get_full_name(),
            'previous_level': curr_level,
            'new_level': curr_level,
            'assessment_type': 'N/A',
            'score_percentage': None,
            'status': 'GRADUATED',
            'message': 'Student has already graduated from the ARAL program.'
        }

    grades = ApiGrade.objects.filter(student=student)

    mosy_grade = grades.filter(Q(subject__icontains='MOSY') | Q(remarks__icontains='MOSY')).order_by('-date_logged').first()
    eosy_grade = grades.filter(Q(subject__icontains='EOSY') | Q(remarks__icontains='EOSY')).order_by('-date_logged').first()
    endline_grade = grades.filter(Q(subject__icontains='Summer') | Q(remarks__icontains='Summer') | Q(subject__icontains='EndLine') | Q(subject__icontains='BOSY') | Q(remarks__icontains='EndLine')).order_by('-date_logged').first()

    def check_pass(grade_obj):
        if not grade_obj:
            return False, 0.0
        ts = float(grade_obj.total_score) if grade_obj.total_score and float(grade_obj.total_score) > 0 else 40.0
        s = float(grade_obj.score) if grade_obj.score is not None else 0.0
        pct = round((s / ts) * 100.0, 1)
        # Passing score: 28 items out of 40 (or >= 70%)
        is_pass = s >= 28.0 if ts == 40.0 else (s / ts) >= (28.0 / 40.0)
        return is_pass, pct

    new_level = curr_level
    status_code = 'RETAINED'
    msg = ''
    ass_type = 'Milestone'
    target_grade = None

    if curr_level == 'basic':
        if mosy_grade:
            target_grade = mosy_grade
            ass_type = 'MOSY'
            passed, pct = check_pass(mosy_grade)
            if passed:
                new_level = 'plus'
                status_code = 'PROMOTED'
                msg = f'Passed MOSY with {mosy_grade.score}/{mosy_grade.total_score or 40} ({pct}%). Promoted to Plus level.'
            else:
                new_level = 'basic'
                status_code = 'RETAINED'
                msg = f'Did not reach passing score (28/40) on MOSY ({mosy_grade.score}/{mosy_grade.total_score or 40}). Retained in Basic level.'
        elif eosy_grade:
            target_grade = eosy_grade
            ass_type = 'EOSY'
            passed, pct = check_pass(eosy_grade)
            if passed:
                new_level = 'plus'
                status_code = 'PROMOTED'
                msg = f'Passed EOSY with {eosy_grade.score}/{eosy_grade.total_score or 40} ({pct}%). Promoted to Plus level.'
            else:
                new_level = 'summer'
                status_code = 'ASSIGNED_SUMMER'
                msg = f'Did not reach passing score (28/40) on EOSY ({eosy_grade.score}/{eosy_grade.total_score or 40}). Assigned to Summer remediation.'
        else:
            return {
                'student_id': str(student.id),
                'student_name': student.get_full_name(),
                'previous_level': curr_level,
                'new_level': curr_level,
                'assessment_type': 'MOSY',
                'score_percentage': None,
                'status': 'RETAINED',
                'message': 'Awaiting MOSY assessment entry for level evaluation.'
            }

    elif curr_level == 'plus':
        if eosy_grade:
            target_grade = eosy_grade
            ass_type = 'EOSY'
            passed, pct = check_pass(eosy_grade)
            if passed:
                new_level = 'graduated'
                status_code = 'GRADUATED'
                msg = f'Passed EOSY with {eosy_grade.score}/{eosy_grade.total_score or 40} ({pct}%). Graduated from ARAL program!'
            else:
                new_level = 'summer'
                status_code = 'ASSIGNED_SUMMER'
                msg = f'Did not reach passing score (28/40) on EOSY ({eosy_grade.score}/{eosy_grade.total_score or 40}). Assigned to Summer remediation.'
        else:
            return {
                'student_id': str(student.id),
                'student_name': student.get_full_name(),
                'previous_level': curr_level,
                'new_level': curr_level,
                'assessment_type': 'EOSY',
                'score_percentage': None,
                'status': 'RETAINED',
                'message': 'Awaiting EOSY assessment entry for graduation evaluation.'
            }

    elif curr_level == 'summer':
        if endline_grade:
            target_grade = endline_grade
            ass_type = 'ARAL Summer Assessment'
            passed, pct = check_pass(endline_grade)
            if passed:
                new_level = 'graduated'
                status_code = 'GRADUATED'
                msg = f'Passed ARAL Summer Assessment with {endline_grade.score}/{endline_grade.total_score or 40} ({pct}%). Graduated from ARAL program!'
            else:
                new_level = 'summer'
                status_code = 'RETAINED'
                msg = f'Did not reach passing score (28/40) on ARAL Summer Assessment ({endline_grade.score}/{endline_grade.total_score or 40}). Retained in Summer remediation.'
        else:
            return {
                'student_id': str(student.id),
                'student_name': student.get_full_name(),
                'previous_level': curr_level,
                'new_level': curr_level,
                'assessment_type': 'ARAL Summer Assessment',
                'score_percentage': None,
                'status': 'RETAINED',
                'message': 'Awaiting ARAL Summer Assessment entry for remediation evaluation.'
            }

    if new_level != curr_level:
        student.aral_level = new_level
        student.save(update_fields=['aral_level'])

    ts = float(target_grade.total_score) if target_grade and target_grade.total_score else 40.0
    s = float(target_grade.score) if target_grade and target_grade.score is not None else 0.0
    pct_val = round((s / ts) * 100.0, 1)

    return {
        'student_id': str(student.id),
        'student_name': student.get_full_name(),
        'previous_level': curr_level,
        'new_level': new_level,
        'assessment_type': ass_type,
        'score_percentage': pct_val,
        'status': status_code,
        'message': msg
    }


def _is_milestone_grade(subject: str | None, remarks: str | None = None) -> bool:
    """Return True only if the grade belongs to a milestone assessment (MOSY, EOSY, Summer, EndLine, BOSY)."""
    text = f"{subject or ''} {remarks or ''}".lower()
    return any(token in text for token in ('mosy', 'eosy', 'summer', 'endline', 'bosy'))


# ---------------------------------------------------------------------------
# Grades
# ---------------------------------------------------------------------------


class GradeListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/academics/grades/         — list grades (role-filtered)
    POST /api/academics/grades/         — create single or bulk grades (tutor only)
    """
    serializer_class   = GradeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs   = ApiGrade.objects.select_related('student', 'tutor').all()

        student_id = self.request.query_params.get('student_id')
        subject    = self.request.query_params.get('subject')
        quarter    = self.request.query_params.get('quarter')

        if student_id:
            qs = qs.filter(student_id=student_id)
        if subject:
            qs = qs.filter(subject__icontains=subject)
        if quarter:
            qs = qs.filter(quarter=quarter)

        if user.is_superuser or user.role in ('principal', 'admin', 'faculty'):
            return qs
        if user.role == 'tutor':
            assigned_ids = user.assigned_students.values_list('id', flat=True)
            return qs.filter(Q(student_id__in=assigned_ids) | Q(tutor=user))
        if user.role == 'student':
            return qs.filter(student=user)
        return qs.none()

    def create(self, request, *args, **kwargs):
        if not isinstance(request.data, list):
            return super().create(request, *args, **kwargs)

        user = request.user
        if user.role != 'tutor' and not user.is_superuser:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only tutors can log grades.')

        if not request.data:
            return Response([], status=status.HTTP_201_CREATED)

        now = timezone.now()
        today = timezone.localdate()

        create_payloads = []
        update_payloads = []
        for item in request.data:
            if isinstance(item, dict) and item.get('id'):
                update_payloads.append(item)
            else:
                create_payloads.append(item)

        saved_grades = []
        audit_logs_data = []

        # 1. Bulk create new grades in a single query
        if create_payloads:
            serializer = self.get_serializer(data=create_payloads, many=True)
            serializer.is_valid(raise_exception=True)

            objs_to_create = []
            for validated in serializer.validated_data:
                objs_to_create.append(
                    ApiGrade(
                        student=validated.get('student'),
                        tutor=user,
                        subject=validated.get('subject', ''),
                        quarter=validated.get('quarter', 1),
                        score=validated.get('score', 0),
                        total_score=validated.get('total_score', 40),
                        component_type=validated.get('component_type', 'assessment'),
                        remarks=validated.get('remarks', ''),
                        date_logged=validated.get('date_logged') or today,
                        batch_id=validated.get('batch_id', str(uuid.uuid4())),
                        created_at=validated.get('created_at') or now,
                    )
                )

            created_objs = ApiGrade.objects.bulk_create(objs_to_create)
            if created_objs and getattr(created_objs[0], 'id', None) is None:
                batch_ids = {g.batch_id for g in objs_to_create if g.batch_id}
                if batch_ids:
                    created_objs = list(
                        ApiGrade.objects.select_related('student', 'tutor')
                        .filter(batch_id__in=batch_ids, tutor=user)
                        .order_by('id')
                    )

            for grade in created_objs:
                saved_grades.append(grade)
                if grade.student:
                    if _is_milestone_grade(grade.subject, grade.remarks):
                        evaluate_student_aral_progression(grade.student)
                    audit_logs_data.append((
                        'GRADE_RECORDED',
                        {
                            'student_id': str(grade.student.id),
                            'student_name': grade.student.get_full_name(),
                            'lrn': grade.student.lrn,
                            'subject': grade.subject,
                            'score': float(grade.score) if grade.score is not None else 0,
                            'total_score': float(grade.total_score) if grade.total_score else 40,
                            'quarter': grade.quarter,
                        },
                    ))

        # 2. Bulk update existing grades (e.g. re-saving MOSY/EOSY/Summer milestone scores)
        if update_payloads:
            update_ids = [int(item['id']) for item in update_payloads if item.get('id')]
            existing_map = {
                g.id: g
                for g in ApiGrade.objects.select_related('student', 'tutor').filter(id__in=update_ids)
            }
            objs_to_update = []
            for item in update_payloads:
                gid = int(item['id'])
                instance = existing_map.get(gid)
                if not instance:
                    continue
                old_score = float(instance.score) if instance.score is not None else 0
                old_total = float(instance.total_score) if instance.total_score else 40

                if 'score' in item:
                    instance.score = item['score']
                if 'total_score' in item:
                    instance.total_score = item['total_score']
                if 'remarks' in item:
                    instance.remarks = item['remarks']
                if 'date_logged' in item and item['date_logged']:
                    instance.date_logged = item['date_logged']
                if 'subject' in item and item['subject']:
                    instance.subject = item['subject']

                objs_to_update.append(instance)
                saved_grades.append(instance)

                if instance.student:
                    audit_logs_data.append((
                        'GRADE_UPDATED',
                        {
                            'student_id': str(instance.student.id),
                            'student_name': instance.student.get_full_name(),
                            'lrn': instance.student.lrn,
                            'subject': instance.subject,
                            'previous_score': old_score,
                            'new_score': float(instance.score) if instance.score is not None else 0,
                            'previous_total': old_total,
                            'total_score': float(instance.total_score) if instance.total_score else 40,
                        },
                    ))

            if objs_to_update:
                ApiGrade.objects.bulk_update(
                    objs_to_update,
                    ['score', 'total_score', 'remarks', 'date_logged', 'subject'],
                )
                for instance in objs_to_update:
                    if instance.student and _is_milestone_grade(instance.subject, instance.remarks):
                        evaluate_student_aral_progression(instance.student)

        # 3. Bulk insert all audit log entries in a single query
        if audit_logs_data:
            try:
                from apps.accounts.models import AuditLog
                from utilities.audit import _get_client_ip

                ip_address = _get_client_ip(request) if request else None
                user_agent = request.META.get('HTTP_USER_AGENT', '')[:500] if request else ''
                email = getattr(user, 'email', '')
                if email and not email.endswith('@aralert.local') and not email.startswith('student-'):
                    resolved_username = email
                else:
                    resolved_username = getattr(user, 'lrn', '') or getattr(user, 'username', '') or str(user)

                AuditLog.objects.bulk_create([
                    AuditLog(
                        user=user if getattr(user, 'pk', None) else None,
                        username=resolved_username,
                        action=action,
                        ip_address=ip_address,
                        user_agent=user_agent,
                        details=details,
                    )
                    for action, details in audit_logs_data
                ])
            except Exception:
                pass

        return Response(
            GradeSerializer(saved_grades, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    def perform_create(self, serializer):
        user = self.request.user
        if user.role != 'tutor' and not user.is_superuser:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only tutors can log grades.')
        grade = serializer.save(tutor=user, created_at=timezone.now())
        if grade.student:
            if _is_milestone_grade(grade.subject, grade.remarks):
                evaluate_student_aral_progression(grade.student)
            log_audit_event(
                'GRADE_RECORDED',
                user=user,
                request=self.request,
                details={
                    'student_id': str(grade.student.id),
                    'student_name': grade.student.get_full_name(),
                    'lrn': grade.student.lrn,
                    'subject': grade.subject,
                    'score': float(grade.score) if grade.score is not None else 0,
                    'total_score': float(grade.total_score) if grade.total_score else 40,
                    'quarter': grade.quarter,
                }
            )


class GradeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/academics/grades/<id>/
    PATCH  /api/academics/grades/<id>/
    DELETE /api/academics/grades/<id>/
    """
    serializer_class   = GradeSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset           = ApiGrade.objects.select_related('student', 'tutor').all()
    lookup_field       = 'id'

    def perform_update(self, serializer):
        instance = self.get_object()
        old_score = float(instance.score) if instance.score is not None else 0
        old_total = float(instance.total_score) if instance.total_score else 40
        grade = serializer.save()
        if grade.student:
            if _is_milestone_grade(grade.subject, grade.remarks):
                evaluate_student_aral_progression(grade.student)
            log_audit_event(
                'GRADE_UPDATED',
                user=self.request.user,
                request=self.request,
                details={
                    'student_id': str(grade.student.id),
                    'student_name': grade.student.get_full_name(),
                    'lrn': grade.student.lrn,
                    'subject': grade.subject,
                    'previous_score': old_score,
                    'new_score': float(grade.score) if grade.score is not None else 0,
                    'previous_total': old_total,
                    'total_score': float(grade.total_score) if grade.total_score else 40,
                }
            )

    def perform_destroy(self, instance):
        if instance.student:
            log_audit_event(
                'GRADE_DELETED',
                user=self.request.user,
                request=self.request,
                details={
                    'student_id': str(instance.student.id),
                    'student_name': instance.student.get_full_name(),
                    'lrn': instance.student.lrn,
                    'subject': instance.subject,
                    'score': float(instance.score) if instance.score is not None else 0,
                    'total_score': float(instance.total_score) if instance.total_score else 40,
                }
            )
        instance.delete()



# ---------------------------------------------------------------------------
# ARAL Activities
# ---------------------------------------------------------------------------

class AralActivityListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/academics/aral-activities/
    POST /api/academics/aral-activities/
    """
    serializer_class   = AralActivitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs   = ApiAralActivity.objects.select_related('student', 'tutor').all()

        student_id    = self.request.query_params.get('student_id')
        status_filter = self.request.query_params.get('status')

        if student_id:
            qs = qs.filter(student_id=student_id)
        if status_filter:
            qs = qs.filter(status=status_filter)

        if user.is_superuser or user.role in ('principal', 'admin', 'faculty'):
            return qs
        if user.role == 'tutor':
            assigned_ids = user.assigned_students.values_list('id', flat=True)
            return qs.filter(Q(student_id__in=assigned_ids) | Q(tutor=user))
        if user.role == 'student':
            return qs.filter(student=user)
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role != 'tutor' and not user.is_superuser:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only tutors can create ARAL activities.')
        serializer.save(tutor=user)


class AralActivityDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/academics/aral-activities/<id>/
    PATCH  /api/academics/aral-activities/<id>/
    DELETE /api/academics/aral-activities/<id>/
    """
    serializer_class   = AralActivitySerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset           = ApiAralActivity.objects.select_related('student', 'tutor').all()
    lookup_field       = 'id'


# ---------------------------------------------------------------------------
# Academic Risks
# ---------------------------------------------------------------------------

class AcademicRiskListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/academics/risks/
    POST /api/academics/risks/
    """
    serializer_class   = AcademicRiskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs   = ApiAcademicRisk.objects.select_related('student').all()

        student_id = self.request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)

        if user.is_superuser or user.role in ('principal', 'admin', 'faculty'):
            return qs
        if user.role == 'tutor':
            assigned_ids = user.assigned_students.values_list('id', flat=True)
            return qs.filter(student_id__in=assigned_ids)
        if user.role == 'student':
            return qs.filter(student=user)
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in ('tutor', 'admin', 'faculty') and not user.is_superuser:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Unauthorized to create risk alerts.')
        from django.utils import timezone as tz
        risk = serializer.save(date_created=tz.now())
        if risk.student:
            log_audit_event(
                'ACADEMIC_RISK_NOTE_RECORDED',
                user=user,
                request=self.request,
                details={
                    'risk_id': risk.id,
                    'student_id': str(risk.student.id),
                    'student_name': risk.student.get_full_name(),
                    'lrn': risk.student.lrn,
                    'risk_level': risk.risk_level,
                    'details': risk.details,
                    'resolved': risk.resolved,
                }
            )


class AcademicRiskDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/academics/risks/<id>/
    PATCH  /api/academics/risks/<id>/
    DELETE /api/academics/risks/<id>/
    """
    serializer_class   = AcademicRiskSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset           = ApiAcademicRisk.objects.select_related('student').all()
    lookup_field       = 'id'

    def perform_update(self, serializer):
        user = self.request.user
        old_risk = self.get_object()
        risk = serializer.save()

        # Check if student acknowledged
        if not old_risk.student_acknowledged and risk.student_acknowledged:
            log_audit_event(
                'STUDENT_INTERVENTION_ACKNOWLEDGED',
                user=user,
                request=self.request,
                details={
                    'risk_id': risk.id,
                    'student_id': str(risk.student.id) if risk.student else '',
                    'student_name': risk.student.get_full_name() if risk.student else user.get_full_name(),
                    'lrn': risk.student.lrn if risk.student else getattr(user, 'lrn', ''),
                    'risk_level': risk.risk_level,
                    'details': risk.details,
                }
            )


# ---------------------------------------------------------------------------
# Attendance Session (QR Generator)
# ---------------------------------------------------------------------------

class AttendanceSessionCreateView(APIView):
    """
    POST /api/academics/attendance/session/
    Generate a QR attendance session.
    GET /api/academics/attendance/session/
    Retrieve currently active session for the authenticated user.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        session_type = request.query_params.get('session_type', 'student')

        session = ApiAttendanceSession.objects.filter(
            creator=user,
            session_type=session_type,
            is_active=True,
            expires_at__gt=timezone.now(),
        ).order_by('-expires_at').first()

        if not session:
            # Check if active sessions have expired; if so, close them and finalize attendance
            expired_sessions = ApiAttendanceSession.objects.filter(
                creator=user,
                session_type=session_type,
                is_active=True,
                expires_at__lte=timezone.now(),
            )
            for exp in expired_sessions:
                exp.is_active = False
                exp.save(update_fields=['is_active'])
                finalize_session_attendance(exp)
            return Response({'session': None}, status=status.HTTP_200_OK)

        return Response({
            'session': AttendanceSessionSerializer(session).data
        }, status=status.HTTP_200_OK)

    def post(self, request):
        user               = request.user
        session_type       = request.data.get('session_type')
        action             = request.data.get('action')
        aral_activity_id   = request.data.get('aral_activity_id')
        expires_in_minutes = int(request.data.get('expires_in_minutes', 5))

        if not session_type:
            return Response({'error': 'session_type is required.'}, status=status.HTTP_400_BAD_REQUEST)

        if session_type == 'student':
            if user.role not in ('tutor', 'principal') and not user.is_superuser:
                return Response(
                    {'error': 'Only Tutors and Principals can generate student QR codes.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
        elif session_type == 'staff':
            if user.role != 'admin' and not user.is_superuser:
                return Response(
                    {'error': 'Only Admins can generate staff QR codes.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            # action is optional — when omitted, the all-day DTR QR determines
            # the punch type automatically based on scan time.
        else:
            return Response({'error': 'Invalid session_type.'}, status=status.HTTP_400_BAD_REQUEST)

        # Deactivate any previous active sessions for this user and session_type and finalize attendance
        prev_sessions = ApiAttendanceSession.objects.filter(
            creator=user,
            session_type=session_type,
            is_active=True
        )
        for prev in prev_sessions:
            prev.is_active = False
            prev.save(update_fields=['is_active'])
            finalize_session_attendance(prev)

        aral_activity = None
        if aral_activity_id:
            aral_activity = get_object_or_404(ApiAralActivity, id=aral_activity_id)

        session = ApiAttendanceSession.objects.create(
            id           = uuid.uuid4(),
            creator      = user,
            session_type = session_type,
            action       = action,
            aral_activity = aral_activity,
            expires_at   = timezone.now() + timedelta(minutes=expires_in_minutes),
            is_active    = True,
        )

        log_audit_event(
            'ATTENDANCE_SESSION_CREATED',
            user=user,
            request=request,
            details={
                'session_id': str(session.id),
                'session_type': session_type,
                'action': action or 'all_day',
                'expires_at': str(session.expires_at),
                'aral_activity': aral_activity.title if aral_activity else '',
            }
        )

        return Response(AttendanceSessionSerializer(session).data, status=status.HTTP_201_CREATED)


def finalize_session_attendance(session, target_student_ids=None):
    """
    Finalizes attendance for a student session:
    - If at least 1 student has recorded attendance (present) in this session:
      Mark all remaining students of THIS session's class/cohort as 'absent'.
    - If target_student_ids is explicitly provided:
      Mark only those targeted assigned students who have not recorded attendance today as 'absent'.
    - If NO students recorded attendance (count == 0) and no target_student_ids provided:
      Do NOT label any students as absent (session was a test or abandoned).
    """
    if not session or session.session_type != 'student':
        return

    today = timezone.localdate()
    tutor = session.creator

    # Check which students recorded attendance (present) strictly in THIS session
    scanned_attendances = list(
        ApiAttendance.objects.filter(
            session=session,
            role='student',
            status='present'
        ).select_related('user')
    )

    if not scanned_attendances:
        # At least 1 student must have recorded attendance (present) in this session
        # to make that session valid for auto-marking unscanned students as absent.
        # If 0 students attended (session was abandoned, test, or closed without attendance),
        # do NOT mark anyone as absent. Remove any stray absent records for this invalid session.
        ApiAttendance.objects.filter(session=session, status='absent').delete()
        return

    # Find candidate assigned students strictly belonging to this session's class
    if target_student_ids is not None:
        target_ids_set = {str(sid).lower() for sid in target_student_ids}
        if not target_ids_set:
            # Explicit empty target roster provided (e.g., frontend signaled 0 scans for this cohort)
            ApiAttendance.objects.filter(session=session, status='absent').delete()
            return

        # Crucial check: verify that AT LEAST ONE student from target_student_ids actually scanned present in this session!
        scanned_target_students = [
            att for att in scanned_attendances
            if str(att.user_id).lower() in target_ids_set
        ]
        if not scanned_target_students:
            # Not a single student from this target class roster scanned present in this session.
            # (e.g., 0 students from this class attended, or session was started for a different class).
            # Under NO circumstances should students of this class be marked absent!
            ApiAttendance.objects.filter(session=session, status='absent').delete()
            return

        assigned_students = User.objects.filter(
            id__in=target_student_ids,
            role='student',
            assigned_tutor=tutor,
            is_active=True
        )
    else:
        # Identify the cohort/section of the students who scanned into this session
        scanned_grades = {
            att.user.grade_level.strip().upper()
            for att in scanned_attendances
            if att.user and att.user.grade_level
        }
        if not scanned_grades:
            # Cannot safely determine cohort; do NOT mark anyone absent!
            return

        scanned_arals = {
            att.user.aral_level.strip().lower()
            for att in scanned_attendances
            if att.user and att.user.aral_level
        }

        qs = User.objects.filter(
            role='student',
            assigned_tutor=tutor,
            grade_level__in=scanned_grades,
            is_active=True
        )
        if scanned_arals:
            qs = qs.filter(aral_level__in=scanned_arals)
        assigned_students = qs

    # Find which students already have an attendance record for today (present or absent)
    existing_student_ids = set(
        ApiAttendance.objects.filter(date=today, role='student')
        .values_list('user_id', flat=True)
    )

    absent_records = []
    for student in assigned_students:
        if student.id not in existing_student_ids:
            absent_records.append(
                ApiAttendance(
                    user=student,
                    tutor=tutor,
                    session=session,
                    role='student',
                    date=today,
                    status='absent',
                    time_in=None,
                    time_out=None,
                )
            )

    if absent_records:
        ApiAttendance.objects.bulk_create(absent_records, ignore_conflicts=True)


class AttendanceSessionCloseView(APIView):
    """
    POST /api/academics/attendance/session/<uuid:session_id>/close/
    Close an active attendance session.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, session_id):
        try:
            session = ApiAttendanceSession.objects.get(id=session_id)
        except (ApiAttendanceSession.DoesNotExist, ValueError):
            return Response({'error': 'Invalid session ID.'}, status=status.HTTP_404_NOT_FOUND)

        if session.creator != request.user and not request.user.is_superuser:
            return Response({'error': 'You do not have permission to close this session.'}, status=status.HTTP_403_FORBIDDEN)

        target_student_ids = request.data.get('student_ids')

        session.is_active = False
        session.save(update_fields=['is_active'])
        finalize_session_attendance(session, target_student_ids=target_student_ids)

        log_audit_event(
            'ATTENDANCE_SESSION_CLOSED',
            user=request.user,
            request=request,
            details={
                'session_id': str(session.id),
                'session_type': session.session_type,
            }
        )

        return Response({
            'message': 'Attendance session closed successfully.',
            'session': AttendanceSessionSerializer(session).data,
        }, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Attendance Scan (QR scan)
# ---------------------------------------------------------------------------

class AttendanceScanView(APIView):
    """
    POST /api/academics/attendance/scan/
    Mark attendance by scanning a QR session.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user       = request.user
        raw_input = request.data.get('session_id') or request.data.get('student_id') or request.data.get('qr_code')

        if not raw_input:
            return Response({'error': 'QR code data is required.'}, status=status.HTTP_400_BAD_REQUEST)

        clean_code = str(raw_input).strip()
        norm_code = clean_code.lower().replace('-', '').replace(' ', '')
        today = timezone.localdate()
        current_time = timezone.localtime().time()

        # ─── FLOW A: Tutor / Staff Scanning a Student's Permanent QR Code ───
        if user.role in ('tutor', 'admin', 'principal') or user.is_superuser:
            # Check if clean_code represents a student (e.g. UUID, LRN, or ARALERT:STUDENT:<uuid>)
            student_candidate = None
            extracted_token = clean_code
            if clean_code.upper().startswith('ARALERT:STUDENT:'):
                extracted_token = clean_code.split(':', 2)[2].strip()

            try:
                cand_uuid = uuid.UUID(extracted_token)
                student_candidate = User.objects.filter(id=cand_uuid, role='student').first()
            except (ValueError, TypeError):
                pass

            if not student_candidate:
                student_candidate = User.objects.filter(lrn=clean_code, role='student').first()

            if not student_candidate and len(norm_code) >= 6:
                student_qs = User.objects.filter(role='student')
                matching_students = [
                    s for s in student_qs
                    if str(s.id).lower().replace('-', '').startswith(norm_code)
                    or (s.lrn and s.lrn.endswith(norm_code))
                ]
                if user.role == 'tutor':
                    assigned_matches = [s for s in matching_students if s.assigned_tutor_id == user.id]
                    if len(assigned_matches) == 1:
                        student_candidate = assigned_matches[0]
                    elif len(assigned_matches) > 1:
                        return Response({
                            'error': 'Multiple assigned students match this 6-digit code. Please enter the full LRN.'
                        }, status=status.HTTP_400_BAD_REQUEST)

                if not student_candidate:
                    if len(matching_students) == 1:
                        student_candidate = matching_students[0]
                    elif len(matching_students) > 1:
                        return Response({
                            'error': 'Multiple students match this 6-digit code. Please enter the full LRN.'
                        }, status=status.HTTP_400_BAD_REQUEST)

            if clean_code.upper().startswith('ARALERT:STUDENT:') and not student_candidate:
                return Response({
                    'error': 'Student QR pass is invalid or student not found.'
                }, status=status.HTTP_404_NOT_FOUND)

            if student_candidate:
                if user.role == 'tutor' and student_candidate.assigned_tutor_id and student_candidate.assigned_tutor_id != user.id:
                    return Response({
                        'error': f"{student_candidate.get_full_name()} is assigned to another tutor."
                    }, status=status.HTTP_400_BAD_REQUEST)

                # Find an active, unexpired student attendance session created by this tutor/staff for today
                now = timezone.now()
                active_session = ApiAttendanceSession.objects.filter(
                    creator=user,
                    session_type='student',
                    is_active=True,
                    expires_at__gt=now
                ).order_by('-expires_at').first()

                if not active_session:
                    # Also check for any active session if superuser/admin
                    if user.is_superuser or user.role in ('admin', 'principal'):
                        active_session = ApiAttendanceSession.objects.filter(
                            session_type='student',
                            is_active=True,
                            expires_at__gt=now
                        ).order_by('-expires_at').first()

                if not active_session:
                    return Response({
                        'error': 'No active attendance session found. Please start a session before scanning students.'
                    }, status=status.HTTP_400_BAD_REQUEST)

                # Check if student is already marked present for this session
                existing_att = ApiAttendance.objects.filter(user=student_candidate, session=active_session).first()
                if not existing_att:
                    existing_att = ApiAttendance.objects.filter(
                        user=student_candidate,
                        date=today,
                        tutor=active_session.creator,
                        session__isnull=True
                    ).first()

                if existing_att:
                    return Response({
                        'error': f"{student_candidate.get_full_name()} is already marked {existing_att.status.upper()} for this session.",
                        'student': {
                            'id': str(student_candidate.id),
                            'name': student_candidate.get_full_name(),
                            'lrn': student_candidate.lrn,
                        },
                        'attendance': AttendanceSerializer(existing_att).data,
                    }, status=status.HTTP_400_BAD_REQUEST)

                attendance = ApiAttendance.objects.create(
                    user          = student_candidate,
                    role          = 'student',
                    date          = today,
                    time_in       = current_time,
                    status        = 'present',
                    tutor         = active_session.creator,
                    aral_activity = active_session.aral_activity,
                    session       = active_session,
                )

                log_audit_event(
                    'ATTENDANCE_STUDENT_SCANNED_BY_TUTOR',
                    user=user,
                    request=request,
                    details={
                        'student_id': str(student_candidate.id),
                        'student_name': student_candidate.get_full_name(),
                        'lrn': student_candidate.lrn,
                        'tutor_id': str(user.id),
                        'tutor_name': user.get_full_name(),
                        'session_id': str(active_session.id),
                        'date': str(today),
                        'time_in': str(attendance.time_in),
                        'status': 'present',
                    }
                )

                return Response({
                    'message': f"Successfully recorded attendance for {student_candidate.get_full_name()}!",
                    'student': {
                        'id': str(student_candidate.id),
                        'name': student_candidate.get_full_name(),
                        'lrn': student_candidate.lrn,
                    },
                    'attendance': AttendanceSerializer(attendance).data,
                }, status=status.HTTP_200_OK)

        # ─── FLOW B: Student Scanning Tutor QR or Staff Scanning DTR Session ───
        session = None
        # 1. Try exact UUID lookup first (QR scanner or full UUID entry)
        try:
            val_uuid = uuid.UUID(clean_code)
            session = ApiAttendanceSession.objects.filter(id=val_uuid).first()
        except (ValueError, TypeError):
            pass

        # 2. Try prefix / short code match on active, unexpired sessions
        if not session and len(norm_code) >= 4:
            now = timezone.now()
            active_qs = ApiAttendanceSession.objects.filter(
                is_active=True,
                expires_at__gt=now
            )
            matching = []
            for s in active_qs:
                s_id_str = str(s.id).lower()
                s_hex = s_id_str.replace('-', '')
                if s_hex.startswith(norm_code) or s_id_str.startswith(norm_code):
                    matching.append(s)

            if user.role == 'student':
                student_matching = [s for s in matching if s.session_type == 'student']
                if len(student_matching) == 1:
                    session = student_matching[0]
                elif len(student_matching) > 1:
                    assigned_tutor_id = getattr(user, 'assigned_tutor_id', None)
                    tutor_matching = [s for s in student_matching if s.creator_id == assigned_tutor_id]
                    if len(tutor_matching) == 1:
                        session = tutor_matching[0]
                    else:
                        return Response({
                            'error': 'Multiple active student sessions match this code. Please scan the QR code directly.'
                        }, status=status.HTTP_400_BAD_REQUEST)
            elif user.role in ('tutor', 'faculty', 'admin', 'principal'):
                staff_matching = [s for s in matching if s.session_type == 'staff']
                if len(staff_matching) == 1:
                    session = staff_matching[0]
                elif len(staff_matching) > 1:
                    return Response({
                        'error': 'Multiple active staff sessions match this code. Please scan the QR code directly.'
                    }, status=status.HTTP_400_BAD_REQUEST)

            if not session and len(matching) == 1:
                session = matching[0]

        if not session:
            return Response({'error': 'Invalid or expired session code.'}, status=status.HTTP_404_NOT_FOUND)

        if not session.is_active or timezone.now() > session.expires_at:
            return Response({'error': 'QR code has expired.'}, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.localdate()
        current_time = timezone.localtime().time()

        if session.session_type == 'student':
            if user.role != 'student':
                return Response({'error': 'This QR code is for students only.'}, status=status.HTTP_400_BAD_REQUEST)

            if ApiAttendance.objects.filter(user=user, session=session).exists():
                return Response({'error': f"{user.get_full_name()} is already marked PRESENT for this session."}, status=status.HTTP_400_BAD_REQUEST)

            attendance = ApiAttendance.objects.create(
                user          = user,
                role          = 'student',
                date          = today,
                time_in       = current_time,
                status        = 'present',
                tutor         = session.creator,
                aral_activity = session.aral_activity,
                session       = session,
            )

            log_audit_event(
                'ATTENDANCE_QR_SCANNED',
                user=user,
                request=request,
                details={
                    'student_id': str(user.id),
                    'student_name': user.get_full_name(),
                    'lrn': user.lrn,
                    'tutor_id': str(session.creator.id) if session.creator else '',
                    'tutor_name': session.creator.get_full_name() if session.creator else '',
                    'session_id': str(session.id),
                    'aral_activity': session.aral_activity.title if session.aral_activity else '',
                    'date': str(today),
                    'status': 'present',
                }
            )

            return Response({
                'message': 'Attendance recorded successfully!',
                'attendance': AttendanceSerializer(attendance).data,
            }, status=status.HTTP_200_OK)

        elif session.session_type == 'staff':
            if user.role not in ('tutor', 'faculty', 'admin', 'principal') and not user.is_superuser:
                return Response({'error': 'Only staff can scan this QR code.'}, status=status.HTTP_403_FORBIDDEN)

            action = session.action
            if not action:
                existing = ApiAttendance.objects.filter(user=user, date=today).first()
                if not existing:
                    action = 'time_in'
                elif not existing.time_out:
                    action = 'time_out'
                else:
                    return Response({'error': 'Already completed DTR (Clock In and Clock Out) for today.'}, status=status.HTTP_400_BAD_REQUEST)

            if action == 'time_in':
                if ApiAttendance.objects.filter(user=user, date=today).exists():
                    return Response({'error': 'Already clocked in today.'}, status=status.HTTP_400_BAD_REQUEST)
                attendance = ApiAttendance.objects.create(
                    user    = user,
                    role    = user.role,
                    date    = today,
                    time_in = current_time,
                    status  = 'present',
                    session = session,
                )

                log_audit_event(
                    'ATTENDANCE_STAFF_CLOCK_IN',
                    user=user,
                    request=request,
                    details={
                        'staff_id': str(user.id),
                        'staff_name': user.get_full_name(),
                        'role': user.role,
                        'session_id': str(session.id),
                        'date': str(today),
                        'time_in': str(attendance.time_in),
                    }
                )

                return Response({
                    'message': 'Clock In recorded!',
                    'attendance': AttendanceSerializer(attendance).data,
                }, status=status.HTTP_200_OK)

            elif action == 'time_out':
                try:
                    attendance = ApiAttendance.objects.get(user=user, date=today)
                except ApiAttendance.DoesNotExist:
                    return Response({'error': 'No Clock In found for today.'}, status=status.HTTP_400_BAD_REQUEST)

                if attendance.time_out:
                    return Response({'error': 'Already clocked out today.'}, status=status.HTTP_400_BAD_REQUEST)

                attendance.time_out = current_time
                attendance.save(update_fields=['time_out'])

                log_audit_event(
                    'ATTENDANCE_STAFF_CLOCK_OUT',
                    user=user,
                    request=request,
                    details={
                        'staff_id': str(user.id),
                        'staff_name': user.get_full_name(),
                        'role': user.role,
                        'session_id': str(session.id),
                        'date': str(today),
                        'time_out': str(attendance.time_out),
                    }
                )

                return Response({
                    'message': 'Clock Out recorded!',
                    'attendance': AttendanceSerializer(attendance).data,
                }, status=status.HTTP_200_OK)

        return Response({'error': 'Invalid session parameters.'}, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Manual Attendance Log
# ---------------------------------------------------------------------------

class AttendanceManualLogView(APIView):
    """
    POST /api/academics/attendance/manual/
    Tutors manually log student attendance.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role != 'tutor' and not user.is_superuser:
            return Response({'error': 'Only tutors can submit manual attendance.'}, status=status.HTTP_403_FORBIDDEN)

        student_id       = request.data.get('student_id')
        date_str         = request.data.get('date')
        status_val       = request.data.get('status', 'present')
        aral_activity_id = request.data.get('aral_activity_id')

        if not student_id:
            return Response({'error': 'student_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        student = get_object_or_404(User, id=student_id, role='student')

        if student.assigned_tutor != user and not user.is_superuser:
            return Response(
                {'error': 'You can only log attendance for your assigned students.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if date_str:
            from datetime import datetime
            try:
                log_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            log_date = timezone.localdate()

        aral_activity = None
        if aral_activity_id:
            aral_activity = get_object_or_404(ApiAralActivity, id=aral_activity_id)

        attendance, created = ApiAttendance.objects.get_or_create(
            user = student,
            date = log_date,
            defaults={
                'role':          'student',
                'time_in':       timezone.localtime().time(),
                'status':        status_val,
                'tutor':         user,
                'aral_activity': aral_activity,
            },
        )
        if not created:
            attendance.status = status_val
            if aral_activity:
                attendance.aral_activity = aral_activity
            attendance.save(update_fields=['status', 'aral_activity'])

        log_audit_event(
            'ATTENDANCE_MANUAL_LOGGED',
            user=user,
            request=request,
            details={
                'student_id': str(student.id),
                'student_name': student.get_full_name(),
                'lrn': student.lrn,
                'date': str(log_date),
                'status': status_val,
            }
        )

        return Response({
            'message': 'Attendance logged manually.',
            'attendance': AttendanceSerializer(attendance).data,
        }, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Attendance History
# ---------------------------------------------------------------------------

class AttendanceHistoryView(generics.ListAPIView):
    """
    GET /api/academics/attendance/history/
    """
    serializer_class   = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs   = ApiAttendance.objects.select_related('user', 'tutor', 'aral_activity', 'session').all()

        date_param    = self.request.query_params.get('date')
        role_param    = self.request.query_params.get('role')
        status_param  = self.request.query_params.get('status')
        user_id_param = self.request.query_params.get('user_id')

        if date_param:
            qs = qs.filter(date=date_param)
        if role_param:
            qs = qs.filter(role=role_param)
        if status_param:
            qs = qs.filter(status=status_param)
        if user_id_param:
            qs = qs.filter(user_id=user_id_param)

        if user.is_superuser or user.role in ('principal', 'admin'):
            return qs
        if user.role == 'student':
            return qs.filter(user=user)
        if user.role == 'tutor':
            assigned_ids = user.assigned_students.values_list('id', flat=True)
            return qs.filter(Q(role='student') | Q(user=user) | Q(tutor=user) | Q(session__creator=user) | Q(user_id__in=assigned_ids))
        if user.role == 'faculty':
            return qs.filter(user=user)
        return qs.none()

    def delete(self, request):
        user = request.user
        if user.role != 'tutor' and not user.is_superuser and user.role not in ('admin', 'principal'):
            return Response({'error': 'Only tutors or admins can delete attendance records.'}, status=status.HTTP_403_FORBIDDEN)

        date_param = request.query_params.get('date') or request.data.get('date')
        all_param = request.query_params.get('all') or request.data.get('all')
        student_ids = request.data.get('student_ids')

        qs = self.get_queryset().filter(role='student')
        if user.role == 'tutor':
            assigned_ids = user.assigned_students.values_list('id', flat=True)
            qs = qs.filter(Q(tutor=user) | Q(session__creator=user) | Q(user_id__in=assigned_ids))

        if student_ids and isinstance(student_ids, list):
            qs = qs.filter(user_id__in=student_ids)

        if date_param and not all_param:
            qs = qs.filter(date=date_param)

        count = qs.count()
        qs.delete()

        log_audit_event(
            'ATTENDANCE_RECORDS_DELETED',
            user=user,
            request=request,
            details={
                'deleted_count': count,
                'date': date_param or 'all',
            }
        )

        return Response({
            'message': f'Successfully cleared {count} attendance records.',
            'count': count
        }, status=status.HTTP_200_OK)


class AttendanceDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET, PATCH, PUT, DELETE /api/academics/attendance/<int:id>/
    Allows tutors, admins, and principals to view and update student attendance records anytime
    without requiring any approval.
    """
    serializer_class   = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field       = 'id'

    def get_queryset(self):
        user = self.request.user
        qs   = ApiAttendance.objects.select_related('user', 'tutor', 'aral_activity', 'session').all()
        if user.is_superuser or user.role in ('principal', 'admin'):
            return qs
        if user.role == 'tutor':
            assigned_ids = user.assigned_students.values_list('id', flat=True)
            return qs.filter(
                Q(role__iexact='student') |
                Q(user__role='student') |
                Q(tutor=user) |
                Q(session__creator=user) |
                Q(user_id__in=assigned_ids)
            )
        if user.role == 'faculty':
            return qs.filter(user=user)
        return qs.none()

    def perform_update(self, serializer):
        instance = self.get_object()
        old_status = instance.status
        old_date = instance.date
        attendance = serializer.save()
        log_audit_event(
            'ATTENDANCE_RECORD_UPDATED',
            user=self.request.user,
            request=self.request,
            details={
                'attendance_id': attendance.id,
                'student_id': str(attendance.user_id) if attendance.user_id else '',
                'student_name': attendance.user.get_full_name() if attendance.user else '',
                'date': str(attendance.date),
                'status': attendance.status,
                'previous_status': old_status,
            }
        )


# ---------------------------------------------------------------------------
# Student Academic Profile
# ---------------------------------------------------------------------------

class StudentAcademicProfileView(APIView):
    """
    GET /api/academics/student-profile/<student_id>/
    GET /api/academics/student-profile/               (student views own profile)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, student_id=None):
        user = request.user

        if student_id:
            student = get_object_or_404(User, id=student_id, role='student')
        else:
            if user.role == 'student':
                student = user
            else:
                return Response({'error': 'student_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Access control
        if not user.is_superuser and user.role not in ('principal', 'admin', 'faculty'):
            if user.role == 'tutor' and student.assigned_tutor != user:
                return Response({'error': 'You do not have access to this student profile.'}, status=status.HTTP_403_FORBIDDEN)
            if user.role == 'student' and student != user:
                return Response({'error': 'You cannot view other students\' profiles.'}, status=status.HTTP_403_FORBIDDEN)

        # Automatically evaluate student ARAL level progression
        evaluate_student_aral_progression(student)

        tutor = student.assigned_tutor
        w_assess  = tutor.assessment_weight   if tutor else 50
        w_tasks   = tutor.weekly_tasks_weight if tutor else 30
        w_attend  = tutor.attendance_weight   if tutor else 20

        # Grades (optimized from 64 queries to 1 query)
        grades = ApiGrade.objects.filter(student=student)
        grade_stats = (
            grades.values('subject', 'quarter')
            .annotate(
                avg_assess=Avg('score', filter=Q(component_type='assessment')),
                avg_task=Avg('score', filter=Q(component_type='weekly_task')),
                avg_attend=Avg('score', filter=Q(component_type='attendance')),
            )
            .order_by('subject', 'quarter')
        )
        grade_summary  = []
        overall_scores = []

        for row in grade_stats:
            subject    = row['subject']
            quarter    = row['quarter']
            avg_assess = row['avg_assess'] or 0
            avg_task   = row['avg_task'] or 0
            avg_attend = row['avg_attend'] or 0
            final = (
                float(avg_assess) * w_assess / 100
                + float(avg_task)  * w_tasks  / 100
                + float(avg_attend) * w_attend / 100
            )
            grade_summary.append({
                'subject':         subject,
                'quarter':         quarter,
                'assessment_avg':  round(float(avg_assess), 2),
                'weekly_task_avg': round(float(avg_task), 2),
                'attendance_avg':  round(float(avg_attend), 2),
                'final_grade':     round(final, 2),
            })
            overall_scores.append(final)

        gpa = round(sum(overall_scores) / len(overall_scores), 2) if overall_scores else None

        # Attendance
        att_logs     = ApiAttendance.objects.filter(user=student)
        total_days   = att_logs.count()
        present_days = att_logs.filter(status='present').count()
        absent_days  = att_logs.filter(status='absent').count()
        att_rate     = round(present_days / total_days * 100, 2) if total_days > 0 else 100

        # ARAL activities
        activities  = ApiAralActivity.objects.filter(student=student)
        act_stats   = activities.values('status').annotate(count=Count('status'))

        # Risks
        risks = ApiAcademicRisk.objects.filter(student=student, resolved=False)

        data = {
            'student': {
                'id':          str(student.id),
                'name':        student.get_full_name(),
                'first_name':  student.first_name,
                'middle_name': student.middle_name or '',
                'last_name':   student.last_name,
                'username':    student.username,
                'lrn':         student.lrn,
                'email':       student.email,
                'aral_level':  student.aral_level,
            },
            'assigned_tutor': {
                'id':                  str(tutor.id),
                'name':                tutor.get_full_name(),
                'email':               tutor.email,
                'assessment_weight':   w_assess,
                'weekly_tasks_weight': w_tasks,
                'attendance_weight':   w_attend,
            } if tutor else None,
            'gpa':          gpa,
            'grade_details': grade_summary,
            'attendance': {
                'attendance_rate': att_rate,
                'total_days':      total_days,
                'present':         present_days,
                'absent':          absent_days,
                'logs':            AttendanceSerializer(att_logs[:15], many=True).data,
            },
            'aral_progress': {
                'activities': AralActivitySerializer(activities, many=True).data,
                'stats':      {item['status']: item['count'] for item in act_stats},
            },
            'academic_risks': AcademicRiskSerializer(risks, many=True).data,
        }
        return Response(data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Principal Dashboard
# ---------------------------------------------------------------------------

class PrincipalDashboardView(APIView):
    """
    GET /api/academics/principal-dashboard/
    Returns program summary, risk counts, and trend data.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role not in ('principal',) and not user.is_superuser:
            return Response({'error': 'Access restricted to Principals.'}, status=status.HTTP_403_FORBIDDEN)

        days = int(request.query_params.get('days', 30))
        since = timezone.now() - timedelta(days=days)

        tutors   = User.objects.filter(role='tutor', is_active=True)
        faculty  = User.objects.filter(role='faculty', is_active=True)
        students = User.objects.filter(role='student', is_active=True)

        # Risk summary (1 query)
        risk_counts = ApiAcademicRisk.objects.filter(resolved=False).values('risk_level').annotate(count=Count('id'))
        risk_map = {row['risk_level']: row['count'] for row in risk_counts}
        risk_summary = {
            'low':    risk_map.get('low', 0),
            'medium': risk_map.get('medium', 0),
            'high':   risk_map.get('high', 0),
        }

        # Class performance trend (daily avg score + attendance rate over last N days)
        # Optimized into 2 queries instead of 3 * N queries
        from datetime import date, timedelta as td
        today = date.today()
        trend_start = today - td(days=days - 1)

        class_grades_qs = (
            ApiGrade.objects.filter(date_logged__gte=trend_start, date_logged__lte=today)
            .values('date_logged')
            .annotate(avg_score=Avg('score'))
        )
        class_grade_map = {row['date_logged']: row['avg_score'] for row in class_grades_qs}

        class_att_qs = (
            ApiAttendance.objects.filter(date__gte=trend_start, date__lte=today, role='student')
            .values('date')
            .annotate(
                total=Count('id'),
                present=Count('id', filter=Q(status='present'))
            )
        )
        class_att_map = {row['date']: (row['total'], row['present']) for row in class_att_qs}

        trend = []
        for i in range(days - 1, -1, -1):
            day = today - td(days=i)
            avg_score = class_grade_map.get(day, 0) or 0
            total, present = class_att_map.get(day, (0, 0))
            att_rate = round(present / total * 100, 2) if total else 0
            if avg_score or att_rate:
                trend.append({
                    'date':            str(day),
                    'attendance_rate': att_rate,
                    'average_score':   round(float(avg_score), 2),
                })

        # Per-tutor performance
        # Optimized into 2 bulk queries instead of 3 * 10 * 7 queries
        top_tutors = list(tutors[:10])
        top_tutor_ids = [t.id for t in top_tutors]
        tutor_days = min(days, 7)
        tutor_start = today - td(days=tutor_days - 1)

        tg_qs = (
            ApiGrade.objects.filter(tutor_id__in=top_tutor_ids, date_logged__gte=tutor_start, date_logged__lte=today)
            .values('tutor_id', 'date_logged')
            .annotate(avg_score=Avg('score'))
        )
        tutor_grade_map = {(row['tutor_id'], row['date_logged']): row['avg_score'] for row in tg_qs}

        ta_qs = (
            ApiAttendance.objects.filter(tutor_id__in=top_tutor_ids, date__gte=tutor_start, date__lte=today)
            .values('tutor_id', 'date')
            .annotate(
                total=Count('id'),
                present=Count('id', filter=Q(status='present'))
            )
        )
        tutor_att_map = {(row['tutor_id'], row['date']): (row['total'], row['present']) for row in ta_qs}

        per_tutor = []
        for tutor in top_tutors:
            tutor_trend = []
            for i in range(tutor_days - 1, -1, -1):
                day = today - td(days=i)
                avg = tutor_grade_map.get((tutor.id, day), 0) or 0
                tot, pre = tutor_att_map.get((tutor.id, day), (0, 0))
                ar = round(pre / tot * 100, 2) if tot else 0
                tutor_trend.append({
                    'date':            str(day),
                    'attendance_rate': ar,
                    'average_score':   round(float(avg), 2),
                })
            per_tutor.append({
                'tutor_id':   str(tutor.id),
                'tutor_name': tutor.get_full_name(),
                'trend':      tutor_trend,
            })

        # Staff attendance trend
        # Optimized into 1 bulk query instead of 4 * 14 queries
        staff_days = min(days, 14)
        staff_start = today - td(days=staff_days - 1)
        staff_qs = (
            ApiAttendance.objects.filter(
                date__gte=staff_start,
                date__lte=today,
                role__in=('tutor', 'faculty')
            )
            .values('date', 'role')
            .annotate(
                total=Count('id'),
                present=Count('id', filter=Q(status='present'))
            )
        )
        staff_att_map = {(row['date'], row['role']): (row['total'], row['present']) for row in staff_qs}

        staff_trend = []
        for i in range(staff_days - 1, -1, -1):
            day = today - td(days=i)
            t_tot, t_pre = staff_att_map.get((day, 'tutor'), (0, 0))
            f_tot, f_pre = staff_att_map.get((day, 'faculty'), (0, 0))
            staff_trend.append({
                'date':                    str(day),
                'tutor_attendance_rate':   round(t_pre / t_tot * 100, 2) if t_tot else 0,
                'faculty_attendance_rate': round(f_pre / f_tot * 100, 2) if f_tot else 0,
            })

        # Program summary (1 query)
        user_counts = (
            User.objects.filter(role__in=('tutor', 'faculty', 'student'), is_active=True)
            .values('role')
            .annotate(count=Count('id'))
        )
        user_count_map = {row['role']: row['count'] for row in user_counts}

        return Response({
            'program_summary': {
                'total_tutors':   user_count_map.get('tutor', 0),
                'total_faculty':  user_count_map.get('faculty', 0),
                'total_students': user_count_map.get('student', 0),
            },
            'risk_summary':            risk_summary,
            'class_performance_trend': trend,
            'per_tutor_performance':   per_tutor,
            'staff_attendance_trend':  staff_trend,
        }, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# ARAL Level Progression Evaluation
# ---------------------------------------------------------------------------

class AralLevelProgressionView(APIView):
    """
    POST /api/academics/level-up/evaluate/
    Evaluates student ARAL Level Progression based on MOSY, EOSY, and ARAL Summer Assessment scores.
    Rules:
    - Basic level: Takes MOSY score. If pass (>= 75%) -> Promoted to Plus. If fail -> Retains Basic.
    - Plus level: Takes EOSY score. If pass (>= 75%) -> Graduated. If fail -> Assigned to Summer.
    - Basic level (at EOSY): If fails EOSY -> Assigned to Summer.
    - Summer level: Takes ARAL Summer Assessment score. If pass (>= 75%) -> Graduated. If fail -> Retains Summer.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role not in ('tutor', 'admin', 'principal') and not user.is_superuser:
            return Response({'error': 'Unauthorized to run level progression evaluation.'}, status=status.HTTP_403_FORBIDDEN)

        student_id = request.data.get('student_id')

        if student_id:
            students = User.objects.filter(id=student_id, role='student')
        elif user.role == 'tutor':
            students = user.assigned_students.filter(role='student')
        else:
            students = User.objects.filter(role='student')

        results = [evaluate_student_aral_progression(s) for s in students]
        return Response({'results': results}, status=status.HTTP_200_OK)

