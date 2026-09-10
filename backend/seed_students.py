import os
import sys
import uuid
import datetime
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import User
from apps.academics.models import ApiAttendance, ApiGrade
from django.db import connection, transaction

# List of 20 realistic student profiles
STUDENTS_DATA = [
    {"first_name": "JUAN", "middle_name": "DELA", "last_name": "CRUZ", "lrn": "108923000001", "aral_level": "basic"},
    {"first_name": "MARIA", "middle_name": "SANTOS", "last_name": "REYES", "lrn": "108923000002", "aral_level": "basic"},
    {"first_name": "ANGELO", "middle_name": "GARCIA", "last_name": "RAMOS", "lrn": "108923000003", "aral_level": "basic"},
    {"first_name": "BEA", "middle_name": "MENDOZA", "last_name": "FLORES", "lrn": "108923000004", "aral_level": "basic"},
    {"first_name": "CARLOS", "middle_name": "BAUTISTA", "last_name": "GONZALES", "lrn": "108923000005", "aral_level": "basic"},
    {"first_name": "DIANA", "middle_name": "AQUINO", "last_name": "LOPEZ", "lrn": "108923000006", "aral_level": "basic"},
    {"first_name": "ETHAN", "middle_name": "CASTILLO", "last_name": "HERNANDEZ", "lrn": "108923000007", "aral_level": "basic"},
    {"first_name": "FATIMA", "middle_name": "VILLANUEVA", "last_name": "PEREZ", "lrn": "108923000008", "aral_level": "basic"},
    {"first_name": "GABRIEL", "middle_name": "FERRER", "last_name": "SANCHEZ", "lrn": "108923000009", "aral_level": "basic"},
    {"first_name": "HANNAH", "middle_name": "TORRES", "last_name": "RIVERA", "lrn": "108923000010", "aral_level": "basic"},
    {"first_name": "IAN", "middle_name": "CORPUZ", "last_name": "CASTRO", "lrn": "108923000011", "aral_level": "basic"},
    {"first_name": "JASMINE", "middle_name": "DOMINGO", "last_name": "ROXAS", "lrn": "108923000012", "aral_level": "basic"},
    {"first_name": "KEVIN", "middle_name": "NAVARRO", "last_name": "DELOS SANTOS", "lrn": "108923000013", "aral_level": "basic"},
    {"first_name": "LARA", "middle_name": "MERCADO", "last_name": "PASCUAL", "lrn": "108923000014", "aral_level": "basic"},
    {"first_name": "MIGUEL", "middle_name": "SALAZAR", "last_name": "AGUILAR", "lrn": "108923000015", "aral_level": "basic"},
    {"first_name": "NICOLE", "middle_name": "ESTRADA", "last_name": "VALENZUELA", "lrn": "108923000016", "aral_level": "basic"},
    {"first_name": "OSCAR", "middle_name": "SORIANO", "last_name": "MANALO", "lrn": "108923000017", "aral_level": "basic"},
    {"first_name": "PATRICIA", "middle_name": "OCAMPO", "last_name": "CORTEZ", "lrn": "108923000018", "aral_level": "basic"},
    {"first_name": "RAFAEL", "middle_name": "DELA ROSA", "last_name": "VILLAR", "lrn": "108923000019", "aral_level": "basic"},
    {"first_name": "SAMANTHA", "middle_name": "TOLENTINO", "last_name": "SANTIAGO", "lrn": "108923000020", "aral_level": "basic"},
]


def seed_students():
    # 1. Locate target tutor
    tutor = User.objects.filter(role='tutor', email='njqa2023-6375-60972@bicol-u.edu.ph').first()
    if not tutor:
        tutor = User.objects.filter(role='tutor', first_name__icontains='NYAN JEAN').first()
    if not tutor:
        print("ERROR: Tutor NYAN JEAN Q. ALCOVINDAS not found!")
        sys.exit(1)

    print(f"Target Tutor found: {tutor.get_full_name()} ({tutor.email}, ID: {tutor.id})")
    if tutor.subject != 'Reading':
        tutor.subject = 'Reading'
        tutor.save(update_fields=['subject'])

    # 2. Delete all existing student accounts and dependent records
    existing_students = list(User.objects.filter(role='student'))
    print(f"Found {len(existing_students)} existing student accounts to remove...")

    with transaction.atomic():
        cursor = connection.cursor()
        for s in existing_students:
            s_hex = s.id.hex
            cursor.execute("DELETE FROM token_blacklist_blacklistedtoken WHERE token_id IN (SELECT id FROM token_blacklist_outstandingtoken WHERE user_id = %s)", [s_hex])
            cursor.execute("DELETE FROM token_blacklist_outstandingtoken WHERE user_id = %s", [s_hex])
            cursor.execute("DELETE FROM api_grade WHERE student_id = %s", [s_hex])
            cursor.execute("DELETE FROM api_attendance WHERE user_id = %s", [s_hex])
            cursor.execute("DELETE FROM api_academic_risk WHERE student_id = %s", [s_hex])
            cursor.execute("DELETE FROM api_aral_activity WHERE student_id = %s", [s_hex])
            cursor.execute("DELETE FROM audit_logs WHERE user_id = %s", [s_hex])
            cursor.execute("DELETE FROM users WHERE id = %s", [s_hex])

    remaining = User.objects.filter(role='student').count()
    print(f"Cleaned up all prior student records. Remaining students in DB: {remaining}")

    # 3. Seed 20 new student accounts assigned to NYAN JEAN Q. ALCOVINDAS
    created_students = []
    for data in STUDENTS_DATA:
        lrn = data["lrn"]
        email = f"student-{lrn}@aralert.local"

        user = User.objects.create(
            email=email,
            username=email,
            first_name=data['first_name'],
            middle_name=data['middle_name'],
            last_name=data['last_name'],
            role='student',
            aral_level=data['aral_level'],
            assigned_tutor=tutor,
            lrn=lrn,
            is_active=True,
        )
        user.set_unusable_password()
        user.save()
        created_students.append(user)
        print(f"Created Student: {user.get_full_name()} (LRN: {user.lrn}, Level: {user.aral_level})")

    print(f"\nSuccessfully seeded {len(created_students)} student accounts for tutor {tutor.get_full_name()}!")

    # 4. Seed Attendance Records for 2 Separate Days per Student (40 records total)
    # Day 1: 2026-09-08
    # Day 2: 2026-09-09
    day1 = datetime.date(2026, 9, 8)
    day2 = datetime.date(2026, 9, 9)

    print("\nSeeding attendance records for Day 1 (2026-09-08) and Day 2 (2026-09-09)...")
    att_count = 0

    for idx, student in enumerate(created_students):
        # Day 1 attendance: 18 present, 2 late
        if idx in (3, 12):
            status1 = 'late'
            time_in_1 = datetime.time(8, 25, 0)
        else:
            status1 = 'present'
            time_in_1 = datetime.time(8, 0, 0)

        ApiAttendance.objects.create(
            user=student,
            tutor=tutor,
            role='student',
            date=day1,
            time_in=time_in_1,
            time_out=datetime.time(11, 30, 0),
            arrival_am=time_in_1,
            departure_am=datetime.time(11, 30, 0),
            status=status1,
        )
        att_count += 1

        # Day 2 attendance: 18 present, 1 late, 1 absent
        if idx == 7:
            status2 = 'late'
            time_in_2 = datetime.time(8, 20, 0)
        elif idx == 15:
            status2 = 'absent'
            time_in_2 = None
        else:
            status2 = 'present'
            time_in_2 = datetime.time(8, 2, 0)

        ApiAttendance.objects.create(
            user=student,
            tutor=tutor,
            role='student',
            date=day2,
            time_in=time_in_2,
            time_out=datetime.time(11, 30, 0) if time_in_2 else None,
            arrival_am=time_in_2,
            departure_am=datetime.time(11, 30, 0) if time_in_2 else None,
            status=status2,
        )
        att_count += 1

    print(f"Seeded {att_count} attendance records (20 for Sep 8, 20 for Sep 9).")

    # 5. Seed Score Entries for 2 Separate Days per Student (40 records total)
    # Day 1: 2026-09-08, Subject: "Reading", Total Score: 20, Batch 1
    # Day 2: 2026-09-09, Subject: "Intervention Activity", Total Score: 25, Batch 2
    batch1_id = str(uuid.uuid4())
    batch2_id = str(uuid.uuid4())

    # Realistic varied scores
    day1_scores = [18, 19, 15, 17, 20, 14, 18, 19, 16, 20, 15, 18, 17, 19, 16, 14, 20, 18, 19, 17]
    day2_scores = [23, 24, 19, 21, 25, 18, 22, 24, 20, 25, 19, 23, 22, 24, 21, 18, 25, 23, 24, 22]

    print("\nSeeding score entries for Day 1 (Reading) and Day 2 (Intervention Activity)...")
    score_count = 0

    for idx, student in enumerate(created_students):
        # Day 1 score entry
        ApiGrade.objects.create(
            student=student,
            tutor=tutor,
            subject='Reading',
            quarter=1,
            score=day1_scores[idx],
            total_score=20,
            component_type='assessment',
            remarks='Taken',
            date_logged=day1,
            batch_id=batch1_id,
            created_at=datetime.datetime(2026, 9, 8, 8, 30, 0, tzinfo=datetime.timezone(datetime.timedelta(hours=8))),
        )
        score_count += 1

        # Day 2 score entry
        ApiGrade.objects.create(
            student=student,
            tutor=tutor,
            subject='Intervention Activity',
            quarter=1,
            score=day2_scores[idx],
            total_score=25,
            component_type='assessment',
            remarks='Taken',
            date_logged=day2,
            batch_id=batch2_id,
            created_at=datetime.datetime(2026, 9, 9, 9, 15, 0, tzinfo=datetime.timezone(datetime.timedelta(hours=8))),
        )
        score_count += 1

    print(f"Seeded {score_count} score entries (Batch 1: Sep 8 Reading, Batch 2: Sep 9 Intervention Activity).")
    print("\nAll student accounts, attendance records, and score entries successfully seeded!")


if __name__ == '__main__':
    seed_students()
