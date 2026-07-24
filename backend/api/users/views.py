"""
Users API Views.
SuperAdmin and Admin endpoints for user management with audit logging.
"""

from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db.models import Q

from apps.accounts.models import User, AuditLog
from apps.academics.models import Attendance, AcademicRisk, Grade
from permissions.role_permissions import IsAdmin, IsTutor, role_required
from utilities.audit import log_audit_event
from .serializers import (
    UserListSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    ResetPasswordSerializer,
)


class UserStatsView(APIView):
    """
    GET /api/users/stats/
    Return dashboard statistics (user counts by role and status).
    """

    permission_classes = [IsAdmin]

    def get(self, request):
        if not request.user.is_superuser and request.user.role == 'admin':
            students = User.objects.filter(is_superuser=False, role='student')
            stats = {
                'total_users': students.count(),
                'active_users': students.filter(is_active=True).count(),
                'inactive_users': students.filter(is_active=False).count(),
                'admins': 0,
                'principals': 0,
                'faculty': 0,
                'tutors': 0,
                'students': students.count(),
                'assigned_students': students.filter(assigned_tutor__isnull=False).count(),
                'unassigned_students': students.filter(assigned_tutor__isnull=True).count(),
            }
            return Response(stats)

        users = User.objects.filter(is_superuser=False)
        attendance_logs = Attendance.objects.filter(user__is_superuser=False)
        grade_entries = Grade.objects.filter(student__is_superuser=False)
        risk_entries = AcademicRisk.objects.filter(student__is_superuser=False)

        attendance_summary = {
            'total_logs': attendance_logs.count(),
            'present': attendance_logs.filter(status='present').count(),
            'late': attendance_logs.filter(status='late').count(),
            'absent': attendance_logs.filter(status='absent').count(),
        }
        attendance_rate = round(
            ((attendance_summary['present'] + attendance_summary['late']) / attendance_summary['total_logs'] * 100)
            if attendance_summary['total_logs'] else 0,
            1,
        )

        score_values = []
        for grade in grade_entries.filter(component_type__in=['assessment', 'weekly_task', 'attendance']):
            total_score = float(grade.total_score or 0)
            if total_score > 0:
                score_values.append((float(grade.score) / total_score) * 100.0)
            elif grade.score is not None:
                score_values.append(float(grade.score))

        academic_summary = {
            'average_score': round(sum(score_values) / len(score_values), 1) if score_values else 0,
            'average_attendance_rate': attendance_rate,
            'grade_entries': grade_entries.count(),
        }

        risk_summary = {
            'low': risk_entries.filter(risk_level='low').count(),
            'medium': risk_entries.filter(risk_level='medium').count(),
            'high': risk_entries.filter(risk_level='high').count(),
            'resolved': risk_entries.filter(resolved=True).count(),
        }

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
            'attendance_summary': attendance_summary,
            'academic_summary': academic_summary,
            'risk_summary': risk_summary,
        }
        return Response(stats)


class UserListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/users/     — List users (paginated, searchable, sortable, filterable).
    POST /api/users/     — Create a new user.
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
            return queryset.filter(assigned_tutor=self.request.user, role='student')

        if not self.request.user.is_superuser and self.request.user.role == 'admin':
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
            )

        role = self.request.query_params.get('role', '').strip()
        if role:
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
        if request.user.is_superuser:
            if role == 'student':
                raise ValidationError(
                    {'role': 'SuperAdmin cannot create student accounts.'}
                )
        elif request.user.role == 'admin':
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
        if not self.request.user.is_superuser and self.request.user.role == 'admin':
            queryset = queryset.filter(role='student')
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
    """
    PATCH /api/users/{id}/activate/
    Set user is_active=True.
    """

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
    """
    PATCH /api/users/{id}/deactivate/
    Set user is_active=False.
    """

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


class ResetPasswordView(APIView):
    """
    POST /api/users/{id}/reset-password/
    Reset a user's password.
    """

    permission_classes = [IsAdmin]

    def post(self, request, id):
        if not request.user.is_superuser and request.user.role == 'admin':
            user = get_object_or_404(User, id=id, is_superuser=False, role='student')
        else:
            user = get_object_or_404(User, id=id, is_superuser=False)
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data['new_password'])
        user.save(update_fields=['password'])

        log_audit_event(
            'USER_PASSWORD_RESET_BY_ADMIN',
            user=request.user,
            request=request,
            details={'target_user_id': str(user.id), 'target_username': user.username}
        )
        return Response({'detail': 'Password reset successfully.'})


class TutorListView(generics.ListAPIView):
    """
    GET /api/users/tutors/
    List active tutors (accessible by Admin and Principal and SuperAdmin).
    """
    permission_classes = [IsAdmin]
    serializer_class = UserListSerializer
    pagination_class = None

    def get_queryset(self):
        return User.objects.filter(role='tutor', is_active=True, is_superuser=False)


class AuditLogListView(APIView):
    """
    GET /api/users/audit-logs/
    Return paginated, filtered audit log entries. SuperAdmin only.
    """

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

        results = [
            {
                'id': str(log.id),
                'timestamp': log.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC'),
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
