import sys
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from apps.accounts.models import User


class Command(BaseCommand):
    help = "Safely wipes all student accounts (role='student') and their associated records while keeping all staff intact."

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Explicit confirmation to proceed with wiping student records.',
        )

    def handle(self, *args, **options):
        confirm = options.get('confirm', False)

        # Count students and staff
        student_count = User.objects.filter(role='student').count()
        staff_users = User.objects.exclude(role='student')
        staff_count = staff_users.count()

        self.stdout.write(self.style.NOTICE("=" * 60))
        self.stdout.write(self.style.NOTICE("ARALert Student Account Wipe Utility"))
        self.stdout.write(self.style.NOTICE("=" * 60))
        self.stdout.write(f"Students found to delete: {student_count}")
        self.stdout.write(f"Staff accounts protected: {staff_count}")
        self.stdout.write(f"  - SuperAdmins: {User.objects.filter(is_superuser=True).count()}")
        self.stdout.write(f"  - Admins:      {User.objects.filter(role='admin').count()}")
        self.stdout.write(f"  - Principals:  {User.objects.filter(role='principal').count()}")
        self.stdout.write(f"  - Faculty:     {User.objects.filter(role='faculty').count()}")
        self.stdout.write(f"  - Tutors:      {User.objects.filter(role='tutor').count()}")
        self.stdout.write(self.style.NOTICE("=" * 60))

        if student_count == 0:
            self.stdout.write(self.style.SUCCESS("No student accounts found. Database is already clean of students."))
            return

        if not confirm:
            self.stdout.write(
                self.style.WARNING(
                    "\n[DRY RUN] No records were deleted.\n"
                    "To execute this deletion, re-run with the --confirm flag:\n\n"
                    "    python manage.py wipe_students --confirm\n"
                )
            )
            return

        self.stdout.write(self.style.WARNING(f"\nProceeding to delete {student_count} student accounts and dependents..."))

        existing_tables = set(connection.introspection.table_names())

        def safe_delete(cursor, sql, label):
            try:
                cursor.execute(sql)
                row_count = cursor.rowcount
                if row_count > 0:
                    self.stdout.write(f"  ✓ Cleaned {label}: {row_count} row(s)")
            except Exception as exc:
                self.stdout.write(self.style.WARNING(f"  Notice ({label}): {exc}"))

        with transaction.atomic():
            with connection.cursor() as cursor:
                # 1. Prediction alerts linked to student
                if 'student_alert' in existing_tables:
                    safe_delete(
                        cursor,
                        "DELETE FROM student_alert WHERE student_id IN (SELECT id FROM student WHERE user_id IN (SELECT id FROM users WHERE role = 'student'))",
                        "student_alert"
                    )

                # 2. Prediction records
                if 'prediction' in existing_tables:
                    safe_delete(
                        cursor,
                        """DELETE FROM prediction WHERE student_att_summary_id IN (
                            SELECT id FROM studentatt_summary WHERE student_id IN (
                                SELECT id FROM student WHERE user_id IN (SELECT id FROM users WHERE role = 'student')
                            )
                        ) OR assess_score_summary_id IN (
                            SELECT id FROM assessscore_summary WHERE student_id IN (
                                SELECT id FROM student WHERE user_id IN (SELECT id FROM users WHERE role = 'student')
                            )
                        )""",
                        "prediction"
                    )

                # 3. Assessment and attendance summaries
                if 'assessscore_summary' in existing_tables:
                    safe_delete(
                        cursor,
                        "DELETE FROM assessscore_summary WHERE student_id IN (SELECT id FROM student WHERE user_id IN (SELECT id FROM users WHERE role = 'student'))",
                        "assessscore_summary"
                    )
                if 'studentatt_summary' in existing_tables:
                    safe_delete(
                        cursor,
                        "DELETE FROM studentatt_summary WHERE student_id IN (SELECT id FROM student WHERE user_id IN (SELECT id FROM users WHERE role = 'student'))",
                        "studentatt_summary"
                    )

                # 4. Student academic scores, attendance, grades, enrollments linked to student profile table
                for tbl in ['assessment_score', 'student_attendance', 'mosy_grade', 'eosy_grade', 'aral_enrollment']:
                    if tbl in existing_tables:
                        safe_delete(
                            cursor,
                            f"DELETE FROM {tbl} WHERE student_id IN (SELECT id FROM student WHERE user_id IN (SELECT id FROM users WHERE role = 'student'))",
                            tbl
                        )

                # 5. Student profile table
                if 'student' in existing_tables:
                    safe_delete(
                        cursor,
                        "DELETE FROM student WHERE user_id IN (SELECT id FROM users WHERE role = 'student')",
                        "student profile"
                    )

                # 6. Academic records directly linked to User model
                if 'summer_record' in existing_tables:
                    safe_delete(cursor, "DELETE FROM summer_record WHERE student_id IN (SELECT id FROM users WHERE role = 'student')", "summer_record")
                if 'tutor_assignment_history' in existing_tables:
                    safe_delete(cursor, "DELETE FROM tutor_assignment_history WHERE student_id IN (SELECT id FROM users WHERE role = 'student')", "tutor_assignment_history")
                if 'student_enrollment' in existing_tables:
                    safe_delete(cursor, "DELETE FROM student_enrollment WHERE student_id IN (SELECT id FROM users WHERE role = 'student')", "student_enrollment")
                if 'api_grade' in existing_tables:
                    safe_delete(cursor, "DELETE FROM api_grade WHERE student_id IN (SELECT id FROM users WHERE role = 'student')", "api_grade")
                if 'legacy_grade' in existing_tables:
                    safe_delete(cursor, "DELETE FROM legacy_grade WHERE student_id IN (SELECT id FROM users WHERE role = 'student')", "legacy_grade")
                if 'api_academic_risk' in existing_tables:
                    safe_delete(cursor, "DELETE FROM api_academic_risk WHERE student_id IN (SELECT id FROM users WHERE role = 'student')", "api_academic_risk")
                if 'legacy_academic_risk' in existing_tables:
                    safe_delete(cursor, "DELETE FROM legacy_academic_risk WHERE student_id IN (SELECT id FROM users WHERE role = 'student')", "legacy_academic_risk")
                if 'api_attendance' in existing_tables:
                    safe_delete(cursor, "DELETE FROM api_attendance WHERE user_id IN (SELECT id FROM users WHERE role = 'student')", "api_attendance")
                if 'legacy_attendance' in existing_tables:
                    safe_delete(cursor, "DELETE FROM legacy_attendance WHERE user_id IN (SELECT id FROM users WHERE role = 'student')", "legacy_attendance")
                if 'api_aral_activity' in existing_tables:
                    safe_delete(cursor, "DELETE FROM api_aral_activity WHERE student_id IN (SELECT id FROM users WHERE role = 'student')", "api_aral_activity")

                # 7. Edit requests and user logs
                if 'student_edit_requests' in existing_tables:
                    safe_delete(cursor, "DELETE FROM student_edit_requests WHERE student_id IN (SELECT id FROM users WHERE role = 'student')", "student_edit_requests")
                if 'audit_logs' in existing_tables:
                    safe_delete(cursor, "DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE role = 'student')", "audit_logs (student)")
                if 'django_admin_log' in existing_tables:
                    safe_delete(cursor, "DELETE FROM django_admin_log WHERE user_id IN (SELECT id FROM users WHERE role = 'student')", "django_admin_log")
                if 'accounts_emailotp' in existing_tables:
                    safe_delete(cursor, "DELETE FROM accounts_emailotp WHERE user_id IN (SELECT id FROM users WHERE role = 'student')", "accounts_emailotp")
                if 'accounts_trusteddevice' in existing_tables:
                    safe_delete(cursor, "DELETE FROM accounts_trusteddevice WHERE user_id IN (SELECT id FROM users WHERE role = 'student')", "accounts_trusteddevice")

                # 8. Token blacklist
                if 'token_blacklist_blacklistedtoken' in existing_tables and 'token_blacklist_outstandingtoken' in existing_tables:
                    safe_delete(
                        cursor,
                        "DELETE FROM token_blacklist_blacklistedtoken WHERE token_id IN (SELECT id FROM token_blacklist_outstandingtoken WHERE user_id IN (SELECT id FROM users WHERE role = 'student'))",
                        "token_blacklist_blacklistedtoken"
                    )
                if 'token_blacklist_outstandingtoken' in existing_tables:
                    safe_delete(cursor, "DELETE FROM token_blacklist_outstandingtoken WHERE user_id IN (SELECT id FROM users WHERE role = 'student')", "token_blacklist_outstandingtoken")

                # 9. Clean self-referential / tutor assignment pointers
                safe_delete(
                    cursor,
                    "UPDATE users SET assigned_tutor_id = NULL WHERE assigned_tutor_id IN (SELECT id FROM users WHERE role = 'student')",
                    "users (tutor pointer cleanup)"
                )

                # 10. Delete the student user accounts
                safe_delete(cursor, "DELETE FROM users WHERE role = 'student'", "users (students)")

        # Verify post-condition
        remaining_students = User.objects.filter(role='student').count()
        remaining_staff = User.objects.exclude(role='student').count()

        if remaining_students == 0:
            self.stdout.write(self.style.SUCCESS(f"\n[SUCCESS] All students successfully wiped! Remaining students: 0."))
            self.stdout.write(self.style.SUCCESS(f"All {remaining_staff} staff accounts remain intact."))
        else:
            self.stdout.write(self.style.ERROR(f"\n[WARNING] {remaining_students} student accounts still remain."))
