"""
Django Management Command: send_weekly_risk_digest
Dispatches weekly academic risk digest reports every Saturday at 12:00 AM PHT:
  1. Tutor Copy: Divided by handled class for each active Tutor.
  2. Principal Copy: Consolidated across all active ARAL classes for the current semester.

Usage:
  python backend/manage.py send_weekly_risk_digest --dry-run
  python backend/manage.py send_weekly_risk_digest --email lro2023-4992-68567@bicol-u.edu.ph
  python backend/manage.py send_weekly_risk_digest --tutors-only --dry-run
  python backend/manage.py send_weekly_risk_digest --principal-only --dry-run
  python backend/manage.py send_weekly_risk_digest --tutor-id <uuid> --email lro2023-4992-68567@bicol-u.edu.ph
"""

from django.core.management.base import BaseCommand, CommandError
from apps.accounts.models import User
from services.email_service import send_weekly_principal_digest_email
from services.weekly_risk_digest_service import (
    build_consolidated_principal_digest_payload,
    format_staff_display_name,
    generate_weekly_tutor_digest,
    resolve_digest_recipient,
    run_weekly_high_risk_digests,
)


class Command(BaseCommand):
    help = 'Compile and send the Saturday 12:00 AM PHT weekly High Risk summary digests to Tutors and Principal'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Run calculations and print summary without sending emails',
        )
        parser.add_argument(
            '--tutor-id',
            type=str,
            default=None,
            help='Run the digest for a single specific tutor UUID',
        )
        parser.add_argument(
            '--tutor-email',
            type=str,
            default=None,
            help='Run the digest for a single specific tutor by their account email',
        )
        parser.add_argument(
            '--principal-email',
            type=str,
            default=None,
            help='Run the consolidated digest for a single specific principal by their account email',
        )
        parser.add_argument(
            '--email',
            type=str,
            default=None,
            help='Override recipient email for test sends',
        )
        parser.add_argument(
            '--tutors-only',
            action='store_true',
            help='Run only the per-class Tutor weekly summaries',
        )
        parser.add_argument(
            '--principal-only',
            action='store_true',
            help='Run only the consolidated Principal active-semester summary',
        )

    def handle(self, *args, **options):
        dry_run = bool(options.get('dry_run', False))
        tutor_id = (options.get('tutor_id') or '').strip() or None
        tutor_email = (options.get('tutor_email') or '').strip() or None
        principal_email = (options.get('principal_email') or '').strip() or None
        override_email = (options.get('email') or '').strip() or None
        tutors_only = bool(options.get('tutors_only', False))
        principal_only = bool(options.get('principal_only', False))

        if tutors_only and principal_only:
            raise CommandError('Cannot combine --tutors-only and --principal-only. Omit both to run all digests.')

        scope = 'tutors' if tutors_only else ('principal' if principal_only else 'all')

        self.stdout.write(
            self.style.NOTICE(
                f"[INFO] Starting Weekly High Risk Digest (scope={scope}, dry_run={dry_run})..."
            )
        )

        if tutor_id or tutor_email:
            try:
                if tutor_id:
                    tutor = User.objects.get(id=tutor_id, role='tutor')
                else:
                    tutor = User.objects.get(email__iexact=tutor_email, role='tutor')
            except User.DoesNotExist:
                ident = tutor_id or tutor_email
                self.stderr.write(self.style.ERROR(f"[ERROR] Tutor '{ident}' not found."))
                return

            res = generate_weekly_tutor_digest(tutor, target_email=override_email, dry_run=dry_run)
            self.stdout.write(
                self.style.SUCCESS(
                    f"[OK] Tutor {res.get('tutor_name', tutor.get_full_name())} ({tutor.email}): "
                    f"{res.get('total_classes', 0)} classes, "
                    f"{res.get('total_students', 0)} active learners, "
                    f"{res.get('high_risk_count', 0)} High Risk | "
                    f"Target: {res.get('dispatched_to', 'skipped')} | "
                    f"Sent: {res.get('send_success')}"
                )
            )
            return

        if principal_email:
            try:
                principal = User.objects.get(email__iexact=principal_email, role='principal')
            except User.DoesNotExist:
                self.stderr.write(self.style.ERROR(f"[ERROR] Principal '{principal_email}' not found."))
                return

            payload = build_consolidated_principal_digest_payload()
            p_name = format_staff_display_name(principal, 'School Principal')
            resolved_to = resolve_digest_recipient(principal.email, override_email)
            digest_copy = {**payload, 'principal_display_name': p_name}
            sent = True if dry_run else send_weekly_principal_digest_email(principal, digest_copy, to_email=resolved_to)
            self.stdout.write(
                self.style.SUCCESS(
                    f"[OK] Principal {p_name} ({principal.email}): "
                    f"{payload.get('total_enrolled_students', 0)} active learners across "
                    f"{payload.get('total_classes', 0)} classes, "
                    f"{payload.get('high_risk_count', 0)} High Risk | "
                    f"Target: {resolved_to} | Sent: {sent}"
                )
            )
            return

        summary = run_weekly_high_risk_digests(
            target_email=override_email,
            dry_run=dry_run,
            scope=scope,
        )

        self.stdout.write(f"Academic Term : {summary.get('academic_term')}")
        self.stdout.write(f"Session Window: {summary.get('week_range')}")
        if summary.get('testing_recipient_lock') and not override_email:
            self.stdout.write(
                self.style.WARNING(
                    f"Testing Lock  : Active -> routing all emails to {summary.get('testing_recipient_lock')}"
                )
            )

        tutor_summary = summary.get('tutors')
        if tutor_summary is not None:
            self.stdout.write(
                f"\n--- Tutor Weekly Summaries ({tutor_summary.get('total_sent', 0)}/"
                f"{tutor_summary.get('total_tutors', 0)} Dispatched) ---"
            )
            for item in tutor_summary.get('results', []):
                if item.get('status') == 'skipped_no_students':
                    self.stdout.write(
                        f"  - {item.get('tutor_name')} ({item.get('tutor_email')}): Skipped (0 active learners)"
                    )
                elif item.get('status') == 'skipped_zero_high_risk':
                    self.stdout.write(
                        f"  - {item.get('tutor_name')} ({item.get('tutor_email')}): Skipped (0 high-risk learners)"
                    )
                elif item.get('error'):
                    self.stderr.write(
                        self.style.ERROR(f"  - {item.get('tutor_email')}: Error -> {item.get('error')}")
                    )
                else:
                    self.stdout.write(
                        f"  - {item.get('tutor_name')} ({item.get('tutor_email')}): "
                        f"{item.get('total_classes', 0)} classes | "
                        f"{item.get('high_risk_count', 0)}/{item.get('total_students', 0)} High Risk | "
                        f"To: {item.get('dispatched_to')} | Sent: {item.get('send_success')}"
                    )

        principal_summary = summary.get('principal')
        if principal_summary is not None:
            if principal_summary.get('status') == 'skipped_zero_high_risk':
                self.stdout.write("\n--- Principal Consolidated Summary (Skipped: 0 High Risk Learners) ---")
            else:
                self.stdout.write(
                    f"\n--- Principal Consolidated Summary ({principal_summary.get('total_sent', 0)} Dispatched) ---"
                )
            self.stdout.write(
                f"  Program Roster : {principal_summary.get('total_enrolled_students', 0)} active learners "
                f"across {principal_summary.get('total_classes', 0)} classes"
            )
            self.stdout.write(
                f"  High Risk Total: {principal_summary.get('consolidated_high_risk_count', 0)} learners"
            )
            for p_item in principal_summary.get('results', []):
                if p_item.get('error'):
                    self.stderr.write(
                        self.style.ERROR(f"  - {p_item.get('principal_email')}: Error -> {p_item.get('error')}")
                    )
                else:
                    self.stdout.write(
                        f"  - {p_item.get('principal_name')} ({p_item.get('principal_email')}): "
                        f"To: {p_item.get('dispatched_to')} | Sent: {p_item.get('send_success')}"
                    )

        self.stdout.write(self.style.SUCCESS("\n[OK] Weekly High Risk Digest run completed."))

