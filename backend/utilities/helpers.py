"""
Utility helpers for ARALert backend.
"""
from datetime import timedelta

from django.db.models import Count, Q


def get_client_ip(request):
    """Extract the client's IP address from the request."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def compute_student_risk_level(attendance_rate, score_avg):
    """Return the same risk tier used by tutor-facing analytics."""
    composite_score = ((attendance_rate * 0.4) + (score_avg * 0.6))

    if composite_score >= 85:
        base_tier = 'low'
    elif composite_score >= 70:
        base_tier = 'medium'
    else:
        base_tier = 'high'

    if attendance_rate >= 90:
        return base_tier
    if attendance_rate >= 80:
        return 'medium' if base_tier == 'low' else base_tier
    if base_tier == 'low':
        return 'medium'
    return 'high'


def grade_percent(score, total_score):
    total = float(total_score or 0)
    if total > 0:
        return (float(score) / total) * 100.0
    return float(score)


def build_daily_score_averages(grades_qs, start_date, end_date):
    """Return {date: average_percent} for non-attendance grade components."""
    buckets = {}
    for grade in grades_qs.filter(
        date_logged__date__range=(start_date, end_date),
        component_type__in=['assessment', 'weekly_task'],
    ):
        date_obj = grade.date_logged.date()
        pct = grade_percent(grade.score, grade.total_score)
        if date_obj not in buckets:
            buckets[date_obj] = {'total': 0.0, 'count': 0}
        buckets[date_obj]['total'] += pct
        buckets[date_obj]['count'] += 1

    return {
        date_obj: round(data['total'] / data['count'], 1)
        for date_obj, data in buckets.items()
        if data['count'] > 0
    }


def build_daily_attendance_rates(attendance_qs, start_date, end_date):
    """Return {date: attendance_rate_percent} for student attendance logs."""
    summary = attendance_qs.filter(
        role='student',
        date__range=(start_date, end_date),
    ).values('date').annotate(
        present_count=Count('id', filter=Q(status='present')),
        late_count=Count('id', filter=Q(status='late')),
        total_count=Count('id'),
    )

    rates = {}
    for row in summary:
        if row['total_count'] > 0:
            rates[row['date']] = round(
                ((row['present_count'] + row['late_count']) / row['total_count']) * 100.0,
                1,
            )
    return rates


def build_performance_trend(start_date, days, attendance_rates_by_date, score_averages_by_date):
    """Build daily attendance/score trend points for dashboard charts."""
    trend = []
    for i in range(days):
        date_obj = start_date + timedelta(days=i)
        point = {
            'date': date_obj.isoformat(),
            'attendance_rate': attendance_rates_by_date.get(date_obj, 0.0),
            'average_score': score_averages_by_date.get(date_obj, 0.0),
        }
        trend.append(point)
    return trend


def build_staff_attendance_trend(start_date, days, staff_attendance_summary):
    """Build per-day tutor/faculty attendance rates."""
    staff_by_date = [
        {
            'tutor': {'present': 0, 'late': 0, 'absent': 0},
            'faculty': {'present': 0, 'late': 0, 'absent': 0},
        }
        for _ in range(days)
    ]

    for row in staff_attendance_summary:
        date_index = (row['date'] - start_date).days
        if date_index < 0 or date_index >= days:
            continue
        role_key = 'tutor' if row['role'] == 'tutor' else 'faculty'
        if row['status'] in ('present', 'late', 'absent'):
            staff_by_date[date_index][role_key][row['status']] += row['count']

    trend = []
    for i in range(days):
        date_obj = start_date + timedelta(days=i)
        point = {
            'date': date_obj.isoformat(),
            'tutor_attendance_rate': 0.0,
            'faculty_attendance_rate': 0.0,
        }
        for role_key in ('tutor', 'faculty'):
            counts = staff_by_date[i][role_key]
            total = sum(counts.values())
            if total > 0:
                point[f'{role_key}_attendance_rate'] = round(
                    ((counts['present'] + counts['late']) / total) * 100.0,
                    1,
                )
        trend.append(point)
    return trend
