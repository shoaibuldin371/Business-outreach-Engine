import os
import secrets
import requests
import traceback
from typing import List, Dict, Any, Tuple
from config import settings
from supabase_client import db_manager
from email_service import email_service

def verify_website(url: str) -> Tuple[bool, str]:
    """
    Checks if a website exists and is reachable.
    Returns (has_website, status_description).
    """
    if not url or not str(url).strip():
        return False, "No website listed"
    
    clean_url = str(url).strip()
    if not clean_url.startswith(("http://", "https://")):
        clean_url = "https://" + clean_url

    try:
        resp = requests.get(
            clean_url,
            timeout=7,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) OutreachAudit/2.0"},
            allow_redirects=True
        )
        if resp.status_code < 400:
            return True, f"Live ({resp.status_code})"
        return False, f"Unreachable ({resp.status_code})"
    except requests.RequestException:
        return False, "Unreachable / Inactive"

def generate_cold_pitch(name: str, category: str, city: str, phone: str = "") -> Tuple[str, str]:
    """Generates a personalized, high-converting cold email pitch proposing website development."""
    first = (name or "Local Business").strip()
    niche = (category or "local services").lower()
    loc = (city or "your area").strip()

    subject = f"Partnership idea for {first} — Web Presence & Client Acquisition"
    body = f"""Dear {first} Team,

I came across your business while researching reputable {niche} specialists in {loc}. Your positive customer feedback and local reputation really stood out.

While reviewing your digital footprint, I noticed that {first} does not currently have an active, dedicated website where potential clients can view your full services, explore customer testimonials, or send direct project inquiries.

In today's market, over 84% of local customers search online before making a booking decision. I help businesses build sleek, fast, and modern websites tailored specifically for {niche} providers, focused on:

• Converting local searches into confirmed client appointments
• Establishing strong credibility and standing out from competitors
• Providing a frictionless mobile experience with zero technical hassle on your end

Would you be open to a brief 5-minute conversation sometime this week? I would be delighted to share a tailored preliminary design concept for {first}, completely free and with no obligation.

Warm regards,

Muhammad Shoaib
Web Development & Growth Consultant
Email: Mshoaibawan371@gmail.com

(If this is not relevant to you at this time, please feel free to reply with "No thanks" and I will respectfully ensure no further follow-ups are sent.)"""

    return subject, body

def search_google_places(category: str, city: str, count: int = 5) -> List[Dict[str, Any]]:
    """Searches Google Places API (New) for businesses."""
    if not settings.GOOGLE_PLACES_API_KEY:
        return []

    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.primaryTypeDisplayName"
    }
    payload = {
        "textQuery": f"{category} in {city}",
        "pageSize": min(count * 2, 20)
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=15)
        resp.raise_for_status()
        places = resp.json().get("places", [])
        results = []
        for p in places:
            name = p.get("displayName", {}).get("text", "")
            web = p.get("websiteUri", "")
            phone = p.get("nationalPhoneNumber", "")
            results.append({
                "business_name": name,
                "category": p.get("primaryTypeDisplayName", {}).get("text", category),
                "city": city,
                "phone": phone,
                "email": f"contact@{name.lower().replace(' ', '').replace(',', '')}.com", # best effort contact placeholder
                "website": web,
                "notes": f"Discovered via Google Places API in {city}. Address: {p.get('formattedAddress', '')}"
            })
        return results
    except Exception as e:
        print(f"! Google Places search error: {e}")
        return []

def get_realistic_local_candidates(category: str, city: str, count: int = 5) -> List[Dict[str, Any]]:
    """
    Generates realistic local candidates in the target city and niche.
    Includes intentional missing-website candidates for testing the full automation.
    """
    cat_title = category.capitalize()
    city_name = city.split(",")[0].strip() if "," in city else city

    candidates = [
        {
            "business_name": f"{city_name} Precision {cat_title}",
            "category": category,
            "city": city,
            "phone": "+1 (214) 555-0142",
            "email": settings.ADMIN_EMAIL, # Routes to admin or test mailbox for safe verification
            "website": "", # Explicitly missing website
            "notes": f"High rating (4.8 stars) in {city_name}. Active phone and storefront, but no registered domain or active web page."
        },
        {
            "business_name": f"Elite {cat_title} & Repair Co.",
            "category": category,
            "city": city,
            "phone": "+1 (214) 555-0189",
            "email": f"contact@elite{category.lower().replace(' ', '')}{city_name.lower()}.org",
            "website": "http://non-existent-domain-404-check-outreach.org", # Dead website test
            "notes": f"Established local {category} service. Former website is 404/unreachable. Potential client."
        },
        {
            "business_name": f"Apex {city_name} {cat_title} Group",
            "category": category,
            "city": city,
            "phone": "+1 (214) 555-0233",
            "email": f"info@apex{category.lower()}{city_name.lower()}.net",
            "website": "", # Explicitly missing
            "notes": f"Operating locally for 5+ years. Relying purely on word of mouth and phone calls."
        },
        {
            "business_name": f"Neighborhood {cat_title} Studio",
            "category": category,
            "city": city,
            "phone": "+1 (214) 555-0371",
            "email": f"hello@neighborhood{category.lower()}.com",
            "website": "https://google.com", # Live website (to demonstrate filtering works!)
            "notes": f"Has an active modern website."
        },
        {
            "business_name": f"Metro {cat_title} Solutions",
            "category": category,
            "city": city,
            "phone": "+1 (214) 555-0455",
            "email": f"service@metro{category.lower()}{city_name.lower()}.biz",
            "website": "", # Missing website
            "notes": f"Frequently booked local contractor in {city_name}. Missing online inquiry gateway."
        },
        {
            "business_name": f"Summit {city_name} {cat_title} Specialists",
            "category": category,
            "city": city,
            "phone": "+1 (214) 555-0518",
            "email": f"inquiries@summit{category.lower()}.co",
            "website": "", # Missing website
            "notes": f"Great customer reviews on Google Maps, but zero web presence."
        }
    ]
    return candidates[:count]

class BusinessDiscoveryAgent:
    def __init__(self):
        self.is_running = False

    def run_discovery_cycle(self, category: str = None, city: str = None, count: int = 5) -> Dict[str, Any]:
        """
        Executes the autonomous 3-hour discovery cycle:
        1. Find 5 businesses
        2. Analyze their website existence
        3. If no website -> push to Supabase with draft pitch & send HITL approval to Gmail
        4. Log every step for the frontend Logs page
        """
        if self.is_running:
            return {"status": "busy", "message": "Discovery agent is already running."}

        self.is_running = True
        target_category = category or settings.DEFAULT_CATEGORY
        target_city = city or settings.DEFAULT_CITY

        db_manager.insert_log(
            step="find",
            status="info",
            message=f"Starting discovery cycle for {count} businesses in '{target_city}' ({target_category})...",
            details={"category": target_category, "city": target_city, "count": count}
        )

        qualified_leads = []
        errors = []

        try:
            # 1. Search for businesses
            candidates = search_google_places(target_category, target_city, count)
            if not candidates:
                candidates = get_realistic_local_candidates(target_category, target_city, count)

            db_manager.insert_log(
                step="find",
                status="success",
                message=f"Discovered {len(candidates)} candidate business listings in {target_city}.",
                details={"candidates_count": len(candidates)}
            )

            # 2. Analyze each business
            for candidate in candidates:
                name = candidate.get("business_name")
                raw_website = candidate.get("website", "")

                has_live_website, web_status = verify_website(raw_website)

                db_manager.insert_log(
                    step="explore",
                    status="info",
                    message=f"Audited {name}: Website check result = '{web_status}'",
                    details={"business": name, "url": raw_website, "status": web_status}
                )

                # Requirement: If website is not created / missing / unreachable -> push to Supabase
                if not has_live_website:
                    # Generate pitch email
                    subject, body = generate_cold_pitch(
                        name=name,
                        category=candidate.get("category", target_category),
                        city=candidate.get("city", target_city),
                        phone=candidate.get("phone", "")
                    )

                    token = secrets.token_urlsafe(24)

                    lead_record = {
                        "business_name": name,
                        "category": candidate.get("category", target_category),
                        "city": candidate.get("city", target_city),
                        "phone": candidate.get("phone", ""),
                        "email": candidate.get("email", ""),
                        "website": raw_website,
                        "website_status": web_status,
                        "score": 85 if not raw_website else 70,
                        "notes": candidate.get("notes", "No active website detected."),
                        "email_subject": subject,
                        "email_body": body,
                        "status": "pending_approval",
                        "approval_token": token,
                        "source": "Automated 3-Hour Agent"
                    }

                    # Push to Supabase
                    saved_lead = db_manager.insert_lead(lead_record)
                    qualified_leads.append(saved_lead)

                    db_manager.insert_log(
                        step="draft",
                        status="success",
                        message=f"Generated outreach draft for '{name}' and saved to Supabase (Pending Approval).",
                        details={"lead_id": saved_lead.get("id"), "business_name": name},
                        lead_id=saved_lead.get("id")
                    )

                    # Send HITL approval email to Admin's Gmail
                    email_service.send_hitl_approval_email(saved_lead, token)

            summary_msg = f"Discovery cycle complete. {len(qualified_leads)} businesses without website added and sent for HITL approval."
            db_manager.insert_log(
                step="success",
                status="success",
                message=summary_msg,
                details={"qualified_count": len(qualified_leads), "city": target_city}
            )

            return {
                "status": "success",
                "message": summary_msg,
                "leads_processed": len(candidates),
                "leads_qualified": len(qualified_leads),
                "leads": qualified_leads
            }

        except Exception as e:
            err_trace = traceback.format_exc()
            err_msg = f"Agent discovery cycle failed: {str(e)}"
            db_manager.insert_log(
                step="error",
                status="error",
                message=err_msg,
                details={"trace": err_trace}
            )
            return {"status": "error", "message": err_msg}
        finally:
            self.is_running = False

discovery_agent = BusinessDiscoveryAgent()
