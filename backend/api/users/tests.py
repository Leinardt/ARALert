from django.test import TestCase
from api.users.serializers import UserCreateSerializer
from apps.accounts.models import User

class UserCreateSerializerTests(TestCase):
    def test_create_user_with_auto_generated_password(self):
        """Test that missing password automatically triggers generating one based on details."""
        data = {
            'first_name': 'John',
            'last_name': 'Doe',
            'username': 'johndoe',
            'email': 'johndoe@example.com',
            'role': 'tutor',
            'is_active': True,
        }
        
        serializer = UserCreateSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        
        user = serializer.save()
        self.assertTrue(user.is_active)
        self.assertEqual(user.first_name, 'John')
        self.assertEqual(user.last_name, 'Doe')
        self.assertEqual(user.username, 'johndoe')
        
        # Verify the password check logic
        # Expected generated password: DoeJ@johndoe
        self.assertTrue(user.check_password('DoeJ@johndoe'))

    def test_create_user_with_explicit_password(self):
        """Test that providing an explicit password uses it instead of generating one."""
        data = {
            'first_name': 'Alice',
            'last_name': 'Smith',
            'username': 'asmith',
            'email': 'asmith@example.com',
            'role': 'faculty',
            'password': 'CustomSecurePassword123!',
            'confirm_password': 'CustomSecurePassword123!',
            'is_active': True,
        }
        
        serializer = UserCreateSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        
        user = serializer.save()
        self.assertTrue(user.check_password('CustomSecurePassword123!'))
        self.assertFalse(user.check_password('SmithA@asmith'))

    def test_create_user_short_details_generates_padded_password(self):
        """Test that short name/username generates password that is at least 8 characters."""
        data = {
            'first_name': 'A',
            'last_name': 'B',
            'username': 'ab',
            'email': 'ab@example.com',
            'role': 'principal',
            'is_active': True,
        }
        
        serializer = UserCreateSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        
        user = serializer.save()
        # Expected base generated password: BA@ab (5 chars)
        # Expected padded: BA@ab123 (8 chars)
        self.assertTrue(user.check_password('BA@ab123'))

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
        self.assertIn('role', response.data)

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
        self.assertIn('role', response.data)

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

