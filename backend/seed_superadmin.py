import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import User, AllowedEmail
from apps.academics.models import SuperAdminProfile

# Seed / Ensure SuperAdmin Accounts exist idempotently WITHOUT deleting existing users
superadmin_emails = [
    ("lro2023-4992-68567@bicol-u.edu.ph", "SUPER", "ADMIN"),
]

for email, fn, ln in superadmin_emails:
    superadmin_user = User.objects.filter(email__iexact=email).first()
    if not superadmin_user:
        superadmin_user = User.objects.create_superuser(
            email=email,
            first_name=fn,
            last_name=ln,
        )
        print(f"SuperAdmin account created: {email}")
    else:
        updated = False
        if not superadmin_user.is_superuser:
            superadmin_user.is_superuser = True
            updated = True
        if not superadmin_user.is_staff:
            superadmin_user.is_staff = True
            updated = True
        if not superadmin_user.is_active:
            superadmin_user.is_active = True
            updated = True
        if updated:
            superadmin_user.save(update_fields=['is_superuser', 'is_staff', 'is_active'])
            print(f"SuperAdmin account permissions verified/updated: {email}")
        else:
            print(f"SuperAdmin account already exists and is active: {email}")

    SuperAdminProfile.objects.get_or_create(
        user=superadmin_user,
        defaults={"account_status": "ACTIVE"}
    )
    AllowedEmail.objects.get_or_create(
        email=email,
        defaults={"note": "SuperAdmin Account"}
    )

print("SuperAdmin seeding completed successfully without modifying other accounts.")

