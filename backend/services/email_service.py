"""
Email Service for ARALert.
Handles sending emails via HTTPS relay (Port 443, compatible with Render Free Tier)
or traditional SMTP using settings from Django config.
"""

import html
import json
import logging
import re
import smtplib
import socket
import threading
import time
import urllib.error
import urllib.request
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from django.conf import settings
from django.db import transaction

logger = logging.getLogger(__name__)

SMTP_SOCKET_TIMEOUT_SECONDS = 5
HTTPS_RELAY_TIMEOUT_SECONDS = 12
_smtp_unreachable_until = 0.0


def _sanitize_header_value(raw_value: str | None) -> str:
    """Strip CR/LF characters from email header fields to prevent header injection."""
    if not raw_value:
        return ''
    return re.sub(r'[\r\n]+', ' ', str(raw_value)).strip()


def dispatch_email_async(email_fn, *args, **kwargs) -> None:
    """
    Schedule a non-blocking email call in a daemon thread after the current DB transaction commits.
    Prevents 2-5 second SMTP/HTTPS relay roundtrips from blocking API responses and guarantees
    emails are never dispatched if the database transaction rolls back.
    """
    def _worker():
        try:
            email_fn(*args, **kwargs)
        except Exception as exc:
            logger.warning(
                'Asynchronous email dispatch failed (%s): %s',
                getattr(email_fn, '__name__', 'email'),
                exc,
            )

    def _schedule():
        threading.Thread(target=_worker, daemon=True).start()

    transaction.on_commit(_schedule)


def _resolve_default_sender_name() -> str:
    """Resolve the system sender display name (defaults to 'ARALert System')."""
    raw = _sanitize_header_value(getattr(settings, 'SENDER_NAME', 'ARALert System') or 'ARALert System') or 'ARALert System'
    if raw.lower() == 'aralert system support':
        return 'ARALert System'
    return raw


def _send_via_https_relay(
    subject: str,
    plain_body: str,
    html_body: str,
    to_email: str,
    to_name: str = '',
    reply_to: str = '',
    custom_sender_name: str = '',
) -> bool:
    """
    Dispatch email over HTTPS (Port 443) via a Google Apps Script Gmail Web App relay.
    Works on Render Free Tier (where outbound SMTP ports 25/465/587 are blocked) and localhost.
    """
    relay_url = (getattr(settings, 'EMAIL_RELAY_URL', '') or '').strip()
    relay_secret = (getattr(settings, 'EMAIL_RELAY_SECRET', '') or '').strip()
    default_sender_name = _resolve_default_sender_name()
    clean_custom_sender = _sanitize_header_value(custom_sender_name)
    sender_name = clean_custom_sender if clean_custom_sender else default_sender_name

    clean_to_email = _sanitize_header_value(to_email)
    clean_to_name = _sanitize_header_value(to_name)
    clean_subject = _sanitize_header_value(subject)
    clean_reply_to = _sanitize_header_value(reply_to)

    if not relay_url or not clean_to_email:
        return False

    payload = {
        'secret': relay_secret,
        'to': clean_to_email,
        'to_name': clean_to_name,
        'subject': clean_subject,
        'plain_body': plain_body or '',
        'html_body': html_body or '',
        'sender_name': sender_name,
        'reply_to': clean_reply_to,
    }

    try:
        data_bytes = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            relay_url,
            data=data_bytes,
            headers={
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': 'application/json',
            },
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=HTTPS_RELAY_TIMEOUT_SECONDS) as resp:
            raw_body = resp.read().decode('utf-8', errors='replace').strip()

        try:
            resp_json = json.loads(raw_body) if raw_body else {}
        except json.JSONDecodeError:
            logger.error(
                'HTTPS email relay returned non-JSON response for %s '
                '(ensure the Apps Script Web App "Who has access" setting is set to "Anyone"): %s',
                to_email,
                raw_body[:200],
            )
            return False

        if resp_json.get('ok') is True:
            logger.info('Email sent via HTTPS relay to %s: %s', to_email, subject)
            return True

        logger.error(
            'HTTPS email relay rejected email to %s: %s',
            to_email,
            resp_json.get('error', 'Unknown relay error'),
        )
        return False

    except urllib.error.HTTPError as exc:
        logger.error('HTTPS email relay HTTP %s error for %s: %s', exc.code, to_email, exc)
        return False
    except Exception as exc:
        logger.error('Failed to send email via HTTPS relay to %s: %s', to_email, exc)
        return False


def _parse_smtp_port(raw_port) -> int:
    try:
        return int(str(raw_port).strip() or '587')
    except (TypeError, ValueError):
        return 587


def send_mail_with_smtp(subject: str, body: str, to_email: str, to_name: str = '', reply_to: str = '') -> bool:
    """
    Send a plain-text email via HTTPS relay (if EMAIL_RELAY_URL is set) or SMTP.
    Returns True on success, False on failure.
    """
    global _smtp_unreachable_until

    relay_url = (getattr(settings, 'EMAIL_RELAY_URL', '') or '').strip()
    if relay_url:
        return _send_via_https_relay(
            subject=subject,
            plain_body=body,
            html_body='',
            to_email=to_email,
            to_name=to_name,
            reply_to=reply_to,
        )

    smtp_host = (getattr(settings, 'SMTP_HOST', '') or '').strip()
    smtp_port = _parse_smtp_port(getattr(settings, 'SMTP_PORT', 587))
    smtp_email = (getattr(settings, 'SMTP_EMAIL', '') or '').strip()
    smtp_password = getattr(settings, 'SMTP_PASSWORD', '') or ''
    smtp_use_tls = getattr(settings, 'SMTP_USE_TLS', True)
    sender_name = _resolve_default_sender_name()

    if not smtp_host or not smtp_email:
        logger.warning(
            'Email transport not configured (set EMAIL_RELAY_URL or SMTP_HOST/SMTP_EMAIL). Email not sent to %s.',
            to_email,
        )
        return False

    if time.monotonic() < _smtp_unreachable_until:
        logger.warning(
            'Skipping SMTP send to %s because %s:%s timed out recently '
            '(outbound SMTP ports are blocked on Render Free Tier; use EMAIL_RELAY_URL instead).',
            to_email,
            smtp_host,
            smtp_port,
        )
        return False

    try:
        clean_subject = _sanitize_header_value(subject)
        clean_to_email = _sanitize_header_value(to_email)
        clean_to_name = _sanitize_header_value(to_name)
        clean_reply_to = _sanitize_header_value(reply_to)

        msg = MIMEMultipart('alternative')
        msg['Subject'] = clean_subject
        msg['From'] = f'{sender_name} <{smtp_email}>'
        msg['To'] = f'{clean_to_name} <{clean_to_email}>' if clean_to_name else clean_to_email
        if clean_reply_to:
            msg['Reply-To'] = clean_reply_to

        msg.attach(MIMEText(body, 'plain'))

        if smtp_use_tls:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=SMTP_SOCKET_TIMEOUT_SECONDS)
            server.ehlo()
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=SMTP_SOCKET_TIMEOUT_SECONDS)

        server.login(smtp_email, smtp_password)
        server.sendmail(smtp_email, clean_to_email, msg.as_string())
        server.quit()

        logger.info('Email sent to %s: %s', to_email, subject)
        return True

    except (TimeoutError, socket.timeout, ConnectionRefusedError, OSError) as exc:
        if not isinstance(exc, smtplib.SMTPException):
            _smtp_unreachable_until = time.monotonic() + 60.0
        logger.error('Failed to send email to %s: %s', to_email, exc)
        return False
    except Exception as exc:
        logger.error('Failed to send email to %s: %s', to_email, exc)
        return False


def _send_html_mail_internal(
    subject: str,
    html_body: str,
    plain_body: str,
    to_email: str,
    to_name: str = '',
    reply_to: str = '',
    custom_sender_name: str = '',
) -> bool:
    global _smtp_unreachable_until

    relay_url = (getattr(settings, 'EMAIL_RELAY_URL', '') or '').strip()
    if relay_url:
        return _send_via_https_relay(
            subject=subject,
            plain_body=plain_body,
            html_body=html_body,
            to_email=to_email,
            to_name=to_name,
            reply_to=reply_to,
            custom_sender_name=custom_sender_name,
        )

    smtp_host = (getattr(settings, 'SMTP_HOST', '') or '').strip()
    smtp_port = _parse_smtp_port(getattr(settings, 'SMTP_PORT', 587))
    smtp_email = (getattr(settings, 'SMTP_EMAIL', '') or '').strip()
    smtp_password = getattr(settings, 'SMTP_PASSWORD', '') or ''
    smtp_use_tls = getattr(settings, 'SMTP_USE_TLS', True)
    default_sender_name = _resolve_default_sender_name()
    sender_name = custom_sender_name.strip() if custom_sender_name and custom_sender_name.strip() else default_sender_name

    if not smtp_host or not smtp_email:
        logger.warning(
            'Email transport not configured (set EMAIL_RELAY_URL or SMTP_HOST/SMTP_EMAIL). Email not sent to %s.',
            to_email,
        )
        return False

    if time.monotonic() < _smtp_unreachable_until:
        logger.warning(
            'Skipping HTML SMTP send to %s because %s:%s timed out recently '
            '(outbound SMTP ports are blocked on Render Free Tier; use EMAIL_RELAY_URL instead).',
            to_email,
            smtp_host,
            smtp_port,
        )
        return False

    try:
        clean_subject = _sanitize_header_value(subject)
        clean_to_email = _sanitize_header_value(to_email)
        clean_to_name = _sanitize_header_value(to_name)
        clean_reply_to = _sanitize_header_value(reply_to)
        sender_name = _sanitize_header_value(sender_name)

        msg = MIMEMultipart('alternative')
        msg['Subject'] = clean_subject
        msg['From'] = f'{sender_name} <{smtp_email}>'
        msg['To'] = f'{clean_to_name} <{clean_to_email}>' if clean_to_name else clean_to_email
        if clean_reply_to:
            msg['Reply-To'] = clean_reply_to

        msg.attach(MIMEText(plain_body, 'plain'))
        msg.attach(MIMEText(html_body, 'html'))

        if smtp_use_tls:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=SMTP_SOCKET_TIMEOUT_SECONDS)
            server.ehlo()
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=SMTP_SOCKET_TIMEOUT_SECONDS)

        server.login(smtp_email, smtp_password)
        server.sendmail(smtp_email, clean_to_email, msg.as_string())
        server.quit()

        logger.info('HTML email sent to %s: %s', to_email, subject)
        return True

    except (TimeoutError, socket.timeout, ConnectionRefusedError, OSError) as exc:
        if not isinstance(exc, smtplib.SMTPException):
            _smtp_unreachable_until = time.monotonic() + 60.0
        logger.error('Failed to send HTML email to %s: %s', to_email, exc)
        return False
    except Exception as exc:
        logger.error('Failed to send HTML email to %s: %s', to_email, exc)
        return False


def send_html_mail_with_smtp(subject: str, html_body: str, plain_body: str, to_email: str, to_name: str = '', reply_to: str = '') -> bool:
    """
    Send an HTML email (with plain-text fallback) via HTTPS relay (if EMAIL_RELAY_URL is set) or SMTP.
    Returns True on success, False on failure.
    """
    return _send_html_mail_internal(
        subject=subject,
        html_body=html_body,
        plain_body=plain_body,
        to_email=to_email,
        to_name=to_name,
        reply_to=reply_to,
    )


def _is_eligible_staff_recipient(user) -> bool:
    """Return True only for non-student staff accounts with a real external email address."""
    if not user:
        return False
    is_super = bool(getattr(user, 'is_superuser', False))
    role = str(getattr(user, 'role', '') or '').strip().lower()
    if not is_super and role == 'student':
        return False
    email = str(getattr(user, 'email', '') or '').strip().lower()
    if not email or email.endswith('@aralert.local') or email.startswith('student-'):
        return False
    return True


def _get_staff_lifecycle_display_meta(user) -> dict:
    """Extract clean display name, role title, tutor assignment metadata, and escalation contact."""
    raw_full = (user.get_full_name() if hasattr(user, 'get_full_name') else '') or ''
    fn = str(getattr(user, 'first_name', '') or '').strip()
    mn = str(getattr(user, 'middle_name', '') or '').strip()
    ln = str(getattr(user, 'last_name', '') or '').strip()
    mi = f"{mn[0].upper()}." if mn else ''
    if fn and ln:
        full_name = f"{fn} {mi} {ln}".strip() if mi else f"{fn} {ln}"
    elif raw_full.strip():
        full_name = raw_full.strip()
    else:
        full_name = str(getattr(user, 'email', '') or 'ARALert Staff').split('@')[0].strip()

    is_super = bool(getattr(user, 'is_superuser', False))
    role = str(getattr(user, 'role', '') or '').strip().lower()

    if is_super or role == 'superadmin':
        role_label = 'Super Administrator'
        contact_authority = 'Super Administrator'
    elif role == 'admin':
        role_label = 'School Administrator'
        contact_authority = 'Super Administrator'
    elif role == 'principal':
        role_label = 'School Principal'
        contact_authority = 'School Administrator'
    elif role == 'tutor':
        role_label = 'ARAL Tutor'
        contact_authority = 'School Administrator'
    elif role == 'faculty':
        role_label = 'Faculty Member'
        contact_authority = 'School Administrator'
    else:
        role_label = role.title() if role else 'Staff Member'
        contact_authority = 'School Administrator'

    tutor_program_str = ''
    tutor_subject_str = ''
    if not is_super and role == 'tutor':
        raw_ttype = str(getattr(user, 'tutor_type', '') or getattr(user, 'aral_level', '') or 'basic').lower()
        prog_labels = []
        for token in [p.strip() for p in raw_ttype.replace('_', ',').split(',') if p.strip()]:
            if token == 'basic' and 'ARAL Basic' not in prog_labels:
                prog_labels.append('ARAL Basic')
            elif token == 'plus' and 'ARAL Plus' not in prog_labels:
                prog_labels.append('ARAL Plus')
            elif token == 'summer' and 'ARAL Summer' not in prog_labels:
                prog_labels.append('ARAL Summer')
        tutor_program_str = ', '.join(prog_labels) if prog_labels else 'ARAL Basic'

        raw_subj = str(getattr(user, 'subject', '') or '').strip()
        if raw_subj:
            tutor_subject_str = ', '.join(
                s.strip().title() for s in raw_subj.split(',') if s.strip()
            )

    return {
        'full_name': full_name,
        'email': str(getattr(user, 'email', '') or '').strip(),
        'role_label': role_label,
        'contact_authority': contact_authority,
        'tutor_program_str': tutor_program_str,
        'tutor_subject_str': tutor_subject_str,
    }


def send_account_invitation_email(user, activation_link: str) -> bool:
    """
    Send a styled Google OAuth registration welcome email to a newly created non-student staff account.
    Confirms their pre-registered Google email, assigned role (plus Tutor program/subject if applicable),
    and direct sign-in link.
    """
    if not _is_eligible_staff_recipient(user):
        return False

    meta = _get_staff_lifecycle_display_meta(user)
    full_name = meta['full_name']
    email = meta['email']
    role_label = meta['role_label']
    contact_authority = meta['contact_authority']
    tutor_program_str = meta['tutor_program_str']
    tutor_subject_str = meta['tutor_subject_str']

    frontend_url = (getattr(settings, 'FRONTEND_URL', 'http://localhost:5173') or 'http://localhost:5173').rstrip('/')
    login_link = (activation_link or '').strip() or f"{frontend_url}/login"

    subject = '[ARALert] Account Registered: Welcome to ARALert'

    plain_lines = [
        f"Hello {full_name},",
        "",
        "Your staff account has been registered in the ARALert platform.",
        "",
        f"Full Name               : {full_name}",
        f"Assigned Role           : {role_label}",
    ]
    if tutor_program_str:
        plain_lines.append(f"ARAL Program            : {tutor_program_str}")
    if tutor_subject_str:
        plain_lines.append(f"Assigned Subject        : {tutor_subject_str}")
    plain_lines.extend([
        f"Registered Google Email : {email}",
        "",
        "How to Sign In:",
        f"1. Open the ARALert Sign-In page: {login_link}",
        f"2. Select 'Continue with Google' and sign in using {email}.",
        "",
        f"If you experience any issue accessing your account or notice incorrect details above, "
        f"please contact your {contact_authority}.",
        "",
        "ARALert: A Student Performance Monitoring and Early Academic Risk Detection",
        "System for the ARAL Program of Palanas National Agriculture High School",
    ])
    plain_body = '\n'.join(plain_lines)

    name_esc = html.escape(full_name)
    email_esc = html.escape(email)
    role_esc = html.escape(role_label)
    contact_esc = html.escape(contact_authority)
    link_esc = html.escape(login_link, quote=True)

    tutor_rows_html = ''
    if tutor_program_str:
        tutor_rows_html += (
            f'<tr>'
            f'<td style="padding:4px 8px;color:#15803d;font-weight:700;">ARAL Program:</td>'
            f'<td style="padding:4px 8px;color:#14532d;font-weight:600;">{html.escape(tutor_program_str)}</td>'
            f'</tr>'
        )
    if tutor_subject_str:
        tutor_rows_html += (
            f'<tr>'
            f'<td style="padding:4px 8px;color:#15803d;font-weight:700;">Assigned Subject:</td>'
            f'<td style="padding:4px 8px;color:#14532d;font-weight:600;">{html.escape(tutor_subject_str)}</td>'
            f'</tr>'
        )

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:0;padding:24px 16px;background-color:#f8fafc;color:#1e293b;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="background-color:#0052B7;padding:20px 24px;">
          <p style="margin:0;color:#dbeafe;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">ARALert Account Registration</p>
          <h2 style="margin:4px 0 0;color:#ffffff;font-size:18px;font-weight:700;">Welcome to ARALert</h2>
        </div>
        <div style="padding:24px;">
          <p style="font-size:14px;color:#334155;margin:0 0 14px;">Hello <strong>{name_esc}</strong>,</p>
          <p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 18px;">
            Your account has been registered in the ARALert platform. Your Google email address is now authorized to sign in with the role details below:
          </p>
          <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #10b981;border-radius:8px;padding:14px 16px;margin-bottom:20px;">
            <table style="width:100%;font-size:13px;border-collapse:collapse;">
              <tr>
                <td style="width:165px;padding:4px 8px;color:#15803d;font-weight:700;">Full Name:</td>
                <td style="padding:4px 8px;font-weight:800;color:#14532d;">{name_esc}</td>
              </tr>
              <tr>
                <td style="padding:4px 8px;color:#15803d;font-weight:700;">Assigned Role:</td>
                <td style="padding:4px 8px;font-weight:700;color:#14532d;">{role_esc}</td>
              </tr>
              {tutor_rows_html}
              <tr>
                <td style="padding:4px 8px;color:#15803d;font-weight:700;">Registered Google Email:</td>
                <td style="padding:4px 8px;font-weight:600;color:#166534;">{email_esc}</td>
              </tr>
            </table>
          </div>
          <p style="font-size:13px;color:#475569;line-height:1.6;margin:0 0 18px;">
            To access your dashboard, open ARALert using the button below and choose <strong>Continue with Google</strong> using <strong>{email_esc}</strong>.
          </p>
          <div style="margin:0 0 20px;">
            <a href="{link_esc}" style="background-color:#0052B7;color:#ffffff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block;">Sign In to ARALert</a>
          </div>
          <p style="font-size:12px;color:#64748b;margin:0;line-height:1.6;">
            If you experience any difficulty signing in or notice incorrect account details above, please contact your {contact_esc}.
          </p>
        </div>
        <div style="background:#f8fafc;padding:14px 24px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;line-height:1.5;">
          ARALert: A Student Performance Monitoring and Early Academic Risk Detection System for the ARAL Program of Palanas National Agriculture High School
        </div>
      </div>
    </body>
    </html>
    """

    return send_html_mail_with_smtp(
        subject=subject,
        html_body=html_body,
        plain_body=plain_body,
        to_email=email,
        to_name=full_name,
    )


def send_password_reset_email(user, reset_link: str) -> bool:
    """
    Stub — password resets are no longer used since all accounts use Google OAuth.
    Kept for import compatibility.
    """
    logger.info(
        'send_password_reset_email called for %s but passwords are not used (Google OAuth). No email sent.',
        user.email,
    )
    return False


# ---------------------------------------------------------------------------
# Problem Ticket / Support Email Dispatch
# ---------------------------------------------------------------------------


def send_problem_ticket_email(ticket_data: dict, to_email: str = '') -> bool:
    """
    Dispatch a problem report ticket to the Super Admin via SMTP.
    Reply-To is set to the submitter's contact email.
    """
    if not to_email or not to_email.strip() or to_email.lower().endswith('@aralert.local'):
        logger.warning('send_problem_ticket_email aborted: invalid or empty recipient (%s)', to_email)
        return False
    ticket_id = ticket_data.get('ticket_id', 'TKT-GENERAL')
    submitter_name = ticket_data.get('submitter_name', 'Anonymous User')
    submitter_role = str(ticket_data.get('submitter_role', 'user')).upper()
    contact_email = ticket_data.get('contact_email', '').strip()
    description = ticket_data.get('description', '').strip()
    submitted_at = ticket_data.get('submitted_at', '')
    lrn = ticket_data.get('lrn')
    grade_level = ticket_data.get('grade_level')
    section = ticket_data.get('section')
    tutor_name = ticket_data.get('tutor_name')

    subject = f'[ARALert Ticket] Problem Report from {submitter_name} ({submitter_role})'

    plain_lines = [
        '==================================================',
        '              ARALert PROBLEM REPORT              ',
        '==================================================',
        f'Ticket Reference : {ticket_id}',
        f'Submitted At     : {submitted_at}',
        f'Submitted By     : {submitter_name} [{submitter_role}]',
        f'Contact Email    : {contact_email or "None provided"}',
    ]
    if lrn:
        plain_lines.append(f'Learner LRN      : {lrn}')
    if grade_level or section:
        cls_text = f'{grade_level or ""} - {section or ""}'.strip(' -')
        plain_lines.append(f'Class Section    : {cls_text}')
    if tutor_name:
        plain_lines.append(f'Assigned Tutor   : {tutor_name}')

    plain_lines.extend([
        '--------------------------------------------------',
        'PROBLEM DESCRIPTION:',
        description,
        '--------------------------------------------------',
        'ARALert: A Student Performance Monitoring and Early Academic Risk Detection',
        'System for the ARAL Program of Palanas National Agriculture High School',
        '==================================================',
    ])
    plain_body = '\n'.join(plain_lines)

    safe_ticket_id = html.escape(str(ticket_id))
    safe_submitter_name = html.escape(str(submitter_name))
    safe_submitter_role = html.escape(str(submitter_role))
    safe_contact_email = html.escape(str(contact_email or 'None provided'))
    safe_submitted_at = html.escape(str(submitted_at))
    safe_description = html.escape(str(description))

    extra_rows = []
    if lrn:
        extra_rows.append(f'<tr><td style="padding:4px 8px;color:#64748b;font-weight:600;">LRN:</td><td style="padding:4px 8px;font-family:monospace;font-weight:bold;">{html.escape(str(lrn))}</td></tr>')
    if grade_level or section:
        cls_text = f'{grade_level or ""} - {section or ""}'.strip(' -')
        extra_rows.append(f'<tr><td style="padding:4px 8px;color:#64748b;font-weight:600;">Class:</td><td style="padding:4px 8px;">{html.escape(cls_text)}</td></tr>')
    if tutor_name:
        extra_rows.append(f'<tr><td style="padding:4px 8px;color:#64748b;font-weight:600;">Assigned Tutor:</td><td style="padding:4px 8px;">{html.escape(str(tutor_name))}</td></tr>')
    student_details_html = ''.join(extra_rows)

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:0;padding:24px;background-color:#f8fafc;color:#1e293b;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="background-color:#0052B7;padding:20px 24px;">
          <p style="margin:0;color:#dbeafe;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">ARALert System</p>
          <h2 style="margin:4px 0 0;color:#ffffff;font-size:18px;font-weight:700;">Problem Report Ticket #{safe_ticket_id}</h2>
        </div>
        <div style="padding:24px;">
          <div style="background-color:#f1f5f9;border-radius:8px;padding:14px 16px;margin-bottom:20px;">
            <table style="width:100%;font-size:13px;border-collapse:collapse;">
              <tr><td style="width:130px;padding:4px 8px;color:#64748b;font-weight:600;">Submitted By:</td><td style="padding:4px 8px;font-weight:700;">{safe_submitter_name} <span style="font-size:11px;color:#64748b;text-transform:uppercase;">({safe_submitter_role})</span></td></tr>
              <tr><td style="padding:4px 8px;color:#64748b;font-weight:600;">Contact Email:</td><td style="padding:4px 8px;color:#0052B7;font-weight:600;">{safe_contact_email}</td></tr>
              <tr><td style="padding:4px 8px;color:#64748b;font-weight:600;">Submitted At:</td><td style="padding:4px 8px;color:#475569;">{safe_submitted_at}</td></tr>
              {student_details_html}
            </table>
          </div>
          <h3 style="margin:0 0 8px;font-size:13px;text-transform:uppercase;color:#475569;letter-spacing:0.05em;">Problem Description:</h3>
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-left:4px solid #0052B7;border-radius:6px;padding:14px 16px;font-size:14px;line-height:1.6;color:#334155;white-space:pre-wrap;">{safe_description}</div>
        </div>
        <div style="background:#f8fafc;padding:14px 24px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;line-height:1.5;">
          ARALert: A Student Performance Monitoring and Early Academic Risk Detection System for the ARAL Program of Palanas National Agriculture High School
        </div>
      </div>
    </body>
    </html>
    """

    dynamic_sender_label = f'{submitter_name} ({submitter_role} via ARALert)'

    return _send_html_mail_internal(
        subject=subject,
        html_body=html_body,
        plain_body=plain_body,
        to_email=to_email,
        to_name='ARALert Super Admin',
        reply_to=contact_email,
        custom_sender_name=dynamic_sender_label,
    )


def send_problem_ticket_confirmation_email(ticket_data: dict, to_email: str) -> bool:
    """
    Dispatch an automated confirmation receipt copy to the submitter,
    so they retain their Ticket Reference ID and a record of their submission in their inbox.
    """
    if not to_email or to_email.endswith('@aralert.local'):
        return False

    ticket_id = ticket_data.get('ticket_id', 'TKT-GENERAL')
    submitter_name = ticket_data.get('submitter_name', 'ARALert User')
    description = ticket_data.get('description', '')
    submitted_at = ticket_data.get('submitted_at', '')

    subject = '[ARALert] Ticket Received: Problem Report Confirmation'

    plain_body = (
        f"Hello {submitter_name},\n\n"
        f"Thank you for reaching out to ARALert Support. We have received your problem report.\n\n"
        f"Ticket Reference ID : {ticket_id}\n"
        f"Submitted At        : {submitted_at}\n\n"
        f"Your Description:\n"
        f"{description}\n\n"
        f"The Super Admin team has been notified and is currently reviewing your report. "
        f"If follow-up or additional details are needed, an administrator will reply directly to this email address.\n\n"
        f"Best regards,\n"
        f"ARALert System\n"
        f"Palanas National Agriculture High School\n"
        f"ARALert: A Student Performance Monitoring and Early Academic Risk Detection System for the ARAL Program of Palanas National Agriculture High School"
    )

    safe_ticket_id = html.escape(str(ticket_id))
    safe_submitter_name = html.escape(str(submitter_name))
    safe_description = html.escape(str(description))

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:0;padding:24px;background-color:#f8fafc;color:#1e293b;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="background-color:#0052B7;padding:20px 24px;">
          <p style="margin:0;color:#dbeafe;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">ARALert System</p>
          <h2 style="margin:4px 0 0;color:#ffffff;font-size:18px;font-weight:700;">Problem Report Received</h2>
        </div>
        <div style="padding:24px;">
          <p style="font-size:14px;color:#334155;margin:0 0 16px;">Hello <strong>{safe_submitter_name}</strong>,</p>
          <p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 20px;">
            Thank you for reaching out. We have logged your problem report. Your unique ticket reference number is shown below for tracking:
          </p>
          <div style="background-color:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:14px 18px;margin-bottom:20px;">
            <div style="font-size:11px;font-family:monospace;color:#64748b;font-weight:700;text-transform:uppercase;">Ticket Reference ID</div>
            <div style="font-size:18px;font-family:monospace;font-weight:800;color:#0f172a;margin-top:2px;">{safe_ticket_id}</div>
          </div>
          <h3 style="margin:0 0 8px;font-size:12px;text-transform:uppercase;color:#475569;letter-spacing:0.05em;">Submitted Issue Description:</h3>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #94a3b8;border-radius:6px;padding:12px 14px;font-size:13px;line-height:1.6;color:#334155;white-space:pre-wrap;">{safe_description}</div>
          <p style="font-size:13px;color:#64748b;line-height:1.6;margin-top:20px;">
            The Super Admin team has been notified. If follow-up or additional clarification is needed, an administrator will reply directly to this email address.
          </p>
        </div>
        <div style="background:#f8fafc;padding:14px 24px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;line-height:1.5;">
          ARALert: A Student Performance Monitoring and Early Academic Risk Detection System for the ARAL Program of Palanas National Agriculture High School
        </div>
      </div>
    </body>
    </html>
    """
    return send_html_mail_with_smtp(
        subject=subject,
        html_body=html_body,
        plain_body=plain_body,
        to_email=to_email,
        to_name=submitter_name,
    )


def send_problem_ticket_resolved_email(ticket_data: dict, to_email: str) -> bool:
    """
    Dispatch an email notification to the submitter when their ticket has been resolved or replied to.
    """
    if not to_email or to_email.endswith('@aralert.local'):
        return False

    ticket_id = ticket_data.get('ticket_id', 'TKT-GENERAL')
    submitter_name = ticket_data.get('submitter_name', 'ARALert User')
    admin_name = ticket_data.get('admin_name', 'Super Admin')
    admin_reply = ticket_data.get('admin_reply', '').strip()
    status_label = str(ticket_data.get('status', 'Resolved')).replace('_', ' ').upper()

    subject = f'[ARALert Ticket] Status Update: {status_label}'
    is_dismissed = status_label == 'DISMISSED'
    card_bg = '#f8fafc' if is_dismissed else '#f0fdf4'
    card_border = '#cbd5e1' if is_dismissed else '#bbf7d0'
    label_color = '#475569' if is_dismissed else '#15803d'
    status_text_color = '#0f172a' if is_dismissed else '#14532d'
    accent_bar_color = '#94a3b8' if is_dismissed else '#10b981'
    note_heading = 'Super Admin Dismissal Reason:' if is_dismissed else 'Super Admin Response / Resolution:'

    plain_body = (
        f"Hello {submitter_name},\n\n"
        f"Your ARALert problem report (Ticket #{ticket_id}) has been updated.\n\n"
        f"Status: {status_label}\n"
        f"Updated By: {admin_name}\n\n"
        f"Administrative Response:\n"
        f"{admin_reply}\n\n"
        f"You can also view this update inside the ARALert platform by clicking the Notification Bell on your dashboard.\n\n"
        f"Best regards,\n"
        f"ARALert System\n"
        f"Palanas National Agriculture High School\n"
        f"ARALert: A Student Performance Monitoring and Early Academic Risk Detection System for the ARAL Program of Palanas National Agriculture High School"
    )

    safe_ticket_id = html.escape(str(ticket_id))
    safe_submitter_name = html.escape(str(submitter_name))
    safe_admin_name = html.escape(str(admin_name))
    safe_admin_reply = html.escape(str(admin_reply))
    safe_status_label = html.escape(str(status_label))

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:0;padding:24px;background-color:#f8fafc;color:#1e293b;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="background-color:#0052B7;padding:20px 24px;">
          <p style="margin:0;color:#dbeafe;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">ARALert System</p>
          <h2 style="margin:4px 0 0;color:#ffffff;font-size:18px;font-weight:700;">Ticket #{safe_ticket_id} - {safe_status_label}</h2>
        </div>
        <div style="padding:24px;">
          <p style="font-size:14px;color:#334155;margin:0 0 16px;">Hello <strong>{safe_submitter_name}</strong>,</p>
          <p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 20px;">
            An update is available on your problem report.
          </p>
          <div style="background-color:{card_bg};border:1px solid {card_border};border-radius:8px;padding:12px 16px;margin-bottom:20px;">
            <table style="width:100%;font-size:13px;border-collapse:collapse;">
              <tr><td style="width:130px;color:{label_color};font-weight:700;">Status:</td><td style="font-weight:800;color:{status_text_color};">{safe_status_label}</td></tr>
              <tr><td style="color:{label_color};font-weight:700;">Handled By:</td><td style="color:#334155;">{safe_admin_name}</td></tr>
            </table>
          </div>
          <h3 style="margin:0 0 8px;font-size:12px;text-transform:uppercase;color:#475569;letter-spacing:0.05em;">{note_heading}</h3>
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-left:4px solid {accent_bar_color};border-radius:6px;padding:14px 16px;font-size:14px;line-height:1.6;color:#1e293b;white-space:pre-wrap;">{safe_admin_reply}</div>
          <p style="font-size:12px;color:#64748b;margin-top:20px;line-height:1.5;">
            You can also review this ticket inside the ARALert platform by opening the Notification Bell in your dashboard.
          </p>
        </div>
        <div style="background:#f8fafc;padding:14px 24px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;line-height:1.5;">
          ARALert: A Student Performance Monitoring and Early Academic Risk Detection System for the ARAL Program of Palanas National Agriculture High School
        </div>
      </div>
    </body>
    </html>
    """
    return send_html_mail_with_smtp(
        subject=subject,
        html_body=html_body,
        plain_body=plain_body,
        to_email=to_email,
        to_name=submitter_name,
    )


# ---------------------------------------------------------------------------
# Account Lifecycle Emails (Staff Activation & Deactivation)
# ---------------------------------------------------------------------------

def send_account_activated_email(user) -> bool:
    """Notify a non-student staff member that their ARALert account access has been activated."""
    if not _is_eligible_staff_recipient(user):
        return False

    meta = _get_staff_lifecycle_display_meta(user)
    full_name = meta['full_name']
    email = meta['email']
    role_label = meta['role_label']
    contact_authority = meta['contact_authority']

    frontend_url = (getattr(settings, 'FRONTEND_URL', 'http://localhost:5173') or 'http://localhost:5173').rstrip('/')
    login_link = f"{frontend_url}/login"

    subject = '[ARALert] Account Access Activated'
    plain_body = (
        f"Hello {full_name},\n\n"
        f"Your ARALert account access has been activated.\n\n"
        f"Status                  : ACTIVE\n"
        f"Assigned Role           : {role_label}\n"
        f"Registered Google Email : {email}\n\n"
        f"You can now sign in using 'Continue with Google' at:\n"
        f"{login_link}\n\n"
        f"If you have any questions regarding your account permissions, please contact your {contact_authority}.\n\n"
        f"ARALert: A Student Performance Monitoring and Early Academic Risk Detection "
        f"System for the ARAL Program of Palanas National Agriculture High School"
    )

    name_esc = html.escape(full_name)
    email_esc = html.escape(email)
    role_esc = html.escape(role_label)
    contact_esc = html.escape(contact_authority)
    link_esc = html.escape(login_link, quote=True)

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:0;padding:24px 16px;background-color:#f8fafc;color:#1e293b;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="background-color:#0052B7;padding:20px 24px;">
          <p style="margin:0;color:#dbeafe;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">ARALert Account Notice</p>
          <h2 style="margin:4px 0 0;color:#ffffff;font-size:18px;font-weight:700;">Account Access Activated</h2>
        </div>
        <div style="padding:24px;">
          <p style="font-size:14px;color:#334155;margin:0 0 14px;">Hello <strong>{name_esc}</strong>,</p>
          <p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 18px;">
            Your ARALert account access has been activated. Full access to your dashboard and assigned responsibilities is now available.
          </p>
          <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #10b981;border-radius:8px;padding:14px 16px;margin-bottom:20px;">
            <table style="width:100%;font-size:13px;border-collapse:collapse;">
              <tr>
                <td style="width:165px;padding:4px 8px;color:#15803d;font-weight:700;">Status:</td>
                <td style="padding:4px 8px;font-weight:800;color:#14532d;">ACTIVE</td>
              </tr>
              <tr>
                <td style="padding:4px 8px;color:#15803d;font-weight:700;">Assigned Role:</td>
                <td style="padding:4px 8px;font-weight:700;color:#14532d;">{role_esc}</td>
              </tr>
              <tr>
                <td style="padding:4px 8px;color:#15803d;font-weight:700;">Registered Google Email:</td>
                <td style="padding:4px 8px;font-weight:600;color:#166534;">{email_esc}</td>
              </tr>
            </table>
          </div>
          <div style="margin:0 0 20px;">
            <a href="{link_esc}" style="background-color:#0052B7;color:#ffffff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block;">Sign In to ARALert</a>
          </div>
          <p style="font-size:12px;color:#64748b;margin:0;line-height:1.6;">
            Sign in using <strong>Continue with Google</strong> with your registered email address above. For any account inquiries, please contact your {contact_esc}.
          </p>
        </div>
        <div style="background:#f8fafc;padding:14px 24px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;line-height:1.5;">
          ARALert: A Student Performance Monitoring and Early Academic Risk Detection System for the ARAL Program of Palanas National Agriculture High School
        </div>
      </div>
    </body>
    </html>
    """
    return send_html_mail_with_smtp(subject, html_body, plain_body, email, full_name)


def send_account_deactivated_email(user) -> bool:
    """Notify a non-student staff member that their ARALert account access has been deactivated."""
    if not _is_eligible_staff_recipient(user):
        return False

    meta = _get_staff_lifecycle_display_meta(user)
    full_name = meta['full_name']
    email = meta['email']
    role_label = meta['role_label']
    contact_authority = meta['contact_authority']

    subject = '[ARALert] Account Access Deactivated'
    plain_body = (
        f"Hello {full_name},\n\n"
        f"Your ARALert account access has been deactivated.\n\n"
        f"Status        : DEACTIVATED\n"
        f"Assigned Role : {role_label}\n"
        f"Account Email : {email}\n\n"
        f"Active sessions associated with this account have been signed out. "
        f"If you believe this action was made in error or need your access restored, "
        f"please contact your {contact_authority}.\n\n"
        f"ARALert: A Student Performance Monitoring and Early Academic Risk Detection "
        f"System for the ARAL Program of Palanas National Agriculture High School"
    )

    name_esc = html.escape(full_name)
    email_esc = html.escape(email)
    role_esc = html.escape(role_label)
    contact_esc = html.escape(contact_authority)

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:0;padding:24px 16px;background-color:#f8fafc;color:#1e293b;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="background-color:#0052B7;padding:20px 24px;">
          <p style="margin:0;color:#dbeafe;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">ARALert Account Notice</p>
          <h2 style="margin:4px 0 0;color:#ffffff;font-size:18px;font-weight:700;">Account Access Deactivated</h2>
        </div>
        <div style="padding:24px;">
          <p style="font-size:14px;color:#334155;margin:0 0 14px;">Hello <strong>{name_esc}</strong>,</p>
          <p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 18px;">
            Your ARALert account access has been deactivated, and any active sessions associated with this account have been signed out.
          </p>
          <div style="background-color:#fef2f2;border:1px solid #fecaca;border-left:4px solid #dc2626;border-radius:8px;padding:14px 16px;margin-bottom:20px;">
            <table style="width:100%;font-size:13px;border-collapse:collapse;">
              <tr>
                <td style="width:145px;padding:4px 8px;color:#991b1b;font-weight:700;">Status:</td>
                <td style="padding:4px 8px;font-weight:800;color:#7f1d1d;">DEACTIVATED</td>
              </tr>
              <tr>
                <td style="padding:4px 8px;color:#991b1b;font-weight:700;">Assigned Role:</td>
                <td style="padding:4px 8px;font-weight:700;color:#7f1d1d;">{role_esc}</td>
              </tr>
              <tr>
                <td style="padding:4px 8px;color:#991b1b;font-weight:700;">Account Email:</td>
                <td style="padding:4px 8px;font-weight:600;color:#991b1b;">{email_esc}</td>
              </tr>
            </table>
          </div>
          <p style="font-size:13px;color:#475569;margin:0;line-height:1.6;">
            If you believe this action was made in error or need your access restored, please contact your <strong>{contact_esc}</strong>.
          </p>
        </div>
        <div style="background:#f8fafc;padding:14px 24px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;line-height:1.5;">
          ARALert: A Student Performance Monitoring and Early Academic Risk Detection System for the ARAL Program of Palanas National Agriculture High School
        </div>
      </div>
    </body>
    </html>
    """
    return send_html_mail_with_smtp(subject, html_body, plain_body, email, full_name)


# ---------------------------------------------------------------------------
# Weekly High Risk Summary Digest Emails (Saturday 12:00 AM PHT)
# ---------------------------------------------------------------------------

def send_weekly_risk_digest_email(tutor, digest_data: dict, to_email: str | None = None) -> bool:
    """
    Send weekly academic risk digest reminder to a tutor.
    Lists only the count of high-risk students per handled class.
    Skips sending if high-risk student count is 0 to save email storage and avoid inbox clutter.
    """
    recipient_email = (to_email or getattr(tutor, 'email', '') or '').strip()
    if not recipient_email or recipient_email.lower().endswith('@aralert.local'):
        return False

    high_risk_students = list(digest_data.get('high_risk_students') or [])
    high_risk_count = len(high_risk_students)
    if high_risk_count == 0:
        logger.info('send_weekly_risk_digest_email skipped for %s: 0 high-risk learners.', recipient_email)
        return False

    raw_tutor_name = (
        digest_data.get('tutor_display_name')
        or (tutor.get_full_name() if hasattr(tutor, 'get_full_name') else str(tutor))
        or 'ARALert Tutor'
    ).strip()
    tutor_name_esc = html.escape(raw_tutor_name)

    class_groups = list(digest_data.get('class_groups') or [])
    active_risk_groups = [cg for cg in class_groups if len(cg.get('high_risk_students') or []) > 0]
    if not active_risk_groups and high_risk_students:
        fallback_map: dict[str, int] = {}
        for item in high_risk_students:
            cls_key = str(item.get('class_section') or 'HANDLED CLASS').strip()
            fallback_map[cls_key] = fallback_map.get(cls_key, 0) + 1
        active_risk_groups = [
            {'class_name': k, 'high_risk_count': v}
            for k, v in fallback_map.items()
        ]

    class_items_html: list[str] = []
    plain_class_lines: list[str] = []

    for cg in active_risk_groups:
        c_name = str(cg.get('class_name') or 'HANDLED CLASS').strip()
        c_risks = len(cg.get('high_risk_students') or []) if 'high_risk_students' in cg else int(cg.get('high_risk_count') or 0)
        c_name_esc = html.escape(c_name)
        word = 'student' if c_risks == 1 else 'students'
        class_items_html.append(
            f'<li style="margin:6px 0;font-size:14px;color:#1e293b;"><strong>{c_name_esc}</strong>: {c_risks} high-risk {word}</li>'
        )
        plain_class_lines.append(f"• {c_name}: {c_risks} high-risk {word}")

    subject = '[ARALert] High Risk Students Reminder'

    frontend_url = (getattr(settings, 'FRONTEND_URL', 'http://localhost:5173') or 'http://localhost:5173').rstrip('/')
    dashboard_url = f"{frontend_url}/tutor/students"

    class_lines_str = "\n".join(plain_class_lines)
    plain_body = f"""ARALert: Weekly Reminder

Hello {raw_tutor_name},

You have high-risk student(s) requiring attention this week:
{class_lines_str}

Please log in to your dashboard to view student details:
{dashboard_url}

Palanas National Agriculture High School • ARALert
"""

    html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:0;padding:24px 16px;background-color:#f8fafc;color:#1e293b;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background-color:#0052B7;padding:18px 24px;">
      <h2 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">ARALert</h2>
      <p style="margin:4px 0 0;color:#dbeafe;font-size:12px;">Weekly Reminder</p>
    </div>
    <div style="padding:24px;">
      <p style="font-size:14px;color:#334155;margin:0 0 14px;">Hello <strong>{tutor_name_esc}</strong>,</p>
      <p style="font-size:14px;color:#334155;margin:0 0 14px;line-height:1.5;">You have high-risk student(s) requiring attention this week:</p>
      <ul style="margin:0 0 18px;padding-left:20px;line-height:1.6;">
        {''.join(class_items_html)}
      </ul>
      <p style="font-size:13px;color:#64748b;margin:0 0 18px;line-height:1.5;">Please log in to your dashboard to view student details.</p>
      <div style="margin:18px 0 8px;">
        <a href="{dashboard_url}" style="display:inline-block;background-color:#0052B7;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;padding:10px 22px;border-radius:6px;">View Dashboard</a>
      </div>
    </div>
    <div style="background:#f8fafc;padding:12px 24px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;">
      Palanas National Agriculture High School • ARALert
    </div>
  </div>
</body>
</html>"""

    return send_html_mail_with_smtp(
        subject=subject,
        html_body=html_body,
        plain_body=plain_body,
        to_email=recipient_email,
        to_name=raw_tutor_name,
    )


def send_weekly_principal_digest_email(principal, digest_data: dict, to_email: str | None = None) -> bool:
    """
    Send consolidated weekly high-risk summary to a Principal.
    Lists only the count of high-risk students per handled class with tutor name and total.
    Skips sending if high-risk student count is 0 to save email storage and avoid inbox clutter.
    """
    recipient_email = (to_email or getattr(principal, 'email', '') or '').strip()
    if not recipient_email or recipient_email.lower().endswith('@aralert.local'):
        return False

    high_risk_count = int(digest_data.get('high_risk_count') or 0)
    if high_risk_count == 0:
        logger.info('send_weekly_principal_digest_email skipped for %s: 0 high-risk learners.', recipient_email)
        return False

    raw_principal_name = (
        digest_data.get('principal_display_name')
        or (principal.get_full_name() if hasattr(principal, 'get_full_name') else str(principal))
        or 'School Principal'
    ).strip()
    principal_name_esc = html.escape(raw_principal_name)

    high_risk_class_groups = list(digest_data.get('high_risk_class_groups') or [])

    class_items_html: list[str] = []
    plain_class_lines: list[str] = []

    for cg in high_risk_class_groups:
        c_name = str(cg.get('class_name') or 'ARAL CLASS').strip()
        c_tutor = str(cg.get('tutor_name') or 'TBA').strip()
        c_risks = len(cg.get('high_risk_students') or []) if 'high_risk_students' in cg else int(cg.get('high_risk_count') or 0)
        c_name_esc = html.escape(c_name)
        c_tutor_esc = html.escape(c_tutor)
        word = 'student' if c_risks == 1 else 'students'
        class_items_html.append(
            f'<li style="margin:6px 0;font-size:14px;color:#1e293b;"><strong>{c_name_esc}</strong> (Tutor: {c_tutor_esc}): {c_risks} {word}</li>'
        )
        plain_class_lines.append(f"• {c_name} (Tutor: {c_tutor}): {c_risks} {word}")

    subject = '[ARALert] Weekly High Risk Summary'

    frontend_url = (getattr(settings, 'FRONTEND_URL', 'http://localhost:5173') or 'http://localhost:5173').rstrip('/')
    analytics_url = f"{frontend_url}/principal/analytics"

    total_word = 'student' if high_risk_count == 1 else 'students'
    class_lines_str = "\n".join(plain_class_lines)

    plain_body = f"""ARALert: Weekly Summary

Hello {raw_principal_name},

High-risk student count across the ARAL Program this week:
{class_lines_str}

Total: {high_risk_count} high-risk {total_word}

Please log in to the dashboard to review program analytics:
{analytics_url}

Palanas National Agriculture High School • ARALert
"""

    html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:0;padding:24px 16px;background-color:#f8fafc;color:#1e293b;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background-color:#0052B7;padding:18px 24px;">
      <h2 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">ARALert</h2>
      <p style="margin:4px 0 0;color:#dbeafe;font-size:12px;">Weekly Summary</p>
    </div>
    <div style="padding:24px;">
      <p style="font-size:14px;color:#334155;margin:0 0 14px;">Hello <strong>{principal_name_esc}</strong>,</p>
      <p style="font-size:14px;color:#334155;margin:0 0 14px;line-height:1.5;">High-risk student count across the ARAL Program this week:</p>
      <ul style="margin:0 0 14px;padding-left:20px;line-height:1.6;">
        {''.join(class_items_html)}
      </ul>
      <p style="font-size:14px;font-weight:700;color:#dc2626;margin:0 0 18px;">Total: {high_risk_count} high-risk {total_word}</p>
      <p style="font-size:13px;color:#64748b;margin:0 0 18px;line-height:1.5;">Please log in to the dashboard to review program analytics.</p>
      <div style="margin:18px 0 8px;">
        <a href="{analytics_url}" style="display:inline-block;background-color:#0052B7;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;padding:10px 22px;border-radius:6px;">View Analytics</a>
      </div>
    </div>
    <div style="background:#f8fafc;padding:12px 24px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;">
      Palanas National Agriculture High School • ARALert
    </div>
  </div>
</body>
</html>"""

    return send_html_mail_with_smtp(
        subject=subject,
        html_body=html_body,
        plain_body=plain_body,
        to_email=recipient_email,
        to_name=raw_principal_name,
    )
