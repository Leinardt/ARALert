import sys
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds initial users for ARALert (SuperAdmin, Admin, Principal, Faculty, Tutor, Student)'

    def handle(self, *args, **options):
        self.stdout.write('Seeding database...')

        # Seed 1 SuperAdmin
        superadmin_username = 'superadmin'
        superadmin_email = 'superadmin@aralert.com'
        superadmin_password = 'SuperAdmin@123!'

        if not User.objects.filter(is_superuser=True).exists():
            User.objects.create_superuser(
                username=superadmin_username,
                email=superadmin_email,
                password=superadmin_password,
                first_name='System',
                last_name='Administrator'
            )
            self.stdout.write(self.style.SUCCESS(f'SuperAdmin created: {superadmin_username} / {superadmin_password}'))
        else:
            self.stdout.write('SuperAdmin already exists.')

        # Seed other application roles
        roles_to_seed = [
            {
                'username': 'admin_user',
                'email': 'admin@aralert.com',
                'role': 'admin',
                'first_name': 'School',
                'last_name': 'Admin',
                'password': 'Admin@123!'
            },
            {
                'username': 'principal_user',
                'email': 'principal@aralert.com',
                'role': 'principal',
                'first_name': 'Jane',
                'last_name': 'Doe',
                'password': 'Principal@123!'
            },
            {
                'username': 'faculty_user',
                'email': 'faculty@aralert.com',
                'role': 'faculty',
                'first_name': 'John',
                'last_name': 'Smith',
                'password': 'Faculty@123!'
            },
            {
                'username': 'tutor_user',
                'email': 'tutor@aralert.com',
                'role': 'tutor',
                'first_name': 'Mary',
                'last_name': 'Jane',
                'password': 'Tutor@123!'
            },
            {
                'username': 'student_user',
                'email': 'student@aralert.com',
                'role': 'student',
                'first_name': 'Bob',
                'last_name': 'Builder',
                'password': 'Student@123!'
            }
        ]

        for role_data in roles_to_seed:
            username = role_data['username']
            email = role_data['email']
            role = role_data['role']
            first_name = role_data['first_name']
            last_name = role_data['last_name']
            password = role_data['password']

            if not User.objects.filter(username=username).exists():
                User.objects.create_user(
                    username=username,
                    email=email,
                    password=password,
                    role=role,
                    first_name=first_name,
                    last_name=last_name,
                    is_active=True
                )
                self.stdout.write(self.style.SUCCESS(f'{role.capitalize()} created: {username} / {password}'))
            else:
                self.stdout.write(f'{role.capitalize()} user already exists.')

        self.stdout.write(self.style.SUCCESS('Database seeding completed successfully.'))
