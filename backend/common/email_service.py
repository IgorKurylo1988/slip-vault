import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger("email_service")

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@slip-vault.com")

def send_password_reset_email(to_email: str, reset_url: str) -> bool:
    """Sends password reset email via SMTP, or logs reset URL if SMTP is unconfigured."""
    subject = "Reset Your Slip Vault Password"
    body_text = f"Hello,\n\nYou requested a password reset for your Slip Vault account.\n\nPlease click the link below or copy it into your browser to set a new password:\n{reset_url}\n\nThis link will expire in 1 hour.\nIf you did not request this reset, please ignore this email."
    
    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #2563eb; margin-top: 0;">Reset Your Password</h2>
      <p style="color: #475569; font-size: 14px;">You requested a password reset for your <strong>Slip Vault</strong> account.</p>
      <div style="margin: 24px 0; text-align: center;">
        <a href="{reset_url}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">Reset Password</a>
      </div>
      <p style="color: #64748b; font-size: 12px;">This link expires in 1 hour. If you didn't request a reset, you can safely ignore this email.</p>
    </div>
    """

    if not SMTP_HOST or not SMTP_USER or not SMTP_PASSWORD:
        logger.warning(f"[SMTP Unconfigured] Password reset link generated for {to_email}: {reset_url}")
        print(f"\n=======================================================\nPASSWORD RESET LINK FOR {to_email}:\n{reset_url}\n=======================================================\n")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = FROM_EMAIL
        msg["To"] = to_email

        msg.attach(MIMEText(body_text, "plain"))
        msg.attach(MIMEText(body_html, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(FROM_EMAIL, [to_email], msg.as_string())
        
        logger.info(f"Password reset email sent via SMTP to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send reset email to {to_email} via SMTP: {e}")
        return False
