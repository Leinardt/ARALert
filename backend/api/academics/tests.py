from django.test import SimpleTestCase

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
