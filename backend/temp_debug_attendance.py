import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django

django.setup()

from django.utils import timezone
from rest_framework.test import APIClient
from unittest.mock import patch
from apps.accounts.models import User
from apps.academics.models import Attendance, AttendanceSession

client = APIClient()

User.objects.filter(username='tutor_attendance2_unique').delete()
User.objects.filter(email='tutor2_unique@example.com').delete()

TUTOR_EMAIL = 'tutor2_unique@example.com'
tutor = User.objects.create_user(
    username='tutor_attendance2_unique',
    email=TUTOR_EMAIL,
    first_name='Tutor',
    last_name='Attendance',
    role='tutor',
    password='TutorPassword123!',
    is_active=True,
)
afternoon_time_in = timezone.datetime(2026, 7, 20, 16, 30, tzinfo=timezone.get_current_timezone())
attendance = Attendance.objects.create(
    user=tutor,
    role='tutor',
    date=timezone.localdate(),
    time_in=afternoon_time_in,
    afternoon_time_in=afternoon_time_in,
    status='present',
)
with patch('django.utils.timezone.now', return_value=timezone.datetime(2026, 7, 20, 16, 45, tzinfo=timezone.get_current_timezone())):
    session = AttendanceSession.objects.create(
        creator=tutor,
        session_type='staff',
        action='time_out',
        expires_at=timezone.now() + timezone.timedelta(minutes=10),
        is_active=True,
    )
    client.force_authenticate(user=tutor)
    response = client.post('/api/academics/attendance/scan/', {'session_id': str(session.id)}, format='json')
    print('status', response.status_code)
    print('data', response.data)
    print('session expires', session.expires_at)
    print('now', timezone.now())
