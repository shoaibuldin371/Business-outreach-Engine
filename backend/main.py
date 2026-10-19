import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from typing import Optional, List, Dict, Any

from config import settings
from models import (
    LeadResponse, CustomEmailRequest, ApprovalActionRequest,
    TriggerDiscoveryRequest, LogResponse, SentEmailResponse, StatsResponse
)
from supabase_client import db_manager
from email_service import email_service
from agent import discovery_agent
from scheduler import start_scheduler, stop_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start 3-hour scheduler
    print("[START] Business Outreach Engine starting up...")
    start_scheduler()
    yield
    # Shutdown
    print("[STOP] Business Outreach Engine shutting down...")
    stop_scheduler()

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API for 3-Hour Business Discovery, Supabase Sync, Gmail HITL, and Custom Email Engine",
    version="2.0.0",
    lifespan=lifespan
)

# CORS setup for Vercel deployment and local Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for Vercel preview & production URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================================
# HEALTH & METRICS
# =========================================================================
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "storage": "supabase" if db_manager.use_supabase else "local_resilient_store",
        "scheduler": "active (every 3 hours)",
        "admin_email": settings.ADMIN_EMAIL,
        "environment": settings.ENVIRONMENT
    }

@app.get("/api/stats", response_model=StatsResponse)
def get_dashboard_stats():
    return db_manager.get_stats()

# =========================================================================
# LEADS ENDPOINTS
# =========================================================================
@app.get("/api/leads")
def list_leads(status: Optional[str] = Query(None, description="Filter: all, pending_approval, approved, rejected, sent")):
    return db_manager.get_leads(status=status, limit=200)

@app.get("/api/leads/{lead_id}")
def get_lead(lead_id: str):
    lead = db_manager.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    return lead

# =========================================================================
# HUMAN-IN-THE-LOOP (HITL) GMAIL VERIFICATION WEBHOOKS
# =========================================================================
@app.get("/api/approval/approve", response_class=HTMLResponse)
def approve_outreach_via_gmail(token: str = Query(..., description="Secure approval token sent in Gmail")):
    """
    Called when the user clicks 'Approve & Send Pitch' inside their Gmail.
    Automatically delivers the pitch email to the prospect business and updates Supabase.
    """
    lead = db_manager.get_lead_by_token(token)
    if not lead:
        return HTMLResponse(
            content=render_html_status(
                title="Invalid or Expired Link",
                badge="Error",
                badge_color="#ef4444",
                message="This approval token is not recognized or has already been used.",
                btn_text="Open Dashboard",
                btn_url=settings.FRONTEND_URL
            ),
            status_code=404
        )

    business_name = lead.get("business_name")
    recipient = lead.get("email")

    if lead.get("status") in ("approved", "sent"):
        return HTMLResponse(
            content=render_html_status(
                title="Already Processed",
                badge="Completed",
                badge_color="#3b82f6",
                message=f"Outreach for <strong>{business_name}</strong> was already approved and sent.",
                btn_text="View in Dashboard",
                btn_url=settings.FRONTEND_URL
            )
        )

    # 1. Update lead status in Supabase
    db_manager.update_lead(lead["id"], {"status": "approved"})
    db_manager.insert_log(
        step="approved",
        status="success",
        message=f"HITL Approval granted via Gmail link for {business_name}.",
        details={"lead_id": lead["id"], "token": token},
        lead_id=lead["id"]
    )

    # 2. Automatically send outreach email to business
    success, note = email_service.send_pitch_to_prospect(lead, sender_type="automated_approved")
    if success:
        db_manager.update_lead(lead["id"], {"status": "sent"})
        return HTMLResponse(
            content=render_html_status(
                title="✅ Approved & Sent Successfully!",
                badge="Outreach Delivered",
                badge_color="#10b981",
                message=f"The personalized pitch email for <strong>{business_name}</strong> has been automatically sent to <code>{recipient}</code>.<br><br>The sent email and live status are now updated in your Supabase database and dashboard.",
                btn_text="Open Web Dashboard",
                btn_url=settings.FRONTEND_URL
            )
        )
    else:
        db_manager.update_lead(lead["id"], {"status": "error"})
        return HTMLResponse(
            content=render_html_status(
                title="Approval Logged, But Send Issue Occurred",
                badge="Dispatch Issue",
                badge_color="#f59e0b",
                message=f"Approval was recorded, but email delivery encountered an issue: {note}. You can retry or send a custom email from your dashboard.",
                btn_text="Review on Dashboard",
                btn_url=settings.FRONTEND_URL
            )
        )

@app.get("/api/approval/reject", response_class=HTMLResponse)
def reject_outreach_via_gmail(token: str = Query(..., description="Secure approval token sent in Gmail")):
    """
    Called when the user clicks 'Reject Draft' inside their Gmail.
    Marks status as rejected so the user can send a custom email through the website.
    """
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
        # Optional subject/body overrides from modal
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
            db_manager.update_lead(lead["id"], {"status": "sent"})
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
    """
    Sends a tailored custom email directly from the frontend website.
    Stores the sent email in Supabase and updates lead status to 'sent'.
    """
    lead = db_manager.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")

    business_name = lead.get("business_name")
    recipient = req.recipient_email or lead.get("email")

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

    # 2. Dispatch email
    success, note = email_service.send_raw_email(recipient, req.subject, req.body)

    # 3. Store in Supabase sent_emails table
    db_manager.insert_sent_email(
        lead_id=lead_id,
        recipient_email=recipient,
        subject=req.subject,
        body=req.body,
        sender_type="custom_manual",
        status="sent" if success else "failed",
        error_message=None if success else note
    )

    if success:
        # 4. Update lead status in Supabase
        db_manager.update_lead(lead_id, {
            "status": "sent",
            "email_subject": req.subject,
            "email_body": req.body,
            "last_contacted_at": "now()"
        })

        db_manager.insert_log(
            step="success",
            status="success",
            message=f"Custom email successfully delivered to {business_name} ({recipient}).",
            details={"recipient": recipient, "note": note},
            lead_id=lead_id
        )
        return {"status": "success", "message": f"Custom email sent to {recipient}."}
    else:
        db_manager.insert_log(
            step="error",
            status="error",
            message=f"Failed to send custom email to {business_name}: {note}",
            details={"error": note},
            lead_id=lead_id
        )
        raise HTTPException(status_code=500, detail=f"Failed to deliver custom email: {note}")

# =========================================================================
# LOGS & AGENT TRIGGER
# =========================================================================
@app.get("/api/logs")
def get_system_logs(limit: int = Query(200, ge=1, le=1000)):
    """Returns execution logs for the frontend /logs page."""
    return db_manager.get_logs(limit=limit)

@app.post("/api/agent/trigger")
def trigger_agent_manually(req: Optional[TriggerDiscoveryRequest] = None):
    """
    Manually triggers the 5-business discovery and analysis cycle
    without waiting for the 3-hour cron.
    """
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
        "smtp_configured": email_service._is_smtp_configured(),
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
