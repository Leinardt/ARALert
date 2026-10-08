from unittest.mock import patch

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import AllowedEmail, User


class AuthAPITests(APITestCase):
    def setUp(self):
        # Create standard staff user
        self.staff_user = User.objects.create_user(
            username='staff1@example.com',
            email='staff1@example.com',
            first_name='Jane',
            last_name='Smith',
            role='faculty',
            is_active=True
        )

        # Create student user
        self.student_user = User.objects.create_user(
            username='123456789012',
            email='student1@example.com',
            first_name='John',
            last_name='Doe',
            role='student',
            lrn='123456789012',
            is_active=True
        )

        # Create deactivated student user
        self.inactive_student = User.objects.create_user(
            username='987654321098',
            email='student2@example.com',
            first_name='Inactive',
            last_name='Student',
            role='student',
            lrn='987654321098',
            is_active=False
        )

        # Create deactivated staff user
        self.inactive_staff = User.objects.create_user(
            username='inactive_staff@example.com',
            email='inactive_staff@example.com',
            first_name='Inactive',
            last_name='Staff',
            role='tutor',
            is_active=False
        )

        # Create superadmin user
        self.superadmin = User.objects.create_superuser(
            username='admin@example.com',
            email='admin@example.com',
            password='AdminPassword123!'
        )

    # ── Student Login Tests ──────────────────────────────────────────

    def test_student_login_success(self):
        url = reverse('auth-student-login')
        data = {
            'lrn': '123456789012'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['role'], 'student')
        self.assertEqual(response.data['redirect'], '/student')

    def test_student_login_invalid_lrn(self):
        url = reverse('auth-student-login')
        data = {
            'lrn': '000000000000'  # Not registered
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_student_login_inactive(self):
        url = reverse('auth-student-login')
        data = {
            'lrn': '987654321098'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Google Login Tests ───────────────────────────────────────────

    @patch('api.auth.serializers._verify_google_id_token')
    def test_google_login_success(self, mock_verify):
        mock_verify.return_value = {
            'email': 'staff1@example.com',
            'email_verified': True,
            'sub': 'google-uid-12345',
            'given_name': 'Jane',
            'family_name': 'Smith',
        }
        url = reverse('auth-google-login')
        data = {'id_token': 'fake-valid-google-id-token'}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['role'], 'faculty')
        self.assertEqual(response.data['redirect'], '/faculty')

        self.staff_user.refresh_from_db()
        self.assertEqual(self.staff_user.google_sub, 'google-uid-12345')

    @patch('api.auth.serializers._verify_google_id_token')
    def test_google_login_unregistered_email_forbidden(self, mock_verify):
        mock_verify.return_value = {
            'email': 'unregistered_person@deped.gov.ph',
            'email_verified': True,
            'sub': 'google-uid-99999',
            'given_name': 'Unknown',
            'family_name': 'Person',
        }
        url = reverse('auth-google-login')
        data = {'id_token': 'fake-valid-google-id-token'}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('not registered', response.data['detail'])

    @patch('api.auth.serializers._verify_google_id_token')
    def test_google_login_inactive_user_forbidden(self, mock_verify):
        mock_verify.return_value = {
            'email': 'inactive_staff@example.com',
            'email_verified': True,
            'sub': 'google-uid-inactive',
            'given_name': 'Inactive',
            'family_name': 'Staff',
        }
        url = reverse('auth-google-login')
        data = {'id_token': 'fake-valid-google-id-token'}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('deactivated', response.data['detail'])

    # ── Privacy Consent Acceptance Tests ─────────────────────────────

    def test_privacy_consent_acceptance(self):
        self.client.force_authenticate(user=self.staff_user)
        self.assertIsNone(self.staff_user.privacy_consent_accepted_at)

        url = reverse('auth-consent')
        response = self.client.post(url, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.staff_user.refresh_from_db()
        self.assertIsNotNone(self.staff_user.privacy_consent_accepted_at)
        self.assertFalse(response.data['user']['is_first_login'])

    # ── Allowed Emails (Whitelist) Management Tests ──────────────────

    def test_superadmin_can_manage_allowed_emails(self):
        self.client.force_authenticate(user=self.superadmin)
        url = reverse('allowed-email-list')

        # Create allowed email
        response = self.client.post(url, {'email': 'trusted.partner@gmail.com', 'notes': 'DepEd partner'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(AllowedEmail.objects.count(), 1)

        # List allowed emails
        list_response = self.client.get(url)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)

    def test_non_superadmin_forbidden_from_allowed_emails(self):
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('allowed-email-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # ── Logout Test ──────────────────────────────────────────────────

    def test_logout_blacklists_refresh_token(self):
        self.client.force_authenticate(user=self.staff_user)
        refresh = RefreshToken.for_user(self.staff_user)

        url = reverse('auth-logout')
        response = self.client.post(url, {'refresh': str(refresh)}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

