import uuid
from datetime import timedelta
from django.db import connection
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.accounts.models import User
from apps.academics.models import ApiAttendance, ApiAttendanceSession
from api.academics.views import AttendanceScanView, AttendanceManualLogView


class AttendanceScanTimezoneTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        with connection.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS "api_attendance_session" (
                    "id" char(32) NOT NULL PRIMARY KEY,
                    "session_type" varchar(10) NOT NULL,
                    "action" varchar(20) NULL,
                    "aral_activity_id" bigint NULL,
                    "expires_at" datetime NOT NULL,
                    "is_active" bool NOT NULL,
                    "creator_id" char(32) NOT NULL REFERENCES "users" ("id")
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS "api_attendance" (
                    "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
                    "role" varchar(20) NOT NULL,
                    "date" date NOT NULL,
                    "time_in" time NULL,
                    "time_out" time NULL,
                    "arrival_am" time NULL,
                    "departure_am" time NULL,
                    "arrival_pm" time NULL,
                    "departure_pm" time NULL,
                    "status" varchar(10) NOT NULL,
                    "user_id" char(32) NOT NULL REFERENCES "users" ("id"),
                    "tutor_id" char(32) NULL REFERENCES "users" ("id"),
                    "session_id" char(32) NULL REFERENCES "api_attendance_session" ("id"),
                    "aral_activity_id" bigint NULL
                )
            """)

    @classmethod
    def tearDownClass(cls):
        with connection.cursor() as cursor:
            cursor.execute('DROP TABLE IF EXISTS "api_attendance"')
            cursor.execute('DROP TABLE IF EXISTS "api_attendance_session"')
        super().tearDownClass()

    def setUp(self):
        self.factory = APIRequestFactory()
        self.admin = User.objects.create(
            username='admin_test',
            email='admin@test.com',
            role='admin',
            first_name='Admin',
            last_name='User'
        )
        self.tutor = User.objects.create(
            username='tutor_test',
            email='tutor@test.com',
            role='tutor',
            first_name='Tutor',
            last_name='User'
        )
        self.student = User.objects.create(
            username='student_test',
            email='student@test.com',
            role='student',
            first_name='Student',
            last_name='User',
            assigned_tutor=self.tutor
        )

    def test_student_scan_records_local_time(self):
        """Student scanning tutor QR session records time_in in local Asia/Manila time, not UTC."""
        session = ApiAttendanceSession.objects.create(
            id=uuid.uuid4(),
            creator=self.tutor,
            session_type='student',
            expires_at=timezone.now() + timedelta(minutes=15),
            is_active=True
        )

        request = self.factory.post('/api/academics/attendance/scan/', {'session_id': str(session.id)})
        force_authenticate(request, user=self.student)
        response = AttendanceScanView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        attendance = ApiAttendance.objects.get(user=self.student, date=timezone.localdate())
        expected_hour = timezone.localtime().hour
        self.assertEqual(attendance.time_in.hour, expected_hour)

    def test_staff_all_day_dtr_dynamic_clock_in_and_out(self):
        """All-day staff session clocks in on first scan and clocks out on second scan using local time."""
        session = ApiAttendanceSession.objects.create(
            id=uuid.uuid4(),
            creator=self.admin,
            session_type='staff',
            expires_at=timezone.now() + timedelta(hours=24),
            is_active=True,
            action=None  # all-day dynamic punch
        )

        # 1. First scan = Clock In
        req1 = self.factory.post('/api/academics/attendance/scan/', {'session_id': str(session.id)})
        force_authenticate(req1, user=self.tutor)
        resp1 = AttendanceScanView.as_view()(req1)
        self.assertEqual(resp1.status_code, 200)
        self.assertIn('Clock In recorded', resp1.data['message'])

        att1 = ApiAttendance.objects.get(user=self.tutor, date=timezone.localdate())
        expected_hour = timezone.localtime().hour
        self.assertEqual(att1.time_in.hour, expected_hour)
        self.assertIsNone(att1.time_out)

        # 2. Second scan = Clock Out
        req2 = self.factory.post('/api/academics/attendance/scan/', {'session_id': str(session.id)})
        force_authenticate(req2, user=self.tutor)
        resp2 = AttendanceScanView.as_view()(req2)
        self.assertEqual(resp2.status_code, 200)
        self.assertIn('Clock Out recorded', resp2.data['message'])

        att2 = ApiAttendance.objects.get(user=self.tutor, date=timezone.localdate())
        self.assertEqual(att2.time_out.hour, expected_hour)

        # 3. Third scan = Already completed
        req3 = self.factory.post('/api/academics/attendance/scan/', {'session_id': str(session.id)})
        force_authenticate(req3, user=self.tutor)
        resp3 = AttendanceScanView.as_view()(req3)
        self.assertEqual(resp3.status_code, 400)
        self.assertIn('Already completed DTR', resp3.data['error'])

    def test_manual_log_records_local_time(self):
        """Manual attendance logged by tutor records time_in in local Asia/Manila time."""
        request = self.factory.post('/api/academics/attendance/manual/', {
            'student_id': str(self.student.id),
            'status': 'present'
        })
        force_authenticate(request, user=self.tutor)
        response = AttendanceManualLogView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        attendance = ApiAttendance.objects.get(user=self.student, date=timezone.localdate())
        expected_hour = timezone.localtime().hour
        self.assertEqual(attendance.time_in.hour, expected_hour)

    def test_tutor_scans_student_permanent_qr_code(self):
        """Tutor scanning student's permanent QR code records student attendance as present."""
        # 1. Tutor creates active student session
        session = ApiAttendanceSession.objects.create(
            id=uuid.uuid4(),
            creator=self.tutor,
            session_type='student',
            is_active=True,
            expires_at=timezone.now() + timezone.timedelta(minutes=15)
        )

        # 2. Tutor scans student's permanent QR token
        student_qr = f"ARALERT:STUDENT:{self.student.id}"
        req = self.factory.post('/api/academics/attendance/scan/', {'qr_code': student_qr})
        force_authenticate(req, user=self.tutor)
        resp = AttendanceScanView.as_view()(req)

        self.assertEqual(resp.status_code, 200)
        self.assertIn('Successfully recorded attendance', resp.data['message'])

        att = ApiAttendance.objects.get(user=self.student, date=timezone.localdate())
        self.assertEqual(att.status, 'present')
        self.assertEqual(att.tutor, self.tutor)
        self.assertEqual(att.time_in.hour, timezone.localtime().hour)

        # 3. Scanning again returns duplicate notice
        req2 = self.factory.post('/api/academics/attendance/scan/', {'qr_code': student_qr})
        force_authenticate(req2, user=self.tutor)
        resp2 = AttendanceScanView.as_view()(req2)
        self.assertEqual(resp2.status_code, 400)
        self.assertIn('already marked', resp2.data['error'])
