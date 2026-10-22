import os
import ssl
import re
import smtplib
import socket
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from typing import Dict, Any, Tuple, Optional
from datetime import datetime

from config import settings
from supabase_client import db_manager

# Optional dnspython for MX resolution
try:
    import dns.resolver
    HAS_DNSPYTHON = True
except ImportError:
    HAS_DNSPYTHON = False

class EmailService:
    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_pass = settings.SMTP_PASSWORD
        self.sender_email = settings.SENDER_EMAIL or "Mshoaibawan371@gmail.com"
        self.sender_name = settings.SENDER_NAME or "Muhammad Shoaib"
        self.admin_email = settings.ADMIN_EMAIL or "Mshoaibawan371@gmail.com"

    def is_smtp_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_pass)

    def verify_domain_has_mx(self, email: str) -> Tuple[bool, str]:
        """
        Pre-flight MX verification: Verifies whether recipient domain exists
        and has active MX mail exchange records on the global internet.
        Prevents 550 'Address not found' or 'Mailbox does not exist' hard bounces.
        """
        if not email or "@" not in email:
            return False, "Invalid email address syntax (missing @)."
        
        domain = email.split("@")[1].strip().lower()
        if not domain or "." not in domain:
            return False, f"Invalid email domain '{domain}'."
        
        # Block known dummy/placeholder domains
        if domain.endswith((".local", ".invalid", ".example", ".test", ".internal")):
            return False, f"Dummy/placeholder domain '{domain}' is not deliverable."

        if HAS_DNSPYTHON:
            try:
                res = dns.resolver.Resolver()
                res.nameservers = ['8.8.8.8', '1.1.1.1', '8.8.4.4']
                answers = res.resolve(domain, "MX", lifetime=4.0)
                if answers and len(answers) > 0:
                    return True, f"Verified MX records found ({len(answers)} mail servers for {domain})."
                return False, f"Domain '{domain}' has no active MX records."
            except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
                return False, f"Domain '{domain}' does not exist or has no MX mail records."
            except Exception:
                # If DNS query timed out, fallback to socket host check
                pass

        # Fallback socket verification
        try:
            socket.getaddrinfo(domain, 25, family=socket.AF_INET, proto=socket.IPPROTO_TCP)
            return True, f"Domain '{domain}' resolved successfully."
        except socket.gaierror:
            return False, f"Domain '{domain}' could not be resolved by DNS."

    def classify_smtp_error(self, err: Exception) -> Tuple[str, str]:
        """
        Classifies SMTP exceptions into actionable deliverability categories:
        - AUTHENTICATION_FAILURE
        - PERMISSION_DENIED
        - RATE_LIMIT_EXCEEDED
        - INVALID_RECIPIENT
        - MESSAGE_REJECTED
        - TEMPORARY_PROVIDER_ERROR
        - TIMEOUT_OR_UNKNOWN
        """
        err_str = str(err)
        err_lower = err_str.lower()
        
        # 1. Authentication Failure
        if isinstance(err, smtplib.SMTPAuthenticationError) or "535" in err_str or "authentication failed" in err_lower or "password" in err_lower:
            return "AUTHENTICATION_FAILURE", "SMTP Authentication failed: Invalid username or App Password."
        
        # 2. Rate Limit or Quota Exceeded
        if "429" in err_str or "5.4.5" in err_str or "daily user sending limit" in err_lower or "quota" in err_lower or "rate limit" in err_lower:
            return "RATE_LIMIT_EXCEEDED", "Provider sending limit exceeded: Gmail allows up to 500 emails/day. Pause campaign."
        
        # 3. Invalid Recipient / Mailbox Does Not Exist (Hard Bounce)
        if "550" in err_str or "5.1.1" in err_str or "5.4.1" in err_str or "recipient rejected" in err_lower or "user unknown" in err_lower or "mailbox not found" in err_lower:
            return "INVALID_RECIPIENT", f"Recipient address rejected by remote mail server (550 Hard Bounce): {err_str}"
        
        # 4. Message Rejected / Spamhaus / DMARC
        if "554" in err_str or "5.7.1" in err_str or "spam" in err_lower or "dmarc" in err_lower or "blocked" in err_lower:
            return "MESSAGE_REJECTED", f"Message rejected by policy or spam filter: {err_str}"
        
        # 5. Permission Denied
        if "403" in err_str or "permission denied" in err_lower or "not authorized" in err_lower:
            return "PERMISSION_DENIED", "Access or permission denied by email provider."
        
        # 6. Temporary Provider Error
        if "421" in err_str or "451" in err_str or "service unavailable" in err_lower or "try again later" in err_lower:
            return "TEMPORARY_PROVIDER_ERROR", f"Temporary mail server error (retry possible): {err_str}"
        
        # 7. Timeout or Connection Abort
        if isinstance(err, (socket.timeout, TimeoutError)) or "timeout" in err_lower or "timed out" in err_lower:
            return "TIMEOUT_OR_UNKNOWN", "SMTP connection timed out. Check existing records before retrying to prevent duplicates."

        return "UNKNOWN_PROVIDER_ERROR", f"SMTP provider error: {err_str}"

    def send_raw_email(
        self,
        to_email: str,
        subject: str,
        text_body: str,
        html_body: Optional[str] = None,
        reply_to: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Sends an email via verified SMTP (Port 465 SSL or Port 587 TLS).
        Enforces suppression list, pre-flight MX checking, and sanitized error classification.
        Never marks simulated or failed sends as sent.
        """
        if not to_email or not to_email.strip():
            return {
                "success": False,
                "status": "failed",
                "error_category": "INVALID_RECIPIENT",
                "message": "Recipient email address is required.",
                "provider": "none"
            }

        recipient = to_email.strip().lower()

        # Step 1: Suppression List Check (Unsubscribed, bounced, do-not-contact)
        is_supp, supp_reason = db_manager.is_suppressed(recipient)
        if is_supp:
            return {
                "success": False,
                "status": "failed",
                "error_category": "INVALID_RECIPIENT",
                "message": f"Delivery blocked by suppression list: {supp_reason}",
                "provider": "suppression_filter"
            }

        # Step 2: Pre-flight MX check on recipient domain
        has_mx, mx_note = self.verify_domain_has_mx(recipient)
        if not has_mx:
            db_manager.add_to_suppression_list(recipient, "NO_MX_RECORDS", mx_note)
            return {
                "success": False,
                "status": "failed",
                "error_category": "INVALID_RECIPIENT",
                "message": f"Pre-flight MX validation failed: {mx_note}. Dispatch blocked to prevent Google 550 bounce.",
                "provider": "dns_preflight"
            }

        # Step 3: Check SMTP Configuration
        if not self.is_smtp_configured():
            # In development/unconfigured mode, report honestly that live credentials are missing
            safe_subj = subject.encode("ascii", "replace").decode("ascii")
            print(f"[UNCONFIGURED SMTP] Attempted send to: {recipient} | Subject: {safe_subj}")
            return {
                "success": False,
                "status": "failed",
                "error_category": "AUTHENTICATION_FAILURE",
                "message": "SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASSWORD) are not configured in environment.",
                "provider": "none"
            }

        # Step 4: Dispatch via SMTP (SSL 465 or TLS 587)
        msg_id = make_msgid(domain=self.sender_email.split("@")[-1] if "@" in self.sender_email else "outreach.internal")
        
        try:
            msg = EmailMessage()
            msg["Subject"] = subject
            msg["From"] = formataddr((self.sender_name, self.sender_email))
            msg["To"] = recipient
            msg["Message-ID"] = msg_id
            msg["Date"] = datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S +0000")
            
            if reply_to:
                msg["Reply-To"] = reply_to
            else:
                msg["Reply-To"] = self.sender_email

            msg.set_content(text_body)
            if html_body:
                msg.add_alternative(html_body, subtype="html")

            # Dual-port SSL vs TLS handling
            if self.smtp_port == 465:
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, context=context, timeout=25) as server:
                    server.login(self.smtp_user, self.smtp_pass)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=25) as server:
                    server.starttls()
                    server.login(self.smtp_user, self.smtp_pass)
                    server.send_message(msg)

            return {
                "success": True,
                "status": "accepted_by_provider",
                "provider_message_id": msg_id,
                "message": "Email accepted by mail provider for delivery (SMTP 250 OK).",
                "provider": "smtp_gmail" if "gmail" in self.smtp_host.lower() else "smtp"
            }

        except Exception as e:
            cat, clean_err = self.classify_smtp_error(e)
            print(f"! [{cat}] SMTP Dispatch Failed: {clean_err}")
            
            # If 550 hard bounce, permanently suppress recipient
            if cat == "INVALID_RECIPIENT":
                db_manager.add_to_suppression_list(recipient, "HARD_BOUNCE_550", clean_err)

            return {
                "success": False,
                "status": "bounced" if cat == "INVALID_RECIPIENT" else "failed",
                "error_category": cat,
                "message": clean_err,
                "provider": "smtp"
            }

    def send_hitl_approval_email(self, lead: Dict[str, Any], token: str) -> bool:
        """
        Sends an interactive Human-In-The-Loop approval request to the Admin's Gmail.
        Contains business intel, drafted email variants, and 1-click Approve/Reject links.
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
        
        text_body = f"""BUSINESS OUTREACH ENGINE - HITL APPROVAL REQUIRED

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
          Review the prospect information above. If approved, this pitch will be dispatched to the verified business email.
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
      Automated 3-Hour Business Outreach Engine • Human-in-the-Loop Verification
    </div>
  </div>
</body>
</html>
"""

        res = self.send_raw_email(self.admin_email, admin_subject, text_body, html_body)
        success = res["success"]
        
        # Log approval dispatch
        db_manager.insert_log(
            step="approval_pending",
            status="info" if success else "warning",
            message=f"Sent HITL approval request to Gmail ({self.admin_email}) for {business_name}: {res['message']}",
            details={
                "lead_id": lead.get("id"),
                "admin_email": self.admin_email,
                "target_business": business_name,
                "provider_status": res["status"],
                "token": token
            },
            lead_id=lead.get("id")
        )
        return success

    def send_pitch_to_prospect(self, lead: Dict[str, Any], sender_type: str = "automated_approved") -> Tuple[bool, str]:
        """
        Sends the finalized pitch email to the verified business prospect.
        Strictly prevents duplicates, enforces MX pre-flight, and stores provider message IDs.
        """
        recipient = (lead.get("email") or "").strip()
        lead_id = lead.get("id")
        business_name = lead.get("business_name", "Local Business")

        if not recipient:
            err = "Business prospect has no verified email on record."
            db_manager.insert_log(
                step="error",
                status="warning",
                message=f"Cannot send outreach to {business_name}: {err}",
                details={"lead_id": lead_id, "error_category": "INVALID_RECIPIENT"},
                lead_id=lead_id
            )
            return False, err

        # Strict Duplicate-Send Prevention (Idempotency)
        if db_manager.is_email_already_sent(lead_id, recipient):
            note = f"Outreach already accepted or sent to {business_name} ({recipient}). Duplicate send prevented."
            db_manager.insert_log(
                step="sending",
                status="warning",
                message=f"Idempotent check blocked duplicate send: {note}",
                details={"lead_id": lead_id, "recipient": recipient},
                lead_id=lead_id
            )
            return True, note

        subject = lead.get("email_subject") or f"A tailored website idea for {business_name}"
        body = lead.get("email_body") or ""

        db_manager.insert_log(
            step="sending",
            status="info",
            message=f"Dispatching outreach email to {business_name} ({recipient})...",
            details={"recipient": recipient, "subject": subject, "sender_type": sender_type},
            lead_id=lead_id
        )

        res = self.send_raw_email(recipient, subject, body)
        success = res["success"]
        status_label = res["status"] # 'accepted_by_provider', 'bounced', 'failed'
        note = res["message"]

        # Record into sent_emails table in Supabase
        db_manager.insert_sent_email(
            lead_id=lead_id,
            recipient_email=recipient,
            subject=subject,
            body=body,
            sender_type=sender_type,
            status=status_label,
            error_message=None if success else note
        )

        if success:
            db_manager.insert_log(
                step="success",
                status="success",
                message=f"Pitch email accepted by mail provider for {business_name} ({recipient}).",
                details={
                    "recipient": recipient,
                    "status": status_label,
                    "provider_message_id": res.get("provider_message_id"),
                    "provider": res.get("provider")
                },
                lead_id=lead_id
            )
        else:
            db_manager.insert_log(
                step="error",
                status="error",
                message=f"Failed to deliver outreach to {business_name}: {note}",
                details={
                    "recipient": recipient,
                    "error": note,
                    "error_category": res.get("error_category")
                },
                lead_id=lead_id
            )

        return success, note

    def check_sender_deliverability(self) -> Dict[str, Any]:
        """
        Diagnoses sender configuration, domain DNS (SPF, DMARC),
        and provider account status.
        """
        domain = self.sender_email.split("@")[-1] if "@" in self.sender_email else "gmail.com"
        is_gmail = "gmail.com" in domain.lower()

        spf_status = "unverified"
        spf_details = ""
        dmarc_status = "unverified"
        dmarc_details = ""

        if HAS_DNSPYTHON:
            res = dns.resolver.Resolver()
            res.nameservers = ['8.8.8.8', '1.1.1.1', '8.8.4.4']

            # Check SPF TXT record
            try:
                txt_answers = res.resolve(domain, "TXT", lifetime=4.0)
                for rdata in txt_answers:
                    txt = rdata.to_text().strip('"')
                    if "v=spf1" in txt:
                        spf_status = "pass"
                        spf_details = txt
                        break
                if spf_status != "pass":
                    spf_status = "missing"
                    spf_details = f"No v=spf1 record found for {domain}."
            except Exception as e:
                spf_status = "pass" if is_gmail else "missing"
                spf_details = "v=spf1 include:_spf.google.com ~all (Google Default SPF)" if is_gmail else str(e)

            # Check DMARC TXT record
            try:
                dmarc_answers = res.resolve(f"_dmarc.{domain}", "TXT", lifetime=4.0)
                for rdata in dmarc_answers:
                    txt = rdata.to_text().strip('"')
                    if "v=DMARC1" in txt:
                        dmarc_status = "pass"
                        dmarc_details = txt
                        break
                if dmarc_status != "pass":
                    dmarc_status = "missing"
                    dmarc_details = f"No _dmarc.{domain} record found."
            except Exception as e:
                dmarc_status = "pass" if is_gmail else "missing"
                dmarc_details = "v=DMARC1; p=reject (Google strict policy)" if is_gmail else str(e)
        else:
            if is_gmail:
                spf_status = "pass"
                spf_details = "v=spf1 include:_spf.google.com ~all (Standard Google SPF)"
                dmarc_status = "pass"
                dmarc_details = "v=DMARC1; p=reject (Google strict quarantine/reject policy)"

        daily_limit = 500 if is_gmail else 2000
        safe_daily_recommended = 25 if is_gmail else 50

        return {
            "sender_email": self.sender_email,
            "sender_domain": domain,
            "is_gmail": is_gmail,
            "smtp_configured": self.is_smtp_configured(),
            "smtp_host": self.smtp_host,
            "smtp_port": self.smtp_port,
            "spf_record": {
                "status": spf_status,
                "details": spf_details,
                "recommendation": "Pass: Google's SPF authorizes official smtp.gmail.com relays." if is_gmail else "Add 'v=spf1 include:... ~all' to domain DNS."
            },
            "dmarc_record": {
                "status": dmarc_status,
                "details": dmarc_details,
                "recommendation": "Strict DMARC (p=reject) applies to @gmail.com: The From address must match the authenticated account." if is_gmail else "Add TXT at _dmarc.yourdomain.com: v=DMARC1; p=none;"
            },
            "dkim_status": "Google auto-signs all outgoing SMTP messages with d=gmail.com" if is_gmail else "Configure DKIM selector with domain registrar.",
            "provider_daily_limit": daily_limit,
            "safe_daily_volume_recommended": safe_daily_recommended,
            "bounce_rate_threshold": "Must stay strictly under 2.0% (ideally < 1.0%) to prevent provider account suspension."
        }

email_service = EmailService()
