from unittest.mock import patch

from django.test import TestCase
from api.users.serializers import UserCreateSerializer
from apps.accounts.models import User

class UserCreateSerializerTests(TestCase):
    def test_create_pending_staff_account_without_password(self):
        """Super Admin creation should create a pending staff account without a password."""
        data = {
            'first_name': 'John',
            'last_name': 'Doe',
            'email': 'johndoe@example.com',
            'role': 'tutor',
            'is_active': False,
        }

        serializer = UserCreateSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)

        user = serializer.save()
        self.assertFalse(user.is_active)
        self.assertFalse(user.password_set)
        self.assertTrue(user.password_setup_required)
        self.assertTrue(user.username.startswith('pending-'))
        self.assertEqual(user.first_name, 'John')
        self.assertEqual(user.last_name, 'Doe')

    def test_create_pending_staff_account_with_provided_password_is_ignored(self):
        """The staff creation flow should not use a password supplied by the Super Admin."""
        data = {
            'first_name': 'Alice',
            'last_name': 'Smith',
            'email': 'asmith@example.com',
            'role': 'faculty',
            'password': 'CustomSecurePassword123!',
            'confirm_password': 'CustomSecurePassword123!',
            'is_active': False,
        }

        serializer = UserCreateSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)

        user = serializer.save()
        self.assertFalse(user.password_set)
        self.assertTrue(user.password_setup_required)
        self.assertFalse(user.check_password('CustomSecurePassword123!'))

    def test_pending_staff_account_gets_activation_token(self):
        """Pending staff accounts should receive an activation token for setup."""
        data = {
            'first_name': 'A',
            'last_name': 'B',
            'email': 'ab@example.com',
            'role': 'principal',
            'is_active': False,
        }

        serializer = UserCreateSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)

        user = serializer.save()
        self.assertIsNotNone(user.activation_token)
        self.assertIsNotNone(user.activation_token_expires_at)

    @patch('api.users.serializers.send_account_invitation_email', return_value=False)
    def test_pending_staff_account_preserves_activation_link_when_email_fails(self, mock_send_email):
        """Even if the email cannot be delivered, the user should still get an activation link."""
        data = {
            'first_name': 'C',
            'last_name': 'D',
            'email': 'cd@example.com',
            'role': 'tutor',
            'is_active': False,
        }

        serializer = UserCreateSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)

        user = serializer.save()
        self.assertFalse(user.email_sent)
        self.assertTrue(user.activation_link.endswith('/activate?token=' + user.activation_token))
        mock_send_email.assert_called_once()

    def test_create_student_requires_lrn(self):
        """Test that creating a student requires a 12-digit LRN."""
        data = {
            'first_name': 'Student',
            'last_name': 'One',
            'username': 'student1',
            'email': 'student1@example.com',
            'role': 'student',
            'is_active': True,
        }
        
        serializer = UserCreateSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('lrn', serializer.errors)

    def test_create_student_accepts_middle_name_and_lrn(self):
        """Student creation should accept a middle name and LRN."""
        data = {
            'first_name': 'Student',
            'middle_name': 'Middle',
            'last_name': 'One',
            'username': 'student2',
            'email': 'student2@example.com',
            'role': 'student',
            'lrn': '123456789012',
            'is_active': True,
        }

        serializer = UserCreateSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)

        user = serializer.save()
        self.assertEqual(user.middle_name, 'Middle')
        self.assertEqual(user.lrn, '123456789012')


from rest_framework.test import APITestCase
from django.urls import reverse
from rest_framework import status

class UserAPIViewTests(APITestCase):
    def setUp(self):
        # Create SuperAdmin
        self.superadmin = User.objects.create_superuser(
            username='superadmin',
            email='superadmin@example.com',
            password='SuperadminPassword123!'
        )
        
        # Create School Admin
        self.admin = User.objects.create_user(
            username='admin1',
            email='admin1@example.com',
            first_name='Admin',
            last_name='User',
            role='admin',
            password='AdminPassword123!',
            is_active=True
        )
        
        # Create Student
        self.student = User.objects.create_user(
            username='student1',
            email='student1@example.com',
            first_name='Student',
            last_name='User',
            role='student',
            lrn='123456789012',
            password='StudentPassword123!',
            is_active=True
        )

        # Create Tutor
        self.tutor = User.objects.create_user(
            username='tutor1',
            email='tutor1@example.com',
            first_name='Tutor',
            last_name='User',
            role='tutor',
            password='TutorPassword123!',
            is_active=True
        )

    def test_superadmin_cannot_create_student(self):
        self.client.force_authenticate(user=self.superadmin)
        url = reverse('user-list')
        data = {
            'first_name': 'New',
            'last_name': 'Student',
            'username': 'newstudent',
            'email': 'newstudent@example.com',
            'role': 'student',
            'lrn': '123456789099',
            'is_active': True
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('role', response.data.get('errors', response.data))

    def test_superadmin_can_create_other_roles(self):
        self.client.force_authenticate(user=self.superadmin)
        url = reverse('user-list')
        data = {
            'first_name': 'New',
            'last_name': 'Tutor',
            'username': 'newtutor',
            'email': 'newtutor@example.com',
            'role': 'tutor',
            'is_active': True
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    @patch('api.users.serializers.send_account_invitation_email')
    def test_superadmin_can_create_staff_without_username_or_password(self, mock_send_email):
        self.client.force_authenticate(user=self.superadmin)
        url = reverse('user-list')
        data = {
            'first_name': 'New',
            'last_name': 'Tutor',
            'email': 'newstaff@example.com',
            'role': 'tutor',
            'is_active': False,
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email='newstaff@example.com')
        self.assertFalse(user.is_active)
        self.assertTrue(user.password_setup_required)
        self.assertIsNotNone(user.activation_token)
        self.assertFalse(user.password_set)
        mock_send_email.assert_called_once()

    def test_admin_can_create_student(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('user-list')
        data = {
            'first_name': 'New',
            'last_name': 'Student',
            'username': 'newstudent',
            'email': 'newstudent@example.com',
            'role': 'student',
            'lrn': '123456789099',
            'is_active': True
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_admin_cannot_create_other_roles(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('user-list')
        data = {
            'first_name': 'New',
            'last_name': 'Tutor',
            'username': 'newtutor',
            'email': 'newtutor@example.com',
            'role': 'tutor',
            'is_active': True
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('role', response.data.get('errors', response.data))

    def test_admin_list_only_contains_students(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('user-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Results should only contain students
        results = response.data['results']
        self.assertTrue(len(results) > 0)
        for item in results:
            self.assertEqual(item['role'], 'student')

