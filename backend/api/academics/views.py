from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q, Avg, Count
from datetime import datetime, timedelta

from apps.accounts.models import User
from apps.academics.models import Grade, AralActivity, AcademicRisk, AttendanceSession, Attendance
from permissions.role_permissions import IsAdmin, IsTutor, role_required
from .serializers import (
    GradeSerializer,
    AralActivitySerializer,
    AcademicRiskSerializer,
    AttendanceSessionSerializer,
    AttendanceSerializer,
)


class GradeListCreateView(generics.ListCreateAPIView):
    serializer_class = GradeSerializer
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        queryset = Grade.objects.all()

        # Filters
        student_id = self.request.query_params.get('student_id')
        subject = self.request.query_params.get('subject')
        quarter = self.request.query_params.get('quarter')

        if student_id:
            queryset = queryset.filter(student_id=student_id)
        if subject:
            queryset = queryset.filter(subject__icontains=subject)
        if quarter:
            queryset = queryset.filter(quarter=quarter)

        # Role restrictions
        if user.is_superuser:
            return queryset
        elif user.role == 'student':
            # Students can only view their own grades
            return queryset.filter(student=user)
        elif user.role == 'tutor':
            # Tutors can view all grades, but typically only of assigned students
            # Let's filter to only their assigned students if they query, or let them see all they logged.
            # To be secure: a tutor can see any of their assigned students' records
            assigned_student_ids = user.assigned_students.values_list('id', flat=True)
            return queryset.filter(Q(student_id__in=assigned_student_ids) | Q(tutor=user))
        elif user.role == 'principal':
            # Principal sees all
            return queryset
        elif user.role in ('faculty', 'admin'):
            # Faculty & Admin can view all student grades for administrative monitoring
            return queryset

        return queryset.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role != 'tutor' and not user.is_superuser:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only tutors can log grades.")
        
        student = serializer.validated_data.get('student')
        if student.assigned_tutor != user and not user.is_superuser:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("You can only log grades for students assigned to you.")
        
        serializer.save(tutor=user)


class GradeDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = GradeSerializer
    queryset = Grade.objects.all()
    lookup_field = 'id'

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        user = request.user
        if user.is_superuser or user.role == 'principal':
            return
        if user.role == 'tutor' and (obj.tutor == user or obj.student.assigned_tutor == user):
            return
        if user.role == 'student' and obj.student == user:
            # View-only
            if request.method in permissions.SAFE_METHODS:
                return
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("You do not have permission to access this grade log.")


class AralActivityListCreateView(generics.ListCreateAPIView):
    serializer_class = AralActivitySerializer
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        queryset = AralActivity.objects.all()

        student_id = self.request.query_params.get('student_id')
        status_filter = self.request.query_params.get('status')

        if student_id:
            queryset = queryset.filter(student_id=student_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        if user.is_superuser or user.role == 'principal':
            return queryset
        elif user.role == 'student':
            return queryset.filter(student=user)
        elif user.role == 'tutor':
            assigned_student_ids = user.assigned_students.values_list('id', flat=True)
            return queryset.filter(Q(student_id__in=assigned_student_ids) | Q(tutor=user))
        
        return queryset.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role != 'tutor' and not user.is_superuser:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only tutors can create ARAL activities.")
        
        student = serializer.validated_data.get('student')
        if student.assigned_tutor != user and not user.is_superuser:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("You can only create activities for students assigned to you.")
        
        serializer.save(tutor=user)


class AralActivityDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AralActivitySerializer
    queryset = AralActivity.objects.all()
    lookup_field = 'id'

    def perform_update(self, serializer):
        # If status is updated to completed, automatically record date_completed
        status_val = serializer.validated_data.get('status')
        if status_val == AralActivity.Status.COMPLETED:
            serializer.validated_data['date_completed'] = timezone.now()
        elif status_val == AralActivity.Status.PENDING or status_val == AralActivity.Status.IN_PROGRESS:
            serializer.validated_data['date_completed'] = None
        serializer.save()

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        user = request.user
        if user.is_superuser or user.role == 'principal':
            return
        if user.role == 'tutor' and (obj.tutor == user or obj.student.assigned_tutor == user):
            return
        if user.role == 'student' and obj.student == user:
            if request.method in permissions.SAFE_METHODS:
                return
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("You do not have permission to access this ARAL activity.")


class AcademicRiskListCreateView(generics.ListCreateAPIView):
    serializer_class = AcademicRiskSerializer
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        queryset = AcademicRisk.objects.all()

        student_id = self.request.query_params.get('student_id')
        if student_id:
            queryset = queryset.filter(student_id=student_id)

        if user.is_superuser or user.role in ('principal', 'admin', 'faculty'):
            return queryset
        elif user.role == 'student':
            return queryset.filter(student=user)
        elif user.role == 'tutor':
            assigned_student_ids = user.assigned_students.values_list('id', flat=True)
            return queryset.filter(student_id__in=assigned_student_ids)

        return queryset.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in ('admin', 'tutor', 'faculty') and not user.is_superuser:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Unauthorized to create risk alerts.")
        serializer.save()


class AcademicRiskDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AcademicRiskSerializer
    queryset = AcademicRisk.objects.all()
    lookup_field = 'id'

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        user = request.user
        if user.is_superuser or user.role in ('principal', 'admin', 'faculty'):
            return
        if user.role == 'tutor' and obj.student.assigned_tutor == user:
            return
        if user.role == 'student' and obj.student == user:
            if request.method in permissions.SAFE_METHODS:
                return
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("You do not have permission to access this risk alert.")


class AttendanceSessionCreateView(APIView):
    """
    POST /api/academics/attendance/session/
    Generate a new QR attendance session.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        session_type = request.data.get('session_type')  # 'student' or 'staff'
        action = request.data.get('action')  # 'time_in' or 'time_out' for staff
        aral_activity_id = request.data.get('aral_activity_id')
        expires_in_minutes = int(request.data.get('expires_in_minutes', 5))

        if not session_type:
            return Response({'error': 'session_type is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate creator permissions
        if session_type == 'student':
            if user.role != 'tutor' and user.role != 'principal' and not user.is_superuser:
                return Response({'error': 'Only Tutors and Principals can generate student attendance QR codes.'}, status=status.HTTP_403_FORBIDDEN)
        elif session_type == 'staff':
            if user.role != 'admin' and not user.is_superuser:
                return Response({'error': 'Only Admins can generate staff attendance QR codes.'}, status=status.HTTP_403_FORBIDDEN)
            if not action or action not in ('time_in', 'time_out'):
                return Response({'error': 'action (time_in/time_out) is required for staff sessions.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({'error': 'Invalid session_type.'}, status=status.HTTP_400_BAD_REQUEST)

        aral_activity = None
        if aral_activity_id:
            aral_activity = get_object_or_404(AralActivity, id=aral_activity_id)

        # Expiration datetime
        expires_at = timezone.now() + timedelta(minutes=expires_in_minutes)

        session = AttendanceSession.objects.create(
            creator=user,
            session_type=session_type,
            action=action,
            aral_activity=aral_activity,
            expires_at=expires_at,
            is_active=True
        )

        return Response(AttendanceSessionSerializer(session).data, status=status.HTTP_201_CREATED)


class AttendanceScanView(APIView):
    """
    POST /api/academics/attendance/scan/
    Confirms attendance by scanning a session's QR code.
    Requires authentication.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        session_id = request.data.get('session_id')

        if not session_id:
            return Response({'error': 'session_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            session = AttendanceSession.objects.get(id=session_id)
        except (AttendanceSession.DoesNotExist, ValueError):
            return Response({'error': 'Invalid QR code or session ID.'}, status=status.HTTP_404_NOT_FOUND)

        # Expiration Check
        if not session.is_active or timezone.now() > session.expires_at:
            return Response({'error': 'This QR code has expired or is no longer active.'}, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.localdate()

        # Session Types Verification
        if session.session_type == 'student':
            if user.role != 'student':
                return Response({'error': 'This QR code is reserved for students.'}, status=status.HTTP_400_BAD_REQUEST)

            # Check if student is assigned to this tutor (session creator or linked tutor)
            tutor = session.creator
            if user.assigned_tutor != tutor and not tutor.is_superuser:
                return Response({'error': f'You can only scan QR codes from your assigned tutor: {user.assigned_tutor.get_full_name() if user.assigned_tutor else "None"}'}, status=status.HTTP_403_FORBIDDEN)

            # Prevent duplicate logs for today
            if Attendance.objects.filter(user=user, date=today).exists():
                return Response({'error': 'Attendance already recorded for today.'}, status=status.HTTP_400_BAD_REQUEST)

            # Log student attendance
            attendance = Attendance.objects.create(
                user=user,
                role='student',
                date=today,
                time_in=timezone.now(),
                status='present',
                tutor=tutor,
                aral_activity=session.aral_activity,
                session=session
            )
            return Response({
                'message': 'Student attendance recorded successfully!',
                'attendance': AttendanceSerializer(attendance).data
            }, status=status.HTTP_200_OK)

        elif session.session_type == 'staff':
            # Employees include: tutor, faculty, admin, principal
            if user.role not in ('tutor', 'faculty', 'admin', 'principal') and not user.is_superuser:
                return Response({'error': 'Only staff members can scan this attendance QR code.'}, status=status.HTTP_403_FORBIDDEN)

            role_label = 'tutor' if user.role == 'tutor' else user.role or 'staff'
            
            import datetime
            local_now = timezone.localtime(timezone.now())
            now_time = local_now.time()

            # Action: time_in vs time_out
            if session.action == 'time_in':
                if now_time > datetime.time(7, 30):
                    return Response({'error': 'Clock-in is only allowed until 7:30 AM.'}, status=status.HTTP_400_BAD_REQUEST)

                if Attendance.objects.filter(user=user, date=today).exists():
                    return Response({'error': 'Already clocked in for today.'}, status=status.HTTP_400_BAD_REQUEST)

                attendance = Attendance.objects.create(
                    user=user,
                    role=role_label,
                    date=today,
                    time_in=timezone.now(),
                    status='present',
                    session=session
                )
                return Response({
                    'message': 'Clock In logged successfully!',
                    'attendance': AttendanceSerializer(attendance).data
                }, status=status.HTTP_200_OK)

            elif session.action == 'time_out':
                if now_time < datetime.time(17, 0):
                    return Response({'error': 'Clock-out is only allowed from 5:00 PM onwards.'}, status=status.HTTP_400_BAD_REQUEST)

                try:
                    attendance = Attendance.objects.get(user=user, date=today)
                except Attendance.DoesNotExist:
                    return Response({'error': 'No Clock In log found for today. Please Clock In first.'}, status=status.HTTP_400_BAD_REQUEST)

                if attendance.time_out:
                    return Response({'error': 'Already clocked out for today.'}, status=status.HTTP_400_BAD_REQUEST)

                attendance.time_out = timezone.now()
                attendance.save(update_fields=['time_out'])
                return Response({
                    'message': 'Clock Out logged successfully!',
                    'attendance': AttendanceSerializer(attendance).data
                }, status=status.HTTP_200_OK)

        return Response({'error': 'Invalid session parameters.'}, status=status.HTTP_400_BAD_REQUEST)


class AttendanceManualLogView(APIView):
    """
    POST /api/academics/attendance/manual/
    Tutors can manually log student attendance.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role != 'tutor' and not user.is_superuser:
            return Response({'error': 'Only tutors can submit manual attendance logs.'}, status=status.HTTP_403_FORBIDDEN)

        student_id = request.data.get('student_id')
        date_str = request.data.get('date')  # 'YYYY-MM-DD'
        status_val = request.data.get('status', 'present')  # present, late, absent
        aral_activity_id = request.data.get('aral_activity_id')

        if not student_id:
            return Response({'error': 'student_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        student = get_object_or_404(User, id=student_id, role='student')

        # Check assigned tutor
        if student.assigned_tutor != user and not user.is_superuser:
            return Response({'error': 'You can only record attendance for students assigned to you.'}, status=status.HTTP_403_FORBIDDEN)

        # Parse date
        if date_str:
            try:
                log_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            log_date = timezone.localdate()

        aral_activity = None
        if aral_activity_id:
            aral_activity = get_object_or_404(AralActivity, id=aral_activity_id)

        # Retrieve or create attendance for the user & date to allow updates
        attendance, created = Attendance.objects.get_or_create(
            user=student,
            date=log_date,
            defaults={
                'role': 'student',
                'time_in': timezone.now(),
                'status': status_val,
                'tutor': user,
                'aral_activity': aral_activity
            }
        )

        if not created:
            # Update fields
            attendance.status = status_val
            if aral_activity:
                attendance.aral_activity = aral_activity
            attendance.save(update_fields=['status', 'aral_activity'])

        return Response({
            'message': 'Student attendance logged manually.',
            'attendance': AttendanceSerializer(attendance).data
        }, status=status.HTTP_200_OK)


class AttendanceHistoryView(generics.ListAPIView):
    serializer_class = AttendanceSerializer
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        queryset = Attendance.objects.all()

        # Query Filters
        date_param = self.request.query_params.get('date')
        role_param = self.request.query_params.get('role')
        status_param = self.request.query_params.get('status')
        user_id_param = self.request.query_params.get('user_id')

        if date_param:
            queryset = queryset.filter(date=date_param)
        if role_param:
            queryset = queryset.filter(role=role_param)
        if status_param:
            queryset = queryset.filter(status=status_param)
        if user_id_param:
            queryset = queryset.filter(user_id=user_id_param)

        # Role-based visibility logic
        if user.is_superuser or user.role == 'principal':
            # Principal and SuperAdmin can see all attendance records
            return queryset
        elif user.role == 'student':
            # Students can ONLY see their own logs
            return queryset.filter(user=user)
        elif user.role == 'tutor':
            # Tutors see their own logs + their assigned students' logs
            assigned_student_ids = user.assigned_students.values_list('id', flat=True)
            return queryset.filter(Q(user=user) | Q(user_id__in=assigned_student_ids))
        elif user.role in ('faculty', 'admin'):
            # Faculty & Admins can ONLY see their own logs
            return queryset.filter(user=user)

        return queryset.none()


class StudentAcademicProfileView(APIView):
    """
    GET /api/academics/student-profile/{student_id}/
    Provides a consolidated summary of a student's grades, attendance, ARAL progress, and risk factors.
    Used for dashboards.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, student_id=None):
        user = request.user
        
        # Determine student target
        if student_id:
            student = get_object_or_404(User, id=student_id, role='student')
        else:
            if user.role == 'student':
                student = user
            else:
                return Response({'error': 'student_id is required for non-student profiles.'}, status=status.HTTP_400_BAD_REQUEST)

        # Access check
        if not user.is_superuser and user.role not in ('principal', 'admin', 'faculty'):
            if user.role == 'tutor' and student.assigned_tutor != user:
                return Response({'error': 'You do not have access to this student profile.'}, status=status.HTTP_403_FORBIDDEN)
            if user.role == 'student' and student != user:
                return Response({'error': 'You cannot view other students profiles.'}, status=status.HTTP_403_FORBIDDEN)

        # 1. Fetch Grades & Calculate GPA / quarterly dynamic grades
        grades = Grade.objects.filter(student=student)
        tutor = student.assigned_tutor
        w_assessment = tutor.assessment_weight if tutor else 50
        w_tasks = tutor.weekly_tasks_weight if tutor else 30
        w_attendance = tutor.attendance_weight if tutor else 20

        # Calculate average grades grouped by subject and quarter
        # We need assessment average, weekly task average, and attendance average
        subjects = grades.values_list('subject', flat=True).distinct()
        grade_summary = []
        overall_scores = []

        for subject in subjects:
            for quarter in [1, 2, 3, 4]:
                sub_q_grades = grades.filter(subject=subject, quarter=quarter)
                if sub_q_grades.exists():
                    avg_assess = sub_q_grades.filter(component_type='assessment').aggregate(Avg('score'))['score__avg'] or 100
                    avg_task = sub_q_grades.filter(component_type='weekly_task').aggregate(Avg('score'))['score__avg'] or 100
                    avg_attend = sub_q_grades.filter(component_type='attendance').aggregate(Avg('score'))['score__avg'] or 100
                    
                    # Compute weighted final grade
                    final_grade = (
                        (float(avg_assess) * w_assessment / 100.0) +
                        (float(avg_task) * w_tasks / 100.0) +
                        (float(avg_attend) * w_attendance / 100.0)
                    )
                    
                    grade_summary.append({
                        'subject': subject,
                        'quarter': quarter,
                        'assessment_avg': round(float(avg_assess), 2),
                        'weekly_task_avg': round(float(avg_task), 2),
                        'attendance_avg': round(float(avg_attend), 2),
                        'final_grade': round(final_grade, 2),
                    })
                    overall_scores.append(final_grade)

        gpa = round(sum(overall_scores) / len(overall_scores), 2) if overall_scores else None

        # 2. Fetch Attendance metrics
        attendance_logs = Attendance.objects.filter(user=student)
        total_days = attendance_logs.count()
        present_days = attendance_logs.filter(status='present').count()
        late_days = attendance_logs.filter(status='late').count()
        absent_days = attendance_logs.filter(status='absent').count()
        
        attendance_rate = round((present_days + late_days) / total_days * 100, 2) if total_days > 0 else 100

        # 3. Fetch ARAL activities
        aral_activities = AralActivity.objects.filter(student=student)
        activity_stats = aral_activities.values('status').annotate(count=Count('status'))
        
        # 4. Fetch Risk Notices
        risks = AcademicRisk.objects.filter(student=student, resolved=False)

        # Tutor Details
        tutor_details = {
            'id': tutor.id,
            'name': tutor.get_full_name(),
            'email': tutor.email,
            'assessment_weight': w_assessment,
            'weekly_tasks_weight': w_tasks,
            'attendance_weight': w_attendance
        } if tutor else None

        data = {
            'student': {
                'id': student.id,
                'name': student.get_full_name(),
                'lrn': student.lrn,
                'email': student.email
            },
            'assigned_tutor': tutor_details,
            'gpa': gpa,
            'grade_details': grade_summary,
            'attendance': {
                'attendance_rate': attendance_rate,
                'total_days': total_days,
                'present': present_days,
                'late': late_days,
                'absent': absent_days,
                'logs': AttendanceSerializer(attendance_logs[:15], many=True).data
            },
            'aral_progress': {
                'activities': AralActivitySerializer(aral_activities, many=True).data,
                'stats': {item['status']: item['count'] for item in activity_stats}
            },
            'academic_risks': AcademicRiskSerializer(risks, many=True).data
        }

        return Response(data, status=status.HTTP_200_OK)
