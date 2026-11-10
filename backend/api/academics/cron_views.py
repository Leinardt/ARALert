"""
Cron / Webhook Views for ARALert.
Provides secure automated triggers for scheduled tasks (such as the Saturday 12:00 AM PHT Weekly Risk Digest).
"""

import hmac
import logging
import os
from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from services.weekly_risk_digest_service import run_weekly_high_risk_digests

logger = logging.getLogger(__name__)


class WeeklyRiskDigestCronView(APIView):
    """
    POST /api/academics/cron/weekly-risk-digest/
    Automated endpoint invoked every Saturday at 12:00 AM PHT (or manually by SuperAdmin).
    Dispatches both Tutor class-grouped summaries and Principal consolidated semester summaries.
    Protected by explicit CRON_SECRET header (when configured) or SuperAdmin authentication.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        auth_header = (request.headers.get('X-Cron-Key') or '').strip()
        raw_setting = getattr(settings, 'CRON_SECRET', None)
        expected_secret = (
            raw_setting if raw_setting is not None else os.environ.get('CRON_SECRET', '')
        ).strip()

        has_valid_cron_key = bool(
            expected_secret and auth_header and hmac.compare_digest(auth_header, expected_secret)
        )
        is_superadmin_user = bool(
            request.user and request.user.is_authenticated and request.user.is_superuser
        )

        if not (has_valid_cron_key or is_superadmin_user):
            return Response(
                {'error': 'Unauthorized cron invocation. Provide valid X-Cron-Key or authenticate as SuperAdmin.'},
                status=status.HTTP_403_FORBIDDEN
            )

        raw_dry_run = request.data.get('dry_run', request.query_params.get('dry_run', False))
        if isinstance(raw_dry_run, bool):
            dry_run = raw_dry_run
        else:
            dry_run = str(raw_dry_run).strip().lower() in ('1', 'true', 'yes')

        raw_force = request.data.get('force', request.query_params.get('force', False))
        if isinstance(raw_force, bool):
            force = raw_force
        else:
            force = str(raw_force).strip().lower() in ('1', 'true', 'yes')

        override_email = (request.data.get('email') or request.query_params.get('email') or '').strip() or None
        scope = (request.data.get('scope') or request.query_params.get('scope') or 'all').strip().lower()
        if scope not in ('all', 'tutors', 'tutor', 'principal', 'principals'):
            return Response(
                {'error': "Invalid scope. Expected 'all', 'tutors', or 'principal'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        logger.info(
            'Executing WeeklyRiskDigestCronView (scope=%s, dry_run=%s, force=%s, override_email=%s)',
            scope,
            dry_run,
            force,
            override_email,
        )

        try:
            summary = run_weekly_high_risk_digests(
                target_email=override_email,
                dry_run=dry_run,
                scope=scope,
                force=force,
            )
            return Response({
                'message': 'Weekly risk digest execution completed.',
                'summary': summary,
            }, status=status.HTTP_200_OK)
        except Exception as exc:
            logger.exception('Weekly risk digest cron failed: %s', exc)
            err_detail = f'Weekly digest execution error: {str(exc)}' if settings.DEBUG else 'Weekly digest execution encountered an internal error.'
            return Response(
                {'error': err_detail},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

