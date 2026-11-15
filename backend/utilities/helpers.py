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


def get_active_program_config():
    """
    Return the active ARAL Program Configuration (composite weights & risk thresholds)
    from the most recent PROGRAM_CONFIGURATION_UPDATED audit record, falling back to
    validated DepEd defaults (40% Attendance / 60% Score, 86% Low / 70% Moderate / 75% Gate).
    """
    defaults = {
        'attendance_weight_pct': 40,
        'score_weight_pct': 60,
        'attendance_weight': 0.40,
        'score_weight': 0.60,
        'low_min_composite': 86,
        'moderate_min_composite': 70,
        'high_attendance_gate': 75,
    }
    try:
        from apps.accounts.models import AuditLog
        last_cfg_log = (
            AuditLog.objects.filter(action='PROGRAM_CONFIGURATION_UPDATED')
            .order_by('-timestamp')
            .first()
        )
        if last_cfg_log and isinstance(last_cfg_log.details, dict):
            d = last_cfg_log.details
            att_pct = int(round(float(d.get('attendance_weight_pct', 40))))
            scr_pct = int(round(float(d.get('score_weight_pct', 100 - att_pct))))
            if 0 <= att_pct <= 100 and att_pct + scr_pct == 100:
                defaults['attendance_weight_pct'] = att_pct
                defaults['score_weight_pct'] = scr_pct
                defaults['attendance_weight'] = round(att_pct / 100.0, 4)
                defaults['score_weight'] = round(scr_pct / 100.0, 4)

            low_min = int(round(float(d.get('low_min_composite', 86))))
            mod_min = int(round(float(d.get('moderate_min_composite', 70))))
            gate = int(round(float(d.get('high_attendance_gate', 75))))
            if 0 <= mod_min < low_min <= 100 and 0 <= gate <= 100:
                defaults['low_min_composite'] = low_min
                defaults['moderate_min_composite'] = mod_min
                defaults['high_attendance_gate'] = gate
    except Exception:
        pass
    return defaults


def compute_student_risk_level(attendance_rate, score_avg):
    """Return the same risk tier used by tutor-facing analytics."""
    att = float(attendance_rate if attendance_rate is not None else 100.0)
    score = float(score_avg if score_avg is not None else 100.0)
    cfg = get_active_program_config()

    # Attendance Safety Gate: <= high_attendance_gate% attendance automatically classifies student as high risk
    if att <= float(cfg['high_attendance_gate']):
        return 'high'

    composite_score = (att * cfg['attendance_weight']) + (score * cfg['score_weight'])

    if composite_score >= float(cfg['low_min_composite']):
        return 'low'
    elif composite_score >= float(cfg['moderate_min_composite']):
        return 'moderate'
    else:
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
        total_count=Count('id'),
    )

    rates = {}
    for row in summary:
        if row['total_count'] > 0:
            rates[row['date']] = round(
                (row['present_count'] / row['total_count']) * 100.0,
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
            'tutor': {'present': 0, 'absent': 0},
            'faculty': {'present': 0, 'absent': 0},
        }
        for _ in range(days)
    ]

    for row in staff_attendance_summary:
        date_index = (row['date'] - start_date).days
        if date_index < 0 or date_index >= days:
            continue
        role_key = 'tutor' if row['role'] == 'tutor' else 'faculty'
        if row['status'] in ('present', 'absent'):
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
                    (counts['present'] / total) * 100.0,
                    1,
                )
        trend.append(point)
    return trend
