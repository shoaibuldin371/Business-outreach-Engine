import os
import json
import uuid
import sqlite3
from datetime import datetime
from typing import List, Dict, Any, Optional
from config import settings

class SupabaseManager:
    def __init__(self):
        self.use_supabase = False
        self.client = None
        self.db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "local_store.db")
        
        # Check if Supabase credentials are provided
        if settings.SUPABASE_URL and settings.SUPABASE_KEY and "http" in settings.SUPABASE_URL:
            try:
                from supabase import create_client, Client
                self.client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
                self.use_supabase = True
                print("[OK] Successfully connected to remote Supabase instance.")
            except Exception as e:
                print(f"[WARN] Failed to connect to Supabase ({e}). Operating in resilient local storage mode.")
                self.use_supabase = False
                self._init_local_db()
        else:
            print("[INFO] Supabase credentials not provided in .env. Initializing local database store.")
            self.use_supabase = False
            self._init_local_db()

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
                website_status TEXT DEFAULT 'No website',
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
                sender_type TEXT DEFAULT 'automated_approved',
                status TEXT DEFAULT 'sent',
                error_message TEXT,
                sent_at TEXT
            )
            """)
            conn.commit()

    # ========================== LEADS ==========================
    def insert_lead(self, data: Dict[str, Any]) -> Dict[str, Any]:
        lead_id = str(uuid.uuid4())
        data["id"] = lead_id
        now_str = datetime.utcnow().isoformat()
        data.setdefault("created_at", now_str)
        data.setdefault("updated_at", now_str)
        data.setdefault("status", "pending_approval")
        
        if self.use_supabase:
            try:
                res = self.client.table("leads").insert(data).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"Error inserting into Supabase leads: {e}, falling back to local DB")
        
        # Local DB fallback
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cols = list(data.keys())
            placeholders = ",".join(["?" for _ in cols])
            col_names = ",".join(cols)
            conn.execute(f"INSERT INTO leads ({col_names}) VALUES ({placeholders})", [data[k] for k in cols])
            conn.commit()
            return data

    def get_leads(self, status: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        if self.use_supabase:
            try:
                query = self.client.table("leads").select("*").order("created_at", desc=True).limit(limit)
                if status and status.lower() != "all":
                    query = query.eq("status", status)
                res = query.execute()
                return res.data or []
            except Exception as e:
                print(f"Error reading from Supabase leads: {e}")
        
        # Local DB
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            if status and status.lower() != "all":
                cur = conn.execute("SELECT * FROM leads WHERE status = ? ORDER BY created_at DESC LIMIT ?", (status, limit))
            else:
                cur = conn.execute("SELECT * FROM leads ORDER BY created_at DESC LIMIT ?", (limit,))
            return [dict(row) for row in cur.fetchall()]

    def get_lead_by_id(self, lead_id: str) -> Optional[Dict[str, Any]]:
        if self.use_supabase:
            try:
                res = self.client.table("leads").select("*").eq("id", lead_id).execute()
                if res.data:
                    return res.data[0]
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
                res = self.client.table("leads").select("*").eq("approval_token", token).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"Error getting lead by token in Supabase: {e}")
        
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.execute("SELECT * FROM leads WHERE approval_token = ?", (token,))
            row = cur.fetchone()
            return dict(row) if row else None

    def update_lead(self, lead_id: str, updates: Dict[str, Any]) -> bool:
        updates["updated_at"] = datetime.utcnow().isoformat()
        if self.use_supabase:
            try:
                res = self.client.table("leads").update(updates).eq("id", lead_id).execute()
                return bool(res.data)
            except Exception as e:
                print(f"Error updating lead in Supabase: {e}")
        
        with sqlite3.connect(self.db_path) as conn:
            set_clauses = [f"{k} = ?" for k in updates.keys()]
            vals = list(updates.values()) + [lead_id]
            conn.execute(f"UPDATE leads SET {','.join(set_clauses)} WHERE id = ?", vals)
            conn.commit()
            return True

    # ========================== LOGS ==========================
    def insert_log(self, step: str, status: str, message: str, details: Optional[Dict[str, Any]] = None, lead_id: Optional[str] = None) -> Dict[str, Any]:
        log_id = str(uuid.uuid4())
        now_str = datetime.utcnow().isoformat()
        log_entry = {
            "id": log_id,
            "lead_id": lead_id,
            "step": step,
            "status": status,
            "message": message,
            "details": details or {},
            "created_at": now_str
        }
        
        if self.use_supabase:
            try:
                self.client.table("logs").insert(log_entry).execute()
                return log_entry
            except Exception as e:
                print(f"Error inserting into Supabase logs: {e}")
        
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT INTO logs (id, lead_id, step, status, message, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (log_id, lead_id, step, status, message, json.dumps(details or {}), now_str)
            )
            conn.commit()
            return log_entry

    def get_logs(self, limit: int = 200) -> List[Dict[str, Any]]:
        if self.use_supabase:
            try:
                res = self.client.table("logs").select("*").order("created_at", desc=True).limit(limit).execute()
                return res.data or []
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
    def insert_sent_email(self, lead_id: Optional[str], recipient_email: str, subject: str, body: str, sender_type: str = "automated_approved", status: str = "sent", error_message: Optional[str] = None) -> Dict[str, Any]:
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
                res = self.client.table("sent_emails").insert(data).execute()
                if res.data:
                    return res.data[0]
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
                query = self.client.table("sent_emails").select("*").order("sent_at", desc=True).limit(limit)
                if lead_id:
                    query = query.eq("lead_id", lead_id)
                res = query.execute()
                return res.data or []
            except Exception as e:
                print(f"Error reading sent_emails from Supabase: {e}")
        
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            if lead_id:
                cur = conn.execute("SELECT * FROM sent_emails WHERE lead_id = ? ORDER BY sent_at DESC LIMIT ?", (lead_id, limit))
            else:
                cur = conn.execute("SELECT * FROM sent_emails ORDER BY sent_at DESC LIMIT ?", (limit,))
            return [dict(row) for row in cur.fetchall()]

    # ========================== METRICS ==========================
    def get_stats(self) -> Dict[str, int]:
        leads = self.get_leads(limit=1000)
        logs = self.get_logs(limit=1000)
        sent = self.get_sent_emails(limit=1000)
        
        total = len(leads)
        no_website = sum(1 for l in leads if not l.get("website") or l.get("website_status") in ("No website", "Unreachable"))
        pending = sum(1 for l in leads if l.get("status") == "pending_approval")
        rejected = sum(1 for l in leads if l.get("status") == "rejected")
        sent_leads = sum(1 for l in leads if l.get("status") in ("sent", "approved"))
        
        return {
            "total_leads": total,
            "no_website_count": no_website,
            "pending_approval": pending,
            "rejected_count": rejected,
            "sent_count": sent_leads,
            "total_logs": len(logs),
            "total_sent_emails": len(sent)
        }

db_manager = SupabaseManager()
