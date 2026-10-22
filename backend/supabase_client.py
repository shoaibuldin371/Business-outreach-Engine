import os
import json
import uuid
import sqlite3
import requests
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from config import settings

class SupabaseManager:
    def __init__(self):
        self.use_supabase = False
        self.supabase_url = (settings.SUPABASE_URL or "").rstrip("/")
        self.supabase_key = settings.SUPABASE_KEY or ""
        self.db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "local_store.db")
        
        # Test direct REST connectivity to Supabase
        if self.supabase_url and self.supabase_key and "http" in self.supabase_url:
            try:
                headers = {
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}"
                }
                r = requests.get(f"{self.supabase_url}/rest/v1/leads?select=id&limit=1", headers=headers, timeout=6)
                if r.status_code in (200, 206):
                    self.use_supabase = True
                    print(f"[OK] Successfully connected to remote Supabase REST API at {self.supabase_url}")
                else:
                    print(f"[WARN] Supabase returned status {r.status_code}: {r.text}. Falling back to resilient local store.")
                    self.use_supabase = False
            except Exception as e:
                print(f"[WARN] Failed to connect to Supabase REST API ({e}). Falling back to resilient local store.")
                self.use_supabase = False
        else:
            print("[INFO] Supabase credentials not provided in .env. Initializing local database store.")
            self.use_supabase = False

        self._init_local_db()

    def _get_headers(self) -> Dict[str, str]:
        return {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

    def _init_local_db(self):
        """Initializes a local SQLite database that mirrors the Supabase schema exactly."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
            CREATE TABLE IF NOT EXISTS leads (
                id TEXT PRIMARY KEY,
                business_name TEXT NOT NULL,
                category TEXT,
                city TEXT,
                phone TEXT,
                email TEXT,
                website TEXT,
                website_status TEXT DEFAULT 'none_found',
                score INTEGER DEFAULT 0,
                notes TEXT,
                email_subject TEXT,
                email_body TEXT,
                status TEXT DEFAULT 'pending_approval',
                approval_token TEXT UNIQUE,
                source TEXT DEFAULT 'Automated Discovery Agent',
                last_contacted_at TEXT,
                created_at TEXT,
                updated_at TEXT
            )
            """)
            conn.execute("""
            CREATE TABLE IF NOT EXISTS logs (
                id TEXT PRIMARY KEY,
                lead_id TEXT,
                step TEXT NOT NULL,
                status TEXT NOT NULL,
                message TEXT NOT NULL,
                details TEXT,
                created_at TEXT
            )
            """)
            conn.execute("""
            CREATE TABLE IF NOT EXISTS sent_emails (
                id TEXT PRIMARY KEY,
                lead_id TEXT,
                recipient_email TEXT NOT NULL,
                subject TEXT NOT NULL,
                body TEXT NOT NULL,
                sender_type TEXT DEFAULT 'smtp',
                status TEXT DEFAULT 'accepted_by_provider',
                error_message TEXT,
                sent_at TEXT
            )
            """)
            conn.execute("""
            CREATE TABLE IF NOT EXISTS suppression_list (
                email TEXT PRIMARY KEY,
                reason TEXT NOT NULL,
                details TEXT,
                created_at TEXT
            )
            """)
            conn.commit()

    # ========================== LEADS ==========================
    def insert_lead(self, data: Dict[str, Any]) -> Dict[str, Any]:
        lead_id = data.get("id") or str(uuid.uuid4())
        data["id"] = lead_id
        now_str = datetime.utcnow().isoformat()
        data.setdefault("created_at", now_str)
        data.setdefault("updated_at", now_str)
        data.setdefault("status", "pending_approval")
        
        # Whitelist allowed columns for Supabase leads table
        allowed_cols = {
            "id", "business_name", "category", "city", "phone", "email",
            "website", "website_status", "score", "notes", "email_subject",
            "email_body", "status", "approval_token", "source",
            "last_contacted_at", "created_at", "updated_at"
        }
        filtered_data = {k: v for k, v in data.items() if k in allowed_cols}

        if self.use_supabase:
            try:
                r = requests.post(
                    f"{self.supabase_url}/rest/v1/leads",
                    headers=self._get_headers(),
                    json=filtered_data,
                    timeout=8
                )
                if r.status_code in (200, 201):
                    res_json = r.json()
                    return res_json[0] if isinstance(res_json, list) and res_json else filtered_data
            except Exception as e:
                print(f"Error inserting into Supabase leads: {e}, falling back to local DB")
        
        # Local DB fallback
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cols = list(filtered_data.keys())
            placeholders = ",".join(["?" for _ in cols])
            col_names = ",".join(cols)
            conn.execute(f"INSERT OR REPLACE INTO leads ({col_names}) VALUES ({placeholders})", [filtered_data[k] for k in cols])
            conn.commit()
            return filtered_data

    def get_leads(self, status: Optional[str] = None, limit: int = 200) -> List[Dict[str, Any]]:
        if self.use_supabase:
            try:
                url = f"{self.supabase_url}/rest/v1/leads?select=*&order=created_at.desc&limit={limit}"
                if status and status.lower() not in ("all", "active"):
                    if status == "completed":
                        url += "&status=in.(sent,accepted_by_provider,delivered,approved)"
                    elif status == "missing_contact":
                        url += "&or=(status.eq.missing_contact,email.is.null,email.eq.)"
                    else:
                        url += f"&status=eq.{status}"
                elif status == "active":
                    url += "&status=not.in.(sent,accepted_by_provider,delivered,rejected)"

                r = requests.get(url, headers=self._get_headers(), timeout=8)
                if r.status_code == 200:
                    return r.json()
            except Exception as e:
                print(f"Error reading from Supabase leads: {e}")
        
        # Local DB
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            if status and status.lower() not in ("all", "active"):
                if status == "completed":
                    cur = conn.execute("SELECT * FROM leads WHERE status IN ('sent', 'accepted_by_provider', 'delivered', 'approved') ORDER BY created_at DESC LIMIT ?", (limit,))
                elif status == "missing_contact":
                    cur = conn.execute("SELECT * FROM leads WHERE status = 'missing_contact' OR email IS NULL OR email = '' ORDER BY created_at DESC LIMIT ?", (limit,))
                else:
                    cur = conn.execute("SELECT * FROM leads WHERE status = ? ORDER BY created_at DESC LIMIT ?", (status, limit))
            elif status == "active":
                cur = conn.execute("SELECT * FROM leads WHERE status NOT IN ('sent', 'accepted_by_provider', 'delivered', 'rejected') ORDER BY created_at DESC LIMIT ?", (limit,))
            else:
                cur = conn.execute("SELECT * FROM leads ORDER BY created_at DESC LIMIT ?", (limit,))
            return [dict(row) for row in cur.fetchall()]

    def get_lead_by_id(self, lead_id: str) -> Optional[Dict[str, Any]]:
        if self.use_supabase:
            try:
                r = requests.get(f"{self.supabase_url}/rest/v1/leads?id=eq.{lead_id}&limit=1", headers=self._get_headers(), timeout=8)
                if r.status_code == 200:
                    data = r.json()
                    return data[0] if data else None
            except Exception as e:
                print(f"Error getting lead by ID in Supabase: {e}")
        
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.execute("SELECT * FROM leads WHERE id = ?", (lead_id,))
            row = cur.fetchone()
            return dict(row) if row else None

    def get_lead_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        if self.use_supabase:
            try:
                # Check by approval_token or ID
                r = requests.get(f"{self.supabase_url}/rest/v1/leads?or=(approval_token.eq.{token},id.eq.{token})&limit=1", headers=self._get_headers(), timeout=8)
                if r.status_code == 200:
                    data = r.json()
                    return data[0] if data else None
            except Exception as e:
                print(f"Error getting lead by token in Supabase: {e}")
        
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.execute("SELECT * FROM leads WHERE approval_token = ? OR id = ?", (token, token))
            row = cur.fetchone()
            return dict(row) if row else None

    def update_lead(self, lead_id: str, updates: Dict[str, Any]) -> bool:
        updates["updated_at"] = datetime.utcnow().isoformat()
        allowed_cols = {
            "business_name", "category", "city", "phone", "email",
            "website", "website_status", "score", "notes", "email_subject",
            "email_body", "status", "approval_token", "source",
            "last_contacted_at", "updated_at"
        }
        filtered_updates = {k: v for k, v in updates.items() if k in allowed_cols}

        if self.use_supabase:
            try:
                r = requests.patch(
                    f"{self.supabase_url}/rest/v1/leads?id=eq.{lead_id}",
                    headers=self._get_headers(),
                    json=filtered_updates,
                    timeout=8
                )
                if r.status_code in (200, 204):
                    return True
            except Exception as e:
                print(f"Error updating lead in Supabase: {e}")
        
        with sqlite3.connect(self.db_path) as conn:
            set_clauses = [f"{k} = ?" for k in filtered_updates.keys()]
            vals = list(filtered_updates.values()) + [lead_id]
            conn.execute(f"UPDATE leads SET {','.join(set_clauses)} WHERE id = ?", vals)
            conn.commit()
            return True

    # ========================== LOGS ==========================
    def insert_log(self, step: str, status: str, message: str, details: Optional[Dict[str, Any]] = None, lead_id: Optional[str] = None) -> Dict[str, Any]:
        log_id = str(uuid.uuid4())
        now_str = datetime.utcnow().isoformat()
        
        # Sanitize details (never leak passwords or secrets)
        sanitized_details = dict(details or {})
        for secret_key in ("password", "smtp_password", "token", "secret", "access_token"):
            if secret_key in sanitized_details:
                sanitized_details[secret_key] = "[REDACTED]"

        log_entry = {
            "id": log_id,
            "lead_id": lead_id,
            "step": step,
            "status": status,
            "message": message,
            "details": sanitized_details,
            "created_at": now_str
        }
        
        if self.use_supabase:
            try:
                r = requests.post(
                    f"{self.supabase_url}/rest/v1/logs",
                    headers=self._get_headers(),
                    json=log_entry,
                    timeout=6
                )
                if r.status_code in (200, 201):
                    return log_entry
            except Exception as e:
                print(f"Error inserting into Supabase logs: {e}")
        
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT INTO logs (id, lead_id, step, status, message, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (log_id, lead_id, step, status, message, json.dumps(sanitized_details), now_str)
            )
            conn.commit()
            return log_entry

    def get_logs(self, limit: int = 200) -> List[Dict[str, Any]]:
        if self.use_supabase:
            try:
                r = requests.get(
                    f"{self.supabase_url}/rest/v1/logs?select=*&order=created_at.desc&limit={limit}",
                    headers=self._get_headers(),
                    timeout=8
                )
                if r.status_code == 200:
                    rows = r.json()
                    # Ensure details is parsed
                    for row in rows:
                        if isinstance(row.get("details"), str):
                            try:
                                row["details"] = json.loads(row["details"])
                            except Exception:
                                pass
                    return rows
            except Exception as e:
                print(f"Error reading logs from Supabase: {e}")
        
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.execute("SELECT * FROM logs ORDER BY created_at DESC LIMIT ?", (limit,))
            rows = []
            for r in cur.fetchall():
                d = dict(r)
                if isinstance(d.get("details"), str):
                    try:
                        d["details"] = json.loads(d["details"])
                    except Exception:
                        d["details"] = {}
                rows.append(d)
            return rows

    # ========================== SENT EMAILS ==========================
    def insert_sent_email(self, lead_id: Optional[str], recipient_email: str, subject: str, body: str, sender_type: str = "smtp", status: str = "accepted_by_provider", error_message: Optional[str] = None) -> Dict[str, Any]:
        email_id = str(uuid.uuid4())
        now_str = datetime.utcnow().isoformat()
        data = {
            "id": email_id,
            "lead_id": lead_id,
            "recipient_email": recipient_email,
            "subject": subject,
            "body": body,
            "sender_type": sender_type,
            "status": status,
            "error_message": error_message,
            "sent_at": now_str
        }
        
        if self.use_supabase:
            try:
                r = requests.post(
                    f"{self.supabase_url}/rest/v1/sent_emails",
                    headers=self._get_headers(),
                    json=data,
                    timeout=8
                )
                if r.status_code in (200, 201):
                    res_json = r.json()
                    return res_json[0] if isinstance(res_json, list) and res_json else data
            except Exception as e:
                print(f"Error inserting into Supabase sent_emails: {e}")
        
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT INTO sent_emails (id, lead_id, recipient_email, subject, body, sender_type, status, error_message, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (email_id, lead_id, recipient_email, subject, body, sender_type, status, error_message, now_str)
            )
            conn.commit()
            return data

    def get_sent_emails(self, lead_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        if self.use_supabase:
            try:
                url = f"{self.supabase_url}/rest/v1/sent_emails?select=*&order=sent_at.desc&limit={limit}"
                if lead_id:
                    url += f"&lead_id=eq.{lead_id}"
                r = requests.get(url, headers=self._get_headers(), timeout=8)
                if r.status_code == 200:
                    return r.json()
            except Exception as e:
                print(f"Error reading sent_emails from Supabase: {e}")
        
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            if lead_id:
                cur = conn.execute("SELECT * FROM sent_emails WHERE lead_id = ? ORDER BY sent_at DESC LIMIT ?", (lead_id, limit))
            else:
                cur = conn.execute("SELECT * FROM sent_emails ORDER BY sent_at DESC LIMIT ?", (limit,))
            return [dict(row) for row in cur.fetchall()]

    # ========================== IDEMPOTENCY & SUPPRESSION ==========================
    def is_email_already_sent(self, lead_id: Optional[str], recipient_email: str) -> bool:
        """Strict duplicate-send prevention: Checks if outreach was already accepted/sent."""
        if not recipient_email:
            return False
        clean_email = recipient_email.strip().lower()

        if self.use_supabase:
            try:
                # Check by lead_id or recipient_email in sent_emails where status is sent/accepted
                url = f"{self.supabase_url}/rest/v1/sent_emails?select=id,status&recipient_email=ilike.{clean_email}&status=in.(sent,accepted_by_provider,delivered)&limit=1"
                r = requests.get(url, headers=self._get_headers(), timeout=6)
                if r.status_code == 200 and len(r.json()) > 0:
                    return True
            except Exception as e:
                print(f"Error checking is_email_already_sent in Supabase: {e}")

        with sqlite3.connect(self.db_path) as conn:
            cur = conn.execute(
                "SELECT id FROM sent_emails WHERE LOWER(recipient_email) = ? AND status IN ('sent', 'accepted_by_provider', 'delivered') LIMIT 1",
                (clean_email,)
            )
            return cur.fetchone() is not None

    def is_suppressed(self, email: str) -> Tuple[bool, str]:
        """Checks if email is on suppression list (bounced, unsubscribed, do-not-contact)."""
        if not email:
            return True, "Empty address"
        clean = email.strip().lower()

        # Hardcoded critical suppressions (e.g. known 550 bounces)
        if clean in ("contact@outbackroofing.com", "contact@.com"):
            return True, "Known 550 Hard Bounce (Mailbox does not exist on Microsoft Outlook)"

        # Block placeholder domains
        if any(clean.endswith(f"@{d}") or f"@{d}" in clean for d in ("example.com", "domain.com", "business.com", "local", "invalid")):
            return True, "Placeholder / dummy test domain"

        with sqlite3.connect(self.db_path) as conn:
            cur = conn.execute("SELECT reason FROM suppression_list WHERE email = ? LIMIT 1", (clean,))
            row = cur.fetchone()
            if row:
                return True, row[0]

        return False, ""

    def add_to_suppression_list(self, email: str, reason: str, details: str = ""):
        clean = email.strip().lower()
        now_str = datetime.utcnow().isoformat()
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO suppression_list (email, reason, details, created_at) VALUES (?, ?, ?, ?)",
                (clean, reason, details, now_str)
            )
            conn.commit()

    # ========================== METRICS & TELEMETRY ==========================
    def get_stats(self) -> Dict[str, Any]:
        leads = self.get_leads(limit=1000)
        logs = self.get_logs(limit=1000)
        sent = self.get_sent_emails(limit=1000)
        
        total = len(leads)
        no_website = sum(1 for l in leads if not l.get("website") or l.get("website_status") in ("none_found", "No website", "unreachable"))
        pending = sum(1 for l in leads if l.get("status") in ("pending_approval", "draft_ready") and bool(l.get("email")))
        missing_contact = sum(1 for l in leads if l.get("status") == "missing_contact" or not l.get("email"))
        rejected = sum(1 for l in leads if l.get("status") == "rejected")
        
        # Breakdown sent by status
        accepted_count = sum(1 for s in sent if s.get("status") in ("accepted_by_provider", "sent", "delivered"))
        failed_count = sum(1 for s in sent if s.get("status") in ("failed", "bounced", "error"))
        replies_count = sum(1 for l in leads if l.get("status") == "reply_received")

        # Reply rate calculation with clear denominator
        reply_rate_pct = round((replies_count / accepted_count * 100), 1) if accepted_count > 0 else 0.0

        return {
            "total_leads": total,
            "no_website_count": no_website,
            "pending_approval": pending,
            "missing_contact_count": missing_contact,
            "active_pipelines_count": pending + missing_contact,
            "rejected_count": rejected,
            "sent_count": accepted_count,
            "accepted_by_provider": accepted_count,
            "failed_count": failed_count,
            "replies_count": replies_count,
            "reply_rate_percentage": reply_rate_pct,
            "total_logs": len(logs),
            "total_sent_emails": len(sent),
            "storage_engine": "Supabase PostgreSQL Cloud REST" if self.use_supabase else "Resilient Local Store"
        }

db_manager = SupabaseManager()
