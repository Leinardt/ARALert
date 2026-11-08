"""
Support Ticket / Problem Report Views for ARALert.
Allows all authenticated users (students, tutors, staff) to report issues directly to the Super Admin via SMTP,
persists tickets in the database for two-way tracking, and powers in-app notifications and administrative triage.
"""

import logging
import uuid
from datetime import datetime
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import models
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User, SupportTicket, SystemAnnouncement
from services.email_service import (
    dispatch_email_async,
    send_problem_ticket_email,
    send_problem_ticket_confirmation_email,
    send_problem_ticket_resolved_email,
)
from utilities.audit import log_audit_event
from utilities.helpers import get_client_ip
from utilities.rate_limit import is_ticket_rate_limited, record_ticket_submission

logger = logging.getLogger(__name__)

MAX_TICKET_NAME_LENGTH = 150
MAX_TICKET_EMAIL_LENGTH = 254
MAX_TICKET_DESCRIPTION_LENGTH = 5000
MAX_ANNOUNCEMENT_TITLE_LENGTH = 200


def _get_testing_superadmin_lock() -> str:
    """Optional override email from Django settings; empty in production so all active Super Admins receive tickets."""
    return (getattr(settings, 'TESTING_SUPERADMIN_RECIPIENT_EMAIL', '') or '').strip()


def get_active_superadmin_emails() -> list[str]:
    """
    Return verified, strictly active Super Admin recipient emails.
    Safeguards:
    - Queries ONLY accounts where is_superuser=True AND is_active=True.
    - Explicitly excludes any email associated with a deactivated (is_active=False) user record.
    - Never appends unverified fallback emails outside active Super Admin accounts.
    - Respects settings.TESTING_SUPERADMIN_RECIPIENT_EMAIL only when explicitly set.
    """
    active_qs = (
        User.objects.filter(is_superuser=True, is_active=True)
        .exclude(email__isnull=True)
        .exclude(email='')
    )
    testing_lock = _get_testing_superadmin_lock()
    if testing_lock:
        active_qs = active_qs.filter(email__iexact=testing_lock)

    deactivated_emails_lower = {
        e.strip().lower()
        for e in User.objects.filter(is_active=False)
        .exclude(email__isnull=True)
        .exclude(email='')
        .values_list('email', flat=True)
        if e and e.strip()
    }

    verified_emails = []
    seen_lower = set()
    for raw_email in active_qs.values_list('email', flat=True):
        clean = (raw_email or '').strip()
        lower = clean.lower()
        if not clean or lower.endswith('@aralert.local'):
            continue
        if lower in deactivated_emails_lower or lower in seen_lower:
            continue
        seen_lower.add(lower)
        verified_emails.append(clean)

    return verified_emails


def serialize_support_ticket(ticket: SupportTicket) -> dict:
    return {
        'id': str(ticket.id),
        'ticket_id': ticket.ticket_id,
        'submitter_name': ticket.submitter_name,
        'submitter_role': ticket.submitter_role,
        'contact_email': ticket.contact_email,
        'description': ticket.description,
        'status': ticket.status,
        'status_display': ticket.get_status_display(),
        'admin_reply': ticket.admin_reply,
        'claimed_by_name': ticket.claimed_by.get_full_name() if ticket.claimed_by else None,
        'resolved_by_name': ticket.resolved_by.get_full_name() if ticket.resolved_by else None,
        'lrn': ticket.lrn,
        'grade_level': ticket.grade_level,
        'section': ticket.section,
        'tutor_name': ticket.tutor_name,
        'created_at': ticket.created_at.isoformat(),
        'updated_at': ticket.updated_at.isoformat(),
        'resolved_at': ticket.resolved_at.isoformat() if ticket.resolved_at else None,
    }


class ReportProblemView(APIView):
    """
    POST /api/users/report-problem/
    Submit a problem report from any authenticated user.
    Saves to the database, sends emails to Super Admins, and dispatches a confirmation receipt.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user

        # Rate limiting: 2-minute cooldown per user / IP to prevent spam or accidental resubmissions
        client_ip = get_client_ip(request)
        is_limited, remaining_sec = is_ticket_rate_limited(str(user.id), client_ip)
        if is_limited:
            return Response(
                {'error': f'Please wait {remaining_sec} second(s) before submitting another problem report.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        name = str(request.data.get('name', '') or '').strip()[:MAX_TICKET_NAME_LENGTH]
        email = str(request.data.get('email', '') or '').strip()
        description = str(request.data.get('description', '') or '').strip()

        # Validation
        if not description:
            return Response(
                {'error': 'Problem description is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if len(description) > MAX_TICKET_DESCRIPTION_LENGTH:
            return Response(
                {'error': f'Problem description cannot exceed {MAX_TICKET_DESCRIPTION_LENGTH} characters.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not email:
            if user.email and not user.email.endswith('@aralert.local'):
                email = user.email.strip()
            else:
                return Response(
                    {'error': 'A valid contact email is required so administrators can reply to your report.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        if len(email) > MAX_TICKET_EMAIL_LENGTH or email.lower().endswith('@aralert.local'):
            return Response(
                {'error': 'Please enter a valid contact email address.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            validate_email(email)
        except DjangoValidationError:
            return Response(
                {'error': 'Please enter a valid contact email address.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate unique ticket ID: TKT-YYYYMMDD-XXXX (in Philippine Time / Asia/Manila)
        local_now = timezone.localtime(timezone.now())
        date_str = local_now.strftime('%Y%m%d')
        unique_suffix = uuid.uuid4().hex[:4].upper()
        ticket_id = f"TKT-{date_str}-{unique_suffix}"
        submitted_at_str = local_now.strftime('%B %d, %Y, %I:%M %p PHT')

        submitter_name = name or user.get_full_name() or user.username or 'ARALert User'
        submitter_role = 'Super Admin' if user.is_superuser else (user.role or 'User').title()

        lrn_val = getattr(user, 'lrn', None) if user.role == 'student' else None
        grade_level_val = getattr(user, 'grade_level', None)
        section_val = getattr(user, 'section', None)
        tutor_name_val = user.assigned_tutor.get_full_name() if (user.role == 'student' and getattr(user, 'assigned_tutor', None)) else None

        ticket_data = {
            'ticket_id': ticket_id,
            'submitter_name': submitter_name,
            'submitter_role': submitter_role,
            'contact_email': email,
            'description': description,
            'submitted_at': submitted_at_str,
            'lrn': lrn_val,
            'grade_level': grade_level_val,
            'section': section_val,
            'tutor_name': tutor_name_val,
        }

        # 1. Persist SupportTicket to database (fail cleanly if DB insert fails)
        try:
            SupportTicket.objects.create(
                ticket_id=ticket_id,
                submitter=user,
                submitter_name=submitter_name,
                submitter_role=submitter_role,
                contact_email=email,
                description=description,
                lrn=lrn_val,
                grade_level=grade_level_val,
                section=section_val,
                tutor_name=tutor_name_val,
                status=SupportTicket.Status.UNDER_REVIEW,
            )
        except Exception as exc:
            logger.exception('Failed to save SupportTicket in database: %s', exc)
            return Response(
                {'error': 'Unable to save problem report right now. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # 2. Query strictly active SuperAdmin email addresses (deactivated SuperAdmins are excluded)
        target_emails = get_active_superadmin_emails()

        for admin_email in target_emails:
            dispatch_email_async(send_problem_ticket_email, ticket_data, to_email=admin_email)

        # 3. Dispatch automated confirmation receipt copy to the submitter (non-blocking)
        confirmation_queued = bool(email and not email.lower().endswith('@aralert.local'))
        if confirmation_queued:
            dispatch_email_async(send_problem_ticket_confirmation_email, ticket_data, to_email=email)

        log_audit_event(
            'PROBLEM_TICKET_SUBMITTED',
            user=user,
            request=request,
            details={
                'ticket_id': ticket_id,
                'submitter_role': submitter_role,
                'contact_email': email,
                'target_recipients': list(target_emails),
                'confirmation_receipt_queued': confirmation_queued,
            }
        )

        # Record ticket submission timestamp to activate the 2-minute cooldown
        record_ticket_submission(str(user.id), client_ip)

        return Response({
            'message': 'Problem report submitted successfully.',
            'ticket_id': ticket_id,
            'contact_email': email,
            'dispatched_to': list(target_emails),
            'email_sent': len(target_emails) > 0,
        }, status=status.HTTP_201_CREATED)


class SupportTicketListView(APIView):
    """
    GET /api/users/tickets/
    Retrieve tickets for the current user's notification feed.
    - If Super Admin: returns all tickets (supports ?status=pending or ?status=all), with pending count.
    - If Regular User: returns their submitted tickets with active/pending count.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        status_param = request.query_params.get('status', 'all').lower()

        if user.is_superuser:
            # Super Admin View
            active_statuses = [SupportTicket.Status.UNDER_REVIEW, SupportTicket.Status.IN_PROGRESS]
            pending_count = SupportTicket.objects.filter(status__in=active_statuses).count()

            if status_param == 'pending':
                tickets = SupportTicket.objects.filter(status__in=active_statuses)[:50]
            elif status_param == 'history':
                tickets = SupportTicket.objects.exclude(status__in=active_statuses)[:50]
            else:
                tickets = SupportTicket.objects.all()[:50]

            return Response({
                'pending_count': pending_count,
                'results': [serialize_support_ticket(t) for t in tickets],
            })
        else:
            # Submitter View (Student, Tutor, Principal, School Admin)
            tickets_qs = SupportTicket.objects.filter(submitter=user, is_dismissed_by_user=False)
            pending_count = tickets_qs.filter(
                status__in=[SupportTicket.Status.UNDER_REVIEW, SupportTicket.Status.IN_PROGRESS]
            ).count()

            return Response({
                'pending_count': pending_count,
                'results': [serialize_support_ticket(t) for t in tickets_qs[:20]],
            })


class SupportTicketActionView(APIView):
    """
    POST /api/users/tickets/<str:ticket_id>/action/
    Super Admin actions on a ticket:
    - action='claim' -> set status to IN_PROGRESS
    - action='resolve' -> set status to RESOLVED with required admin reply note
    - action='dismiss' -> set status to DISMISSED with required reason note
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, ticket_id):
        user = request.user
        if not user.is_superuser:
            return Response({'error': 'Only Super Admins can update ticket statuses.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            ticket = SupportTicket.objects.get(ticket_id=ticket_id)
        except SupportTicket.DoesNotExist:
            return Response({'error': f'Ticket {ticket_id} not found.'}, status=status.HTTP_404_NOT_FOUND)

        action = str(request.data.get('action', '') or '').strip().lower()
        reply = str(request.data.get('reply', '') or '').strip()
        if len(reply) > MAX_TICKET_DESCRIPTION_LENGTH:
            return Response(
                {'error': f'Response note cannot exceed {MAX_TICKET_DESCRIPTION_LENGTH} characters.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        admin_name = user.get_full_name() or user.username or 'Super Admin'

        if action == 'claim':
            ticket.status = SupportTicket.Status.IN_PROGRESS
            ticket.claimed_by = user
            ticket.save(update_fields=['status', 'claimed_by', 'updated_at'])

            log_audit_event(
                'PROBLEM_TICKET_CLAIMED',
                user=user,
                request=request,
                details={'ticket_id': ticket_id, 'claimed_by': user.email}
            )
            return Response({
                'message': f'Ticket {ticket_id} marked as In Progress.',
                'ticket': serialize_support_ticket(ticket)
            })

        elif action == 'resolve':
            if not reply:
                return Response({'error': 'A resolution note is required when resolving a ticket.'}, status=status.HTTP_400_BAD_REQUEST)

            ticket.status = SupportTicket.Status.RESOLVED
            ticket.admin_reply = reply
            ticket.resolved_by = user
            ticket.resolved_at = timezone.now()
            ticket.save(update_fields=['status', 'admin_reply', 'resolved_by', 'resolved_at', 'updated_at'])

            # Dispatch resolution email to submitter (non-blocking after DB commit)
            if ticket.contact_email:
                dispatch_email_async(
                    send_problem_ticket_resolved_email,
                    {
                        'ticket_id': ticket.ticket_id,
                        'submitter_name': ticket.submitter_name,
                        'admin_name': admin_name,
                        'admin_reply': reply,
                        'status': 'Resolved',
                    },
                    to_email=ticket.contact_email,
                )

            log_audit_event(
                'PROBLEM_TICKET_RESOLVED',
                user=user,
                request=request,
                details={'ticket_id': ticket_id, 'resolved_by': user.email, 'reply': reply}
            )
            return Response({
                'message': f'Ticket {ticket_id} marked as Resolved.',
                'ticket': serialize_support_ticket(ticket)
            })

        elif action == 'dismiss':
            if not reply:
                return Response({'error': 'A reason is required when dismissing a ticket.'}, status=status.HTTP_400_BAD_REQUEST)

            ticket.status = SupportTicket.Status.DISMISSED
            ticket.admin_reply = reply
            ticket.resolved_by = user
            ticket.resolved_at = timezone.now()
            ticket.save(update_fields=['status', 'admin_reply', 'resolved_by', 'resolved_at', 'updated_at'])

            # Dispatch dismissal email to submitter (non-blocking after DB commit)
            if ticket.contact_email:
                dispatch_email_async(
                    send_problem_ticket_resolved_email,
                    {
                        'ticket_id': ticket.ticket_id,
                        'submitter_name': ticket.submitter_name,
                        'admin_name': admin_name,
                        'admin_reply': reply,
                        'status': 'Dismissed',
                    },
                    to_email=ticket.contact_email,
                )

            log_audit_event(
                'PROBLEM_TICKET_DISMISSED',
                user=user,
                request=request,
                details={'ticket_id': ticket_id, 'dismissed_by': user.email, 'reason': reply}
            )
            return Response({
                'message': f'Ticket {ticket_id} dismissed.',
                'ticket': serialize_support_ticket(ticket)
            })

        return Response({'error': f"Invalid action '{action}'. Valid actions are 'claim', 'resolve', 'dismiss'."}, status=status.HTTP_400_BAD_REQUEST)


class SupportTicketDismissView(APIView):
    """
    POST /api/users/tickets/<str:ticket_id>/dismiss-user/
    Submitter dismisses a resolved/dismissed ticket from their active notification bell.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, ticket_id):
        user = request.user
        try:
            ticket = SupportTicket.objects.get(ticket_id=ticket_id, submitter=user)
        except SupportTicket.DoesNotExist:
            return Response({'error': f'Ticket {ticket_id} not found for this user.'}, status=status.HTTP_404_NOT_FOUND)

        ticket.is_dismissed_by_user = True
        ticket.save(update_fields=['is_dismissed_by_user', 'updated_at'])
        return Response({'message': 'Ticket dismissed from notifications.'})


def serialize_system_announcement(announcement: SystemAnnouncement) -> dict:
    return {
        'id': str(announcement.id),
        'title': announcement.title,
        'message': announcement.message,
        'announcement_type': announcement.announcement_type,
        'announcement_type_display': announcement.get_announcement_type_display(),
        'target_role': announcement.target_role,
        'target_role_display': announcement.get_target_role_display(),
        'is_active': announcement.is_active,
        'created_by_name': announcement.created_by.get_full_name() if announcement.created_by else 'System Administrator',
        'created_at': announcement.created_at.isoformat(),
        'expires_at': announcement.expires_at.isoformat() if announcement.expires_at else None,
    }


class SystemAnnouncementListCreateView(APIView):
    """
    GET /api/users/announcements/
    - Regular Users: returns active, non-expired announcements targeted to ALL or their role.
    - Super Admins: returns active announcements with total count.

    POST /api/users/announcements/
    - Super Admins only: Create and broadcast a new system announcement.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.now()

        qs = SystemAnnouncement.objects.filter(is_active=True).filter(
            models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=now)
        )

        if not user.is_superuser:
            user_role = (user.role or '').lower()
            allowed_roles = ['ALL']
            if user_role in ('tutor', 'faculty'):
                allowed_roles.append('TUTORS')
            elif user_role == 'student':
                allowed_roles.append('STUDENTS')
            elif user_role == 'principal':
                allowed_roles.append('PRINCIPALS')

            qs = qs.filter(target_role__in=allowed_roles)

        announcements = list(qs[:30])
        return Response({
            'count': len(announcements),
            'results': [serialize_system_announcement(a) for a in announcements],
        })

    def post(self, request):
        user = request.user
        if not user.is_superuser:
            return Response({'error': 'Only Super Admins can publish system announcements.'}, status=status.HTTP_403_FORBIDDEN)

        title = str(request.data.get('title', '') or '').strip()[:MAX_ANNOUNCEMENT_TITLE_LENGTH]
        message = str(request.data.get('message', '') or '').strip()
        announcement_type = str(request.data.get('announcement_type', 'INFO') or 'INFO').upper()
        target_role = str(request.data.get('target_role', 'ALL') or 'ALL').upper()

        if not title:
            return Response({'error': 'Announcement title is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not message:
            return Response({'error': 'Announcement message is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(message) > MAX_TICKET_DESCRIPTION_LENGTH:
            return Response(
                {'error': f'Announcement message cannot exceed {MAX_TICKET_DESCRIPTION_LENGTH} characters.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if announcement_type not in SystemAnnouncement.AnnouncementType.values:
            announcement_type = SystemAnnouncement.AnnouncementType.INFO
        if target_role not in SystemAnnouncement.TargetRole.values:
            target_role = SystemAnnouncement.TargetRole.ALL

        announcement = SystemAnnouncement.objects.create(
            title=title,
            message=message,
            announcement_type=announcement_type,
            target_role=target_role,
            created_by=user,
            is_active=True,
        )

        log_audit_event(
            'SYSTEM_ANNOUNCEMENT_CREATED',
            user=user,
            request=request,
            details={
                'id': str(announcement.id),
                'title': title,
                'announcement_type': announcement_type,
                'target_role': target_role,
            }
        )

        return Response(serialize_system_announcement(announcement), status=status.HTTP_201_CREATED)


class SystemAnnouncementDetailView(APIView):
    """
    DELETE /api/users/announcements/<int:id>/
    Super Admin deactivates / deletes an announcement.
    """
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, id):
        user = request.user
        if not user.is_superuser:
            return Response({'error': 'Only Super Admins can remove system announcements.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            announcement = SystemAnnouncement.objects.get(id=id)
        except SystemAnnouncement.DoesNotExist:
            return Response({'error': f'Announcement #{id} not found.'}, status=status.HTTP_404_NOT_FOUND)

        announcement.is_active = False
        announcement.save(update_fields=['is_active'])

        log_audit_event(
            'SYSTEM_ANNOUNCEMENT_DEACTIVATED',
            user=user,
            request=request,
            details={'id': id, 'title': announcement.title}
        )

        return Response({'message': f'Announcement #{id} deactivated successfully.'})

