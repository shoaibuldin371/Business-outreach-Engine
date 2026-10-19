from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime

class LeadBase(BaseModel):
    business_name: str
    category: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    website_status: Optional[str] = "No website"
    score: Optional[int] = 0
    notes: Optional[str] = None
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    status: Optional[str] = "pending_approval"
    source: Optional[str] = "Automated Discovery Agent"

class LeadCreate(LeadBase):
    pass

class LeadResponse(LeadBase):
    id: str
    approval_token: Optional[str] = None
    last_contacted_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class CustomEmailRequest(BaseModel):
    recipient_email: str
    subject: str
    body: str

class ApprovalActionRequest(BaseModel):
    lead_id: str
    action: str # "approve" or "reject"
    custom_subject: Optional[str] = None
    custom_body: Optional[str] = None

class TriggerDiscoveryRequest(BaseModel):
    category: Optional[str] = None
    city: Optional[str] = None
    count: Optional[int] = 5

class LogResponse(BaseModel):
    id: str
    lead_id: Optional[str] = None
    step: str # find, explore, draft, approval_pending, approved, rejected, sending, success, error
    status: str # info, success, warning, error
    message: str
    details: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None

class SentEmailResponse(BaseModel):
    id: str
    lead_id: Optional[str] = None
    recipient_email: str
    subject: str
    body: str
    sender_type: str # automated_approved, custom_manual
    status: str
    error_message: Optional[str] = None
    sent_at: Optional[datetime] = None

class StatsResponse(BaseModel):
    total_leads: int
    no_website_count: int
    pending_approval: int
    rejected_count: int
    sent_count: int
    total_logs: int
    total_sent_emails: int
