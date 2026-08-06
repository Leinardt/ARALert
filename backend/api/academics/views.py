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

from .serializers import (
    AcademicRiskSerializer,
    AralActivitySerializer,
    AttendanceSerializer,
    AttendanceSessionSerializer,
    GradeSerializer,
)


# ---------------------------------------------------------------------------
# Grades
# ---------------------------------------------------------------------------

class GradeListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/academics/grades/         — list grades (role-filtered)
    POST /api/academics/grades/         — create a grade (tutor only)
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

    def perform_create(self, serializer):
        user = self.request.user
        if user.role != 'tutor' and not user.is_superuser:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only tutors can log grades.')
        serializer.save(tutor=user)


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
        serializer.save(date_created=tz.now())


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


# ---------------------------------------------------------------------------
# Attendance Session (QR Generator)
# ---------------------------------------------------------------------------

class AttendanceSessionCreateView(APIView):
    """
    POST /api/academics/attendance/session/
    Generate a QR attendance session.
    """
    permission_classes = [permissions.IsAuthenticated]

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
        return Response(AttendanceSessionSerializer(session).data, status=status.HTTP_201_CREATED)


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
        session_id = request.data.get('session_id')

        if not session_id:
            return Response({'error': 'session_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            session = ApiAttendanceSession.objects.get(id=session_id)
        except (ApiAttendanceSession.DoesNotExist, ValueError):
            return Response({'error': 'Invalid session ID.'}, status=status.HTTP_404_NOT_FOUND)

        if not session.is_active or timezone.now() > session.expires_at:
            return Response({'error': 'QR code has expired.'}, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.localdate()

        if session.session_type == 'student':
            if user.role != 'student':
                return Response({'error': 'This QR code is for students only.'}, status=status.HTTP_400_BAD_REQUEST)

            if ApiAttendance.objects.filter(user=user, date=today).exists():
                return Response({'error': 'Attendance already recorded for today.'}, status=status.HTTP_400_BAD_REQUEST)

            attendance = ApiAttendance.objects.create(
                user          = user,
                role          = 'student',
                date          = today,
                time_in       = timezone.now().time(),
                status        = 'present',
                tutor         = session.creator,
                aral_activity = session.aral_activity,
                session       = session,
            )
            return Response({
                'message': 'Attendance recorded successfully!',
                'attendance': AttendanceSerializer(attendance).data,
            }, status=status.HTTP_200_OK)

        elif session.session_type == 'staff':
            if user.role not in ('tutor', 'faculty', 'admin', 'principal') and not user.is_superuser:
                return Response({'error': 'Only staff can scan this QR code.'}, status=status.HTTP_403_FORBIDDEN)

            action = session.action or 'time_in'

            if action == 'time_in':
                if ApiAttendance.objects.filter(user=user, date=today).exists():
                    return Response({'error': 'Already clocked in today.'}, status=status.HTTP_400_BAD_REQUEST)
                attendance = ApiAttendance.objects.create(
                    user    = user,
                    role    = user.role,
                    date    = today,
                    time_in = timezone.now().time(),
                    status  = 'present',
                    session = session,
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

                attendance.time_out = timezone.now().time()
                attendance.save(update_fields=['time_out'])
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
                'time_in':       timezone.now().time(),
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

        if user.is_superuser or user.role == 'principal':
            return qs
        if user.role == 'student':
            return qs.filter(user=user)
        if user.role == 'tutor':
            assigned_ids = user.assigned_students.values_list('id', flat=True)
            return qs.filter(Q(user=user) | Q(user_id__in=assigned_ids))
        if user.role in ('faculty', 'admin'):
            return qs.filter(user=user)
        return qs.none()


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

        tutor = student.assigned_tutor
        w_assess  = tutor.assessment_weight   if tutor else 50
        w_tasks   = tutor.weekly_tasks_weight if tutor else 30
        w_attend  = tutor.attendance_weight   if tutor else 20

        # Grades
        grades   = ApiGrade.objects.filter(student=student)
        subjects = grades.values_list('subject', flat=True).distinct()
        grade_summary  = []
        overall_scores = []

        for subject in subjects:
            for quarter in [1, 2, 3, 4]:
                sq = grades.filter(subject=subject, quarter=quarter)
                if sq.exists():
                    avg_assess = sq.filter(component_type='assessment').aggregate(Avg('score'))['score__avg'] or 0
                    avg_task   = sq.filter(component_type='weekly_task').aggregate(Avg('score'))['score__avg'] or 0
                    avg_attend = sq.filter(component_type='attendance').aggregate(Avg('score'))['score__avg'] or 0
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
        late_days    = att_logs.filter(status='late').count()
        absent_days  = att_logs.filter(status='absent').count()
        att_rate     = round((present_days + late_days) / total_days * 100, 2) if total_days > 0 else 100

        # ARAL activities
        activities  = ApiAralActivity.objects.filter(student=student)
        act_stats   = activities.values('status').annotate(count=Count('status'))

        # Risks
        risks = ApiAcademicRisk.objects.filter(student=student, resolved=False)

        data = {
            'student': {
                'id':         str(student.id),
                'name':       student.get_full_name(),
                'first_name': student.first_name,
                'last_name':  student.last_name,
                'username':   student.username,
                'lrn':        student.lrn,
                'email':      student.email,
                'aral_level': student.aral_level,
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
                'late':            late_days,
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

        # Risk summary
        risks = ApiAcademicRisk.objects.filter(resolved=False)
        risk_summary = {
            'low':    risks.filter(risk_level='low').count(),
            'medium': risks.filter(risk_level='medium').count(),
            'high':   risks.filter(risk_level='high').count(),
        }

        # Class performance trend (daily avg score + attendance rate over last N days)
        from datetime import date, timedelta as td
        today = date.today()
        trend = []
        for i in range(days - 1, -1, -1):
            day = today - td(days=i)
            day_grades = ApiGrade.objects.filter(date_logged=day)
            avg_score  = day_grades.aggregate(Avg('score'))['score__avg'] or 0
            day_att    = ApiAttendance.objects.filter(date=day, role='student')
            total      = day_att.count()
            present    = day_att.filter(status__in=['present', 'late']).count()
            att_rate   = round(present / total * 100, 2) if total else 0
            if avg_score or att_rate:
                trend.append({
                    'date':            str(day),
                    'attendance_rate': att_rate,
                    'average_score':   round(float(avg_score), 2),
                })

        # Per-tutor performance
        per_tutor = []
        for tutor in tutors[:10]:  # cap at 10 for performance
            tutor_students = tutor.assigned_students.all()
            tutor_trend    = []
            for i in range(min(days, 7) - 1, -1, -1):
                day = today - td(days=i)
                tg  = ApiGrade.objects.filter(tutor=tutor, date_logged=day)
                avg = tg.aggregate(Avg('score'))['score__avg'] or 0
                ta  = ApiAttendance.objects.filter(tutor=tutor, date=day)
                tot = ta.count()
                pre = ta.filter(status__in=['present', 'late']).count()
                ar  = round(pre / tot * 100, 2) if tot else 0
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
        staff_trend = []
        for i in range(min(days, 14) - 1, -1, -1):
            day       = today - td(days=i)
            t_att     = ApiAttendance.objects.filter(date=day, role='tutor')
            t_tot     = t_att.count()
            t_pre     = t_att.filter(status__in=['present', 'late']).count()
            f_att     = ApiAttendance.objects.filter(date=day, role='faculty')
            f_tot     = f_att.count()
            f_pre     = f_att.filter(status__in=['present', 'late']).count()
            staff_trend.append({
                'date':                    str(day),
                'tutor_attendance_rate':   round(t_pre / t_tot * 100, 2) if t_tot else 0,
                'faculty_attendance_rate': round(f_pre / f_tot * 100, 2) if f_tot else 0,
            })

        return Response({
            'program_summary': {
                'total_tutors':   tutors.count(),
                'total_faculty':  faculty.count(),
                'total_students': students.count(),
            },
            'risk_summary':            risk_summary,
            'class_performance_trend': trend,
            'per_tutor_performance':   per_tutor,
            'staff_attendance_trend':  staff_trend,
        }, status=status.HTTP_200_OK)
