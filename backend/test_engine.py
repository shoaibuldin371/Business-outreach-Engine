import pytest
from fastapi.testclient import TestClient
from main import app
from supabase_client import db_manager
from agent import discovery_agent, verify_website

client = TestClient(app)

def test_health_check():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "active" in data["scheduler"]

def test_website_verification():
    # Live URL
    is_live, status = verify_website("https://google.com")
    assert is_live is True
    assert "Live" in status

    # Missing URL
    is_live_empty, status_empty = verify_website("")
    assert is_live_empty is False
    assert status_empty == "No website listed"

    # Dead URL
    is_live_dead, status_dead = verify_website("https://this-domain-does-not-exist-at-all-99999.xyz")
    assert is_live_dead is False

def test_discovery_agent_cycle():
    # Run cycle for 5 businesses
    res = discovery_agent.run_discovery_cycle(category="plumbers", city="Austin, TX", count=5)
    assert res["status"] == "success"
    assert res["leads_qualified"] > 0
    
    # Check that leads are in database with status pending_approval
    leads = db_manager.get_leads(status="pending_approval")
    assert len(leads) > 0
    first_lead = leads[0]
    assert first_lead["status"] == "pending_approval"
    assert first_lead["approval_token"] is not None
    assert first_lead["email_subject"] is not None
    assert first_lead["email_body"] is not None

    # Check that logs were created
    logs = db_manager.get_logs(limit=20)
    steps = [l["step"] for l in logs]
    assert "find" in steps
    assert "explore" in steps
    assert "draft" in steps
    assert "approval_pending" in steps

def test_gmail_hitl_approval_flow():
    # Create or fetch a pending lead
    leads = db_manager.get_leads(status="pending_approval")
    assert len(leads) > 0
    target_lead = leads[0]
    token = target_lead["approval_token"]

    # Simulate Admin clicking "Approve & Send" in Gmail
    approve_resp = client.get(f"/api/approval/approve?token={token}")
    assert approve_resp.status_code == 200
    assert "Approved &amp; Sent" in approve_resp.text or "Approved & Sent" in approve_resp.text

    # Verify status changed in database
    updated_lead = db_manager.get_lead_by_id(target_lead["id"])
    assert updated_lead["status"] == "sent"

    # Verify sent_emails entry was created
    sent = db_manager.get_sent_emails(lead_id=target_lead["id"])
    assert len(sent) > 0
    assert sent[0]["sender_type"] == "automated_approved"

def test_gmail_hitl_rejection_flow():
    # Run another cycle to get a lead to reject
    res = discovery_agent.run_discovery_cycle(category="roofers", city="Dallas, TX", count=2)
    leads = db_manager.get_leads(status="pending_approval")
    assert len(leads) > 0
    target_lead = leads[0]
    token = target_lead["approval_token"]

    # Simulate Admin clicking "Reject Draft" in Gmail
    reject_resp = client.get(f"/api/approval/reject?token={token}")
    assert reject_resp.status_code == 200
    assert "Draft Rejected" in reject_resp.text

    # Verify status changed to rejected
    updated_lead = db_manager.get_lead_by_id(target_lead["id"])
    assert updated_lead["status"] == "rejected"

    # Now verify user can send a CUSTOM EMAIL through the website for this rejected lead!
    custom_payload = {
        "recipient_email": "custom-client@testbusiness.com",
        "subject": "Customized Web Revamp Proposal",
        "body": "Hello, here is a custom proposal specifically revised for you."
    }
    custom_resp = client.post(f"/api/leads/{target_lead['id']}/send-custom-email", json=custom_payload)
    assert custom_resp.status_code == 200
    assert custom_resp.json()["status"] == "success"

    # Verify status is now sent
    lead_after_custom = db_manager.get_lead_by_id(target_lead["id"])
    assert lead_after_custom["status"] == "sent"

    # Verify sent_emails contains custom_manual type
    sent_list = db_manager.get_sent_emails(lead_id=target_lead["id"])
    assert any(s["sender_type"] == "custom_manual" for s in sent_list)

def test_logs_endpoint():
    resp = client.get("/api/logs?limit=50")
    assert resp.status_code == 200
    logs = resp.json()
    assert isinstance(logs, list)
    assert len(logs) > 0
    # Ensure statuses like success, info, warning are present
    assert any("step" in l for l in logs)

def test_stats_endpoint():
    resp = client.get("/api/stats")
    assert resp.status_code == 200
    stats = resp.json()
    assert "total_leads" in stats
    assert "no_website_count" in stats
    assert "pending_approval" in stats
    assert "rejected_count" in stats
    assert "sent_count" in stats
