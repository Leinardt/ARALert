"""
Comprehensive tests for MOSY/EOSY Evaluation, Progression, Compatibility, Transition, Archive, and Summer Remediation.
"""

from decimal import Decimal
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.academics.models import (
    SchoolYear,
    StudentEnrollment,
    TutorAssignmentHistory,
    SummerRecord,
    TransitionAuditLog,
    ApiGrade,
)
from services.tutor_service import (
    validate_tutor_compatibility,
    assign_tutor_to_student,
    get_available_tutors_data,
)
from services.mosy_service import (
    get_mosy_monitoring_data,
    process_mosy_completion,
    get_mosy_assignment_dashboard_data,
)
from services.transition_service import (
    get_eosy_monitoring_data,
    get_transition_summary_preview,
    execute_school_year_transition,
)
from services.summer_service import (
    count_historical_basic_failures,
    record_summer_evaluation,
    start_summer_participation,
)


from django.db import connection


class EvaluationWorkflowTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        with connection.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS "api_grade" (
                    "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
                    "subject" varchar(100) NOT NULL,
                    "quarter" integer NOT NULL,
                    "score" decimal NOT NULL,
                    "total_score" decimal NOT NULL,
                    "component_type" varchar(20) NOT NULL,
                    "remarks" text NULL,
                    "date_logged" date NOT NULL,
                    "batch_id" varchar(50) NOT NULL,
                    "student_id" char(32) NOT NULL REFERENCES "users" ("id") DEFERRABLE INITIALLY DEFERRED,
                    "tutor_id" char(32) NULL REFERENCES "users" ("id") DEFERRABLE INITIALLY DEFERRED,
                    "created_at" datetime
                )
            """)

    @classmethod
    def tearDownClass(cls):
        with connection.cursor() as cursor:
            cursor.execute('DROP TABLE IF EXISTS "api_grade"')
        super().tearDownClass()

    def setUp(self):
        self.client = APIClient()

        # Admin user
        self.admin = User.objects.create(
            email='admin@test.com',
            username='admin@test.com',
            first_name='ADMIN',
            last_name='USER',
            role='admin',
            is_active=True,
        )

        # Tutors
        self.basic_tutor = User.objects.create(
            email='basic_tutor@test.com',
            username='basic_tutor@test.com',
            first_name='BASIC',
            last_name='TUTOR',
            role='tutor',
            tutor_type='basic',
            is_active=True,
        )

        self.plus_tutor = User.objects.create(
            email='plus_tutor@test.com',
            username='plus_tutor@test.com',
            first_name='PLUS',
            last_name='TUTOR',
            role='tutor',
            tutor_type='plus',
            is_active=True,
        )

        self.both_tutor = User.objects.create(
            email='both_tutor@test.com',
            username='both_tutor@test.com',
            first_name='BOTH',
            last_name='TUTOR',
            role='tutor',
            tutor_type='basic_plus',
            is_active=True,
        )

        # Students
        self.student_basic = User.objects.create(
            email='student_basic@test.com',
            username='student_basic@test.com',
            first_name='PEDRO',
            last_name='CRUZ',
            lrn='123456789001',
            role='student',
            aral_level='basic',
            assigned_tutor=self.basic_tutor,
            is_active=True,
        )

        self.student_plus = User.objects.create(
            email='student_plus@test.com',
            username='student_plus@test.com',
            first_name='JUAN',
            last_name='DELA CRUZ',
            lrn='123456789002',
            role='student',
            aral_level='plus',
            assigned_tutor=self.plus_tutor,
            is_active=True,
        )

        # Active School Year
        self.sy = SchoolYear.objects.create(
            school_year='2025-2026',
            status='ACTIVE',
            is_active=True,
        )

        # Initial enrollments
        self.enr_basic = StudentEnrollment.objects.create(
            student=self.student_basic,
            school_year=self.sy,
            program='basic',
            assigned_tutor=self.basic_tutor,
            enrollment_status='active',
        )

        self.enr_plus = StudentEnrollment.objects.create(
            student=self.student_plus,
            school_year=self.sy,
            program='plus',
            assigned_tutor=self.plus_tutor,
            enrollment_status='active',
        )

    def test_tutor_compatibility_rules(self):
        """Test strict compatibility enforcement (backend)."""
        # Basic Tutor + Basic Student -> ALLOWED
        validate_tutor_compatibility(self.basic_tutor, 'basic')

        # Basic Tutor + Plus Student -> NOT ALLOWED
        with self.assertRaises(ValidationError):
            validate_tutor_compatibility(self.basic_tutor, 'plus')

        # Plus Tutor + Basic Student -> NOT ALLOWED
        with self.assertRaises(ValidationError):
            validate_tutor_compatibility(self.plus_tutor, 'basic')

        # Plus Tutor + Plus Student -> ALLOWED
        validate_tutor_compatibility(self.plus_tutor, 'plus')

        # Basic & Plus Tutor + Basic Student -> ALLOWED
        validate_tutor_compatibility(self.both_tutor, 'basic')

        # Basic & Plus Tutor + Plus Student -> ALLOWED
        validate_tutor_compatibility(self.both_tutor, 'plus')

    def test_assign_tutor_history_preservation(self):
        """Test that assigning a new tutor does not overwrite historical records."""
        assign_tutor_to_student(
            student=self.student_basic,
            tutor=self.both_tutor,
            school_year=self.sy,
            assigned_by=self.admin,
            period='MOSY',
        )

        self.student_basic.refresh_from_db()
        self.assertEqual(self.student_basic.assigned_tutor, self.both_tutor)

        histories = TutorAssignmentHistory.objects.filter(student=self.student_basic)
        self.assertTrue(histories.filter(tutor=self.both_tutor, is_active=True).exists())

    def test_no_capacity_limits_in_available_tutors(self):
        """Verify available tutors tracking has no capacity or vacant slot numbers."""
        data = get_available_tutors_data()
        self.assertGreaterEqual(len(data), 3)
        for t in data:
            self.assertIn('current_students_count', t)
            self.assertIn('is_available', t)
            self.assertNotIn('capacity', t)
            self.assertNotIn('vacant_slots', t)
            self.assertNotIn('max_students', t)

    def test_mosy_completion_logic(self):
        """
        Test MOSY completion:
        - Plus student becomes Unassigned awaiting Plus tutor.
        - Basic student retains existing compatible Basic tutor.
        """
        # Seed MOSY grades
        ApiGrade.objects.create(
            student=self.student_basic,
            tutor=self.basic_tutor,
            subject='MOSY Reading',
            quarter=2,
            score=Decimal('25.00'),  # Failed MOSY -> Retains Basic
            total_score=Decimal('40.00'),
            date_logged=timezone.localdate(),
        )

        ApiGrade.objects.create(
            student=self.student_plus,
            tutor=self.plus_tutor,
            subject='MOSY Reading',
            quarter=2,
            score=Decimal('35.00'),
            total_score=Decimal('40.00'),
            date_logged=timezone.localdate(),
        )

        # Trigger MOSY completion
        res = process_mosy_completion(admin_user=self.admin)
        self.assertEqual(res['status'], 'SUCCESS')

        self.student_plus.refresh_from_db()
        self.student_basic.refresh_from_db()

        # Plus student should become Unassigned
        self.assertIsNone(self.student_plus.assigned_tutor)
        self.assertEqual(self.student_plus.aral_level, 'plus')

        # Basic student should remain with Basic tutor
        self.assertEqual(self.student_basic.assigned_tutor, self.basic_tutor)

    def test_eosy_gate_blocks_incomplete_evaluations(self):
        """Starting new school year must be rejected if EOSY evaluations are incomplete."""
        self.client.force_authenticate(user=self.admin)

        # Attempt transition with no EOSY grades
        response = self.client.post('/api/academics/evaluations/start-new-school-year/')
        self.assertEqual(response.status_code, 400)
        self.assertIn('All required EOSY evaluations must be completed first', response.data['error'])

    def test_atomic_school_year_transition_and_summer(self):
        """
        Test full 11-step transition when 100% EOSY evaluations are completed:
        1. student_basic fails EOSY for the 2nd time -> Summer Required.
        2. student_plus passes EOSY -> Graduated.
        3. A new student_basic_pass passes EOSY -> Promoted to Plus.
        """
        # Create student who passes Basic
        student_basic_pass = User.objects.create(
            email='basic_pass@test.com',
            username='basic_pass@test.com',
            first_name='MARIA',
            last_name='SANTOS',
            lrn='123456789003',
            role='student',
            aral_level='basic',
            assigned_tutor=self.basic_tutor,
            is_active=True,
        )
        StudentEnrollment.objects.create(
            student=student_basic_pass,
            school_year=self.sy,
            program='basic',
            assigned_tutor=self.basic_tutor,
            enrollment_status='active',
        )

        # Seed 1 prior historical failure for student_basic in 2024-2025
        past_sy = SchoolYear.objects.create(school_year='2024-2025', status='ARCHIVED', is_active=False)
        StudentEnrollment.objects.create(
            student=self.student_basic,
            school_year=past_sy,
            program='basic',
            eosy_result='failed',
            enrollment_status='completed',
        )

        # Seed 100% EOSY grades for current year 2025-2026:
        # student_basic fails (2nd fail -> Summer Required)
        ApiGrade.objects.create(
            student=self.student_basic,
            tutor=self.basic_tutor,
            subject='EOSY Reading',
            quarter=4,
            score=Decimal('20.00'),
            total_score=Decimal('40.00'),
            date_logged=timezone.localdate(),
        )

        # student_plus passes (Plus Passed -> Graduated)
        ApiGrade.objects.create(
            student=self.student_plus,
            tutor=self.plus_tutor,
            subject='EOSY Reading',
            quarter=4,
            score=Decimal('35.00'),
            total_score=Decimal('40.00'),
            date_logged=timezone.localdate(),
        )

        # student_basic_pass passes (Basic Passed -> Plus)
        ApiGrade.objects.create(
            student=student_basic_pass,
            tutor=self.basic_tutor,
            subject='EOSY Reading',
            quarter=4,
            score=Decimal('32.00'),
            total_score=Decimal('40.00'),
            date_logged=timezone.localdate(),
        )

        # Verify monitoring says ready
        monitoring = get_eosy_monitoring_data(self.sy)
        self.assertTrue(monitoring['can_transition'])

        # Execute 11-step transition
        result = execute_school_year_transition(admin_user=self.admin)
        self.assertEqual(result['status'], 'SUCCESS')

        # Check outcomes:
        self.student_basic.refresh_from_db()
        self.student_plus.refresh_from_db()
        student_basic_pass.refresh_from_db()

        # 1. student_basic should have a SummerRecord created (2nd failure)
        summer_rec = SummerRecord.objects.filter(student=self.student_basic).first()
        self.assertIsNotNone(summer_rec)
        self.assertEqual(summer_rec.reason, SummerRecord.Reason.BASIC_FAILED_TWICE)

        # 2. student_plus should be Graduated with no active new enrollment
        self.assertEqual(self.student_plus.aral_level, 'graduated')
        new_sy = SchoolYear.objects.get(school_year='2026-2027')
        self.assertFalse(StudentEnrollment.objects.filter(student=self.student_plus, school_year=new_sy).exists())

        # 3. student_basic_pass should be in Plus with active enrollment in 2026-2027
        self.assertEqual(student_basic_pass.aral_level, 'plus')
        enr_new = StudentEnrollment.objects.filter(student=student_basic_pass, school_year=new_sy).first()
        self.assertIsNotNone(enr_new)
        self.assertEqual(enr_new.program, 'plus')

        # 4. Old school year should be ARCHIVED
        self.sy.refresh_from_db()
        self.assertEqual(self.sy.status, 'ARCHIVED')
        self.assertFalse(self.sy.is_active)

        # 5. Transition Audit Log created
        audit = TransitionAuditLog.objects.filter(new_school_year='2026-2027').first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.transition_result, 'SUCCESS')

    def test_summer_lifecycle_and_evaluation(self):
        """Test Summer participation start and evaluation recording."""
        summer_rec = SummerRecord.objects.create(
            student=self.student_basic,
            previous_program='basic',
            previous_school_year='2025-2026',
            reason=SummerRecord.Reason.BASIC_FAILED_TWICE,
            summer_status=SummerRecord.Status.REQUIRED,
        )

        # Start participation
        start_summer_participation(summer_rec.id)
        summer_rec.refresh_from_db()
        self.assertEqual(summer_rec.summer_status, 'summer_active')

        # Record evaluation as passed
        record_summer_evaluation(summer_rec.id, result='passed', evaluator=self.basic_tutor)
        summer_rec.refresh_from_db()
        self.assertEqual(summer_rec.summer_status, 'summer_passed')
        self.assertEqual(summer_rec.summer_result, 'passed')
        self.assertEqual(summer_rec.evaluating_tutor, self.basic_tutor)
