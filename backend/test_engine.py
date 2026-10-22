import pytest
from fastapi.testclient import TestClient
from main import app
from supabase_client import db_manager
from agent import discovery_agent, verify_website
from email_service import email_service

client = TestClient(app)

def test_health_check():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "active" in data["scheduler"]
    assert "admin_email" in data

def test_deliverability_diagnostics():
    resp = client.get("/api/health/deliverability")
    assert resp.status_code == 200
    data = resp.json()
    assert "sender_email" in data
    assert "spf_record" in data
    assert "dmarc_record" in data
    assert data["provider_daily_limit"] >= 500

def test_database_status_endpoint():
    resp = client.get("/api/database/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "engine" in data
    assert data["is_connected"] is True
    assert len(data["primary_tables"]) >= 3

def test_website_verification_and_waf():
    # 1. Empty URL
    is_live_empty, status_empty, _ = verify_website("")
    assert is_live_empty is False
    assert status_empty == "none_found"

    # 2. Live website behind Cloudflare WAF (HTTP 403 WAF must be detected as verified_live, not dead!)
    is_live_waf, status_waf, _ = verify_website("https://www.houstonent.com/")
    assert is_live_waf is True
    assert "verified_live" in status_waf

    # 3. Known dead / non-existent domain
    is_live_dead, status_dead, _ = verify_website("https://nonexistent-domain-check-99881122.org")
    assert is_live_dead is False

def test_mx_resolution_and_preflight():
    # Real domain must pass MX check
    valid_pass, valid_msg = email_service.verify_domain_has_mx("test@gmail.com")
    assert valid_pass is True
    assert "Verified MX" in valid_msg or "resolved" in valid_msg

    # Fake domain must fail MX check before touching mail provider
    fake_pass, fake_msg = email_service.verify_domain_has_mx("test@fake-domain-xyz-never-exists-999.invalid")
    assert fake_pass is False

def test_suppression_list_and_hard_bounce_protection():
    # contact@outbackroofing.com was a known 550 hard bounce from Microsoft Outlook
    is_supp, reason = db_manager.is_suppressed("contact@outbackroofing.com")
    assert is_supp is True
    assert "Hard Bounce" in reason

    # Attempting to send raw email to suppressed address must be blocked immediately
    res = email_service.send_raw_email(
        to_email="contact@outbackroofing.com",
        subject="Test Block",
        text_body="Test text"
    )
    assert res["success"] is False
    assert "suppression list" in res["message"].lower()

def test_duplicate_send_prevention():
    # dancoRoofing@outlook.com was already recorded as sent
    is_dup = db_manager.is_email_already_sent("any-id", "dancoRoofing@outlook.com")
    assert is_dup is True

def test_safe_diagnostics_suite():
    payload = {"authorized": False}
    resp = client.post("/api/test/safe-run", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["step_1_smtp_auth"]["status"] in ("pass", "fail")
    assert data["step_2_database_connectivity"]["status"] == "pass"
    assert data["step_3_mx_resolution"]["status"] == "pass"
    assert data["step_4_suppression_and_bounce_guard"]["status"] == "pass"
    assert data["step_5_duplicate_prevention"]["status"] == "pass"
    assert data["step_6_authorized_test_send"]["status"] == "skipped"

def test_reply_recording_flow():
    # Find or create a test lead
    leads = db_manager.get_leads(limit=1)
    assert len(leads) > 0
    target_id = leads[0]["id"]

    reply_payload = {
        "reply_type": "inquiry",
        "notes": "Interested in website redesign. Asked for portfolio and pricing."
    }
    resp = client.post(f"/api/leads/{target_id}/reply", json=reply_payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"

    updated = db_manager.get_lead_by_id(target_id)
    assert updated["status"] == "reply_received"

def test_stats_and_reply_rate():
    resp = client.get("/api/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_leads" in data
    assert "sent_count" in data
    assert "replies_count" in data
    assert "reply_rate_percentage" in data
