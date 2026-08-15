import os
import logging
import urllib.request
import json
from common.secret_manager import get_secret

logger = logging.getLogger("email_service")

FROM_EMAIL = os.getenv("FROM_EMAIL", "Slip Vault <noreply@slip-vault.com>")

def send_password_reset_email(to_email: str, reset_url: str) -> bool:
    """Sends password reset email using Resend API / Python SDK."""
    resend_api_key = get_secret("RESEND_API_KEY")
    subject = "Reset Your Slip Vault Password"

    body_text = f"Hello,\n\nYou requested a password reset for your Slip Vault account.\n\nPlease click the link below to set a new password:\n{reset_url}\n\nThis link expires in 1 hour."

    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #2563eb; margin-top: 0; font-size: 20px;">Reset Your Password</h2>
      <p style="color: #475569; font-size: 14px; line-height: 1.5;">You requested a password reset for your <strong>Slip Vault</strong> account.</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="{reset_url}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">Reset Password</a>
      </div>
      <p style="color: #64748b; font-size: 12px; border-t: 1px solid #f1f5f9; pt: 16px;">This link expires in 1 hour. If you didn't request a reset, you can safely ignore this email.</p>
    </div>
    """

    if not resend_api_key:
        logger.warning(f"[RESEND_API_KEY Unset] Reset link for {to_email}: {reset_url}")
        print(f"\n=======================================================\nRESEND API KEY UNSET. RESET LINK FOR {to_email}:\n{reset_url}\n=======================================================\n")
        return True

    # 1. Try sending via official Resend Python SDK
    try:
        import resend
        resend.api_key = resend_api_key
        params = {
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": body_html,
            "text": body_text
        }
        res = resend.Emails.send(params)
        logger.info(f"Password reset email sent via Resend SDK to {to_email}: {res}")
        return True
    except ImportError:
        logger.info("resend SDK not installed. Falling back to Resend REST API HTTP request.")
    except Exception as e:
        logger.error(f"Resend SDK error sending email to {to_email}: {e}")

    # 2. HTTP REST API Fallback to https://api.resend.com/emails
    try:
        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {resend_api_key}",
            "Content-Type": "application/json"
        }
        payload = json.dumps({
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": body_html,
            "text": body_text
        }).encode("utf-8")

        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = response.read().decode("utf-8")
            logger.info(f"Password reset email sent via Resend REST API to {to_email}: {res_body}")
            return True
    except Exception as e:
        logger.error(f"Failed to send email via Resend REST API: {e}")
        return False
