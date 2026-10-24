import uuid
from django.test import TestCase
from rest_framework.test import APIClient
from apps.accounts.models import User, StudentEditRequest
from apps.academics.models import School, TutorProfile, Student

class StudentEditRequestWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.school = School.objects.create(
            depedsch_id='108923',
            sch_name='Polangui General Comprehensive High School',
            sch_division='Albay',
            sch_region='Region V'
        )
        self.tutor = User.objects.create_user(
            username='testtutor@aralert.com',
            email='testtutor@aralert.com',
            password='TestPassword123!',
            first_name='Maria',
            last_name='Santos',
            role='tutor'
        )
        self.tutor_profile = TutorProfile.objects.create(
            user=self.tutor,
            school=self.school,
            tut_aral_level='basic',
            subject='Reading'
        )
        self.admin = User.objects.create_user(
            username='testadmin@aralert.com',
            email='testadmin@aralert.com',
            password='TestPassword123!',
            first_name='Admin',
            last_name='User',
            role='admin'
        )
        self.student_user = User.objects.create_user(
            username='teststudent@aralert.com',
            email='teststudent@aralert.com',
            password='TestPassword123!',
            first_name='Juan',
            middle_name='Dela',
            last_name='Cruz',
            role='student',
            lrn='123456789012',
            aral_level='basic',
            assigned_tutor=self.tutor
        )
        self.academic_student = Student.objects.create(
            user=self.student_user,
            tutor=self.tutor_profile,
            stu_fname='Juan',
            stu_mname='Dela',
            stu_lname='Cruz',
            lrn='123456789012',
            aral_level='basic'
        )

    def test_direct_tutor_patch_is_forbidden(self):
        """Tutors cannot directly mutate student profiles via PATCH /api/users/<id>/"""
        self.client.force_authenticate(user=self.tutor)
        response = self.client.patch(
            f'/api/users/{self.student_user.id}/',
            {'first_name': 'HackedName', 'last_name': 'HackedLast'},
            format='json'
        )
        self.assertEqual(response.status_code, 403)
        self.student_user.refresh_from_db()
        self.assertEqual(self.student_user.first_name, 'JUAN')

    def test_tutor_create_edit_request(self):
        """Tutors can submit edit requests which are stored with status 'pending'"""
        self.client.force_authenticate(user=self.tutor)
        payload = {
            'student': str(self.student_user.id),
            'proposed_first_name': 'Juanito',
            'proposed_middle_name': 'Dela',
            'proposed_last_name': 'Cruz',
            'proposed_lrn': '123456789099',
            'proposed_aral_level': 'plus',
            'reason': 'PSA birth certificate correction and ARAL level elevation'
        }
        response = self.client.post('/api/users/student-edit-requests/', payload, format='json')
        self.assertEqual(response.status_code, 201)
        req_id = response.data['id']
        req = StudentEditRequest.objects.get(id=req_id)
        self.assertEqual(req.status, 'pending')
        self.assertEqual(req.proposed_first_name, 'JUANITO')
        self.assertEqual(req.proposed_lrn, '123456789099')

        # Verify student record hasn't changed yet
        self.student_user.refresh_from_db()
        self.assertEqual(self.student_user.first_name, 'JUAN')

    def test_admin_approve_edit_request(self):
        """Admin approving the request updates User and Student models"""
        req = StudentEditRequest.objects.create(
            student=self.student_user,
            requested_by=self.tutor,
            proposed_first_name='JUANITO',
            proposed_middle_name='SILANG',
            proposed_last_name='CRUZ',
            proposed_lrn='123456789099',
            proposed_aral_level='plus',
            reason='Verified by school registrar'
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f'/api/users/student-edit-requests/{req.id}/review/',
            {'action': 'approve'},
            format='json'
        )
        self.assertEqual(response.status_code, 200)

        req.refresh_from_db()
        self.assertEqual(req.status, 'approved')
        self.assertEqual(req.reviewed_by, self.admin)

        # Verify User was updated
        self.student_user.refresh_from_db()
        self.assertEqual(self.student_user.first_name, 'JUANITO')
        self.assertEqual(self.student_user.middle_name, 'SILANG')
        self.assertEqual(self.student_user.lrn, '123456789099')
        self.assertEqual(self.student_user.aral_level, 'plus')

        # Verify Academic Student was updated
        self.academic_student.refresh_from_db()
        self.assertEqual(self.academic_student.stu_fname, 'JUANITO')
        self.assertEqual(self.academic_student.stu_mname, 'SILANG')
        self.assertEqual(self.academic_student.lrn, '123456789099')
        self.assertEqual(self.academic_student.aral_level, 'plus')

    def test_admin_reject_edit_request(self):
        """Admin rejecting the request records rejection reason and keeps records unchanged"""
        req = StudentEditRequest.objects.create(
            student=self.student_user,
            requested_by=self.tutor,
            proposed_first_name='FUNNYNAME',
            proposed_middle_name='',
            proposed_last_name='PRANK',
            proposed_lrn='000000000000',
            proposed_aral_level='graduated',
            reason='Testing joke edit'
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f'/api/users/student-edit-requests/{req.id}/review/',
            {'action': 'reject', 'rejection_reason': 'Invalid student name provided.'},
            format='json'
        )
        self.assertEqual(response.status_code, 200)

        req.refresh_from_db()
        self.assertEqual(req.status, 'rejected')
        self.assertEqual(req.rejection_reason, 'Invalid student name provided.')

        # Verify student was NOT modified
        self.student_user.refresh_from_db()
        self.assertEqual(self.student_user.first_name, 'JUAN')
        self.assertEqual(self.student_user.last_name, 'CRUZ')

    def test_student_create_edit_request(self):
        """Students can submit edit requests for their own profile"""
        self.client.force_authenticate(user=self.student_user)
        payload = {
            'student': str(self.student_user.id),
            'proposed_first_name': 'Juanito',
            'proposed_middle_name': 'Dela',
            'proposed_last_name': 'Cruz',
            'proposed_lrn': '123456789099',
            'proposed_aral_level': 'plus',
            'reason': 'PSA birth certificate correction'
        }
        response = self.client.post('/api/users/student-edit-requests/', payload, format='json')
        self.assertEqual(response.status_code, 201)
        req_id = response.data['id']
        req = StudentEditRequest.objects.get(id=req_id)
        self.assertEqual(req.status, 'pending')
        self.assertEqual(req.requested_by, self.student_user)

    def test_student_cannot_edit_other_student(self):
        """Students cannot submit edit requests for other students"""
        other_student = User.objects.create_user(
            username='otherstudent@aralert.com',
            email='otherstudent@aralert.com',
            password='TestPassword123!',
            first_name='Pedro',
            last_name='Penduko',
            role='student',
            lrn='987654321098'
        )
        self.client.force_authenticate(user=self.student_user)
        payload = {
            'student': str(other_student.id),
            'proposed_first_name': 'Pedro',
            'proposed_middle_name': '',
            'proposed_last_name': 'Hacked',
        }
        response = self.client.post('/api/users/student-edit-requests/', payload, format='json')
        self.assertEqual(response.status_code, 403)

    def test_user_can_cancel_own_pending_request(self):
        """User can withdraw their own pending edit request"""
        req = StudentEditRequest.objects.create(
            student=self.student_user,
            requested_by=self.student_user,
            proposed_first_name='JUANITO',
            proposed_last_name='CRUZ',
        )
        self.client.force_authenticate(user=self.student_user)
        response = self.client.delete(f'/api/users/student-edit-requests/{req.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(StudentEditRequest.objects.filter(id=req.id).exists())

    def test_user_cannot_cancel_other_user_request(self):
        """Non-admin user cannot cancel another user's edit request"""
        req = StudentEditRequest.objects.create(
            student=self.student_user,
            requested_by=self.tutor,
            proposed_first_name='JUANITO',
            proposed_last_name='CRUZ',
        )
        self.client.force_authenticate(user=self.student_user)
        response = self.client.delete(f'/api/users/student-edit-requests/{req.id}/')
        self.assertEqual(response.status_code, 403)
        self.assertTrue(StudentEditRequest.objects.filter(id=req.id).exists())

