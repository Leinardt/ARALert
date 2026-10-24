"""
Users API Views.
SuperAdmin and Admin endpoints for user management with audit logging, bulk tutor assignment,
and user login/logout activity history.
"""

import re
import uuid
from django.db.models import Avg, Case, Count, IntegerField, Q, Value, When
from django.db.models.functions import Lower
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import AuditLog, User, StudentEditRequest
from permissions.role_permissions import IsAdmin, IsTutor, role_required
from utilities.audit import log_audit_event

from .serializers import (
    BulkAssignTutorSerializer,
    StudentEditRequestCreateSerializer,
    StudentEditRequestReviewSerializer,
    StudentEditRequestSerializer,
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
        base_qs = User.objects.filter(is_superuser=False)
        if not request.user.is_superuser:
            base_qs = base_qs.exclude(role='admin')

        user_aggregates = base_qs.aggregate(
            total_users=Count('id'),
            active_users=Count('id', filter=Q(is_active=True)),
            inactive_users=Count('id', filter=Q(is_active=False)),
            admins=Count('id', filter=Q(role='admin')),
            principals=Count('id', filter=Q(role='principal')),
            faculty=Count('id', filter=Q(role='faculty')),
            tutors=Count('id', filter=Q(role='tutor')),
            students=Count('id', filter=Q(role='student') & ~Q(aral_level='graduated')),
            assigned_students=Count('id', filter=Q(role='student', assigned_tutor__isnull=False) & ~Q(aral_level='graduated')),
            unassigned_students=Count('id', filter=Q(role='student', assigned_tutor__isnull=True) & ~Q(aral_level='graduated')),
        )

        total_att = 0
        present_att = 0
        absent_att = 0
        att_rate = 0.0
        avg_score = 0.0
        total_assessments = 0

        try:
            from apps.academics.models import StudentAttendance, AssessmentScore

            att_aggregates = StudentAttendance.objects.aggregate(
                total_logs=Count('id'),
                present=Count('id', filter=Q(status__iexact='PRESENT')),
                absent=Count('id', filter=Q(status__iexact='ABSENT')),
            )

            score_aggregates = AssessmentScore.objects.filter(score__isnull=False).aggregate(
                avg_score=Avg('score'),
                total_assessments=Count('id'),
            )

            total_att = att_aggregates['total_logs'] or 0
            present_att = att_aggregates['present'] or 0
            absent_att = att_aggregates['absent'] or 0
            att_rate = round((present_att / total_att * 100.0), 1) if total_att > 0 else 0
            avg_score = round(float(score_aggregates['avg_score']), 1) if score_aggregates['avg_score'] is not None else 0
            total_assessments = score_aggregates['total_assessments'] or 0
        except Exception:
            pass

        stats = {
            'total_users': user_aggregates['total_users'] or 0,
            'active_users': user_aggregates['active_users'] or 0,
            'inactive_users': user_aggregates['inactive_users'] or 0,
            'admins': user_aggregates['admins'] or 0,
            'principals': user_aggregates['principals'] or 0,
            'faculty': user_aggregates['faculty'] or 0,
            'tutors': user_aggregates['tutors'] or 0,
            'students': user_aggregates['students'] or 0,
            'assigned_students': user_aggregates['assigned_students'] or 0,
            'unassigned_students': user_aggregates['unassigned_students'] or 0,
            'attendance_summary': {
                'total_logs': total_att,
                'present': present_att,
                'absent': absent_att,
            },
            'academic_summary': {
                'average_score': avg_score,
                'average_attendance_rate': att_rate,
                'total_assessments': total_assessments,
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
        user = getattr(self.request, 'user', None)
        if user and user.is_authenticated and getattr(user, 'role', None) == 'tutor':
            return [IsTutor()]
        if user and user.is_authenticated and getattr(user, 'role', None) == 'principal':
            return [role_required('principal')()]
        return [IsAdmin()]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserListSerializer

    def get_queryset(self):
        user = getattr(self.request, 'user', None)
        if not user or not user.is_authenticated:
            return User.objects.none()

        role = self.request.query_params.get('role', '').strip()

        # SuperAdmin accounts are only visible to authenticated superusers
        if user.is_superuser:
            if role == 'superadmin':
                queryset = User.objects.filter(is_superuser=True).select_related('assigned_tutor')
            else:
                queryset = User.objects.filter(is_superuser=False).select_related('assigned_tutor')
        else:
            # School Admins and lower cannot view SuperAdmins or Admins
            queryset = User.objects.filter(is_superuser=False).exclude(role='admin').select_related('assigned_tutor')

        if not user.is_superuser and getattr(user, 'role', None) == 'tutor':
            if role == 'principal':
                return queryset.filter(role='principal', is_active=True)
            return queryset.filter(assigned_tutor=user, role='student').exclude(aral_level='graduated')

        role = self.request.query_params.get('role', '').strip()

        assigned_tutor = self.request.query_params.get('assigned_tutor', '').strip()
        if assigned_tutor:
            if assigned_tutor == 'none':
                queryset = queryset.filter(assigned_tutor__isnull=True)
            else:
                queryset = queryset.filter(assigned_tutor_id=assigned_tutor)

        subject = self.request.query_params.get('subject', '').strip()
        if subject:
            if subject.lower() in ('reading', 'filipino'):
                queryset = queryset.filter(Q(subject__icontains='Filipino') | Q(subject__icontains='Reading') | Q(aral_level__icontains='basic'))
            else:
                queryset = queryset.filter(Q(subject__icontains=subject) | (Q(aral_level__icontains='plus') if subject.lower() == 'english' else Q()))

        include_graduated = self.request.query_params.get('include_graduated', '').strip().lower() in ('true', '1')

        aral_level = self.request.query_params.get('aral_level', '').strip()
        if aral_level:
            queryset = queryset.filter(aral_level__iexact=aral_level)
        elif (role == 'student' or not role) and not include_graduated:
            # Graduated students are archived and must not appear in active student user management
            queryset = queryset.exclude(aral_level='graduated')

        grade_level = self.request.query_params.get('grade_level', '').strip()
        if grade_level:
            queryset = queryset.filter(grade_level__icontains=grade_level)

        section = self.request.query_params.get('section', '').strip()
        if section:
            queryset = queryset.filter(Q(section__iexact=section) | Q(grade_level__icontains=section))

        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(lrn__icontains=search)
            )

        if role and role != 'superadmin':
            if role == 'staff':
                queryset = queryset.filter(role__in=['admin', 'principal', 'faculty', 'tutor'])
            else:
                queryset = queryset.filter(role=role)

        status_filter = self.request.query_params.get('status', '').strip()
        if status_filter == 'active':
            queryset = queryset.filter(is_active=True)
        elif status_filter == 'inactive':
            queryset = queryset.filter(is_active=False)

        ordering = self.request.query_params.get('ordering', 'last_name')
        if ordering in ['last_name', 'first_name', 'name']:
            queryset = queryset.order_by('last_name', 'first_name')
        elif ordering in ['-last_name', '-first_name', '-name']:
            queryset = queryset.order_by('-last_name', '-first_name')
        elif ordering == 'assigned_tutor':
            queryset = queryset.order_by('assigned_tutor__last_name', 'assigned_tutor__first_name')
        elif ordering == '-assigned_tutor':
            queryset = queryset.order_by('-assigned_tutor__last_name', '-assigned_tutor__first_name')
        elif ordering in ['status', 'is_active']:
            queryset = queryset.order_by('-is_active', 'last_name', 'first_name')
        elif ordering in ['-status', '-is_active']:
            queryset = queryset.order_by('is_active', 'last_name', 'first_name')
        elif ordering in ['grade_level', '-grade_level']:
            grade_cases = []
            for g in range(12, 0, -1):
                grade_cases.append(When(grade_level__istartswith=f'Grade {g}', then=Value(g)))
                grade_cases.append(When(grade_level__icontains=f'Grade {g}', then=Value(g)))
                grade_cases.append(When(grade_level__startswith=f'{g} ', then=Value(g)))
                grade_cases.append(When(grade_level__startswith=f'{g}-', then=Value(g)))
                grade_cases.append(When(grade_level__startswith=f'{g} -', then=Value(g)))
                grade_cases.append(When(grade_level=f'{g}', then=Value(g)))

            queryset = queryset.annotate(
                grade_num=Case(
                    *grade_cases,
                    default=Value(99),
                    output_field=IntegerField()
                )
            )
            order_prefix = '-' if ordering.startswith('-') else ''
            queryset = queryset.order_by(f'{order_prefix}grade_num', 'last_name', 'first_name')
        elif ordering in ['section', '-section']:
            order_prefix = '-' if ordering.startswith('-') else ''
            queryset = queryset.order_by(f'{order_prefix}grade_level', 'last_name', 'first_name')
        else:
            allowed_orderings = [
                'role', '-role',
                'lrn', '-lrn',
                'aral_level', '-aral_level',
                'subject', '-subject',
                'email', '-email',
                'date_joined', '-date_joined',
                'last_login', '-last_login',
                'username', '-username',
            ]
            if ordering in allowed_orderings:
                queryset = queryset.order_by(ordering)
            else:
                queryset = queryset.order_by('last_name', 'first_name')

        return queryset

    def create(self, request, *args, **kwargs):
        target_role = request.data.get('role')
        is_creating_superadmin = (target_role == 'superadmin' or request.data.get('is_superuser') is True)

        if is_creating_superadmin:
            if not request.user.is_superuser:
                return Response(
                    {'detail': 'Only SuperAdmin can register SuperAdmin accounts.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        if target_role == 'admin' and not request.user.is_superuser:
            return Response(
                {'detail': 'Only SuperAdmin can register School Admin accounts.'},
                status=status.HTTP_403_FORBIDDEN
            )

        data = request.data.copy()
        if is_creating_superadmin:
            data['is_superuser'] = True
            data['role'] = None

        serializer = UserCreateSerializer(data=data)
        serializer.is_valid(raise_exception=True)

        user = serializer.save()
        target_full_name = user.get_full_name().strip()
        if not target_full_name:
            if user.role == 'student' and user.lrn:
                target_full_name = f"STUDENT {user.lrn}"
            elif user.role == 'student':
                target_full_name = "STUDENT"
            else:
                raw_u = (user.username or user.email or '').split('@')[0]
                target_full_name = raw_u.replace('.', ' ').replace('_', ' ').strip().upper()

        log_audit_event(
            'USER_CREATED',
            user=request.user,
            request=request,
            details={
                'target_user_id': str(user.id),
                'target_username': user.username if (user.role != 'student' and not user.username.endswith('@aralert.local')) else (user.lrn or user.username),
                'target_name': target_full_name,
                'target_role': 'superadmin' if user.is_superuser else user.role,
                'target_lrn': getattr(user, 'lrn', '') or None,
                'role': 'superadmin' if user.is_superuser else user.role,
                'email': user.email if (user.role != 'student' and not user.email.endswith('@aralert.local') and not user.email.startswith('student-')) else None,
                'lrn': user.lrn if user.role == 'student' else None,
            }
        )
        return Response(
            UserListSerializer(user).data,
            status=status.HTTP_201_CREATED,
        )


class CheckExistingLrnsView(APIView):
    """
    POST /api/users/check-lrns/
    Checks a batch of LRNs against existing database users.
    Returns: {"existing_lrns": ["123456789012", ...]}
    """
    permission_classes = [IsAdmin]

    def post(self, request, *args, **kwargs):
        lrns = request.data.get('lrns', [])
        if not isinstance(lrns, list):
            return Response({'error': 'lrns must be a list of strings.'}, status=status.HTTP_400_BAD_REQUEST)

        clean_lrns = [str(l).strip() for l in lrns if str(l).strip()]
        if not clean_lrns:
            return Response({'existing_lrns': []}, status=status.HTTP_200_OK)

        existing = list(
            User.objects.filter(lrn__in=clean_lrns, role='student').values_list('lrn', flat=True)
        )
        return Response({'existing_lrns': existing}, status=status.HTTP_200_OK)


ROOT_SUPERADMIN_EMAIL = 'lro2023-4992-68567@bicol-u.edu.ph'
PROTECTED_ROOT_SUPERADMIN_EMAILS = {
    'lro2023-4992-68567@bicol-u.edu.ph',
    'ro2023-4992-68567@bicol-u.edu.ph',
}


def is_root_superadmin(user_obj) -> bool:
    if not user_obj:
        return False
    email = getattr(user_obj, 'email', '') or ''
    return email.strip().lower() in PROTECTED_ROOT_SUPERADMIN_EMAILS


class UserDetailView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/users/{id}/   — Retrieve a single user.
    PATCH /api/users/{id}/   — Update a user.
    """

    lookup_field = 'id'

    def get_permissions(self):
        user = getattr(self.request, 'user', None)
        if user and user.is_authenticated and getattr(user, 'role', None) == 'tutor':
            return [IsTutor()]
        return [IsAdmin()]

    def get_queryset(self):
        user = getattr(self.request, 'user', None)
        if not user or not user.is_authenticated:
            return User.objects.none()
        if user.is_superuser:
            return User.objects.all().select_related('assigned_tutor')
        if getattr(user, 'role', None) == 'tutor':
            return User.objects.filter(role='student', assigned_tutor=user, is_superuser=False).select_related('assigned_tutor')
        return User.objects.filter(is_superuser=False).exclude(role='admin').select_related('assigned_tutor')

    def get_serializer_class(self):
        if self.request.method in ('PATCH', 'PUT'):
            return UserUpdateSerializer
        return UserListSerializer

    def perform_update(self, serializer):
        if getattr(self.request.user, 'role', None) == 'tutor':
            # Tutors can update identity and academic details of their assigned students.
            # Disallow changing sensitive security, administrative, or reassignment fields.
            for restricted_field in ['role', 'is_superuser', 'is_staff', 'is_active', 'assigned_tutor']:
                if restricted_field in serializer.validated_data:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied(f'Tutors are not permitted to modify {restricted_field}.')

        target_user = serializer.instance

        # 1. Do not let admin or superadmin deactivate their own account
        if (str(target_user.id) == str(self.request.user.id) or (
            target_user.email and self.request.user.email and target_user.email.strip().lower() == self.request.user.email.strip().lower()
        )) and serializer.validated_data.get('is_active') is False:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'is_active': 'You cannot deactivate your own account.'})

        # 2. Do not allow anyone to deactivate or alter the role of the Primary Root SuperAdmin account
        if is_root_superadmin(target_user):
            if serializer.validated_data.get('is_active') is False:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'is_active': f'The Primary Root SuperAdmin account ({ROOT_SUPERADMIN_EMAIL}) cannot be deactivated.'})
            if 'role' in serializer.validated_data and serializer.validated_data['role'] != target_user.role:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'role': 'The Primary Root SuperAdmin role cannot be changed.'})

        prev_level = (getattr(target_user, 'aral_level', '') or '').lower()
        prev_tutor = target_user.assigned_tutor
        updated_user = serializer.save()
        new_level = (getattr(updated_user, 'aral_level', '') or '').lower()

        # If ARAL level is changed from graduated back to basic/plus/summer (reverting a mistake)
        if updated_user.role == 'student' and prev_level == 'graduated' and new_level in ('basic', 'plus', 'summer'):
            try:
                from apps.academics.models import StudentEnrollment
                StudentEnrollment.objects.filter(
                    student=updated_user,
                    graduation_status='graduated'
                ).update(
                    graduation_status='not_eligible',
                    enrollment_status='active',
                    final_result=''
                )
            except Exception:
                pass

        # If ARAL level is manually set to graduated
        if updated_user.role == 'student' and new_level == 'graduated' and prev_level != 'graduated':
            try:
                from apps.academics.models import StudentEnrollment
                latest_enr = StudentEnrollment.objects.filter(
                    student=updated_user
                ).order_by('-school_year__start_date', '-id').first()
                if latest_enr:
                    latest_enr.graduation_status = 'graduated'
                    latest_enr.final_result = 'Graduated'
                    latest_enr.enrollment_status = 'completed'
                    latest_enr.save(update_fields=['graduation_status', 'final_result', 'enrollment_status'])
            except Exception:
                pass

        # Log individual tutor assignment if changed
        if 'assigned_tutor' in serializer.validated_data and updated_user.assigned_tutor != prev_tutor:
            tutor_obj = updated_user.assigned_tutor
            from services.tutor_service import assign_tutor_to_student
            assign_tutor_to_student(
                student=updated_user,
                tutor=tutor_obj,
                assigned_by=self.request.user,
                period='MOSY',
                notes='Individual tutor assignment'
            )
            log_audit_event(
                'TUTOR_ASSIGNED',
                user=self.request.user,
                request=self.request,
                details={
                    'student_id': str(updated_user.id),
                    'student_name': updated_user.get_full_name(),
                    'student_lrn': updated_user.lrn,
                    'tutor_id': str(tutor_obj.id) if tutor_obj else None,
                    'tutor_name': tutor_obj.get_full_name() if tutor_obj else 'TBA'
                }
            )

        target_full_name = updated_user.get_full_name().strip()
        if not target_full_name:
            if updated_user.role == 'student' and updated_user.lrn:
                target_full_name = f"STUDENT {updated_user.lrn}"
            elif updated_user.role == 'student':
                target_full_name = "STUDENT"
            else:
                raw_u = (updated_user.username or updated_user.email or '').split('@')[0]
                target_full_name = raw_u.replace('.', ' ').replace('_', ' ').strip().upper()

        target_display_username = updated_user.lrn if (updated_user.role == 'student' and updated_user.lrn) else updated_user.username
        if updated_user.role == 'student' and (not target_display_username or str(target_display_username).startswith('student-') or '@' in str(target_display_username)):
            target_display_username = updated_user.lrn or 'Student'

        target_role = 'superadmin' if updated_user.is_superuser else updated_user.role
        target_lrn = getattr(updated_user, 'lrn', '') or None

        log_audit_event(
            'USER_UPDATED',
            user=self.request.user,
            request=self.request,
            details={
                'target_user_id': str(updated_user.id),
                'target_username': target_display_username,
                'target_name': target_full_name,
                'target_role': target_role,
                'target_lrn': target_lrn,
                'updated_fields': list(serializer.validated_data.keys())
            }
        )


class UserActivateView(APIView):
    """PATCH /api/users/{id}/activate/ — Set user is_active=True."""

    permission_classes = [IsAdmin]

    def patch(self, request, id):
        if request.user.is_superuser:
            user = get_object_or_404(User, id=id)
        else:
            user = get_object_or_404(User, id=id, is_superuser=False)

        user.is_active = True
        user.save(update_fields=['is_active'])

        actor_role = getattr(request.user, 'role', '')
        action = 'USER_ACTIVATED_BY_SUPERADMIN' if (actor_role == 'superadmin' or request.user.is_superuser) else 'USER_ACTIVATED_BY_ADMIN'

        target_full_name = user.get_full_name().strip()
        if not target_full_name:
            if user.role == 'student' and user.lrn:
                target_full_name = f"STUDENT {user.lrn}"
            elif user.role == 'student':
                target_full_name = "STUDENT"
            else:
                raw_u = (user.username or user.email or '').split('@')[0]
                target_full_name = raw_u.replace('.', ' ').replace('_', ' ').strip().upper()

        target_display_username = user.lrn if (user.role == 'student' and user.lrn) else user.username
        if user.role == 'student' and (not target_display_username or str(target_display_username).startswith('student-') or '@' in str(target_display_username)):
            target_display_username = user.lrn or 'Student'

        target_role = 'superadmin' if user.is_superuser else (user.role or '')
        target_lrn = getattr(user, 'lrn', '') or None

        log_audit_event(
            action,
            user=request.user,
            request=request,
            details={
                'target_user_id': str(user.id),
                'target_username': target_display_username,
                'target_name': target_full_name,
                'target_role': target_role,
                'target_lrn': target_lrn,
            }
        )
        return Response({'detail': 'User activated successfully.'})


class UserDeactivateView(APIView):
    """PATCH /api/users/{id}/deactivate/ — Set user is_active=False."""

    permission_classes = [IsAdmin]

    def patch(self, request, id):
        if request.user.is_superuser:
            user = get_object_or_404(User, id=id)
        else:
            user = get_object_or_404(User, id=id, is_superuser=False)

        from rest_framework.exceptions import PermissionDenied

        # 1. Do not let admin or superadmin deactivate their own account
        if str(user.id) == str(request.user.id) or (
            user.email and request.user.email and user.email.strip().lower() == request.user.email.strip().lower()
        ):
            raise PermissionDenied('You cannot deactivate your own account.')

        # 2. Do not allow other superadmin to deactivate the Primary Root SuperAdmin account
        if is_root_superadmin(user):
            raise PermissionDenied(f'The Primary Root SuperAdmin account ({ROOT_SUPERADMIN_EMAIL}) is protected and cannot be deactivated.')

        user.is_active = False
        user.save(update_fields=['is_active'])

        # Blacklist any outstanding JWT tokens so the user is forcibly logged out immediately
        try:
            from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
            for ot in OutstandingToken.objects.filter(user=user):
                BlacklistedToken.objects.get_or_create(token=ot)
        except Exception:
            pass

        actor_role = getattr(request.user, 'role', '')
        action = 'USER_DEACTIVATED_BY_SUPERADMIN' if (actor_role == 'superadmin' or request.user.is_superuser) else 'USER_DEACTIVATED_BY_ADMIN'

        target_full_name = user.get_full_name().strip()
        if not target_full_name:
            if user.role == 'student' and user.lrn:
                target_full_name = f"STUDENT {user.lrn}"
            elif user.role == 'student':
                target_full_name = "STUDENT"
            else:
                raw_u = (user.username or user.email or '').split('@')[0]
                target_full_name = raw_u.replace('.', ' ').replace('_', ' ').strip().upper()

        target_display_username = user.lrn if (user.role == 'student' and user.lrn) else user.username
        if user.role == 'student' and (not target_display_username or str(target_display_username).startswith('student-') or '@' in str(target_display_username)):
            target_display_username = user.lrn or 'Student'

        target_role = 'superadmin' if user.is_superuser else (user.role or '')
        target_lrn = getattr(user, 'lrn', '') or None

        log_audit_event(
            action,
            user=request.user,
            request=request,
            details={
                'target_user_id': str(user.id),
                'target_username': target_display_username,
                'target_name': target_full_name,
                'target_role': target_role,
                'target_lrn': target_lrn,
            }
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

        students = list(User.objects.filter(id__in=student_ids, role='student', is_superuser=False))

        from services.tutor_service import assign_tutor_to_student, validate_tutor_compatibility
        from django.core.exceptions import ValidationError as DjangoValidationError
        from rest_framework.exceptions import ValidationError as RestValidationError

        # Compatibility pre-check for all selected students
        if tutor:
            for s in students:
                s_prog = (s.aral_level or 'basic').lower().strip()
                try:
                    validate_tutor_compatibility(tutor, s_prog)
                except DjangoValidationError as e:
                    t_name = tutor.get_full_name() or tutor.email or 'This tutor'
                    s_name = s.get_full_name() or s.email or 'this student'
                    raw_msg = ''
                    if hasattr(e, 'message_dict') and 'tutor' in e.message_dict:
                        raw_msg = e.message_dict['tutor'][0]
                    else:
                        raw_msg = str(getattr(e, 'message', None) or e)
                    err_msg = f"Cannot assign {t_name} to {s_name}: {raw_msg}"
                    raise RestValidationError({
                        'detail': err_msg,
                        'tutor_id': err_msg,
                    })

        # Process assignments
        for s in students:
            try:
                assign_tutor_to_student(
                    student=s,
                    tutor=tutor,
                    assigned_by=request.user,
                    period='MOSY',
                    notes='Bulk tutor assignment',
                )
            except DjangoValidationError as e:
                err_msg = str(getattr(e, 'message', None) or e)
                raise RestValidationError({
                    'detail': err_msg,
                    'tutor_id': err_msg,
                })

        updated_count = len(students)
        tutor_name = tutor.get_full_name() if tutor else 'TBA'
        log_audit_event(
            'BULK_TUTOR_ASSIGNED',
            user=request.user,
            request=request,
            details={
                'updated_count': updated_count,
                'tutor': tutor_name,
                'student_ids': [str(s.id) for s in students],
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
        if not request.user.is_superuser and target_user.role == 'admin':
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

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

    permission_classes = [role_required('admin', 'principal')]
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
        if not (request.user.is_superuser or request.user.role == 'admin'):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        from django.db.models import Q
        from django.utils.timezone import localtime

        action_filter = request.query_params.get('action', '').strip()
        search_filter = (request.query_params.get('search') or request.query_params.get('username') or '').strip()
        date_filter = request.query_params.get('date', '').strip()
        date_from = request.query_params.get('date_from', '').strip()
        date_to = request.query_params.get('date_to', '').strip()
        page = max(1, int(request.query_params.get('page', 1)))
        page_size = 30

        qs = AuditLog.objects.select_related('user').all().order_by('-timestamp')
        if action_filter:
            qs = qs.filter(action__iexact=action_filter) if '_' in action_filter else qs.filter(action__icontains=action_filter)
        if date_filter:
            qs = qs.filter(timestamp__date=date_filter)
        else:
            if date_from:
                qs = qs.filter(timestamp__date__gte=date_from)
            if date_to:
                qs = qs.filter(timestamp__date__lte=date_to)
        if search_filter:
            qs = qs.filter(
                Q(username__icontains=search_filter) |
                Q(user__first_name__icontains=search_filter) |
                Q(user__last_name__icontains=search_filter) |
                Q(user__email__icontains=search_filter) |
                Q(user__lrn__icontains=search_filter)
            )

        total = qs.count()
        offset = (page - 1) * page_size
        logs = qs[offset: offset + page_size]

        # Batch resolve target users for older or target_user_id-only logs
        target_user_ids = set()
        for log in logs:
            if isinstance(log.details, dict) and log.details.get('target_user_id'):
                t_name = str(log.details.get('target_name') or '').strip()
                if not t_name or '@' in t_name or t_name.startswith('student-'):
                    try:
                        target_user_ids.add(uuid.UUID(str(log.details['target_user_id'])))
                    except (ValueError, TypeError):
                        pass

        target_users_map = {}
        if target_user_ids:
            for u in User.objects.filter(id__in=target_user_ids):
                u_full = u.get_full_name().strip()
                if not u_full:
                    if u.role == 'student' and u.lrn:
                        u_full = f"STUDENT {u.lrn}"
                    elif u.role == 'student':
                        u_full = "STUDENT"
                    else:
                        u_full = (u.username or u.email or '').split('@')[0].replace('.', ' ').replace('_', ' ').strip().upper()
                target_users_map[str(u.id)] = {
                    'name': u_full,
                    'role': 'superadmin' if u.is_superuser else (u.role or ''),
                    'lrn': getattr(u, 'lrn', '') or None,
                }

        results = []
        for log in logs:
            # 1. Role
            if log.user:
                if log.user.is_superuser:
                    role = 'SuperAdmin'
                elif log.user.role:
                    role = log.user.get_role_display() if hasattr(log.user, 'get_role_display') else log.user.role.capitalize()
                else:
                    role = 'SuperAdmin'
            elif isinstance(log.details, dict) and log.details.get('role'):
                role = str(log.details.get('role')).capitalize()
            elif isinstance(log.details, dict) and log.details.get('target_role') and not log.user:
                role = str(log.details.get('target_role')).capitalize()
            else:
                role = 'System'

            # 2. Name
            if log.user and (log.user.first_name or log.user.last_name):
                name = log.user.get_full_name()
            elif isinstance(log.details, dict) and (log.details.get('student_name') or log.details.get('user_name') or log.details.get('name')):
                name = log.details.get('student_name') or log.details.get('user_name') or log.details.get('name')
            elif log.username and not log.username.endswith('@aralert.local') and not log.username.startswith('student-'):
                name = log.username
            elif log.user and log.user.lrn:
                name = log.user.lrn
            else:
                name = 'System'

            # 3. LRN
            if log.user and log.user.lrn:
                lrn = log.user.lrn
            elif isinstance(log.details, dict) and (log.details.get('lrn') or log.details.get('student_lrn') or log.details.get('proposed_lrn')):
                lrn = log.details.get('lrn') or log.details.get('student_lrn') or log.details.get('proposed_lrn')
            else:
                lrn = '—'

            # 4. Email:
            # Students only have an LRN and MUST NOT have any email in the audit log.
            # Also never display dummy/placeholder @aralert.local / student-* emails.
            is_student = (
                role.lower() == 'student' or
                (log.user and (log.user.role == 'student' or bool(log.user.lrn))) or
                (isinstance(log.details, dict) and str(log.details.get('role', '')).lower() == 'student')
            )

            if is_student:
                email = '—'
            else:
                raw_email = ''
                if log.user and log.user.email:
                    raw_email = log.user.email
                elif isinstance(log.details, dict) and log.details.get('email'):
                    raw_email = str(log.details.get('email'))

                if raw_email and not raw_email.endswith('@aralert.local') and not raw_email.startswith('student-'):
                    email = raw_email
                else:
                    email = '—'

            # 5. Target (The user or entity created, updated, or affected by this event)
            # Only put the target name (not email) and omit the [role] tag to save space.
            target = '—'
            if isinstance(log.details, dict):
                target_id = str(log.details.get('target_user_id') or '')
                cached_target = target_users_map.get(target_id)

                raw_target_name = None
                t_detail_name = str(log.details.get('target_name') or '').strip()
                if t_detail_name and '@' not in t_detail_name and not t_detail_name.startswith('student-'):
                    raw_target_name = t_detail_name
                elif cached_target and cached_target.get('name'):
                    raw_target_name = cached_target['name']
                elif t_detail_name:
                    raw_target_name = t_detail_name.split('@')[0].replace('.', ' ').replace('_', ' ').strip().upper()

                if not raw_target_name:
                    raw_target_name = (
                        log.details.get('student_name') or
                        log.details.get('user_name') or
                        log.details.get('name')
                    )

                if not raw_target_name:
                    cand = str(log.details.get('target_username') or '')
                    if cand and not cand.startswith('student-'):
                        raw_target_name = cand.split('@')[0].replace('.', ' ').replace('_', ' ').strip().upper()
                    elif log.details.get('target_lrn') or log.details.get('lrn'):
                        raw_target_name = f"STUDENT {log.details.get('target_lrn') or log.details.get('lrn')}"

                if raw_target_name:
                    clean_name = re.sub(r'\s*\[.*?\]$', '', str(raw_target_name)).strip()
                    if '@' in clean_name:
                        clean_name = clean_name.split('@')[0].replace('.', ' ').replace('_', ' ').strip().upper()
                    if clean_name.startswith('student-'):
                        clean_name = '—'
                    target = clean_name or '—'

            # Sanitize username so placeholder student emails are not exposed
            clean_username = log.username or (str(log.user) if log.user else 'Anonymous')
            if clean_username.endswith('@aralert.local') or clean_username.startswith('student-'):
                clean_username = lrn if lrn != '—' else (log.user.lrn if (log.user and log.user.lrn) else 'Student')

            results.append({
                'id': str(log.id),
                'timestamp': localtime(log.timestamp).strftime('%Y-%m-%d %I:%M:%S %p PHT'),
                'action': log.action,
                'target': target,
                'name': name,
                'role': role,
                'email': email,
                'lrn': lrn,
                'username': clean_username,
                'ip_address': log.ip_address or '—',
                'user_agent': log.user_agent or '—',
                'details': log.details or {},
            })

        return Response({
            'count': total,
            'page': page,
            'page_size': page_size,
            'total_pages': max(1, (total + page_size - 1) // page_size),
            'results': results,
        })


class StudentEditRequestListCreateView(APIView):
    """
    GET  /api/users/student-edit-requests/ — List profile/student edit requests.
    POST /api/users/student-edit-requests/ — Submit an edit request.
    """

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        return [IsAuthenticated()]

    def get(self, request):
        user = request.user
        queryset = StudentEditRequest.objects.select_related('student', 'requested_by', 'reviewed_by').all()

        if user.is_superuser:
            # Super Admin sees all requests
            pass
        elif getattr(user, 'role', None) == 'admin':
            # School Admin sees requests destined for admin review (not admin profile requests)
            queryset = queryset.filter(required_reviewer_role='admin')
        else:
            # All other users (tutor, faculty, principal, student) see only requests submitted by them or for them
            from django.db.models import Q
            queryset = queryset.filter(Q(requested_by=user) | Q(student=user))

        status_param = request.query_params.get('status', '').strip()
        if status_param:
            queryset = queryset.filter(status=status_param)

        student_id = request.query_params.get('student_id', '').strip()
        if student_id:
            queryset = queryset.filter(student_id=student_id)

        serializer = StudentEditRequestSerializer(queryset, many=True)
        is_admin_or_super = user.is_superuser or getattr(user, 'role', None) == 'admin'
        
        if user.is_superuser:
            pending_count = StudentEditRequest.objects.filter(status='pending').count()
        elif getattr(user, 'role', None) == 'admin':
            pending_count = StudentEditRequest.objects.filter(status='pending', required_reviewer_role='admin').count()
        else:
            pending_count = queryset.filter(status='pending').count()

        return Response({
            'count': queryset.count(),
            'pending_count': pending_count,
            'results': serializer.data,
        })

    def post(self, request):
        user = request.user
        role = getattr(user, 'role', None)

        serializer = StudentEditRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        student = serializer.validated_data.get('student')
        request_type = serializer.validated_data.get('request_type', 'student')

        # Determine reviewer role:
        # If an admin is editing their profile -> strictly SuperAdmin
        # If student/tutor/faculty/principal -> School Admin
        if role == 'admin':
            required_reviewer_role = 'superadmin'
            request_type = 'staff'
        elif role != 'student' and not student:
            required_reviewer_role = 'admin'
            request_type = 'staff'
        else:
            required_reviewer_role = 'admin'

        if student:
            if role == 'tutor' and student.assigned_tutor != user:
                return Response(
                    {'detail': 'You can only submit edit requests for students assigned to you.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            if role == 'student' and student != user:
                return Response(
                    {'detail': 'You can only submit edit requests for your own profile.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        edit_request = serializer.save(
            requested_by=user,
            request_type=request_type,
            required_reviewer_role=required_reviewer_role,
        )

        target_name = student.get_full_name() if student else user.get_full_name()
        log_audit_event(
            'PROFILE_EDIT_REQUEST_SUBMITTED',
            user=user,
            request=request,
            details={
                'request_id': str(edit_request.id),
                'target_name': target_name,
                'request_type': request_type,
                'required_reviewer_role': required_reviewer_role,
                'proposed_name': f"{edit_request.proposed_last_name}, {edit_request.proposed_first_name}",
                'proposed_lrn': edit_request.proposed_lrn,
                'proposed_aral_level': edit_request.proposed_aral_level,
                'reason': edit_request.reason,
            }
        )

        return Response(
            StudentEditRequestSerializer(edit_request).data,
            status=status.HTTP_201_CREATED
        )


class StudentEditRequestReviewView(APIView):
    """
    PATCH /api/users/student-edit-requests/{id}/review/ — Approve or reject an edit request.
    - School Admin can approve staff & student requests.
    - Super Admin can approve all requests, and is REQUIRED for Admin profile requests.
    """

    permission_classes = [IsAdmin]

    def patch(self, request, id):
        edit_req = get_object_or_404(StudentEditRequest, id=id)

        if edit_req.status != 'pending':
            return Response(
                {'detail': f'This request has already been {edit_req.status}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Permission check: If request requires SuperAdmin approval, enforce is_superuser
        if edit_req.required_reviewer_role == 'superadmin' and not request.user.is_superuser:
            return Response(
                {'detail': 'School Admin profile edit requests can only be approved by the Super Admin.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = StudentEditRequestReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action = serializer.validated_data['action']
        rejection_reason = serializer.validated_data.get('rejection_reason', '').strip()

        from django.utils import timezone

        if action == 'approve':
            # Target is student if student is set, otherwise the requesting user themselves (staff/admin profile)
            target_user = edit_req.student if edit_req.student else edit_req.requested_by
            target_user.first_name = edit_req.proposed_first_name
            target_user.middle_name = edit_req.proposed_middle_name
            target_user.last_name = edit_req.proposed_last_name
            if edit_req.proposed_lrn and target_user.role == 'student':
                target_user.lrn = edit_req.proposed_lrn
            if edit_req.proposed_aral_level and target_user.role == 'student':
                target_user.aral_level = edit_req.proposed_aral_level
            target_user.save()

            # Synchronize linked academic Student record if target is a student
            if target_user.role == 'student':
                try:
                    from apps.academics.models import Student as AcademicStudent
                    academic_student = AcademicStudent.objects.filter(user=target_user).first()
                    if academic_student:
                        academic_student.stu_fname = edit_req.proposed_first_name
                        academic_student.stu_mname = edit_req.proposed_middle_name
                        academic_student.stu_lname = edit_req.proposed_last_name
                        if edit_req.proposed_lrn:
                            academic_student.lrn = edit_req.proposed_lrn
                        if edit_req.proposed_aral_level:
                            academic_student.aral_level = edit_req.proposed_aral_level
                        academic_student.save()
                except Exception:
                    pass

            edit_req.status = 'approved'
            edit_req.reviewed_by = request.user
            edit_req.reviewed_at = timezone.now()
            edit_req.save()

            log_audit_event(
                'PROFILE_EDIT_REQUEST_APPROVED',
                user=request.user,
                request=request,
                details={
                    'request_id': str(edit_req.id),
                    'target_user_id': str(target_user.id),
                    'target_user_name': target_user.get_full_name(),
                    'requested_by': edit_req.requested_by.get_full_name(),
                    'approved_by': request.user.get_full_name(),
                }
            )

            return Response({
                'detail': f'Edit request for {target_user.get_full_name()} has been approved.',
                'request': StudentEditRequestSerializer(edit_req).data
            })

        else:
            edit_req.status = 'rejected'
            edit_req.rejection_reason = rejection_reason
            edit_req.reviewed_by = request.user
            edit_req.reviewed_at = timezone.now()
            edit_req.save()

            target_name = edit_req.student.get_full_name() if edit_req.student else edit_req.requested_by.get_full_name()
            log_audit_event(
                'PROFILE_EDIT_REQUEST_REJECTED',
                user=request.user,
                request=request,
                details={
                    'request_id': str(edit_req.id),
                    'target_name': target_name,
                    'requested_by': edit_req.requested_by.get_full_name(),
                    'rejected_by': request.user.get_full_name(),
                    'rejection_reason': rejection_reason,
                }
            )

            return Response({
                'detail': f'Edit request for {target_name} was rejected.',
                'request': StudentEditRequestSerializer(edit_req).data
            })



