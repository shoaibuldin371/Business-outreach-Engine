import os
import smtplib
from email.message import EmailMessage
from email.utils import formataddr
from typing import Dict, Any, Tuple
from config import settings
from supabase_client import db_manager

class EmailService:
    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_pass = settings.SMTP_PASSWORD
        self.sender_email = settings.SENDER_EMAIL or "outreach@agency.com"
        self.sender_name = settings.SENDER_NAME or "Web Design & Growth Studio"
        self.admin_email = settings.ADMIN_EMAIL

    def _is_smtp_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_pass)

    def send_raw_email(self, to_email: str, subject: str, text_body: str, html_body: str = None) -> Tuple[bool, str]:
        """Sends an email via SMTP or simulates it cleanly in dev mode."""
        if not to_email:
            return False, "Recipient email is missing."

        if not self._is_smtp_configured():
            # In simulation/local mode without live SMTP credentials
            safe_subj = subject.encode('ascii', 'replace').decode('ascii')
            print(f"[EMAIL Simulation] To: {to_email} | Subject: {safe_subj}")
            return True, "Simulated send (SMTP credentials not configured in .env)."

        try:
            msg = EmailMessage()
            msg["Subject"] = subject
            msg["From"] = formataddr((self.sender_name, self.sender_email))
            msg["To"] = to_email
            msg.set_content(text_body)
            if html_body:
                msg.add_alternative(html_body, subtype="html")

            with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=20) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_pass)
                server.send_message(msg)

            return True, "Sent successfully via SMTP."
        except Exception as e:
            err_msg = f"SMTP Send Error: {str(e)}"
            print(f"! {err_msg}")
            return False, err_msg

    def send_hitl_approval_email(self, lead: Dict[str, Any], token: str) -> bool:
        """
        Sends an interactive Human-In-The-Loop approval email to the Admin's Gmail.
        Contains business intel, drafted email, and 1-click Approve/Reject links.
        """
        business_name = lead.get("business_name", "Local Business")
        city = lead.get("city", "Local Area")
        phone = lead.get("phone") or "Not listed"
        target_email = lead.get("email") or "contact@business.com"
        subject = lead.get("email_subject") or f"A modern website proposal for {business_name}"
        body = lead.get("email_body") or ""
        
        approve_url = f"{settings.BACKEND_PUBLIC_URL}/api/approval/approve?token={token}"
        reject_url = f"{settings.BACKEND_PUBLIC_URL}/api/approval/reject?token={token}"
        dashboard_url = f"{settings.FRONTEND_URL}/"

        admin_subject = f"[APPROVAL NEEDED] Pitch Website to: {business_name} ({city})"
        
        text_body = f"""BUSINESS OUTREACH ENGINE - APPROVAL REQUIRED

We found a qualified local business without an active website:
- Business: {business_name}
- Category: {lead.get('category', 'Local Service')}
- City: {city}
- Phone: {phone}
- Prospect Email: {target_email}

DRAFT PITCH:
Subject: {subject}
--------------------------------------------------
{body}
--------------------------------------------------

HUMAN IN THE LOOP ACTIONS:
Approve & Send: {approve_url}
Reject Draft:   {reject_url}
Open Dashboard: {dashboard_url}
"""

        html_body = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f3f4f6; margin: 0; padding: 24px; }}
    .card {{ max-width: 620px; margin: 0 auto; background: #111827; border-radius: 14px; border: 1px solid #1f2937; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }}
    .header {{ background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 24px; text-align: center; }}
    .header h1 {{ margin: 0; font-size: 22px; color: #ffffff; font-weight: 700; }}
    .header p {{ margin: 6px 0 0; color: #e0e7ff; font-size: 14px; }}
    .content {{ padding: 24px; }}
    .badge {{ display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: #ef4444; color: #ffffff; }}
    .info-grid {{ background: #1f2937; border-radius: 8px; padding: 16px; margin: 16px 0; }}
    .info-row {{ display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #374151; font-size: 14px; }}
    .info-row:last-child {{ border-bottom: none; }}
    .label {{ color: #9ca3af; }}
    .value {{ color: #ffffff; font-weight: 600; }}
    .draft-box {{ background: #0f172a; border-left: 4px solid #6366f1; padding: 16px; border-radius: 6px; margin: 20px 0; }}
    .draft-title {{ font-size: 14px; font-weight: 700; color: #818cf8; margin-bottom: 8px; }}
    .draft-body {{ white-space: pre-wrap; font-size: 14px; line-height: 1.6; color: #e2e8f0; }}
    .actions {{ display: flex; gap: 12px; margin: 28px 0 10px; justify-content: center; }}
    .btn {{ display: inline-block; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 15px; text-decoration: none; text-align: center; }}
    .btn-approve {{ background: #10b981; color: #ffffff !important; }}
    .btn-reject {{ background: #ef4444; color: #ffffff !important; }}
    .footer {{ text-align: center; padding: 16px; font-size: 12px; color: #6b7280; border-top: 1px solid #1f2937; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>🚀 Business Outreach Engine</h1>
      <p>Human-in-the-Loop Review Needed</p>
    </div>
    <div class="content">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h2 style="margin: 0; color: #ffffff; font-size: 18px;">{business_name}</h2>
        <span class="badge">Missing Website</span>
      </div>

      <div class="info-grid">
        <div class="info-row"><span class="label">City / Market:</span><span class="value">{city}</span></div>
        <div class="info-row"><span class="label">Category:</span><span class="value">{lead.get('category', 'Local Service')}</span></div>
        <div class="info-row"><span class="label">Phone:</span><span class="value">{phone}</span></div>
        <div class="info-row"><span class="label">Target Contact:</span><span class="value">{target_email}</span></div>
      </div>

      <div class="draft-box">
        <div class="draft-title">Proposed Email Pitch</div>
        <div style="font-size: 13px; color: #94a3b8; margin-bottom: 8px;"><strong>Subject:</strong> {subject}</div>
        <div class="draft-body">{body}</div>
      </div>

      <div style="text-align: center; margin: 24px 0;">
        <p style="font-size: 14px; color: #9ca3af; margin-bottom: 16px;">
          Choose your action below. If approved, this pitch will be delivered automatically to the business prospect.
        </p>
        <div class="actions">
          <a href="{approve_url}" class="btn btn-approve" style="margin-right: 8px;">✅ Approve & Send Pitch</a>
          <a href="{reject_url}" class="btn btn-reject">❌ Reject Draft</a>
        </div>
      </div>

      <div style="text-align: center; margin-top: 16px;">
        <a href="{dashboard_url}" style="color: #60a5fa; font-size: 13px; text-decoration: none;">Open Web Dashboard →</a>
      </div>
    </div>
    <div class="footer">
      Automated 3-Hour Business Outreach Engine • Railway & Vercel
    </div>
  </div>
</body>
</html>
"""

        success, msg = self.send_raw_email(self.admin_email, admin_subject, text_body, html_body)
        
        # Log approval dispatch
        db_manager.insert_log(
            step="approval_pending",
            status="info" if success else "warning",
            message=f"Sent HITL approval request to Gmail ({self.admin_email}) for {business_name}: {msg}",
            details={"lead_id": lead["id"], "admin_email": self.admin_email, "target_business": business_name, "token": token},
            lead_id=lead["id"]
        )
        return success

    def send_pitch_to_prospect(self, lead: Dict[str, Any], sender_type: str = "automated_approved") -> Tuple[bool, str]:
        """Sends the finalized pitch email to the business prospect and logs in Supabase."""
        recipient = lead.get("email")
        if not recipient:
            err = "Business prospect has no email on record."
            db_manager.insert_log(
                step="error",
                status="error",
                message=f"Cannot send email to {lead.get('business_name')}: {err}",
                details={"lead_id": lead.get("id")},
                lead_id=lead.get("id")
            )
            return False, err

        subject = lead.get("email_subject") or f"A tailored website idea for {lead.get('business_name')}"
        body = lead.get("email_body") or ""

        db_manager.insert_log(
            step="sending",
            status="info",
            message=f"Sending {sender_type} outreach email to {lead.get('business_name')} ({recipient})...",
            details={"recipient": recipient, "subject": subject, "sender_type": sender_type},
            lead_id=lead.get("id")
        )

        success, note = self.send_raw_email(recipient, subject, body)
        
        # Record into sent_emails table in Supabase
        db_manager.insert_sent_email(
            lead_id=lead.get("id"),
            recipient_email=recipient,
            subject=subject,
            body=body,
            sender_type=sender_type,
            status="sent" if success else "failed",
            error_message=None if success else note
        )

        if success:
            db_manager.insert_log(
                step="success",
                status="success",
                message=f"Pitch email successfully dispatched to {lead.get('business_name')} ({recipient}).",
                details={"recipient": recipient, "note": note},
                lead_id=lead.get("id")
            )
        else:
            db_manager.insert_log(
                step="error",
                status="error",
                message=f"Failed to deliver email to {lead.get('business_name')}: {note}",
                details={"recipient": recipient, "error": note},
                lead_id=lead.get("id")
            )

        return success, note

email_service = EmailService()
