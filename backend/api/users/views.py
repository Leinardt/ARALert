"""
Users API Views.
SuperAdmin-only endpoints for user management.
"""

from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db.models import Q

from apps.accounts.models import User
from apps.academics.models import Attendance, AcademicRisk, Grade
from permissions.role_permissions import IsAdmin, IsTutor, role_required
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
        # If logged-in user is a School Admin, only return Student statistics
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

        # Exclude SuperAdmin from counts
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
        # Allow Tutors to list their assigned students
        return [IsAdmin() if not self.request.user.role == 'tutor' else IsTutor()]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserListSerializer

    def get_queryset(self):
        # Never expose the SuperAdmin in user management
        queryset = User.objects.filter(is_superuser=False)

        # Tutors can ONLY see their assigned students
        if not self.request.user.is_superuser and self.request.user.role == 'tutor':
            return queryset.filter(assigned_tutor=self.request.user, role='student')

        # Filter queryset to show only student accounts for School Admins
        if not self.request.user.is_superuser and self.request.user.role == 'admin':
            queryset = queryset.filter(role='student')

        # Filter by assigned tutor
        assigned_tutor = self.request.query_params.get('assigned_tutor', '').strip()
        if assigned_tutor:
            if assigned_tutor == 'none':
                queryset = queryset.filter(assigned_tutor__isnull=True)
            else:
                queryset = queryset.filter(assigned_tutor_id=assigned_tutor)

        # Search by name, username, or email
        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(username__icontains=search)
                | Q(email__icontains=search)
            )

        # Filter by role
        role = self.request.query_params.get('role', '').strip()
        if role:
            queryset = queryset.filter(role=role)

        # Filter by status
        status_filter = self.request.query_params.get('status', '').strip()
        if status_filter == 'active':
            queryset = queryset.filter(is_active=True)
        elif status_filter == 'inactive':
            queryset = queryset.filter(is_active=False)

        # Sort
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
        
        # Enforce role-creation logic based on current user's role
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
        serializer.save()


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
        return Response({'detail': 'Password reset successfully.'})


class TutorListView(generics.ListAPIView):
    """
    GET /api/users/tutors/
    List active tutors (accessible by Admin and Principal and SuperAdmin).
    """
    permission_classes = [IsAdmin]
    serializer_class = UserListSerializer
    pagination_class = None  # Return all for dropdowns

    def get_queryset(self):
        return User.objects.filter(role='tutor', is_active=True, is_superuser=False)

