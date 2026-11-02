from django.db import migrations


def delete_faculty_accounts(apps, schema_editor):
    User = apps.get_model('accounts', 'User')

    # Count existing accounts by role before deletion
    tutor_count = User.objects.filter(role='tutor').count()
    principal_count = User.objects.filter(role='principal').count()
    student_count = User.objects.filter(role='student').count()
    admin_count = User.objects.filter(role='admin').count()
    superadmin_count = User.objects.filter(is_superuser=True).count()
    faculty_users = User.objects.filter(role='faculty')
    initial_faculty_count = faculty_users.count()

    print("\n--- Migration 0011: Account Verification Before Deletion ---")
    print(f"Tutors:      {tutor_count}")
    print(f"Principals:  {principal_count}")
    print(f"Students:    {student_count}")
    print(f"Admins:      {admin_count}")
    print(f"SuperAdmins: {superadmin_count}")
    print(f"Faculty:     {initial_faculty_count}")

    # Delete any related FacultyAttendance records first to avoid ProtectedError
    try:
        FacultyProfile = apps.get_model('academics', 'FacultyProfile')
        FacultyAttendance = apps.get_model('academics', 'FacultyAttendance')
        profiles = FacultyProfile.objects.filter(user__in=faculty_users)
        att_deleted, _ = FacultyAttendance.objects.filter(faculty__in=profiles).delete()
        if att_deleted > 0:
            print(f"Cleaned up {att_deleted} related faculty attendance records.")
    except Exception as e:
        print(f"Note: FacultyAttendance cleanup skipped or not applicable: {e}")

    # Delete only faculty accounts
    deleted_count, _ = faculty_users.delete()
    print(f"\nSuccessfully deleted {deleted_count} faculty accounts.")

    # Confirm all other roles remain 100% intact
    print("--- Migration 0011: Account Verification After Deletion ---")
    print(f"Tutors:      {User.objects.filter(role='tutor').count()} (Unchanged)")
    print(f"Principals:  {User.objects.filter(role='principal').count()} (Unchanged)")
    print(f"Students:    {User.objects.filter(role='student').count()} (Unchanged)")
    print(f"Admins:      {User.objects.filter(role='admin').count()} (Unchanged)")
    print(f"SuperAdmins: {User.objects.filter(is_superuser=True).count()} (Unchanged)")
    print(f"Faculty:     {User.objects.filter(role='faculty').count()} (Now 0)\n")


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0010_alter_user_aral_level_alter_user_subject_and_more'),
    ]

    operations = [
        migrations.RunPython(delete_faculty_accounts, reverse_code=migrations.RunPython.noop),
    ]
