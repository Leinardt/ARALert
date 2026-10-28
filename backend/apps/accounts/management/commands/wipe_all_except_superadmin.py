import sys
from django.core.management.base import BaseCommand
from django.db import connection, transaction
from apps.accounts.models import User


class Command(BaseCommand):
    help = (
        "Wipes all non-superadmin users (students, tutors, faculty, admins) "
        "and their dependent academic records while preserving SuperAdmin accounts."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Explicit confirmation to proceed with wiping all non-superadmin records.',
        )

    def handle(self, *args, **options):
        confirm = options.get('confirm', False)

        superadmins = list(User.objects.filter(is_superuser=True))
        superadmin_ids = [u.id for u in superadmins]
        non_superadmin_count = User.objects.exclude(id__in=superadmin_ids).count()

        self.stdout.write(self.style.NOTICE("=" * 65))
        self.stdout.write(self.style.NOTICE("ARALert Wipe All Users Except SuperAdmin"))
        self.stdout.write(self.style.NOTICE("=" * 65))
        self.stdout.write(f"SuperAdmin account(s) protected: {len(superadmins)}")
        for sa in superadmins:
            self.stdout.write(f"  - {sa.get_full_name()} ({sa.email}) [ID: {sa.id}]")

        self.stdout.write(f"\nNon-superadmin accounts found to delete: {non_superadmin_count}")
        self.stdout.write(f"  - Admins:     {User.objects.filter(role='admin', is_superuser=False).count()}")
        self.stdout.write(f"  - Principals: {User.objects.filter(role='principal').count()}")
        self.stdout.write(f"  - Faculty:    {User.objects.filter(role='faculty').count()}")
        self.stdout.write(f"  - Tutors:     {User.objects.filter(role='tutor').count()}")
        self.stdout.write(f"  - Students:   {User.objects.filter(role='student').count()}")
        self.stdout.write(self.style.NOTICE("=" * 65))

        if non_superadmin_count == 0:
            self.stdout.write(self.style.SUCCESS("No non-superadmin users found. Database already clean!"))
            return

        if not confirm:
            self.stdout.write(
                self.style.WARNING(
                    "\n[DRY RUN] No records were deleted.\n"
                    "To execute this deletion on this database, run:\n\n"
                    "    python manage.py wipe_all_except_superadmin --confirm\n"
                )
            )
            return

        self.stdout.write(self.style.WARNING(f"\nProceeding to delete {non_superadmin_count} non-superadmin accounts..."))

        existing_tables = set(connection.introspection.table_names())

        def safe_delete(cursor, table_name):
            if table_name in existing_tables:
                cursor.execute(f"DELETE FROM \"{table_name}\";")
                rc = cursor.rowcount
                if rc > 0:
                    self.stdout.write(f"  Cleaned {table_name}: {rc} row(s)")

        with transaction.atomic():
            with connection.cursor() as cur:
                # Break self-referential tutor FK
                cur.execute("UPDATE users SET assigned_tutor_id = NULL;")

                tables_to_clear = [
                    "api_academic_risk",
                    "api_attendance",
                    "api_attendance_session",
                    "api_grade",
                    "api_aral_activity",
                    "student_enrollment",
                    "tutor_assignment_history",
                    "summer_record",
                    "student_edit_requests",
                    "audit_logs",
                    "token_blacklist_blacklistedtoken",
                    "token_blacklist_outstandingtoken",
                    "student",
                    "tutor",
                    "faculty",
                    "principal",
                    "admin",
                    "accounts_emailotp",
                    "accounts_trusteddevice",
                ]

                for table in tables_to_clear:
                    safe_delete(cur, table)

                # Delete non-superadmins from users table
                if connection.vendor == 'sqlite':
                    placeholders = ",".join(["?"] * len(superadmin_ids))
                    hex_ids = [u.id.hex if hasattr(u.id, 'hex') else str(u.id) for u in superadmins]
                    cur.execute(f"DELETE FROM users WHERE id NOT IN ({placeholders});", hex_ids)
                else:
                    placeholders = ",".join(["%s"] * len(superadmin_ids))
                    cur.execute(f"DELETE FROM users WHERE id NOT IN ({placeholders});", superadmin_ids)

                deleted_users = cur.rowcount
                self.stdout.write(self.style.SUCCESS(f"  Deleted {deleted_users} non-superadmin users from users table."))

        remaining_users = list(User.objects.all())
        self.stdout.write(self.style.SUCCESS(f"\nSUCCESS: Wipe complete. Remaining users: {len(remaining_users)}"))
        for u in remaining_users:
            self.stdout.write(f"  - {u.get_full_name()} ({u.email}) [SuperAdmin: {u.is_superuser}]")
