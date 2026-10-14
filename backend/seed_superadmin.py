import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import User, AllowedEmail
from apps.academics.models import SuperAdminProfile

# Seed / Ensure SuperAdmin Accounts exist idempotently WITHOUT deleting existing users
superadmin_accounts = [
    {
        "first_name": "Leinardt",
        "middle_name": "Recoso",
        "last_name": "Omadto",
        "email": "lro2023-4992-68567@bicol-u.edu.ph",
    },
    {
        "first_name": "Nyan Jean",
        "middle_name": "Quening",
        "last_name": "Alcovindas",
        "email": "njqa2023-6375-60972@bicol-u.edu.ph",
    },
    {
        "first_name": "Jorge Benidict",
        "middle_name": "Carandang",
        "last_name": "Licup",
        "email": "jbcl2023-2689-70869@bicol-u.edu.ph",
    },
]

for admin in superadmin_accounts:
    email = admin["email"]
    fn = admin["first_name"]
    mn = admin["middle_name"]
    ln = admin["last_name"]

    superadmin_user = User.objects.filter(email__iexact=email).first()
    if not superadmin_user:
        superadmin_user = User.objects.create_superuser(
            email=email,
            first_name=fn,
            middle_name=mn,
            last_name=ln,
        )
        print(f"SuperAdmin account created: {fn} {ln} ({email})")
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
        if superadmin_user.first_name != fn:
            superadmin_user.first_name = fn
            updated = True
        if superadmin_user.middle_name != mn:
            superadmin_user.middle_name = mn
            updated = True
        if superadmin_user.last_name != ln:
            superadmin_user.last_name = ln
            updated = True
        if updated:
            superadmin_user.save()
            print(f"SuperAdmin account permissions and details updated: {fn} {ln} ({email})")
        else:
            print(f"SuperAdmin account already exists and is active: {fn} {ln} ({email})")

    SuperAdminProfile.objects.get_or_create(
        user=superadmin_user,
        defaults={"account_status": "ACTIVE"}
    )
    AllowedEmail.objects.get_or_create(
        email=email,
        defaults={"note": f"SuperAdmin Account - {fn} {ln}"}
    )

print("SuperAdmin seeding completed successfully without modifying other accounts.")

