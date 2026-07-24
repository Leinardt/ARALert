import logging
import os
import smtplib
from email.message import EmailMessage

from django.conf import settings
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


def send_mail_with_smtp(subject, body, recipient_email, recipient_name=None):
    """Send an email using Python's built-in smtplib."""
    smtp_host = getattr(settings, 'SMTP_HOST', None) or os.getenv('SMTP_HOST')
    smtp_port = getattr(settings, 'SMTP_PORT', None) or os.getenv('SMTP_PORT')
    smtp_email = getattr(settings, 'SMTP_EMAIL', None) or os.getenv('SMTP_EMAIL')
    smtp_password = getattr(settings, 'SMTP_PASSWORD', None) or os.getenv('SMTP_PASSWORD')
    smtp_use_tls_raw = getattr(settings, 'SMTP_USE_TLS', None)
    if smtp_use_tls_raw is None:
        smtp_use_tls_raw = os.getenv('SMTP_USE_TLS', 'True')
    if isinstance(smtp_use_tls_raw, str):
        smtp_use_tls = smtp_use_tls_raw.strip().lower() in {'1', 'true', 'yes', 'on'}
    else:
        smtp_use_tls = bool(smtp_use_tls_raw)
    sender_name = getattr(settings, 'SENDER_NAME', None) or os.getenv('SENDER_NAME', 'ARALert')

    if not all([smtp_host, smtp_port, smtp_email, smtp_password]):
        logger.warning('SMTP configuration is incomplete; email not sent. Falling back to console output in development.')
        print(f"[EMAIL FALLBACK] To: {recipient_email}")
        print(f"[EMAIL FALLBACK] Subject: {subject}")
        print(f"[EMAIL FALLBACK] Body: {body}")
        return False

    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = f'{sender_name} <{smtp_email}>'
    msg['To'] = recipient_email if recipient_name is None else f'{recipient_name} <{recipient_email}>'
    msg['Reply-To'] = smtp_email
    msg.set_content(body)

    try:
        with smtplib.SMTP(smtp_host, int(smtp_port), timeout=10) as server:
            if smtp_use_tls:
                server.starttls()
            server.login(smtp_email, smtp_password)
            server.send_message(msg)
        logger.info(f'Email sent successfully to {recipient_email}')
        return True
    except Exception as exc:
        logger.exception('Failed to send email to %s: %s', recipient_email, exc)
        return False


def _render_email_template(template_name, context):
    return render_to_string(template_name, context).strip()


def send_account_invitation_email(user, activation_link):
    subject = 'Welcome to ARALert — Create Your Password'
    body = _render_email_template('emails/account_invitation.txt', {
        'recipient_name': user.get_full_name(),
        'activation_link': activation_link,
        'expiration_minutes': getattr(settings, 'TOKEN_EXPIRATION_TIME', '60'),
    })
    return send_mail_with_smtp(subject, body, user.email, user.get_full_name())


def send_password_reset_email(user, reset_link):
    subject = 'ARALert Password Reset'
    body = _render_email_template('emails/password_reset.txt', {
        'recipient_name': user.get_full_name(),
        'reset_link': reset_link,
        'expiration_minutes': getattr(settings, 'TOKEN_EXPIRATION_TIME', '60'),
    })
    return send_mail_with_smtp(subject, body, user.email, user.get_full_name())
