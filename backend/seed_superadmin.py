import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import User, AuditLog, EmailOTP, TrustedDevice, AllowedEmail
from apps.academics.models import (
    SuperAdminProfile, AdminProfile, PrincipalProfile, TutorProfile, FacultyProfile, Student,
    AralEnrollment, TutorAttendance, FacultyAttendance, StudentAttendance, MosyGrade, EosyGrade,
    AssessmentScore, AssessScoreSummary, StudentAttSummary, Report, Prediction, TutorAlert,
    PrincipalAlert, StudentAlert, UserActivityLog
)

print("Deleting all existing data for a fresh start...")

# Clear all academic records & activity logs
UserActivityLog.objects.all().delete()
StudentAlert.objects.all().delete()
PrincipalAlert.objects.all().delete()
TutorAlert.objects.all().delete()
Prediction.objects.all().delete()
Report.objects.all().delete()
StudentAttSummary.objects.all().delete()
AssessScoreSummary.objects.all().delete()
AssessmentScore.objects.all().delete()
EosyGrade.objects.all().delete()
MosyGrade.objects.all().delete()
StudentAttendance.objects.all().delete()
FacultyAttendance.objects.all().delete()
TutorAttendance.objects.all().delete()
AralEnrollment.objects.all().delete()

# Delete role profiles
Student.objects.all().delete()
FacultyProfile.objects.all().delete()
TutorProfile.objects.all().delete()
PrincipalProfile.objects.all().delete()
AdminProfile.objects.all().delete()
SuperAdminProfile.objects.all().delete()

# Delete user accounts and logs
AuditLog.objects.all().delete()
EmailOTP.objects.all().delete()
TrustedDevice.objects.all().delete()
User.objects.all().delete()

print("All user accounts deleted successfully.")

# Seed SuperAdmin Account
superadmin_email = "lro2023-4992-68567@bicol-u.edu.ph"

superadmin_user = User.objects.create_superuser(
    email=superadmin_email,
    first_name="SUPER",
    last_name="ADMIN",
)

SuperAdminProfile.objects.create(
    user=superadmin_user,
    account_status="ACTIVE",
)

print(f"SuperAdmin account seeded successfully:")
print(f"  Email: {superadmin_user.email}")
print(f"  Role: SuperAdmin (is_superuser=True)")
print(f"  Auth Method: Google OAuth (bicol-u.edu.ph domain)")
