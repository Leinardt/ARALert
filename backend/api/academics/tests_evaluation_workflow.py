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
    assign_students_to_tutor_bulk,
    get_tutor_cohort_history,
)
from services.mosy_service import (
    get_mosy_monitoring_data,
    process_mosy_completion,
    get_mosy_assignment_dashboard_data,
    get_unified_assignment_queue,
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

        self.summer_tutor = User.objects.create(
            email='summer_tutor@test.com',
            username='summer_tutor@test.com',
            first_name='SUMMER',
            last_name='TUTOR',
            role='tutor',
            tutor_type='summer',
            is_active=True,
        )

        self.second_basic_tutor = User.objects.create(
            email='second_basic_tutor@test.com',
            username='second_basic_tutor@test.com',
            first_name='SECOND',
            last_name='BASIC TUTOR',
            role='tutor',
            tutor_type='basic',
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
        """Test strict single ARAL level compatibility enforcement (backend)."""
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

    def test_assign_tutor_history_preservation(self):
        """Test that assigning a new tutor does not overwrite historical records."""
        assign_tutor_to_student(
            student=self.student_basic,
            tutor=self.second_basic_tutor,
            school_year=self.sy,
            assigned_by=self.admin,
            period='MOSY',
        )

        self.student_basic.refresh_from_db()
        self.assertEqual(self.student_basic.assigned_tutor, self.second_basic_tutor)

        histories = TutorAssignmentHistory.objects.filter(student=self.student_basic)
        self.assertTrue(histories.filter(tutor=self.second_basic_tutor, is_active=True).exists())

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
        Test MOSY completion Clean-Slate Model:
        - All student-tutor pairings concluded with period='MOSY'.
        - Both leveled-up and retake students become Unassigned for Admin reassignment.
        - All tutors reset to 0/25 vacant.
        """
        # Seed MOSY grades
        ApiGrade.objects.create(
            student=self.student_basic,
            tutor=self.basic_tutor,
            subject='MOSY Reading',
            quarter=2,
            score=Decimal('25.00'),  # Failed MOSY (<28/40) -> Retains Basic
            total_score=Decimal('40.00'),
            date_logged=timezone.localdate(),
        )

        ApiGrade.objects.create(
            student=self.student_plus,
            tutor=self.plus_tutor,
            subject='MOSY Reading',
            quarter=2,
            score=Decimal('35.00'),  # Passed MOSY (>=28/40) -> Promoted to Plus
            total_score=Decimal('40.00'),
            date_logged=timezone.localdate(),
        )

        # Trigger MOSY completion
        res = process_mosy_completion(admin_user=self.admin)
        self.assertEqual(res['status'], 'SUCCESS')

        self.student_plus.refresh_from_db()
        self.student_basic.refresh_from_db()

        # Plus student should become Unassigned for Admin reassignment
        self.assertIsNone(self.student_plus.assigned_tutor)
        self.assertEqual(self.student_plus.aral_level, 'plus')

        # Basic student should also become Unassigned under Clean-Slate Model
        self.assertIsNone(self.student_basic.assigned_tutor)
        self.assertEqual(self.student_basic.aral_level, 'basic')

        # Historical assignment records preserved with period='MOSY'
        histories = TutorAssignmentHistory.objects.filter(student=self.student_basic, period='MOSY')
        self.assertTrue(histories.exists())
        self.assertFalse(histories.first().is_active)

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

    def test_unified_assignment_queue_and_bulk_dispatch(self):
        """Test unified assignment queue returns all unassigned students and bulk cohort dispatch works."""
        # Setup student state
        self.student_basic.assigned_tutor = None
        self.student_basic.aral_level = 'basic'
        self.student_basic.save()

        self.student_plus.assigned_tutor = None
        self.student_plus.aral_level = 'plus'
        self.student_plus.save()

        # 1. Test Unified Queue
        queue = get_unified_assignment_queue(self.sy)
        self.assertGreaterEqual(queue['total_unassigned'], 2)
        plus_ids = [s['id'] for s in queue['plus_queue']]
        basic_ids = [s['id'] for s in queue['basic_queue']]
        self.assertIn(str(self.student_plus.id), plus_ids)
        self.assertIn(str(self.student_basic.id), basic_ids)

        # 2. Test Bulk Cohort Assignment
        dispatch = assign_students_to_tutor_bulk(
            student_ids=[str(self.student_basic.id)],
            tutor_id=str(self.basic_tutor.id),
            period='MOSY',
            notes='Test Cohort Dispatch',
        )
        self.assertEqual(dispatch['total_assigned'], 1)
        self.assertEqual(dispatch['total_skipped'], 0)

        self.student_basic.refresh_from_db()
        self.assertEqual(self.student_basic.assigned_tutor, self.basic_tutor)

        # 3. Test Tutor Cohort History
        history_data = get_tutor_cohort_history(str(self.basic_tutor.id))
        self.assertEqual(history_data['active_students_count'], 1)
        self.assertGreaterEqual(history_data['total_historical_students'], 1)

    def test_tutor_cohort_history_api_endpoint(self):
        """Test GET /api/academics/tutors/cohort-history/ endpoint."""
        self.client.force_authenticate(user=self.basic_tutor)
        response = self.client.get('/api/academics/tutors/cohort-history/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('active_cohort', response.data)
        self.assertIn('past_records', response.data)
        self.assertEqual(response.data['tutor_id'], str(self.basic_tutor.id))
