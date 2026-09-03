import os
import sys
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import User

# List of 20 realistic student profiles
STUDENTS_DATA = [
    {"first_name": "JUAN", "middle_name": "DELA", "last_name": "CRUZ", "lrn": "108923000001", "aral_level": "basic"},
    {"first_name": "MARIA", "middle_name": "SANTOS", "last_name": "REYES", "lrn": "108923000002", "aral_level": "basic"},
    {"first_name": "ANGELO", "middle_name": "GARCIA", "last_name": "RAMOS", "lrn": "108923000003", "aral_level": "plus"},
    {"first_name": "BEA", "middle_name": "MENDOZA", "last_name": "FLORES", "lrn": "108923000004", "aral_level": "basic"},
    {"first_name": "CARLOS", "middle_name": "BAUTISTA", "last_name": "GONZALES", "lrn": "108923000005", "aral_level": "plus"},
    {"first_name": "DIANA", "middle_name": "AQUINO", "last_name": "LOPEZ", "lrn": "108923000006", "aral_level": "summer"},
    {"first_name": "ETHAN", "middle_name": "CASTILLO", "last_name": "HERNANDEZ", "lrn": "108923000007", "aral_level": "basic"},
    {"first_name": "FATIMA", "middle_name": "VILLANUEVA", "last_name": "PEREZ", "lrn": "108923000008", "aral_level": "plus"},
    {"first_name": "GABRIEL", "middle_name": "FERRER", "last_name": "SANCHEZ", "lrn": "108923000009", "aral_level": "basic"},
    {"first_name": "HANNAH", "middle_name": "TORRES", "last_name": "RIVERA", "lrn": "108923000010", "aral_level": "summer"},
    {"first_name": "IAN", "middle_name": "CORPUZ", "last_name": "CASTRO", "lrn": "108923000011", "aral_level": "basic"},
    {"first_name": "JASMINE", "middle_name": "DOMINGO", "last_name": "ROXAS", "lrn": "108923000012", "aral_level": "plus"},
    {"first_name": "KEVIN", "middle_name": "NAVARRO", "last_name": "DELOS SANTOS", "lrn": "108923000013", "aral_level": "basic"},
    {"first_name": "LARA", "middle_name": "MERCADO", "last_name": "PASCUAL", "lrn": "108923000014", "aral_level": "plus"},
    {"first_name": "MIGUEL", "middle_name": "SALAZAR", "last_name": "AGUILAR", "lrn": "108923000015", "aral_level": "basic"},
    {"first_name": "NICOLE", "middle_name": "ESTRADA", "last_name": "VALENZUELA", "lrn": "108923000016", "aral_level": "summer"},
    {"first_name": "OSCAR", "middle_name": "SORIANO", "last_name": "MANALO", "lrn": "108923000017", "aral_level": "basic"},
    {"first_name": "PATRICIA", "middle_name": "OCAMPO", "last_name": "CORTEZ", "lrn": "108923000018", "aral_level": "plus"},
    {"first_name": "RAFAEL", "middle_name": "DELA ROSA", "last_name": "VILLAR", "lrn": "108923000019", "aral_level": "basic"},
    {"first_name": "SAMANTHA", "middle_name": "TOLENTINO", "last_name": "SANTIAGO", "lrn": "108923000020", "aral_level": "plus"},
]

def seed_students():
    tutors = list(User.objects.filter(role='tutor', is_superuser=False))
    print(f"Found {len(tutors)} tutors to assign students to.")
    
    created_count = 0
    updated_count = 0
    
    for i, data in enumerate(STUDENTS_DATA):
        lrn = data["lrn"]
        email = f"student-{lrn}@aralert.local"
        
        # Distribute: assign alternating tutors, leave some unassigned (None)
        assigned_tutor = None
        if tutors:
            if i % 3 == 0 and len(tutors) > 0:
                assigned_tutor = tutors[0]
            elif i % 3 == 1 and len(tutors) > 1:
                assigned_tutor = tutors[1]
            elif i % 3 == 1 and len(tutors) == 1:
                assigned_tutor = tutors[0]
            # i % 3 == 2 remains None (TBA)

        user, created = User.objects.get_or_create(
            lrn=lrn,
            defaults={
                'email': email,
                'username': email,
                'first_name': data['first_name'],
                'middle_name': data['middle_name'],
                'last_name': data['last_name'],
                'role': 'student',
                'aral_level': data['aral_level'],
                'assigned_tutor': assigned_tutor,
                'is_active': True,
            }
        )
        
        if created:
            user.set_unusable_password()
            user.save()
            created_count += 1
            print(f"Created: {user.get_full_name()} (LRN: {user.lrn}, Level: {user.aral_level}, Tutor: {assigned_tutor.get_full_name() if assigned_tutor else 'TBA'})")
        else:
            # Update fields if already exists
            user.first_name = data['first_name']
            user.middle_name = data['middle_name']
            user.last_name = data['last_name']
            user.aral_level = data['aral_level']
            user.assigned_tutor = assigned_tutor
            user.save()
            updated_count += 1
            print(f"Updated: {user.get_full_name()} (LRN: {user.lrn})")
            
    print(f"\nDone! Created {created_count} students, updated {updated_count} students. Total students in DB: {User.objects.filter(role='student').count()}")

if __name__ == '__main__':
    seed_students()
