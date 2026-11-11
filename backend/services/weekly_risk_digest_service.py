"""
Weekly Risk Digest Service for ARALert.
Compiles and dispatches weekly academic risk summaries every Saturday at 12:00 AM PHT:
1. Tutor Copy: Divided by handled class for each active Tutor.
2. Principal Copy: Consolidated across all active ARAL classes for the current semester.
"""

import logging
import re
from datetime import timedelta
from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from apps.academics.models import ApiAttendance, ApiGrade, SchoolYear
from apps.accounts.models import AuditLog, User
from services.email_service import (
    send_weekly_principal_digest_email,
    send_weekly_risk_digest_email,
)
from utilities.audit import log_audit_event

logger = logging.getLogger(__name__)


def _get_testing_digest_lock() -> str:
    """Optional override email from Django settings; empty in production so real Tutors & Principal receive digests."""
    return (getattr(settings, 'TESTING_DIGEST_RECIPIENT_EMAIL', '') or '').strip()


def resolve_digest_recipient(natural_email: str | None, override_email: str | None = None) -> str:
    """Resolve safe recipient address respecting explicit CLI/API overrides and optional testing lock."""
    if override_email and override_email.strip():
        return override_email.strip()
    testing_lock = _get_testing_digest_lock()
    if testing_lock:
        return testing_lock
    return (natural_email or '').strip()


def format_learner_academic_name(student: User) -> str:
    """Format student name in DepEd academic format: LASTNAME, FIRSTNAME M.I."""
    ln = (getattr(student, 'last_name', '') or '').strip().upper()
    fn = (getattr(student, 'first_name', '') or '').strip().upper()
    mn = (getattr(student, 'middle_name', '') or '').strip()
    mi = f"{mn[0].upper()}." if mn else ''

    if ln and fn:
        return f"{ln}, {fn} {mi}".strip() if mi else f"{ln}, {fn}"
    if ln:
        return ln
    if fn:
        return f"{fn} {mi}".strip() if mi else fn
    fallback = student.get_full_name() if hasattr(student, 'get_full_name') else str(student)
    return (fallback or 'LEARNER').strip().upper()


def format_staff_display_name(user: User | None, default_label: str = 'ARALert Staff') -> str:
    """Format staff name as FIRSTNAME M.I. LASTNAME in uppercase."""
    if not user:
        return default_label
    fn = (getattr(user, 'first_name', '') or '').strip().upper()
    mn = (getattr(user, 'middle_name', '') or '').strip()
    ln = (getattr(user, 'last_name', '') or '').strip().upper()
    mi = f"{mn[0].upper()}." if mn else ''

    if fn and ln:
        return f"{fn} {mi} {ln}".strip() if mi else f"{fn} {ln}"
    full = (user.get_full_name() if hasattr(user, 'get_full_name') else '') or ''
    if full.strip():
        return full.strip().upper()
    return (getattr(user, 'username', '') or getattr(user, 'email', '') or default_label).strip().upper()


def normalize_class_section_name(student: User) -> str:
    """Normalize student grade_level and section into 'GRADE X - SECTION' without duplication."""
    raw_gl = re.sub(r'[\u2010-\u2015]', '-', (getattr(student, 'grade_level', '') or '').strip().upper())
    raw_sec = re.sub(r'[\u2010-\u2015]', '-', (getattr(student, 'section', '') or '').strip().upper())

    if raw_gl and '-' in raw_gl:
        parts = [p.strip() for p in raw_gl.split('-', 1)]
        g_part = parts[0]
        s_part = parts[1] if len(parts) > 1 else ''
        if g_part.isdigit():
            g_part = f"GRADE {g_part}"
        elif g_part and not g_part.startswith('GRADE') and re.match(r'^\d+', g_part):
            g_part = f"GRADE {g_part}"
        return f"{g_part} - {s_part}".strip(' -') if s_part else g_part

    g_clean = raw_gl
    if g_clean.isdigit():
        g_clean = f"GRADE {g_clean}"
    elif g_clean and not g_clean.startswith('GRADE') and re.match(r'^\d+', g_clean):
        g_clean = f"GRADE {g_clean}"

    if g_clean and raw_sec:
        if raw_sec in g_clean:
            return g_clean
        return f"{g_clean} - {raw_sec}"
    if g_clean:
        return g_clean
    if raw_sec:
        return raw_sec

    raw_prog = (getattr(student, 'aral_level', '') or 'basic').split(',')[0].strip().lower()
    if raw_prog == 'plus':
        return 'ARAL PLUS COHORT'
    if raw_prog == 'summer':
        return 'ARAL SUMMER COHORT'
    return 'ARAL BASIC COHORT'


def format_program_subject_label(student: User) -> tuple[str, str]:
    """Return (program_bucket, display_label) such as ('basic', 'ARAL Basic (Filipino)')."""
    raw_level = (getattr(student, 'aral_level', '') or 'basic').lower()
    if 'summer' in raw_level:
        bucket = 'summer'
        prog_title = 'ARAL Summer'
    elif 'plus' in raw_level:
        bucket = 'plus'
        prog_title = 'ARAL Plus'
    else:
        bucket = 'basic'
        prog_title = 'ARAL Basic'

    raw_subj = (getattr(student, 'subject', '') or '').strip()
    if not raw_subj or raw_subj.lower() == 'reading':
        subj_title = 'English' if bucket == 'plus' else 'Filipino'
    else:
        subj_title = raw_subj.split(',')[0].strip().title()

    return bucket, f"{prog_title} ({subj_title})"


def class_sort_key(class_name: str) -> tuple[int, str]:
    """Sort classes naturally by grade number (Grade 7, Grade 8, ..., Grade 12) then section name."""
    match = re.search(r'(\d+)', class_name or '')
    grade_num = int(match.group(1)) if match else 99
    return (grade_num, (class_name or '').upper())


def get_active_semester_context() -> dict:
    """Resolve active SchoolYear, current semester label, and Monday–Friday PHT session dates."""
    active_sy = SchoolYear.objects.filter(is_active=True).first()
    if not active_sy:
        active_sy = SchoolYear.objects.filter(status='ACTIVE').first()

    sy_raw = (active_sy.school_year if active_sy and active_sy.school_year else '2025-2026').strip()
    sy_display = sy_raw.replace('-', '–')
    sem_code = ((active_sy.current_semester if active_sy else '2nd') or '2nd').strip().lower()

    if sem_code == '1st':
        sem_display = '1st Semester'
    elif sem_code == 'summer':
        sem_display = 'ARAL Summer'
    else:
        sem_code = '2nd'
        sem_display = '2nd Semester'

    semester_label = f"S.Y. {sy_display} • {sem_display}"

    now_local = timezone.localtime(timezone.now())
    today_pht = now_local.date()
    # On Saturday (weekday == 5), today_pht - 5 days is Monday and monday + 4 days is Friday
    monday_date = today_pht - timedelta(days=today_pht.weekday())
    friday_date = monday_date + timedelta(days=4)

    if monday_date.year == friday_date.year:
        short_week_label = f"{monday_date.strftime('%b %d')} – {friday_date.strftime('%b %d, %Y')}"
    else:
        short_week_label = f"{monday_date.strftime('%b %d, %Y')} – {friday_date.strftime('%b %d, %Y')}"

    week_range_str = f"Monday – Friday Sessions ({short_week_label})"
    week_ending_label = f"Week Ending {friday_date.strftime('%b %d, %Y')}"

    return {
        'active_sy': active_sy,
        'school_year': sy_raw,
        'current_semester': sem_code,
        'semester_label': semester_label,
        'short_week_label': short_week_label,
        'week_range_str': week_range_str,
        'week_ending_label': week_ending_label,
    }


def get_active_semester_students_qs(current_semester: str):
    """Return active non-graduated ARAL students scoped to the active semester."""
    qs = (
        User.objects.filter(role='student', is_active=True, is_superuser=False)
        .exclude(aral_level__iexact='graduated')
        .select_related('assigned_tutor')
    )
    if current_semester == 'summer':
        qs = qs.filter(aral_level__icontains='summer')
    else:
        qs = qs.exclude(aral_level__iexact='summer')
    return qs


def prefetch_student_records(student_ids: list, active_sy: SchoolYear | None) -> tuple[dict, dict]:
    """Bulk-prefetch grades and attendance in O(1) queries matching analyticsHelpers.ts."""
    if not student_ids:
        return {}, {}

    grades_qs = ApiGrade.objects.filter(student_id__in=student_ids).exclude(component_type='attendance')
    grades_by_student: dict[str, list] = {}
    for g in grades_qs:
        sid = str(g.student_id)
        grades_by_student.setdefault(sid, []).append(g)

    att_qs = ApiAttendance.objects.filter(user_id__in=student_ids)
    if active_sy is not None:
        att_qs = att_qs.filter(Q(school_year=active_sy) | Q(school_year__isnull=True))

    att_by_student: dict[str, list] = {}
    for a in att_qs:
        uid = str(a.user_id)
        att_by_student.setdefault(uid, []).append(a)

    return grades_by_student, att_by_student


def compute_student_weekly_metrics(student: User, grades_by_student: dict, att_by_student: dict) -> dict:
    """
    Compute attendance rate, average score, and early warning composite score
    strictly matching frontend/src/utils/analyticsHelpers.ts (computeStudentRiskRows):
    - 40% Attendance Rate + 60% Score Average
    - High Risk tier: composite_score < 70.0
    """
    student_id = str(student.id)
    student_grades = grades_by_student.get(student_id, [])
    student_att = att_by_student.get(student_id, [])

    total_att = len(student_att)
    attended_count = sum(
        1 for a in student_att
        if str(getattr(a, 'status', '') or '').strip().lower() in ('present', 'p')
    )
    attendance_rate = round((attended_count / total_att) * 100.0, 2) if total_att > 0 else 100.0

    if student_grades:
        pct_list = []
        for g in student_grades:
            if str(getattr(g, 'component_type', '') or '').strip().lower() == 'attendance':
                continue
            score = float(g.score or 0)
            total = float(g.total_score if g.total_score is not None else 100)
            pct = (score / total) * 100.0 if total > 0 else 0.0
            pct_list.append(pct)
        score_avg = round(sum(pct_list) / len(pct_list), 2) if pct_list else 100.0
    else:
        score_avg = 100.0

    composite_score = round((attendance_rate * 0.40) + (score_avg * 0.60), 2)
    # Attendance Safety Gate: <= 75% attendance automatically triggers High Risk tier
    is_high_risk = (composite_score < 70.0) or (total_att > 0 and attendance_rate <= 75.0)

    class_section = normalize_class_section_name(student)
    program_bucket, program_label = format_program_subject_label(student)

    return {
        'id': student_id,
        'name': format_learner_academic_name(student),
        'lrn': getattr(student, 'lrn', '') or '—',
        'class_section': class_section,
        'program_bucket': program_bucket,
        'program_label': program_label,
        'attendance_rate': round(attendance_rate, 1),
        'score_avg': round(score_avg, 1),
        'composite_score': round(composite_score, 1),
        'raw_composite_score': composite_score,
        'is_high_risk': is_high_risk,
    }


def generate_weekly_tutor_digest(
    tutor: User,
    target_email: str | None = None,
    dry_run: bool = False,
    prefetched_context: dict | None = None,
) -> dict:
    """
    Generate and send the Saturday 12:00 AM PHT High Risk Summary for a single Tutor,
    divided by handled class.
    """
    sem_ctx = (prefetched_context or {}).get('sem_ctx') or get_active_semester_context()

    if prefetched_context and 'students_by_tutor' in prefetched_context:
        handled_students = list(prefetched_context['students_by_tutor'].get(str(tutor.id), []))
    else:
        handled_students = list(
            get_active_semester_students_qs(sem_ctx['current_semester']).filter(assigned_tutor=tutor)
        )

    if not handled_students:
        logger.info('Tutor %s has no active assigned students in %s. Digest skipped.', tutor.email, sem_ctx['semester_label'])
        return {
            'tutor_id': str(tutor.id),
            'tutor_name': format_staff_display_name(tutor, 'Tutor'),
            'tutor_email': tutor.email,
            'total_students': 0,
            'total_classes': 0,
            'high_risk_count': 0,
            'status': 'skipped_no_students',
            'send_success': False,
        }

    if prefetched_context and 'grades_by_student' in prefetched_context and 'att_by_student' in prefetched_context:
        grades_by_student = prefetched_context['grades_by_student']
        att_by_student = prefetched_context['att_by_student']
    else:
        s_ids = [s.id for s in handled_students]
        grades_by_student, att_by_student = prefetch_student_records(s_ids, sem_ctx['active_sy'])

    grouped_classes: dict[str, dict] = {}
    high_risk_all: list[dict] = []

    for s in handled_students:
        metrics = compute_student_weekly_metrics(s, grades_by_student, att_by_student)
        cls_name = metrics['class_section']
        if cls_name not in grouped_classes:
            grouped_classes[cls_name] = {
                'class_name': cls_name,
                'program_label': metrics['program_label'],
                'total_students': 0,
                'high_risk_students': [],
            }
        grouped_classes[cls_name]['total_students'] += 1
        if metrics['is_high_risk']:
            grouped_classes[cls_name]['high_risk_students'].append(metrics)
            high_risk_all.append(metrics)

    class_groups = sorted(grouped_classes.values(), key=lambda cg: class_sort_key(cg['class_name']))
    for cg in class_groups:
        cg['high_risk_students'].sort(key=lambda x: (x['raw_composite_score'], x['name']))

    high_risk_all.sort(key=lambda x: (x['raw_composite_score'], x['name']))

    tutor_display_name = format_staff_display_name(tutor, 'ARALert Tutor')

    # Skip sending email if there are no high-risk learners to save storage and prevent inbox clutter
    if not high_risk_all:
        logger.info(
            'Tutor %s has 0 high-risk learners in %s. Weekly digest email skipped.',
            tutor.email,
            sem_ctx['semester_label'],
        )
        return {
            'tutor_id': str(tutor.id),
            'tutor_name': tutor_display_name,
            'tutor_email': tutor.email,
            'dispatched_to': None,
            'total_students': len(handled_students),
            'total_classes': len(class_groups),
            'high_risk_count': 0,
            'status': 'skipped_zero_high_risk',
            'send_success': False,
            'dry_run': dry_run,
        }

    resolved_to_email = resolve_digest_recipient(tutor.email, target_email)

    digest_data = {
        'tutor_display_name': tutor_display_name,
        'semester_label': sem_ctx['semester_label'],
        'short_week_label': sem_ctx['short_week_label'],
        'week_range_str': sem_ctx['week_range_str'],
        'high_risk_students': high_risk_all,
        'class_groups': class_groups,
        'total_handled_students': len(handled_students),
        'total_classes': len(class_groups),
    }

    send_success = False
    if not dry_run:
        if resolved_to_email and not resolved_to_email.lower().endswith('@aralert.local'):
            send_success = send_weekly_risk_digest_email(tutor, digest_data, to_email=resolved_to_email)
            log_audit_event(
                'WEEKLY_TUTOR_RISK_DIGEST_SENT',
                user=tutor,
                details={
                    'tutor_email': tutor.email,
                    'target_recipient': resolved_to_email,
                    'academic_term': sem_ctx['semester_label'],
                    'total_handled': len(handled_students),
                    'total_classes': len(class_groups),
                    'high_risk_count': len(high_risk_all),
                    'send_success': send_success,
                },
            )
    else:
        send_success = True

    return {
        'tutor_id': str(tutor.id),
        'tutor_name': tutor_display_name,
        'tutor_email': tutor.email,
        'dispatched_to': resolved_to_email if not dry_run else (resolved_to_email or 'dry-run'),
        'total_students': len(handled_students),
        'total_classes': len(class_groups),
        'high_risk_count': len(high_risk_all),
        'send_success': send_success,
        'dry_run': dry_run,
    }


def build_consolidated_principal_digest_payload(prefetched_context: dict | None = None) -> dict:
    """Compile the consolidated High Risk payload across all active ARAL learners in the current semester."""
    sem_ctx = (prefetched_context or {}).get('sem_ctx') or get_active_semester_context()
    all_students = list(
        (prefetched_context or {}).get('all_students')
        or get_active_semester_students_qs(sem_ctx['current_semester'])
    )

    if prefetched_context and 'grades_by_student' in prefetched_context and 'att_by_student' in prefetched_context:
        grades_by_student = prefetched_context['grades_by_student']
        att_by_student = prefetched_context['att_by_student']
    else:
        s_ids = [s.id for s in all_students]
        grades_by_student, att_by_student = prefetch_student_records(s_ids, sem_ctx['active_sy'])

    class_map: dict[tuple[str, str], dict] = {}
    program_risk_counts = {'basic': 0, 'plus': 0, 'summer': 0}
    total_high_risk = 0

    for s in all_students:
        metrics = compute_student_weekly_metrics(s, grades_by_student, att_by_student)
        assigned_tutor = getattr(s, 'assigned_tutor', None)
        tutor_key = str(assigned_tutor.id) if assigned_tutor else 'tba'
        tutor_name = format_staff_display_name(assigned_tutor, 'TBA') if assigned_tutor else 'TBA'
        cls_name = metrics['class_section']

        group_key = (cls_name, tutor_key)
        if group_key not in class_map:
            class_map[group_key] = {
                'class_name': cls_name,
                'program_label': metrics['program_label'],
                'tutor_name': tutor_name,
                'total_students': 0,
                'high_risk_students': [],
            }

        class_map[group_key]['total_students'] += 1
        if metrics['is_high_risk']:
            class_map[group_key]['high_risk_students'].append(metrics)
            total_high_risk += 1
            bucket = metrics.get('program_bucket', 'basic')
            program_risk_counts[bucket] = program_risk_counts.get(bucket, 0) + 1

    all_class_groups = sorted(
        class_map.values(),
        key=lambda cg: (class_sort_key(cg['class_name']), cg['tutor_name']),
    )
    for cg in all_class_groups:
        cg['high_risk_students'].sort(key=lambda x: (x['raw_composite_score'], x['name']))

    high_risk_class_groups = [cg for cg in all_class_groups if len(cg['high_risk_students']) > 0]

    if sem_ctx['current_semester'] == 'summer':
        program_breakdown_str = f"ARAL Summer: {program_risk_counts['summer']} High Risk"
    else:
        program_breakdown_str = (
            f"ARAL Basic: {program_risk_counts['basic']} High Risk  |  "
            f"ARAL Plus: {program_risk_counts['plus']} High Risk"
        )

    return {
        'semester_label': sem_ctx['semester_label'],
        'week_ending_label': sem_ctx['week_ending_label'],
        'program_breakdown_str': program_breakdown_str,
        'total_enrolled_students': len(all_students),
        'total_classes': len(all_class_groups),
        'high_risk_count': total_high_risk,
        'high_risk_class_groups': high_risk_class_groups,
    }


def run_all_weekly_principal_digests(
    target_email: str | None = None,
    dry_run: bool = False,
    prefetched_context: dict | None = None,
) -> dict:
    """Dispatch the consolidated current-semester High Risk summary to active Principal account(s)."""
    payload = build_consolidated_principal_digest_payload(prefetched_context=prefetched_context)

    # Skip sending email if there are no high-risk learners program-wide to save storage and prevent inbox clutter
    if payload.get('high_risk_count', 0) == 0:
        logger.info(
            'ARAL Program has 0 high-risk learners in %s. Principal weekly digest email skipped.',
            payload.get('semester_label', 'active semester'),
        )
        return {
            'semester_label': payload.get('semester_label', ''),
            'total_enrolled_students': payload.get('total_enrolled_students', 0),
            'total_classes': payload.get('total_classes', 0),
            'consolidated_high_risk_count': 0,
            'total_principals': 0,
            'total_sent': 0,
            'status': 'skipped_zero_high_risk',
            'results': [],
        }

    principals = list(
        User.objects.filter(role='principal', is_active=True, is_superuser=False)
        .exclude(email__isnull=True)
        .exclude(email='')
    )

    results = []
    if not principals and target_email:
        # Allow local/CLI testing with --email even if no active Principal user is seeded yet
        digest_copy = {**payload, 'principal_display_name': 'SCHOOL PRINCIPAL'}
        resolved_to = resolve_digest_recipient('', target_email)
        sent = True if dry_run else send_weekly_principal_digest_email(None, digest_copy, to_email=resolved_to)
        results.append({
            'principal_id': None,
            'principal_name': 'SCHOOL PRINCIPAL',
            'principal_email': resolved_to,
            'dispatched_to': resolved_to,
            'total_enrolled_students': payload['total_enrolled_students'],
            'high_risk_count': payload['high_risk_count'],
            'send_success': sent,
            'dry_run': dry_run,
        })
    else:
        for principal in principals:
            p_name = format_staff_display_name(principal, 'School Principal')
            resolved_to = resolve_digest_recipient(principal.email, target_email)
            digest_copy = {**payload, 'principal_display_name': p_name}
            send_success = False
            try:
                if not dry_run:
                    if resolved_to and not resolved_to.lower().endswith('@aralert.local'):
                        send_success = send_weekly_principal_digest_email(principal, digest_copy, to_email=resolved_to)
                        log_audit_event(
                            'WEEKLY_PRINCIPAL_RISK_DIGEST_SENT',
                            user=principal,
                            details={
                                'principal_email': principal.email,
                                'target_recipient': resolved_to,
                                'academic_term': payload['semester_label'],
                                'total_enrolled': payload['total_enrolled_students'],
                                'total_classes': payload['total_classes'],
                                'high_risk_count': payload['high_risk_count'],
                                'send_success': send_success,
                            },
                        )
                else:
                    send_success = True

                results.append({
                    'principal_id': str(principal.id),
                    'principal_name': p_name,
                    'principal_email': principal.email,
                    'dispatched_to': resolved_to if not dry_run else (resolved_to or 'dry-run'),
                    'total_enrolled_students': payload['total_enrolled_students'],
                    'high_risk_count': payload['high_risk_count'],
                    'send_success': send_success,
                    'dry_run': dry_run,
                })
            except Exception as exc:
                logger.exception('Error sending consolidated digest to principal %s: %s', principal.email, exc)
                results.append({
                    'principal_id': str(principal.id),
                    'principal_email': principal.email,
                    'error': str(exc),
                    'send_success': False,
                })

    total_sent = sum(1 for r in results if r.get('send_success'))
    return {
        'semester_label': payload['semester_label'],
        'total_enrolled_students': payload['total_enrolled_students'],
        'total_classes': payload['total_classes'],
        'consolidated_high_risk_count': payload['high_risk_count'],
        'total_principals': len(principals),
        'total_sent': total_sent,
        'results': results,
    }


def _build_bulk_prefetched_context() -> dict:
    """Build shared O(1) prefetched data for both Tutor and Principal weekly digests."""
    sem_ctx = get_active_semester_context()
    all_students = list(get_active_semester_students_qs(sem_ctx['current_semester']))
    student_ids = [s.id for s in all_students]
    grades_by_student, att_by_student = prefetch_student_records(student_ids, sem_ctx['active_sy'])

    students_by_tutor: dict[str, list[User]] = {}
    for s in all_students:
        if getattr(s, 'assigned_tutor_id', None):
            students_by_tutor.setdefault(str(s.assigned_tutor_id), []).append(s)

    return {
        'sem_ctx': sem_ctx,
        'all_students': all_students,
        'students_by_tutor': students_by_tutor,
        'grades_by_student': grades_by_student,
        'att_by_student': att_by_student,
    }


def run_all_weekly_tutor_digests(
    target_email: str | None = None,
    dry_run: bool = False,
    prefetched_context: dict | None = None,
) -> dict:
    """Iterate over all active tutors and send each tutor's class-divided weekly summary."""
    ctx = prefetched_context or _build_bulk_prefetched_context()

    tutors = list(
        User.objects.filter(role='tutor', is_active=True, is_superuser=False)
        .exclude(email__isnull=True)
        .exclude(email='')
    )

    results = []
    for tutor in tutors:
        try:
            res = generate_weekly_tutor_digest(
                tutor,
                target_email=target_email,
                dry_run=dry_run,
                prefetched_context=ctx,
            )
            results.append(res)
        except Exception as exc:
            logger.exception('Error generating weekly digest for tutor %s: %s', tutor.email, exc)
            results.append({
                'tutor_id': str(tutor.id),
                'tutor_email': tutor.email,
                'error': str(exc),
                'send_success': False,
            })

    total_sent = sum(1 for r in results if r.get('send_success'))
    return {
        'total_tutors': len(tutors),
        'total_processed': len(results),
        'total_sent': total_sent,
        'results': results,
    }


def run_weekly_high_risk_digests(
    target_email: str | None = None,
    dry_run: bool = False,
    scope: str = 'all',
    force: bool = False,
) -> dict:
    """
    Master Saturday 12:00 AM PHT entry point:
    - scope='all'       -> dispatches both Tutor copies (by class) and Principal copy (consolidated semester)
    - scope='tutors'    -> dispatches only Tutor copies
    - scope='principal' -> dispatches only Principal consolidated copy
    Includes a same-day idempotency guard for automated runs (bypassed when dry_run, target_email, or force=True).
    """
    normalized_scope = (scope or 'all').strip().lower()
    today_pht_str = str(timezone.localtime(timezone.now()).date())
    testing_lock = _get_testing_digest_lock()

    if not dry_run and not target_email and not force:
        already_dispatched = AuditLog.objects.filter(
            action='WEEKLY_RISK_DIGEST_BATCH_COMPLETED',
            details__batch_date=today_pht_str,
            details__scope__in=[normalized_scope, 'all'],
        ).exists()
        if already_dispatched:
            logger.info(
                'Skipping duplicate Weekly High Risk Digest batch for %s (scope=%s); already completed today.',
                today_pht_str,
                normalized_scope,
            )
            return {
                'skipped_duplicate_run': True,
                'batch_date': today_pht_str,
                'scope': normalized_scope,
                'dry_run': dry_run,
                'testing_recipient_lock': testing_lock or None,
                'tutors': None,
                'principal': None,
            }

    ctx = _build_bulk_prefetched_context()

    tutor_summary = None
    principal_summary = None

    if normalized_scope in ('all', 'tutors', 'tutor'):
        tutor_summary = run_all_weekly_tutor_digests(
            target_email=target_email,
            dry_run=dry_run,
            prefetched_context=ctx,
        )

    if normalized_scope in ('all', 'principal', 'principals'):
        principal_summary = run_all_weekly_principal_digests(
            target_email=target_email,
            dry_run=dry_run,
            prefetched_context=ctx,
        )

    if not dry_run and not target_email:
        tutors_sent = (tutor_summary or {}).get('total_sent', 0)
        principals_sent = (principal_summary or {}).get('total_sent', 0)
        if tutors_sent > 0 or principals_sent > 0:
            log_audit_event(
                'WEEKLY_RISK_DIGEST_BATCH_COMPLETED',
                details={
                    'batch_date': today_pht_str,
                    'scope': normalized_scope,
                    'academic_term': ctx['sem_ctx']['semester_label'],
                    'week_range': ctx['sem_ctx']['week_range_str'],
                    'tutors_sent': tutors_sent,
                    'principals_sent': principals_sent,
                },
            )

    return {
        'skipped_duplicate_run': False,
        'academic_term': ctx['sem_ctx']['semester_label'],
        'week_range': ctx['sem_ctx']['week_range_str'],
        'scope': normalized_scope,
        'dry_run': dry_run,
        'testing_recipient_lock': testing_lock or None,
        'tutors': tutor_summary,
        'principal': principal_summary,
    }
