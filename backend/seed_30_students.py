import os
import sys
import uuid
import datetime
import random
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection, transaction
from apps.accounts.models import User
from apps.academics.models import (
    SchoolYear,
    StudentEnrollment,
    TutorAssignmentHistory,
    ApiAttendance,
    ApiGrade,
    ApiAcademicRisk,
    ApiAralActivity,
    SummerRecord,
)

FILIPINO_FIRST_NAMES_MALE = [
    "Juan", "Angelo", "Carlos", "Ethan", "Gabriel", "Ian", "Kevin", "Miguel", "Oscar", "Rafael",
    "Joshua", "Christian", "Mark", "Daniel", "Matthew", "John Paul", "Alexander", "Nathan", "Justin", "Francis",
    "Adrian", "Kenneth", "Dominic", "Vincent", "Paolo", "Marco", "Jerome", "Kyle", "Bryan", "Alden",
    "Elijah", "Sebastian", "Lucas", "Liam", "Oliver", "Noah", "Leo", "Tristan", "Jacob", "Aaron"
]

FILIPINO_FIRST_NAMES_FEMALE = [
    "Maria", "Bea", "Diana", "Fatima", "Hannah", "Jasmine", "Lara", "Nicole", "Patricia", "Samantha",
    "Angelica", "Alyssa", "Camille", "Denise", "Ella", "Francesca", "Giselle", "Hazel", "Isabella", "Joyce",
    "Kathleen", "Lorraine", "Marian", "Natalie", "Princess", "Rhea", "Stephanie", "Trisha", "Vanessa", "Ysabel",
    "Chloe", "Sophia", "Mia", "Andrea", "Clarisse", "Geline", "Kathryn", "Pauline", "Zoe", "Kirsten"
]

FILIPINO_MIDDLE_NAMES = [
    "Dela", "Santos", "Garcia", "Mendoza", "Bautista", "Aquino", "Castillo", "Villanueva", "Ferrer", "Torres",
    "Corpuz", "Domingo", "Navarro", "Mercado", "Salazar", "Estrada", "Soriano", "Ocampo", "Dela Rosa", "Tolentino",
    "Bernardo", "Cruz", "Reyes", "Ramos", "Flores", "Gonzales", "Lopez", "Hernandez", "Perez", "Sanchez"
]

FILIPINO_LAST_NAMES = [
    "Cruz", "Reyes", "Ramos", "Flores", "Gonzales", "Lopez", "Hernandez", "Perez", "Sanchez", "Rivera",
    "Castro", "Roxas", "Delos Santos", "Pascual", "Aguilar", "Valenzuela", "Manalo", "Cortez", "Villar", "Santiago",
    "Marquez", "Morales", "Panganiban", "Alvarez", "Guinto", "Salvador", "De Leon", "Villamor", "Serrano", "Alcantara",
    "Beltran", "Cabrera", "Dizon", "Enriquez", "Fajardo", "Guevarra", "Ignacio", "Jimenez", "Laurel", "Magbanua",
    "Nobleza", "Ortega", "Padilla", "Quizon", "Rosario", "Tan", "Umali", "Valdez", "Yambao", "Zamora"
]


def seed_fresh_data():
    print("================================================================")
    print("      ARALert Fresh Clean Seed — SY 2026–2027 (0% Baseline)     ")
    print("================================================================")

    with transaction.atomic():
        # 1. Clean previous school years and historical records
        print("[*] Wiping old school years and historical records...")
        SummerRecord.objects.all().delete()
        StudentEnrollment.objects.all().delete()
        TutorAssignmentHistory.objects.all().delete()
        ApiGrade.objects.all().delete()
        ApiAttendance.objects.all().delete()
        ApiAcademicRisk.objects.all().delete()
        ApiAralActivity.objects.all().delete()
        SchoolYear.objects.exclude(school_year='2026-2027').delete()

        # 2. Configure active SchoolYear 2026-2027
        sy, _ = SchoolYear.objects.get_or_create(
            school_year='2026-2027',
            defaults={
                'status': 'ACTIVE',
                'is_active': True,
                'start_date': datetime.date(2026, 8, 1),
                'end_date': datetime.date(2027, 6, 30),
            }
        )
        sy.status = 'ACTIVE'
        sy.is_active = True
        sy.save()
        print(f"[*] Active School Year: {sy.school_year} (status: {sy.status}, is_active: {sy.is_active})")

    # 3. Setup the 3 Tutors
    tutors_config = [
        {
            "email": "tyszlicup@gmail.com",
            "first_name": "JORGE",
            "last_name": "LICUP",
            "subject": "Reading",
            "grade_level": "Grade 7 - HYACINTH",
            "tutor_type": "basic",
        },
        {
            "email": "njqa2023-6375-60972@bicol-u.edu.ph",
            "first_name": "NYAN JEAN",
            "middle_name": "Q.",
            "last_name": "ALCOVINDAS",
            "subject": "Reading",
            "grade_level": "Grade 7 - HYACINTH",
            "tutor_type": "plus",
        },
        {
            "email": "dummy.tutor@aralert.local",
            "first_name": "MARIA CLARA",
            "middle_name": "M.",
            "last_name": "DE LOS SANTOS",
            "subject": "Reading",
            "grade_level": "Grade 7 - DAHLIA",
            "tutor_type": "summer",
        },
    ]

    tutors_objs = []
    for t_cfg in tutors_config:
        tutor, _ = User.objects.get_or_create(
            email=t_cfg["email"],
            defaults={
                "username": t_cfg["email"],
                "first_name": t_cfg["first_name"],
                "middle_name": t_cfg.get("middle_name", ""),
                "last_name": t_cfg["last_name"],
                "role": "tutor",
                "is_active": True,
            }
        )
        tutor.first_name = t_cfg["first_name"]
        tutor.middle_name = t_cfg.get("middle_name", "")
        tutor.last_name = t_cfg["last_name"]
        tutor.subject = t_cfg["subject"]
        tutor.grade_level = t_cfg["grade_level"]
        tutor.tutor_type = t_cfg["tutor_type"]
        tutor.role = "tutor"
        tutor.is_active = True
        tutor.save()
        tutors_objs.append(tutor)
        print(f"[*] Tutor Configured: {tutor.get_full_name()} | Level: {tutor.tutor_type.upper()} | Subject: {tutor.subject} | Grade/Sec: {tutor.grade_level}")

    # 4. Clean previous student users
    existing_students = list(User.objects.filter(role='student'))
    print(f"\n[*] Cleaning up {len(existing_students)} prior student accounts...")
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
            cursor.execute("DELETE FROM student_enrollment WHERE student_id = %s", [s_hex])
            cursor.execute("DELETE FROM tutor_assignment_history WHERE student_id = %s", [s_hex])
            cursor.execute("DELETE FROM audit_logs WHERE user_id = %s", [s_hex])
            cursor.execute("DELETE FROM users WHERE id = %s", [s_hex])

    # 5. Generate 30 Fresh Students per Tutor (90 Total) for SY 2026-2027
    all_seeded_students = []
    base_lrn = 108923000001
    contact_prefixes = ["0917", "0918", "0920", "0927", "0939", "0945", "0956", "0966", "0977", "0998"]

    print("\n[*] Generating 30 fresh students per tutor (90 students total)...")

    for tutor in tutors_objs:
        print(f"\n---> Seeding 30 fresh students for {tutor.get_full_name()} (0% MOSY completed)...")
        tutor_students = []

        for i in range(30):
            lrn_str = str(base_lrn)
            base_lrn += 1

            is_male = (i % 2 == 0)
            fn = FILIPINO_FIRST_NAMES_MALE[i % len(FILIPINO_FIRST_NAMES_MALE)] if is_male else FILIPINO_FIRST_NAMES_FEMALE[i % len(FILIPINO_FIRST_NAMES_FEMALE)]
            mn = FILIPINO_MIDDLE_NAMES[(i * 3 + len(tutor_students)) % len(FILIPINO_MIDDLE_NAMES)]
            ln = FILIPINO_LAST_NAMES[(i * 7 + len(tutor_students)) % len(FILIPINO_LAST_NAMES)]

            parent_fn = random.choice(FILIPINO_FIRST_NAMES_FEMALE if is_male else FILIPINO_FIRST_NAMES_MALE)
            parent_name = f"{parent_fn} {mn} {ln}"
            contact_num = f"{random.choice(contact_prefixes)}{random.randint(1000000, 9999999)}"

            aral_lvl = 'basic' if tutor.tutor_type == 'basic' else ('plus' if tutor.tutor_type == 'plus' else ('plus' if i % 2 == 0 else 'basic'))
            email = f"student-{lrn_str}@aralert.local"

            # Create Student User with fresh evaluation flags
            student = User.objects.create(
                email=email,
                username=email,
                first_name=fn.upper(),
                middle_name=mn.upper(),
                last_name=ln.upper(),
                role='student',
                aral_level=aral_lvl,
                assigned_tutor=tutor,
                lrn=lrn_str,
                grade_level=tutor.grade_level,
                parent_guardian_name=parent_name.upper(),
                contact_number=contact_num,
                is_active=True,
                has_bosy=True,
                has_mosy=False,    # Fresh start!
                has_eosy=False,
                has_summer=False,
            )
            student.set_unusable_password()
            student.save()

            # Create StudentEnrollment
            StudentEnrollment.objects.create(
                student=student,
                school_year=sy,
                grade_level=tutor.grade_level,
                program=aral_lvl,
                assigned_tutor=tutor,
                enrollment_status='active',
                mosy_result='pending',
                eosy_result='pending',
                evaluation_status='pending',
                enrollment_date=datetime.date(2026, 8, 15),
            )

            # Create TutorAssignmentHistory
            TutorAssignmentHistory.objects.create(
                student=student,
                tutor=tutor,
                school_year=sy,
                period='MOSY',
                program=aral_lvl,
                start_date=datetime.date(2026, 8, 15),
                is_active=True,
            )

            tutor_students.append(student)

        all_seeded_students.extend(tutor_students)

        # 6. Seed Baseline Attendance & Regular Classroom Activities (NO MOSY Evaluation Scores)
        day1 = datetime.date(2026, 9, 8)
        day2 = datetime.date(2026, 9, 9)

        for s_idx, st in enumerate(tutor_students):
            # Daily classroom attendance
            ApiAttendance.objects.create(
                user=st,
                tutor=tutor,
                role='student',
                date=day1,
                time_in=datetime.time(8, 0, 0),
                time_out=datetime.time(11, 30, 0),
                arrival_am=datetime.time(8, 0, 0),
                departure_am=datetime.time(11, 30, 0),
                status='present',
            )
            ApiAttendance.objects.create(
                user=st,
                tutor=tutor,
                role='student',
                date=day2,
                time_in=datetime.time(8, 5, 0),
                time_out=datetime.time(11, 30, 0),
                arrival_am=datetime.time(8, 5, 0),
                departure_am=datetime.time(11, 30, 0),
                status='present',
            )

            # Regular Classroom Activity Grade (Regular daily practice, not MOSY Evaluation)
            ApiGrade.objects.create(
                student=st,
                tutor=tutor,
                subject='Reading',
                quarter=1,
                score=random.randint(16, 20),
                total_score=20,
                component_type='assessment',
                remarks='Taken',
                date_logged=day1,
                batch_id=str(uuid.uuid4()),
                created_at=datetime.datetime(2026, 9, 8, 9, 0, 0, tzinfo=datetime.timezone(datetime.timedelta(hours=8))),
            )

        print(f"[*] Finished {tutor.get_full_name()}: 30 students assigned, 0/30 MOSY evaluated (Fresh).")

    print("\n================================================================")
    print(f"SUCCESS: Fresh Clean Seed Complete!")
    print(f"Active School Year: 2026–2027 ACTIVE")
    print(f"Total Seeded Students: {len(all_seeded_students)} (30 per tutor)")
    print(f"Tutor 1: JORGE LICUP (0/30 Evaluated - Pending)")
    print(f"Tutor 2: NYAN JEAN Q. ALCOVINDAS (0/30 Evaluated - Pending)")
    print(f"Tutor 3: MARIA CLARA M. DE LOS SANTOS (0/30 Evaluated - Pending)")
    print(f"MOSY Evaluation Progress: 0/3 Tutors Completed (3 Pending)")
    print("================================================================")


if __name__ == '__main__':
    seed_fresh_data()
