import os
import sys
import datetime
import django

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.core.management import call_command
from django.db import transaction
from apps.accounts.models import User
from apps.academics.models import SchoolYear, StudentEnrollment, TutorAssignmentHistory, ApiGrade, ApiAttendance

# 40 distinct tutor names
TUTOR_NAMES = [
    ("ALEX", "M.", "SANTOS"), ("BEA", "L.", "REYES"), ("CARLOS", "P.", "CRUZ"), ("DIANA", "R.", "BAUTISTA"),
    ("EDWARD", "V.", "GARCIA"), ("FAYE", "S.", "MENDOZA"), ("GABRIEL", "D.", "TORRES"), ("HELEN", "K.", "FLORES"),
    ("IAN", "T.", "VILLANUEVA"), ("JOYCE", "B.", "CASTILLO"), ("KENNETH", "G.", "AQUINO"), ("LARA", "C.", "LOPEZ"),
    ("MARK", "A.", "HERNANDEZ"), ("NICOLE", "E.", "PEREZ"), ("OLIVER", "J.", "SANCHEZ"), ("PATRICIA", "N.", "RIVERA"),
    ("QUINTIN", "F.", "CASTRO"), ("ROSE", "H.", "ROXAS"), ("SAMUEL", "O.", "DELOS SANTOS"), ("TANYA", "U.", "PASCUAL"),
    ("ULYSSES", "Y.", "AGUILAR"), ("VALERIE", "W.", "VALENZUELA"), ("WARREN", "Z.", "MANALO"), ("XENIA", "Q.", "CORTEZ"),
    ("YVES", "I.", "VILLAR"), ("ZARA", "X.", "SANTIAGO"), ("ADRIAN", "B.", "DE LEON"), ("BIANCA", "C.", "DELA ROSA"),
    ("CHRISTIAN", "D.", "FERRER"), ("DENISE", "E.", "DOMINGO"), ("ERIC", "F.", "NAVARRO"), ("FRANCES", "G.", "MERCADO"),
    ("GLENN", "H.", "SALAZAR"), ("HAZEL", "I.", "ESTRADA"), ("IVAN", "J.", "SORIANO"), ("JUDY", "K.", "OCAMPO"),
    ("KYLE", "L.", "TOLENTINO"), ("LEONA", "M.", "BERNARDO"), ("MARCO", "N.", "CORPUZ"), ("NADIA", "O.", "FELICIANO")
]

# 40 distinct student names
STUDENT_NAMES = [
    ("AARON", "B.", "ALVAREZ"), ("BRIDGET", "C.", "BELTRAN"), ("CEDRIC", "D.", "CABRERA"), ("DANICA", "E.", "DAVID"),
    ("ELIJAH", "F.", "ESPINOSA"), ("FLORENCE", "G.", "FRANCISCO"), ("GERARD", "H.", "GUTIERREZ"), ("HANNAH", "I.", "IGNACIO"),
    ("ISAIAH", "J.", "JAVIER"), ("JOCELYN", "K.", "LACSON"), ("KOBE", "L.", "LAGMAN"), ("LOREN", "M.", "MAGNO"),
    ("MATTEO", "N.", "MORALES"), ("NOELLE", "O.", "NATIVIDAD"), ("OWEN", "P.", "OBREGON"), ("PAULA", "Q.", "PADILLA"),
    ("QUINCY", "R.", "QUIAMBAO"), ("REINA", "S.", "RAMIREZ"), ("SETH", "T.", "SEVILLA"), ("TRISHA", "U.", "TAMAYO"),
    ("URIE", "V.", "UMALI"), ("VICTORIA", "W.", "VARGAS"), ("WESLEY", "X.", "YAP"), ("XANDER", "Y.", "ZAMORA"),
    ("YASMINE", "Z.", "ABELLA"), ("ZACK", "A.", "BALUYOT"), ("ANDREI", "B.", "CAPISTRANO"), ("CELINE", "C.", "DIMALANTA"),
    ("DOMINIC", "D.", "EVANGELISTA"), ("ELENA", "E.", "FIGUEROA"), ("FELIX", "F.", "GALANG"), ("GINA", "G.", "HENSON"),
    ("HUGO", "H.", "ILAGAN"), ("IRENE", "I.", "JACINTO"), ("JUSTIN", "J.", "KATIGBAK"), ("KLAIRE", "K.", "LAUREL"),
    ("LIAM", "L.", "MACARAIG"), ("MYRA", "M.", "NOBLEZA"), ("NATHAN", "N.", "ORDONEZ"), ("OLIVIA", "O.", "PALMA")
]

# Grade and section mapping
GRADE_SECTIONS = [
    ("7", "HYACINTH"),
    ("8", "MANGO"),
    ("9", "ROSE"),
    ("10", "SAMPAGUITA"),
]

# 10 Level-Subject Combinations
LEVEL_SUBJECT_COMBOS = [
    # Basic (3)
    ("basic", "Filipino"),
    ("basic", "Math"),
    ("basic", "Science"),
    # Plus (3)
    ("plus", "English"),
    ("plus", "Math"),
    ("plus", "Science"),
    # Summer (4)
    ("summer", "Filipino"),
    ("summer", "English"),
    ("summer", "Math"),
    ("summer", "Science"),
]


def run_seed():
    print("=" * 65)
    print("ARALert Comprehensive Matrix Seeder")
    print("=" * 65)

    # 1. Wipe non-superadmins safely
    print("\n[Step 1] Wiping existing mock users and academic data (preserving SuperAdmin)...")
    call_command('wipe_all_except_superadmin', confirm=True)

    with transaction.atomic():
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

        # 3. Seed other roles (Admin, Principal, Faculty)
        print("\n[Step 2] Seeding single administrative & staff accounts...")
        admin_user = User.objects.create(
            username='admin@deped.gov.ph',
            email='admin@deped.gov.ph',
            first_name='ARTURO',
            middle_name='C.',
            last_name='MENDOZA',
            role='admin',
            is_active=True,
        )
        admin_user.set_password('Password123!')
        admin_user.save()
        print(f"  Created Admin: {admin_user.get_full_name()} ({admin_user.email})")

        principal_user = User.objects.create(
            username='principal@deped.gov.ph',
            email='principal@deped.gov.ph',
            first_name='TERESA',
            middle_name='L.',
            last_name='VALDEZ',
            role='principal',
            is_active=True,
        )
        principal_user.set_password('Password123!')
        principal_user.save()
        print(f"  Created Principal: {principal_user.get_full_name()} ({principal_user.email})")

        faculty_user = User.objects.create(
            username='faculty@deped.gov.ph',
            email='faculty@deped.gov.ph',
            first_name='RAMON',
            middle_name='S.',
            last_name='BAUTISTA',
            role='faculty',
            is_active=True,
        )
        faculty_user.set_password('Password123!')
        faculty_user.save()
        print(f"  Created Faculty: {faculty_user.get_full_name()} ({faculty_user.email})")

        # 3. Build 40 combinations and seed tutors and students
        print("\n[Step 3] Seeding 40 Tutors and 40 Students (1 per combination)...")
        combo_index = 0

        for grade_num, section in GRADE_SECTIONS:
            grade_str = f"GRADE {grade_num} - {section}"

            for aral_lvl, subject in LEVEL_SUBJECT_COMBOS:
                combo_index += 1
                idx = combo_index - 1  # 0-39

                t_fn, t_mn, t_ln = TUTOR_NAMES[idx]
                s_fn, s_mn, s_ln = STUDENT_NAMES[idx]

                tutor_email = f"tutor.{combo_index:02d}@bicol-u.edu.ph"
                student_email = f"student.{combo_index:02d}@aralert.local"
                lrn_str = f"10892300{combo_index:04d}"

                # Create Tutor
                tutor = User.objects.create(
                    username=tutor_email,
                    email=tutor_email,
                    first_name=t_fn,
                    middle_name=t_mn,
                    last_name=t_ln,
                    role='tutor',
                    aral_level=aral_lvl,
                    tutor_type=aral_lvl,
                    subject=subject,
                    grade_level=grade_str,
                    is_active=True,
                    is_available_for_students=True,
                )
                tutor.set_password('Password123!')
                tutor.save()

                # Create Student assigned to this Tutor
                student = User.objects.create(
                    username=student_email,
                    email=student_email,
                    first_name=s_fn,
                    middle_name=s_mn,
                    last_name=s_ln,
                    role='student',
                    aral_level=aral_lvl,
                    subject=subject,
                    grade_level=grade_str,
                    assigned_tutor=tutor,
                    lrn=lrn_str,
                    parent_guardian_name=f"GUARDIAN OF {s_fn} {s_ln}",
                    contact_number=f"0917{combo_index:07d}",
                    has_bosy=True,
                    has_mosy=False,
                    has_eosy=False,
                    has_summer=False,
                    is_active=True,
                )
                student.set_unusable_password()
                student.save()

                # Create StudentEnrollment
                StudentEnrollment.objects.create(
                    student=student,
                    school_year=sy,
                    grade_level=grade_str,
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
                )

                # Create Baseline Grade (BOSY)
                base_score = 20 + (combo_index % 16)  # score between 20 and 35
                ApiGrade.objects.create(
                    student=student,
                    tutor=tutor,
                    subject=subject,
                    quarter=1,
                    score=base_score,
                    total_score=40,
                    component_type='assessment',
                    remarks='Initial Diagnostic Assessment (BOSY)',
                    date_logged=datetime.date(2026, 8, 20),
                )

                # Create Sample Attendance Record
                ApiAttendance.objects.create(
                    user=student,
                    tutor=tutor,
                    role='student',
                    date=datetime.date(2026, 8, 22),
                    status='present',
                )

                print(
                    f"  [{combo_index:02d}/40] {grade_str} | {aral_lvl.upper():6} | {subject:8} "
                    f"-> Student: {student.get_full_name()} (LRN: {student.lrn}) "
                    f"<=> Tutor: {tutor.get_full_name()}"
                )

    print("\n" + "=" * 65)
    print("Seeding completed successfully!")
    print(f"Total Users in DB: {User.objects.count()}")
    print(f"  - SuperAdmins: {User.objects.filter(is_superuser=True).count()}")
    print(f"  - Admins:      {User.objects.filter(role='admin', is_superuser=False).count()}")
    print(f"  - Principals:  {User.objects.filter(role='principal').count()}")
    print(f"  - Faculty:     {User.objects.filter(role='faculty').count()}")
    print(f"  - Tutors:      {User.objects.filter(role='tutor').count()}")
    print(f"  - Students:    {User.objects.filter(role='student').count()}")
    print("=" * 65)


if __name__ == '__main__':
    run_seed()
