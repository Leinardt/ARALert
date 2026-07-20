from unittest.mock import patch

from django.test import SimpleTestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.academics.models import Attendance, AttendanceSession
from utilities.helpers import compute_student_risk_level


class ComputeStudentRiskLevelTests(SimpleTestCase):
    def test_low_score_with_high_attendance_stays_medium(self):
        risk_level = compute_student_risk_level(attendance_rate=95, score_avg=60)
        self.assertEqual(risk_level, 'medium')

    def test_low_attendance_escalates_medium_to_high(self):
        risk_level = compute_student_risk_level(attendance_rate=75, score_avg=90)
        self.assertEqual(risk_level, 'high')

    def test_low_attendance_and_low_score_becomes_high(self):
        risk_level = compute_student_risk_level(attendance_rate=50, score_avg=60)
        self.assertEqual(risk_level, 'high')


class StaffAttendanceScanTests(APITestCase):
    def setUp(self):
        self.tutor = User.objects.create_user(
            username='tutor_attendance',
            email='tutor-attendance@example.com',
            first_name='Tutor',
            last_name='Attendance',
            role='tutor',
            password='TutorPassword123!',
            is_active=True,
        )

    def test_faculty_morning_clock_in_is_recorded_for_the_morning_shift(self):
        faculty = User.objects.create_user(
            username='faculty_attendance',
            email='faculty-attendance@example.com',
            first_name='Faculty',
            last_name='Attendance',
            role='faculty',
            password='FacultyPassword123!',
            is_active=True,
        )

        session = AttendanceSession.objects.create(
            creator=self.tutor,
            session_type='staff',
            action='time_in',
            expires_at=timezone.now() + timezone.timedelta(minutes=10),
            is_active=True,
        )
        self.client.force_authenticate(user=faculty)

        with patch('django.utils.timezone.now', return_value=timezone.datetime(2026, 7, 20, 11, 59, tzinfo=timezone.get_current_timezone())):
            response = self.client.post('/api/academics/attendance/scan/', {'session_id': str(session.id)}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        attendance = Attendance.objects.get(user=faculty, date=timezone.localdate())
        self.assertEqual(attendance.status, 'late')
        self.assertEqual(attendance.time_in, timezone.datetime(2026, 7, 20, 11, 59, tzinfo=timezone.get_current_timezone()))
        self.assertEqual(attendance.morning_time_in, timezone.datetime(2026, 7, 20, 11, 59, tzinfo=timezone.get_current_timezone()))

    def test_early_clock_out_is_logged_as_early_out(self):
        afternoon_time_in = timezone.datetime(2026, 7, 20, 16, 30, tzinfo=timezone.get_current_timezone())

        with patch('django.utils.timezone.now', return_value=timezone.datetime(2026, 7, 20, 16, 45, tzinfo=timezone.get_current_timezone())):
            attendance = Attendance.objects.create(
                user=self.tutor,
                role='tutor',
                date=timezone.localdate(),
                time_in=afternoon_time_in,
                afternoon_time_in=afternoon_time_in,
                status='present',
            )
            session = AttendanceSession.objects.create(
                creator=self.tutor,
                session_type='staff',
                action='time_out',
                expires_at=timezone.now() + timezone.timedelta(minutes=10),
                is_active=True,
            )
            self.client.force_authenticate(user=self.tutor)
            response = self.client.post('/api/academics/attendance/scan/', {'session_id': str(session.id)}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        attendance.refresh_from_db()
        self.assertEqual(attendance.status, 'early_out')
        self.assertIsNotNone(attendance.time_out)

    def test_missing_clock_in_or_clock_out_is_logged_as_absent(self):
        session = AttendanceSession.objects.create(
            creator=self.tutor,
            session_type='staff',
            action='time_out',
            expires_at=timezone.now() + timezone.timedelta(minutes=10),
            is_active=True,
        )
        self.client.force_authenticate(user=self.tutor)

        with patch('django.utils.timezone.now', return_value=timezone.datetime(2026, 7, 20, 12, 1, tzinfo=timezone.get_current_timezone())):
            response = self.client.post('/api/academics/attendance/scan/', {'session_id': str(session.id)}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        attendance = Attendance.objects.get(user=self.tutor, date=timezone.localdate())
        self.assertEqual(attendance.status, 'absent')
        self.assertIsNotNone(attendance.time_out)
