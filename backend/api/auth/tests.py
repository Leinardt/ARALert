from django.test import TestCase
from django.urls import reverse
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
