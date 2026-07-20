"""
Utility helpers for ARALert backend.
"""


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
