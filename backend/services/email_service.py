"""
Email Service for ARALert.
Handles sending emails via SMTP using settings from Django config.
"""

import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from django.conf import settings

logger = logging.getLogger(__name__)


def send_mail_with_smtp(subject: str, body: str, to_email: str, to_name: str = '') -> bool:
    """
    Send a plain-text email via SMTP.
    Returns True on success, False on failure.
    """
    smtp_host = getattr(settings, 'SMTP_HOST', '')
    smtp_port = int(getattr(settings, 'SMTP_PORT', 587))
    smtp_email = getattr(settings, 'SMTP_EMAIL', '')
    smtp_password = getattr(settings, 'SMTP_PASSWORD', '')
    smtp_use_tls = getattr(settings, 'SMTP_USE_TLS', True)
    sender_name = getattr(settings, 'SENDER_NAME', 'ARALert')

    if not smtp_host or not smtp_email:
        logger.warning('SMTP not configured. Email not sent to %s.', to_email)
        return False

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f'{sender_name} <{smtp_email}>'
        msg['To'] = f'{to_name} <{to_email}>' if to_name else to_email

        msg.attach(MIMEText(body, 'plain'))

        if smtp_use_tls:
            server = smtplib.SMTP(smtp_host, smtp_port)
            server.ehlo()
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port)

        server.login(smtp_email, smtp_password)
        server.sendmail(smtp_email, to_email, msg.as_string())
        server.quit()

        logger.info('Email sent to %s: %s', to_email, subject)
        return True

    except Exception as exc:
        logger.error('Failed to send email to %s: %s', to_email, exc)
        return False


def send_html_mail_with_smtp(subject: str, html_body: str, plain_body: str, to_email: str, to_name: str = '') -> bool:
    """
    Send an HTML email (with plain-text fallback) via SMTP.
    Returns True on success, False on failure.
    """
    smtp_host = getattr(settings, 'SMTP_HOST', '')
    smtp_port = int(getattr(settings, 'SMTP_PORT', 587))
    smtp_email = getattr(settings, 'SMTP_EMAIL', '')
    smtp_password = getattr(settings, 'SMTP_PASSWORD', '')
    smtp_use_tls = getattr(settings, 'SMTP_USE_TLS', True)
    sender_name = getattr(settings, 'SENDER_NAME', 'ARALert')

    if not smtp_host or not smtp_email:
        logger.warning('SMTP not configured. Email not sent to %s.', to_email)
        return False

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f'{sender_name} <{smtp_email}>'
        msg['To'] = f'{to_name} <{to_email}>' if to_name else to_email

        msg.attach(MIMEText(plain_body, 'plain'))
        msg.attach(MIMEText(html_body, 'html'))

        if smtp_use_tls:
            server = smtplib.SMTP(smtp_host, smtp_port)
            server.ehlo()
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port)

        server.login(smtp_email, smtp_password)
        server.sendmail(smtp_email, to_email, msg.as_string())
        server.quit()

        logger.info('HTML email sent to %s: %s', to_email, subject)
        return True

    except Exception as exc:
        logger.error('Failed to send HTML email to %s: %s', to_email, exc)
        return False


def send_account_invitation_email(user, activation_link: str) -> bool:
    """
    Send a Google login invitation email to a newly created staff account.
    Since the system now uses Google OAuth, this just notifies the user that
    their account has been created and they can now log in with Google.
    """
    full_name = user.get_full_name() if hasattr(user, 'get_full_name') else str(user)
    email = user.email

    subject = 'Your ARALert Account Has Been Created'
    body = (
        f'Hello {full_name},\n\n'
        f'Your ARALert account has been created.\n\n'
        f'You can now sign in using your Google account ({email}) at:\n'
        f'{activation_link}\n\n'
        f'Important: Only accounts with @edu.ph or @deped.gov.ph email addresses '
        f'can log in directly. If your email is a personal address, please contact '
        f'your administrator to verify that your email has been approved.\n\n'
        f'If you have any questions, please contact your school administrator.\n\n'
        f'Best regards,\n'
        f'The ARALert Team'
    )

    return send_mail_with_smtp(subject, body, email, full_name)


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
