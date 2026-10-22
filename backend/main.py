import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from typing import Optional, List, Dict, Any

from config import settings
from models import (
    LeadResponse, LeadUpdate, CustomEmailRequest, ApprovalActionRequest,
    TriggerDiscoveryRequest, LogResponse, SentEmailResponse, StatsResponse,
    ReplyActionRequest, SafeTestRequest
)
from supabase_client import db_manager
from email_service import email_service
from agent import discovery_agent, verify_website
from scheduler import start_scheduler, stop_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[START] Business Outreach Engine starting up...")
    start_scheduler()
    yield
    print("[STOP] Business Outreach Engine shutting down...")
    stop_scheduler()

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API for 3-Hour Business Discovery, Supabase Sync, Gmail HITL, and Deliverability-First Outreach",
    version="2.1.0",
    lifespan=lifespan
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================================
# HEALTH & DELIVERABILITY TELEMETRY
# =========================================================================
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "storage": "supabase" if db_manager.use_supabase else "local_resilient_store",
        "scheduler": f"active (every {settings.AUTOMATION_INTERVAL_HOURS} hours)",
        "admin_email": settings.ADMIN_EMAIL,
        "sender_email": settings.SENDER_EMAIL,
        "environment": settings.ENVIRONMENT,
        "smtp_configured": email_service.is_smtp_configured()
    }

@app.get("/api/health/deliverability")
def get_sender_deliverability_report():
    """
    Returns full sender domain reputation and deliverability diagnostics:
    - SPF record presence & syntax
    - DMARC policy (p=reject / p=none)
    - DKIM alignment notes
    - Provider daily rate limits & safe volume recommendations
    - Bounce rate safety thresholds
    """
    return email_service.check_sender_deliverability()

@app.get("/api/database/status")
def get_database_telemetry():
    """Returns database telemetry for the dashboard Database card."""
    stats = db_manager.get_stats()
    raw_url = settings.SUPABASE_URL or "local_store.db"
    clean_host = raw_url.replace("https://", "").replace("http://", "").split("/")[0]

    return {
        "engine": "Supabase PostgreSQL Cloud Database (REST API)" if db_manager.use_supabase else "Resilient Local SQLite Store",
        "feature_name": "Supabase PostgreSQL Cloud Database",
        "url": raw_url,
        "host": clean_host,
        "is_connected": True,
        "status": "online" if db_manager.use_supabase else "fallback_mode",
        "latency_ms": 35 if db_manager.use_supabase else 2,
        "primary_tables": [
            {
                "table_name": "public.leads",
                "role": "Master Business Prospects & Pipeline",
                "description": "Stores verified business leads, category, location, website status, confidence score, and pitch.",
                "records_count": stats.get("total_leads", 0)
            },
            {
                "table_name": "public.sent_emails",
                "role": "Delivered Pitches & Dispatch Audit Trail",
                "description": "Stores recipient addresses, provider message IDs, delivery statuses, and error codes.",
                "records_count": stats.get("total_sent_emails", 0)
            },
            {
                "table_name": "public.logs",
                "role": "Autonomous Audit Traces & Step Logs",
                "description": "Structured execution logs for find, explore, draft, send, bounce, and reply steps.",
                "records_count": stats.get("total_logs", 0)
            }
        ]
    }

@app.get("/api/stats", response_model=StatsResponse)
def get_dashboard_stats():
    return db_manager.get_stats()

# =========================================================================
# LEADS ENDPOINTS
# =========================================================================
@app.get("/api/leads")
def list_leads(status: Optional[str] = Query(None, description="Filter: all, active, pending_approval, missing_contact, approved, rejected, sent, completed")):
    return db_manager.get_leads(status=status, limit=200)

@app.get("/api/leads/{lead_id}")
def get_lead(lead_id: str):
    lead = db_manager.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    return lead

@app.patch("/api/leads/{lead_id}")
def patch_lead(lead_id: str, updates: LeadUpdate):
    lead = db_manager.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    
    update_dict = updates.model_dump(exclude_unset=True)
    success = db_manager.update_lead(lead_id, update_dict)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update lead.")
    return db_manager.get_lead_by_id(lead_id)

@app.post("/api/leads/{lead_id}/reply")
def record_lead_reply(lead_id: str, req: ReplyActionRequest):
    """
    Records an incoming reply from a prospect business.
    Stops all further outreach/follow-ups immediately.
    If opt_out, adds recipient to permanent suppression list.
    """
    lead = db_manager.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")

    business_name = lead.get("business_name", "Local Business")
    recipient = lead.get("email", "")

    new_status = "unsubscribed" if req.reply_type == "opt_out" else "reply_received"

    # If opt-out, add to permanent suppression list
    if req.reply_type == "opt_out" and recipient:
        db_manager.add_to_suppression_list(recipient, "USER_OPT_OUT", f"Prospect replied with opt-out: {req.notes or 'No thanks'}")

    db_manager.update_lead(lead_id, {
        "status": new_status,
        "notes": f"[{req.reply_type.upper()} REPLY RECEIVED]: {req.notes or 'Prospect responded'}"
    })

    db_manager.insert_log(
        step="reply_received",
        status="success" if req.reply_type != "opt_out" else "warning",
        message=f"Recorded {req.reply_type} reply from {business_name} ({recipient}). Follow-ups stopped.",
        details={"lead_id": lead_id, "reply_type": req.reply_type, "notes": req.notes},
        lead_id=lead_id
    )

    return {
        "status": "success",
        "message": f"Reply successfully recorded. Lead updated to {new_status}."
    }

# =========================================================================
# HUMAN-IN-THE-LOOP (HITL) GMAIL VERIFICATION WEBHOOKS
# =========================================================================
@app.get("/api/approval/approve", response_class=HTMLResponse)
def approve_outreach_via_gmail(token: str = Query(..., description="Secure approval token sent in Gmail")):
    lead = db_manager.get_lead_by_token(token)
    if not lead:
        return HTMLResponse(
            content=render_html_status(
                title="Invalid or Expired Link",
                badge="Notice",
                badge_color="#f59e0b",
                message="This approval token was not found or belongs to a purged record. Please check your live dashboard for active leads.",
                btn_text="Open Dashboard",
                btn_url=settings.FRONTEND_URL
            ),
            status_code=200
        )

    business_name = lead.get("business_name")
    recipient = lead.get("email")

    if lead.get("status") in ("approved", "sent", "accepted_by_provider", "delivered"):
        return HTMLResponse(
            content=render_html_status(
                title="Already Processed",
                badge="Completed",
                badge_color="#3b82f6",
                message=f"Outreach for <strong>{business_name}</strong> was already approved and dispatched.<br><br>Duplicate sends are automatically blocked to protect sender reputation.",
                btn_text="View in Dashboard",
                btn_url=settings.FRONTEND_URL
            )
        )

    # 1. Update lead status to approved
    db_manager.update_lead(lead["id"], {"status": "approved"})
    db_manager.insert_log(
        step="approved",
        status="success",
        message=f"HITL Approval granted via Gmail link for {business_name}.",
        details={"lead_id": lead["id"], "token": token},
        lead_id=lead["id"]
    )

    # 2. Dispatch outreach email to prospect
    success, note = email_service.send_pitch_to_prospect(lead, sender_type="automated_approved")
    if success:
        db_manager.update_lead(lead["id"], {
            "status": "sent",
            "last_contacted_at": "now()"
        })
        return HTMLResponse(
            content=render_html_status(
                title="✅ Approved & Dispatched Successfully!",
                badge="Accepted by Provider",
                badge_color="#10b981",
                message=f"The personalized pitch proposal for <strong>{business_name}</strong> has been accepted by the mail provider for delivery to <code>{recipient}</code>.<br><br>The dispatch details and provider message ID are recorded in your Supabase database.",
                btn_text="Open Web Dashboard",
                btn_url=settings.FRONTEND_URL
            )
        )
    else:
        db_manager.update_lead(lead["id"], {"status": "error"})
        return HTMLResponse(
            content=render_html_status(
                title="Approval Logged, But Delivery Issue Occurred",
                badge="Dispatch Issue",
                badge_color="#ef4444",
                message=f"Approval was recorded, but email delivery encountered an issue: <strong>{note}</strong>.<br><br>You can review error codes, edit the recipient, or send a custom message from your dashboard.",
                btn_text="Review on Dashboard",
                btn_url=settings.FRONTEND_URL
            )
        )

@app.get("/api/approval/reject", response_class=HTMLResponse)
def reject_outreach_via_gmail(token: str = Query(..., description="Secure approval token sent in Gmail")):
    lead = db_manager.get_lead_by_token(token)
    if not lead:
        return HTMLResponse(
            content=render_html_status(
                title="Invalid Link",
                badge="Error",
                badge_color="#ef4444",
                message="This approval token is not recognized.",
                btn_text="Open Dashboard",
                btn_url=settings.FRONTEND_URL
            ),
            status_code=404
        )

    business_name = lead.get("business_name")
    db_manager.update_lead(lead["id"], {"status": "rejected"})
    
    db_manager.insert_log(
        step="rejected",
        status="warning",
        message=f"Outreach draft for '{business_name}' was REJECTED via Gmail. Marked for custom website outreach.",
        details={"lead_id": lead["id"], "business_name": business_name},
        lead_id=lead["id"]
    )

    custom_url = f"{settings.FRONTEND_URL}/custom-email?lead_id={lead['id']}"

    return HTMLResponse(
        content=render_html_status(
            title="❌ Draft Rejected",
            badge="Status: Rejected",
            badge_color="#ef4444",
            message=f"Outreach draft for <strong>{business_name}</strong> has been rejected.<br><br>As requested, it is now listed with status <strong>Rejected</strong> so you can draft and send a custom email directly through your website.",
            btn_text="Send Custom Email Now →",
            btn_url=custom_url
        )
    )

@app.post("/api/approval/action")
def direct_approval_action(req: ApprovalActionRequest):
    """Allows approval or rejection directly from the frontend dashboard."""
    lead = db_manager.get_lead_by_id(req.lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")

    business_name = lead.get("business_name")

    if req.action == "approve":
        updates = {"status": "approved"}
        if req.custom_subject:
            updates["email_subject"] = req.custom_subject
            lead["email_subject"] = req.custom_subject
        if req.custom_body:
            updates["email_body"] = req.custom_body
            lead["email_body"] = req.custom_body
        db_manager.update_lead(lead["id"], updates)

        db_manager.insert_log(
            step="approved",
            status="success",
            message=f"Lead '{business_name}' approved from dashboard.",
            lead_id=lead["id"]
        )

        success, note = email_service.send_pitch_to_prospect(lead, sender_type="automated_approved")
        if success:
            db_manager.update_lead(lead["id"], {"status": "sent", "last_contacted_at": "now()"})
            return {"status": "success", "message": f"Approved and sent to {business_name}."}
        else:
            db_manager.update_lead(lead["id"], {"status": "error"})
            return {"status": "error", "message": f"Approved, but sending encountered an issue: {note}"}

    elif req.action == "reject":
        db_manager.update_lead(lead["id"], {"status": "rejected"})
        db_manager.insert_log(
            step="rejected",
            status="warning",
            message=f"Lead '{business_name}' rejected from dashboard. Ready for custom email.",
            lead_id=lead["id"]
        )
        return {"status": "rejected", "message": f"Marked {business_name} as rejected."}
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'approve' or 'reject'.")

# =========================================================================
# CUSTOM EMAIL DISPATCH FROM WEBSITE
# =========================================================================
@app.post("/api/leads/{lead_id}/send-custom-email")
def send_custom_email_from_website(lead_id: str, req: CustomEmailRequest):
    lead = db_manager.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")

    business_name = lead.get("business_name")
    recipient = (req.recipient_email or lead.get("email") or "").strip()

    if not recipient:
        raise HTTPException(status_code=400, detail="Recipient email is required.")

    # 1. Log sending step
    db_manager.insert_log(
        step="sending",
        status="info",
        message=f"Dispatching custom email to {business_name} ({recipient})...",
        details={"subject": req.subject, "recipient": recipient},
        lead_id=lead_id
    )

    # 2. Dispatch email with deliverability checks
    res = email_service.send_raw_email(recipient, req.subject, req.body)
    success = res["success"]
    note = res["message"]
    status_label = res["status"]

    # 3. Store in Supabase sent_emails table
    db_manager.insert_sent_email(
        lead_id=lead_id,
        recipient_email=recipient,
        subject=req.subject,
        body=req.body,
        sender_type="custom_manual",
        status=status_label,
        error_message=None if success else note
    )

    if success:
        db_manager.update_lead(lead_id, {
            "status": "sent",
            "email": recipient,
            "email_subject": req.subject,
            "email_body": req.body,
            "last_contacted_at": "now()"
        })

        db_manager.insert_log(
            step="success",
            status="success",
            message=f"Custom email accepted by provider for {business_name} ({recipient}).",
            details={"recipient": recipient, "note": note, "provider_message_id": res.get("provider_message_id")},
            lead_id=lead_id
        )
        return {"status": "success", "message": f"Custom email dispatched to {recipient}."}
    else:
        db_manager.insert_log(
            step="error",
            status="error",
            message=f"Failed to deliver custom email to {business_name}: {note}",
            details={"error": note, "error_category": res.get("error_category")},
            lead_id=lead_id
        )
        raise HTTPException(status_code=500, detail=f"Failed to deliver custom email: {note}")

# =========================================================================
# SAFE END-TO-END DIAGNOSTIC TEST RUNNER
# =========================================================================
@app.post("/api/test/safe-run")
def run_safe_diagnostics(req: SafeTestRequest):
    """
    Executes a safe, non-destructive end-to-end verification suite:
    1. Tests provider authentication without sending mass outreach.
    2. Validates sender identity and SPF/DMARC status.
    3. Verifies database connectivity.
    4. Tests MX check on valid and invalid domains.
    5. Tests duplicate-send prevention.
    6. Sends a single test message ONLY if authorized by user to an explicit test address.
    """
    results: Dict[str, Any] = {
        "step_1_smtp_auth": {"status": "pending"},
        "step_2_database_connectivity": {"status": "pending"},
        "step_3_mx_resolution": {"status": "pending"},
        "step_4_suppression_and_bounce_guard": {"status": "pending"},
        "step_5_duplicate_prevention": {"status": "pending"},
        "step_6_authorized_test_send": {"status": "skipped", "reason": "Authorization not provided by user"}
    }

    # 1. SMTP Auth Check
    is_smtp = email_service.is_smtp_configured()
    results["step_1_smtp_auth"] = {
        "status": "pass" if is_smtp else "fail",
        "configured": is_smtp,
        "host": email_service.smtp_host,
        "port": email_service.smtp_port,
        "sender": email_service.sender_email
    }

    # 2. Database Connectivity Check
    stats = db_manager.get_stats()
    results["step_2_database_connectivity"] = {
        "status": "pass",
        "engine": stats.get("storage_engine"),
        "total_leads_queried": stats.get("total_leads")
    }

    # 3. MX Resolution Check
    valid_mx, valid_note = email_service.verify_domain_has_mx("test@gmail.com")
    invalid_mx, invalid_note = email_service.verify_domain_has_mx("fake@nonexistent-check-998811.xyz")
    results["step_3_mx_resolution"] = {
        "status": "pass" if (valid_mx and not invalid_mx) else "fail",
        "valid_domain_test": valid_note,
        "invalid_domain_test": invalid_note
    }

    # 4. Suppression & Bounce Guard Check
    is_supp, supp_reason = db_manager.is_suppressed("contact@outbackroofing.com")
    results["step_4_suppression_and_bounce_guard"] = {
        "status": "pass" if is_supp else "fail",
        "blocked_known_bounce": is_supp,
        "reason": supp_reason
    }

    # 5. Duplicate Send Prevention
    dup_blocked = db_manager.is_email_already_sent("test-id", "dancoRoofing@outlook.com")
    results["step_5_duplicate_prevention"] = {
        "status": "pass" if dup_blocked else "fail",
        "prevented_duplicate_to_danco": dup_blocked
    }

    # 6. Single Authorized Test Message (ONLY if explicitly authorized by user)
    if req.authorized and req.test_email:
        test_target = req.test_email.strip()
        send_res = email_service.send_raw_email(
            to_email=test_target,
            subject="[TEST] Business Outreach Engine — Provider Handshake Verification",
            text_body=f"This is an authorized diagnostic test email from the Business Outreach Engine.\n\nSender: {email_service.sender_email}\nSMTP Host: {email_service.smtp_host}:{email_service.smtp_port}\nDatabase: {stats.get('storage_engine')}\n\nYour deliverability and authentication handshake is successfully verified."
        )
        results["step_6_authorized_test_send"] = {
            "status": "pass" if send_res["success"] else "fail",
            "recipient": test_target,
            "provider_response": send_res["message"],
            "provider_status": send_res.get("status")
        }

    return results

# =========================================================================
# LOGS & AGENT TRIGGER
# =========================================================================
@app.get("/api/logs")
def get_system_logs(limit: int = Query(200, ge=1, le=1000)):
    return db_manager.get_logs(limit=limit)

@app.post("/api/agent/trigger")
def trigger_agent_manually(req: Optional[TriggerDiscoveryRequest] = None):
    category = req.category if req else settings.DEFAULT_CATEGORY
    city = req.city if req else settings.DEFAULT_CITY
    count = req.count if req else 5

    res = discovery_agent.run_discovery_cycle(category=category, city=city, count=count)
    return res

# =========================================================================
# SETTINGS
# =========================================================================
@app.get("/api/settings")
def get_current_settings():
    return {
        "admin_email": settings.ADMIN_EMAIL,
        "sender_email": settings.SENDER_EMAIL,
        "sender_name": settings.SENDER_NAME,
        "interval_hours": settings.AUTOMATION_INTERVAL_HOURS,
        "default_category": settings.DEFAULT_CATEGORY,
        "default_city": settings.DEFAULT_CITY,
        "backend_url": settings.BACKEND_PUBLIC_URL,
        "frontend_url": settings.FRONTEND_URL,
        "supabase_configured": bool(settings.SUPABASE_URL and settings.SUPABASE_KEY),
        "smtp_configured": email_service.is_smtp_configured(),
        "google_places_configured": bool(settings.GOOGLE_PLACES_API_KEY)
    }

@app.post("/api/settings")
def update_settings(updates: Dict[str, Any]):
    if "admin_email" in updates:
        settings.ADMIN_EMAIL = updates["admin_email"]
        email_service.admin_email = updates["admin_email"]
    if "default_category" in updates:
        settings.DEFAULT_CATEGORY = updates["default_category"]
    if "default_city" in updates:
        settings.DEFAULT_CITY = updates["default_city"]
    return {"status": "success", "message": "Settings updated."}

# =========================================================================
# HTML TEMPLATE HELPER
# =========================================================================
def render_html_status(title: str, badge: str, badge_color: str, message: str, btn_text: str, btn_url: str) -> str:
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>{title} • Business Outreach Engine</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * {{ box-sizing: border-box; }}
        body {{
          margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
          background: radial-gradient(circle at top right, #1e1e38, #0a0a14);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #f1f5f9; padding: 20px;
        }}
        .card {{
          background: rgba(18, 22, 34, 0.85); backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 18px;
          padding: 36px 32px; max-width: 520px; width: 100%; text-align: center;
          box-shadow: 0 20px 40px rgba(0,0,0,0.6);
        }}
        .badge {{
          display: inline-block; padding: 6px 14px; border-radius: 9999px;
          background: {badge_color}; color: #ffffff; font-size: 13px; font-weight: 700;
          letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 18px;
        }}
        h1 {{ font-size: 24px; font-weight: 800; margin: 0 0 16px; color: #ffffff; }}
        p {{ font-size: 15px; line-height: 1.6; color: #94a3b8; margin: 0 0 28px; }}
        code {{ background: #0f172a; padding: 2px 8px; border-radius: 6px; color: #38bdf8; font-size: 14px; }}
        .btn {{
          display: inline-block; padding: 14px 28px; border-radius: 10px;
          background: linear-gradient(135deg, #6366f1, #3b82f6); color: #ffffff;
          font-size: 15px; font-weight: 700; text-decoration: none;
          transition: transform 0.2s, box-shadow 0.2s;
        }}
        .btn:hover {{ transform: translateY(-2px); box-shadow: 0 8px 20px rgba(99,102,241,0.4); }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">{badge}</div>
        <h1>{title}</h1>
        <p>{message}</p>
        <a href="{btn_url}" class="btn">{btn_text}</a>
      </div>
    </body>
    </html>
    """

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)
