"""
Users API Views.
SuperAdmin and Admin endpoints for user management with audit logging, bulk tutor assignment,
and user login/logout activity history.
"""

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import AssessmentScore, Prediction, StudentAttendance
from apps.accounts.models import AuditLog, User
from permissions.role_permissions import IsAdmin, IsTutor
from utilities.audit import log_audit_event

from .serializers import (
    BulkAssignTutorSerializer,
    UserCreateSerializer,
    UserListSerializer,
    UserUpdateSerializer,
)


class UserStatsView(APIView):
    """
    GET /api/users/stats/
    Return dashboard statistics (user counts by role and status).
    """

    permission_classes = [IsAdmin]

    def get(self, request):
        users = User.objects.filter(is_superuser=False)
        attendance_logs = StudentAttendance.objects.all()
        assessment_entries = AssessmentScore.objects.all()

        total_att = attendance_logs.count()
        present_att = attendance_logs.filter(status__iexact='PRESENT').count()
        absent_att = attendance_logs.filter(status__iexact='ABSENT').count()

        att_rate = round((present_att / total_att * 100.0), 1) if total_att > 0 else 0

        scores = [float(s.score) for s in assessment_entries if s.score is not None]
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0

        stats = {
            'total_users': users.count(),
            'active_users': users.filter(is_active=True).count(),
            'inactive_users': users.filter(is_active=False).count(),
            'admins': users.filter(role='admin').count(),
            'principals': users.filter(role='principal').count(),
            'faculty': users.filter(role='faculty').count(),
            'tutors': users.filter(role='tutor').count(),
            'students': users.filter(role='student').count(),
            'assigned_students': users.filter(role='student', assigned_tutor__isnull=False).count(),
            'unassigned_students': users.filter(role='student', assigned_tutor__isnull=True).count(),
            'attendance_summary': {
                'total_logs': total_att,
                'present': present_att,
                'absent': absent_att,
            },
            'academic_summary': {
                'average_score': avg_score,
                'average_attendance_rate': att_rate,
                'total_assessments': len(scores),
            },
        }
        return Response(stats)


class UserListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/users/     — List users (paginated, searchable, sortable, filterable).
    POST /api/users/     — Create a new user (SuperAdmin registers staff; Admin registers students).
    """

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdmin()]
        return [IsAdmin() if not self.request.user.role == 'tutor' else IsTutor()]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserListSerializer

    def get_queryset(self):
        queryset = User.objects.filter(is_superuser=False)

        if not self.request.user.is_superuser and self.request.user.role == 'tutor':
            role = self.request.query_params.get('role', '').strip()
            if role == 'principal':
                return queryset.filter(role='principal', is_active=True)
            return queryset.filter(assigned_tutor=self.request.user, role='student')

        role = self.request.query_params.get('role', '').strip()

        if not self.request.user.is_superuser and self.request.user.role == 'admin':
            if not role:
                queryset = queryset.filter(role='student')

        assigned_tutor = self.request.query_params.get('assigned_tutor', '').strip()
        if assigned_tutor:
            if assigned_tutor == 'none':
                queryset = queryset.filter(assigned_tutor__isnull=True)
            else:
                queryset = queryset.filter(assigned_tutor_id=assigned_tutor)

        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(lrn__icontains=search)
            )

        if role:
            if role == 'staff':
                queryset = queryset.filter(role__in=['admin', 'principal', 'faculty', 'tutor'])
            else:
                queryset = queryset.filter(role=role)

        status_filter = self.request.query_params.get('status', '').strip()
        if status_filter == 'active':
            queryset = queryset.filter(is_active=True)
        elif status_filter == 'inactive':
            queryset = queryset.filter(is_active=False)

        ordering = self.request.query_params.get('ordering', '-date_joined')
        allowed_orderings = [
            'first_name', '-first_name',
            'last_name', '-last_name',
            'role', '-role',
            'date_joined', '-date_joined',
            'last_login', '-last_login',
            'username', '-username',
        ]
        if ordering in allowed_orderings:
            queryset = queryset.order_by(ordering)
        else:
            queryset = queryset.order_by('-date_joined')

        return queryset

    def create(self, request, *args, **kwargs):
        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        role = serializer.validated_data.get('role')
        from rest_framework.exceptions import ValidationError
        if not request.user.is_superuser and request.user.role == 'admin':
            if role != 'student':
                raise ValidationError(
                    {'role': 'School Admins can only enroll student accounts.'}
                )

        user = serializer.save()
        log_audit_event(
            'USER_CREATED',
            user=request.user,
            request=request,
            details={'target_user_id': str(user.id), 'target_username': user.username, 'role': user.role, 'email': user.email}
        )
        return Response(
            UserListSerializer(user).data,
            status=status.HTTP_201_CREATED,
        )


class UserDetailView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/users/{id}/   — Retrieve a single user.
    PATCH /api/users/{id}/   — Update a user.
    """

    lookup_field = 'id'

    def get_permissions(self):
        if self.request.user.role == 'tutor':
            return [IsTutor()]
        return [IsAdmin()]

    def get_queryset(self):
        queryset = User.objects.filter(is_superuser=False)
        if self.request.user.role == 'tutor':
            queryset = queryset.filter(role='student', assigned_tutor=self.request.user)
        return queryset

    def get_serializer_class(self):
        if self.request.method in ('PATCH', 'PUT'):
            return UserUpdateSerializer
        return UserListSerializer

    def perform_update(self, serializer):
        if not self.request.user.is_superuser and self.request.user.role == 'admin':
            role = serializer.validated_data.get('role')
            if role and role != 'student':
                from rest_framework.exceptions import ValidationError
                raise ValidationError(
                    {'role': 'School Admins can only manage student accounts.'}
                )
        updated_user = serializer.save()
        log_audit_event(
            'USER_UPDATED',
            user=self.request.user,
            request=self.request,
            details={'target_user_id': str(updated_user.id), 'target_username': updated_user.username, 'updated_fields': list(serializer.validated_data.keys())}
        )


class UserActivateView(APIView):
    """PATCH /api/users/{id}/activate/ — Set user is_active=True."""

    permission_classes = [IsAdmin]

    def patch(self, request, id):
        if not request.user.is_superuser and request.user.role == 'admin':
            user = get_object_or_404(User, id=id, is_superuser=False, role='student')
        else:
            user = get_object_or_404(User, id=id, is_superuser=False)
        user.is_active = True
        user.save(update_fields=['is_active'])

        log_audit_event(
            'USER_ACTIVATED_BY_ADMIN',
            user=request.user,
            request=request,
            details={'target_user_id': str(user.id), 'target_username': user.username}
        )
        return Response({'detail': 'User activated successfully.'})


class UserDeactivateView(APIView):
    """PATCH /api/users/{id}/deactivate/ — Set user is_active=False."""

    permission_classes = [IsAdmin]

    def patch(self, request, id):
        if not request.user.is_superuser and request.user.role == 'admin':
            user = get_object_or_404(User, id=id, is_superuser=False, role='student')
        else:
            user = get_object_or_404(User, id=id, is_superuser=False)
        user.is_active = False
        user.save(update_fields=['is_active'])

        log_audit_event(
            'USER_DEACTIVATED_BY_ADMIN',
            user=request.user,
            request=request,
            details={'target_user_id': str(user.id), 'target_username': user.username}
        )
        return Response({'detail': 'User deactivated successfully.'})


class BulkAssignTutorView(APIView):
    """
    POST /api/users/bulk-assign-tutor/
    Multi-select students and assign them to a tutor in a single request.
    If tutor_id is null/blank, sets assignment to TBA (null).
    Accessible by Admin and SuperAdmin.
    """

    permission_classes = [IsAdmin]

    def post(self, request):
        serializer = BulkAssignTutorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        student_ids = serializer.validated_data['student_ids']
        tutor = serializer.validated_data.get('tutor_id')  # User instance or None

        students = User.objects.filter(id__in=student_ids, role='student', is_superuser=False)
        updated_count = students.update(assigned_tutor=tutor)

        tutor_name = tutor.get_full_name() if tutor else 'TBA'
        log_audit_event(
            'BULK_TUTOR_ASSIGNED',
            user=request.user,
            request=request,
            details={
                'updated_count': updated_count,
                'tutor': tutor_name,
                'student_ids': [str(s) for s in student_ids],
            },
        )

        return Response({
            'detail': f'Successfully assigned {updated_count} student(s) to {tutor_name}.',
            'updated_count': updated_count,
            'tutor_name': tutor_name,
        }, status=status.HTTP_200_OK)


class UserActivityHistoryView(APIView):
    """
    GET /api/users/{id}/activity/
    Return full login and logout history for a specific user with dates, times, and IP.
    Accessible by Admin and SuperAdmin.
    """

    permission_classes = [IsAdmin]

    def get(self, request, id):
        target_user = get_object_or_404(User, id=id)

        # Match by user FK, or email/username
        qs = AuditLog.objects.filter(
            Q(user=target_user)
            | Q(username__iexact=target_user.email)
            | Q(username__iexact=target_user.username)
        ).order_by('-timestamp')

        login_logout_actions = [
            'GOOGLE_LOGIN_SUCCESS',
            'STUDENT_LOGIN_SUCCESS',
            'LOGOUT_SUCCESS',
            'LOGIN_SUCCESS',
        ]

        auth_only = request.query_params.get('auth_only', 'true').lower() == 'true'
        if auth_only:
            qs = qs.filter(action__in=login_logout_actions)

        from django.utils.timezone import localtime

        logs = qs[:100]

        results = [
            {
                'id': str(log.id),
                'timestamp': log.timestamp.isoformat(),
                'formatted_time': localtime(log.timestamp).strftime('%B %d, %Y at %I:%M %p'),
                'action': log.action,
                'event_type': 'LOGIN' if 'LOGIN' in log.action else ('LOGOUT' if 'LOGOUT' in log.action else 'OTHER'),
                'ip_address': str(log.ip_address) if log.ip_address else 'N/A',
                'user_agent': log.user_agent[:100] if log.user_agent else '',
                'details': log.details,
            }
            for log in logs
        ]

        return Response({
            'user_id': str(target_user.id),
            'full_name': target_user.get_full_name(),
            'email': target_user.email,
            'count': len(results),
            'activities': results,
        })


class TutorListView(generics.ListAPIView):
    """GET /api/users/tutors/ — List active tutors for assignment dropdowns."""

    permission_classes = [IsAdmin]
    serializer_class = UserListSerializer
    pagination_class = None

    def get_queryset(self):
        return User.objects.filter(role='tutor', is_active=True, is_superuser=False)


class AuditLogListView(APIView):
    """GET /api/users/audit-logs/ — Return paginated audit logs for SuperAdmin."""

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        return [IsAuthenticated()]

    def get(self, request):
        if not request.user.is_superuser:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        action_filter = request.query_params.get('action', '')
        username_filter = request.query_params.get('username', '')
        page = max(1, int(request.query_params.get('page', 1)))
        page_size = 20

        qs = AuditLog.objects.all().order_by('-timestamp')
        if action_filter:
            qs = qs.filter(action__icontains=action_filter)
        if username_filter:
            qs = qs.filter(username__icontains=username_filter)

        total = qs.count()
        offset = (page - 1) * page_size
        logs = qs[offset: offset + page_size]

        from django.utils.timezone import localtime

        results = [
            {
                'id': str(log.id),
                'timestamp': localtime(log.timestamp).strftime('%Y-%m-%d %I:%M:%S %p PHT'),
                'action': log.action,
                'username': log.username or (str(log.user) if log.user else 'Anonymous'),
                'ip_address': str(log.ip_address) if log.ip_address else 'N/A',
                'user_agent': log.user_agent[:100] if log.user_agent else '',
                'details': log.details,
            }
            for log in logs
        ]

        return Response({
            'count': total,
            'page': page,
            'page_size': page_size,
            'total_pages': max(1, (total + page_size - 1) // page_size),
            'results': results,
        })
