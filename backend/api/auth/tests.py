from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from apps.accounts.models import User

class AuthAPITests(APITestCase):
    def setUp(self):
        # Create standard staff user
        self.staff_user = User.objects.create_user(
            username='staff1',
            email='staff1@example.com',
            first_name='Jane',
            last_name='Smith',
            role='faculty',
            password='FacultyPassword123!',
            is_active=True
        )
        
        # Create student user
        self.student_user = User.objects.create_user(
            username='student1',
            email='student1@example.com',
            first_name='John',
            last_name='Doe',
            role='student',
            lrn='123456789012',
            password='StudentPassword123!',
            is_active=True
        )

        # Create deactivated student user
        self.inactive_student = User.objects.create_user(
            username='student2',
            email='student2@example.com',
            first_name='Inactive',
            last_name='Student',
            role='student',
            lrn='987654321098',
            password='StudentPassword123!',
            is_active=False
        )

    def test_staff_login_success(self):
        url = reverse('auth-login')
        data = {
            'username_or_email': 'staff1@example.com',
            'password': 'FacultyPassword123!'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['role'], 'faculty')

    def test_student_login_success(self):
        url = reverse('auth-student-login')
        # Test exact match
        data = {
            'full_name': 'John Doe',
            'lrn': '123456789012'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertEqual(response.data['user']['role'], 'student')
        self.assertEqual(response.data['redirect'], '/student')

    def test_student_login_case_and_space_insensitive(self):
        url = reverse('auth-student-login')
        # Test lowercase, uppercase, and extra spaces
        data = {
            'full_name': '   john   DOE   ',
            'lrn': '123456789012'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_student_login_invalid_lrn(self):
        url = reverse('auth-student-login')
        data = {
            'full_name': 'John Doe',
            'lrn': '000000000000' # Not registered
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_student_login_name_mismatch(self):
        url = reverse('auth-student-login')
        data = {
            'full_name': 'Jane Doe', # Wrong name for LRN 123456789012
            'lrn': '123456789012'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_student_login_inactive(self):
        url = reverse('auth-student-login')
        data = {
            'full_name': 'Inactive Student',
            'lrn': '987654321098'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('api.users.serializers.send_account_invitation_email')
    def test_superadmin_can_create_invitation_account(self, mock_send_email):
        superadmin = User.objects.create_superuser(
            username='superadmin_test',
            email='superadmin_test@example.com',
            password='SuperadminPassword123!'
        )
        self.client.force_authenticate(user=superadmin)

        url = reverse('user-list')
        data = {
            'first_name': 'Invited',
            'last_name': 'User',
            'username': 'inviteduser',
            'email': 'invited@example.com',
            'role': 'faculty',
            'is_active': False,
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email='invited@example.com')
        self.assertFalse(user.is_active)
        self.assertTrue(user.password_setup_required)
        self.assertIsNotNone(user.activation_token)
        mock_send_email.assert_called_once()

    def test_account_activation_sets_username_password_and_logs_in(self):
        user = User.objects.create_user(
            username='pendinguser',
            email='pending@example.com',
            first_name='Pending',
            last_name='User',
            role='faculty',
            password=None,
            is_active=False,
            password_setup_required=True,
        )
        user.activation_token = 'activation-token-123'
        user.activation_token_expires_at = timezone.now() + timezone.timedelta(hours=1)
        user.save(update_fields=['activation_token', 'activation_token_expires_at'])

        url = reverse('auth-activate')
        data = {
            'token': 'activation-token-123',
            'username': 'pendinguser2',
            'password': 'NewPassword123!',
            'confirm_password': 'NewPassword123!',
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.is_active)
        self.assertFalse(user.password_setup_required)
        self.assertTrue(user.email_verified)
        self.assertEqual(user.username, 'pendinguser2')
        self.assertTrue(user.check_password('NewPassword123!'))
        self.assertIn('access', response.data)

    def test_forgot_password_sets_reset_token_and_allows_password_reset(self):
        user = User.objects.create_user(
            username='resetuser',
            email='reset@example.com',
            first_name='Reset',
            last_name='User',
            role='faculty',
            password='OldPassword123!',
            is_active=True,
        )

        url = reverse('auth-forgot-password')
        response = self.client.post(url, {'email': 'reset@example.com'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertIsNotNone(user.password_reset_token)

        reset_url = reverse('auth-reset-password')
        response = self.client.post(
            reset_url,
            {
                'token': user.password_reset_token,
                'password': 'NewRecoveredPassword123!',
                'confirm_password': 'NewRecoveredPassword123!',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.check_password('NewRecoveredPassword123!'))
        self.assertIn('access', response.data)
