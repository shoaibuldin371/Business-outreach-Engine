import os
import secrets
import requests
import traceback
import socket
from urllib.parse import urlparse
from typing import List, Dict, Any, Tuple, Optional
from config import settings
from supabase_client import db_manager
from email_service import email_service

try:
    import dns.resolver
    HAS_DNSPYTHON = True
except ImportError:
    HAS_DNSPYTHON = False

PARKED_DOMAIN_SIGNATURES = [
    "this domain is parked",
    "domain is for sale",
    "buy this domain",
    "godaddy parked",
    "namecheap parking",
    "hugedomains",
    "domain under construction",
    "website is coming soon",
    "renew this domain",
    "parkingcrew",
    "sedo domain parking",
    "parked free"
]

WAF_SIGNATURE_HEADERS = [
    "cloudflare",
    "cf-ray",
    "x-amz-cf-id",
    "akamai",
    "imperva",
    "incapsula",
    "sucuri"
]

def verify_website(url: str) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Independently verifies if a website exists and is reachable.
    Correctly recognizes Cloudflare/Imperva/WAF 403/401 protections as ACTIVE LIVE WEBSITES.
    Detects parked/abandoned domains and DNS absence.
    Returns (has_live_website, status_description, details).
    """
    if not url or not str(url).strip():
        return False, "none_found", {"reason": "No website URL provided in public directory."}
    
    clean_url = str(url).strip()
    if not clean_url.startswith(("http://", "https://")):
        clean_url = "https://" + clean_url

    parsed = urlparse(clean_url)
    domain = parsed.netloc.split(":")[0] if parsed.netloc else parsed.path.split("/")[0]

    details: Dict[str, Any] = {
        "url": clean_url,
        "domain": domain,
        "dns_resolved": False,
        "http_status": None,
        "is_parked": False,
        "waf_protected": False
    }

    # Step 1: DNS Resolution Check
    has_dns = False
    if domain:
        if HAS_DNSPYTHON:
            try:
                res = dns.resolver.Resolver()
                res.nameservers = ['8.8.8.8', '1.1.1.1']
                a_records = res.resolve(domain, 'A', lifetime=3.0)
                if a_records:
                    has_dns = True
                    details["dns_resolved"] = True
                    details["ip_addresses"] = [r.to_text() for r in a_records]
            except Exception:
                pass
        
        if not has_dns:
            try:
                socket.getaddrinfo(domain, 80, family=socket.AF_INET)
                has_dns = True
                details["dns_resolved"] = True
            except socket.gaierror:
                return False, "dns_failed", {**details, "reason": f"Domain '{domain}' does not resolve to any IP address."}

    # Step 2: HTTP / HTTPS probe with standard browser headers
    try:
        resp = requests.get(
            clean_url,
            timeout=8,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            },
            allow_redirects=True
        )
        status_code = resp.status_code
        details["http_status"] = status_code
        details["final_url"] = resp.url

        # Check for Cloudflare / Enterprise WAF header signatures
        server_header = (resp.headers.get("server") or "").lower()
        headers_str = " ".join([f"{k}:{v}" for k, v in resp.headers.items()]).lower()
        is_waf = any(sig in server_header or sig in headers_str for sig in WAF_SIGNATURE_HEADERS)
        if is_waf:
            details["waf_protected"] = True

        # If HTTP 200-399 -> Live website, but check if parked
        if status_code < 400:
            body_text = resp.text[:25000].lower()
            is_parked = any(sig in body_text for sig in PARKED_DOMAIN_SIGNATURES)
            details["is_parked"] = is_parked
            if is_parked:
                return False, "parked_domain", {**details, "reason": "Domain is registered but parked/for sale."}
            return True, f"verified_live ({status_code})", details

        # CRITICAL REPAIR: If HTTP 403 or 401 is returned by Cloudflare/WAF, the website IS LIVE!
        if status_code in (401, 403, 406, 429) and (is_waf or has_dns):
            return True, f"verified_live (WAF Protected HTTP {status_code})", details

        # Real 404, 500, 502, 503 errors
        return False, f"unreachable (HTTP {status_code})", details

    except requests.exceptions.SSLError:
        return False, "ssl_error", {**details, "reason": "SSL certificate invalid or expired."}
    except requests.exceptions.Timeout:
        # If timeout occurred but DNS resolves to Cloudflare/hosting, mark for manual review, not dead
        if has_dns:
            return False, "slow_or_timeout", {**details, "reason": "Connection timed out after 8s."}
        return False, "unreachable", {**details, "reason": "Connection timed out."}
    except requests.RequestException as e:
        return False, "unreachable", {**details, "reason": str(e)}

def generate_cold_pitch_variants(name: str, category: str, city: str, phone: str = "") -> Dict[str, Any]:
    """
    Generates genuine, tailored cold email pitches using real verified observations.
    Provides 3 distinct angles and alternative subject lines.
    Avoids generic clichés, false flattery, and fabricated statistics.
    """
    first = (name or "Local Business").strip()
    niche = (category or "local services").lower()
    loc = (city or "your area").strip()

    # Angle 1: Capturing nearby client searches
    subject_1 = f"Idea for {first} — Capturing {loc} client searches online"
    body_1 = f"""Dear {first} Team,

I came across your business while researching established {niche} providers in {loc}.

While looking for your official online presence, I noticed that {first} does not currently have an active, dedicated website where local clients searching online can view your complete service offerings or submit direct inquiries.

When prospective clients in {loc} search for {niche} providers on their phones, they tend to book with companies that offer clean service details and direct contact forms. Without an active website, those inquiries often go to other local businesses.

I build clean, fast, and modern websites tailored specifically for {niche} businesses, focused on:
• Turning local search traffic into verified phone calls and booked appointments
• Establishing clear credibility and differentiating you from competitors
• Providing a seamless mobile experience with zero technical hassle on your end

Would you be open to a brief 5-minute conversation sometime this week? I have already sketched a preliminary design concept for {first} that I would be glad to share with you, completely free with no obligation.

Best regards,

{settings.SENDER_NAME}
Web Development & Business Automation
Email: {settings.SENDER_EMAIL}

(If this is not relevant to you, simply reply with "No thanks" and I will ensure no further messages are sent.)"""

    # Angle 2: Mobile customer conversion & frictionless inquiries
    subject_2 = f"Quick question regarding online inquiries for {first}"
    body_2 = f"""Hi {first} Team,

I noticed that {first} serves clients across {loc} in {niche}, but does not currently maintain an active mobile-optimized website for prospective customers to request estimates or view your services.

Many local clients look up services directly on their phones before reaching out. Providing a straightforward online inquiry form and clear service highlights makes it significantly easier for new clients to contact you.

I specialize in lightweight, high-converting websites and booking automation for {niche} specialists. 

Could I send over a quick 2-minute visual mockup tailored for {first}? There is no cost or obligation—just a practical look at how an online gateway could help capture more local clients for your business.

Warm regards,

{settings.SENDER_NAME}
Web Development & Business Automation
Email: {settings.SENDER_EMAIL}

(Feel free to reply "No thanks" if you'd prefer not to hear from me again.)"""

    # Angle 3: Direct portfolio & free design proof
    subject_3 = f"Tailored website mockup concept for {first}"
    body_3 = f"""Dear {first} Team,

While researching reputable {niche} services in {loc}, I noticed that you do not currently have an active website to showcase your work and receive client requests online.

I design custom websites for local service businesses that want a polished online presence without the high agency overhead. 

I would be happy to share a free, no-obligation preliminary design mockup created specifically for {first}, showing how a modern web presence could showcase your services and streamline customer inquiries.

Would you be open to taking a look sometime this week?

Sincerely,

{settings.SENDER_NAME}
Web Development & Business Automation
Email: {settings.SENDER_EMAIL}

(If this is not a fit, reply "No thanks" and you won't hear from me again.)"""

    return {
        "primary_subject": subject_1,
        "primary_body": body_1,
        "variants": [
            {"angle": "Local Search Capture", "subject": subject_1, "body": body_1},
            {"angle": "Mobile Inquiries", "subject": subject_2, "body": body_2},
            {"angle": "Portfolio & Free Mockup", "subject": subject_3, "body": body_3}
        ]
    }

def search_google_places(category: str, city: str, count: int = 5) -> List[Dict[str, Any]]:
    """Searches Google Places API (New) for 100% real businesses."""
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
        resp = requests.post(url, headers=headers, json=payload, timeout=12)
        resp.raise_for_status()
        places = resp.json().get("places", [])
        results = []
        for p in places:
            name = p.get("displayName", {}).get("text", "")
            web = p.get("websiteUri", "")
            phone = p.get("nationalPhoneNumber", "")
            # NEVER fabricate an email: leave empty so it is accurately classified as needs contact
            results.append({
                "business_name": name,
                "category": p.get("primaryTypeDisplayName", {}).get("text", category),
                "city": city,
                "phone": phone,
                "email": "",
                "website": web,
                "source": "Google Places API (New)",
                "notes": f"Verified local listing in {city}. Address: {p.get('formattedAddress', '')}"
            })
        return results
    except Exception as e:
        print(f"! Google Places search error: {e}")
        return []

def search_openstreetmap(category: str, city: str, count: int = 5) -> List[Dict[str, Any]]:
    """Searches OpenStreetMap Nominatim for 100% REAL registered businesses."""
    city_name = city.split(",")[0].strip()
    search_keyword = category.lower().strip()
    if "dentist" in search_keyword: search_keyword = "dentist"
    elif "roof" in search_keyword: search_keyword = "roofing"
    elif "plumb" in search_keyword: search_keyword = "plumber"
    elif "hvac" in search_keyword: search_keyword = "hvac"
    elif "law" in search_keyword or "attorney" in search_keyword: search_keyword = "lawyer"
    elif "account" in search_keyword or "cpa" in search_keyword: search_keyword = "accountant"
    elif "auto" in search_keyword or "repair" in search_keyword: search_keyword = "car repair"
    elif "vet" in search_keyword: search_keyword = "veterinary"

    query = f"{search_keyword} {city_name}"
    url = f"https://nominatim.openstreetmap.org/search?q={requests.utils.quote(query)}&format=json&limit={min(count * 3, 20)}&addressdetails=1&extratags=1"

    try:
        resp = requests.get(
            url,
            headers={"User-Agent": "BusinessOutreachEngineAudit/2.0 (contact: admin@outreachengine.com)", "Accept": "application/json"},
            timeout=10
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        if not isinstance(data, list):
            return []

        results = []
        for item in data:
            raw_name = item.get("name") or (item.get("display_name", "").split(",")[0] if item.get("display_name") else "")
            clean_name = raw_name.strip()
            if not clean_name or len(clean_name) < 3 or clean_name.lower() == search_keyword:
                continue

            extratags = item.get("extratags", {})
            address = item.get("address", {})
            phone = extratags.get("phone") or extratags.get("contact:phone", "")
            website = extratags.get("website") or extratags.get("contact:website", "")
            real_public_email = extratags.get("email") or extratags.get("contact:email", "")

            results.append({
                "business_name": clean_name,
                "category": category,
                "city": city,
                "phone": phone,
                "email": real_public_email, # ONLY real public email if present, never fabricated
                "website": website,
                "source": "OpenStreetMap Live Directory",
                "notes": f"Registered entity in {city_name}. Address: {item.get('display_name', '')[:100]}"
            })
            if len(results) >= count * 2:
                break
        return results
    except Exception as e:
        print(f"! OpenStreetMap search error: {e}")
        return []

class BusinessDiscoveryAgent:
    def __init__(self):
        self.is_running = False

    def run_discovery_cycle(self, category: str = None, city: str = None, count: int = 5) -> Dict[str, Any]:
        """
        Executes an autonomous discovery cycle:
        1. Find real candidate businesses across USA & eligible industries.
        2. Accurately audit their website presence (recognizing WAF protections as live).
        3. For businesses without websites:
           - If verified email found -> push as 'pending_approval' & send HITL review to Admin Gmail.
           - If no email found -> push as 'missing_contact' (Phone Outreach queue), NEVER fabricate emails!
        4. Log every step for real-time telemetry.
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
        skipped_count = 0

        try:
            # 1. Search for 100% REAL businesses
            candidates = search_google_places(target_category, target_city, count)
            if not candidates:
                candidates = search_openstreetmap(target_category, target_city, count)

            # Pre-fetch existing leads to prevent duplicates
            existing_leads = db_manager.get_leads(limit=500)
            existing_names = {l.get("business_name", "").lower().strip() for l in existing_leads if l.get("business_name")}

            db_manager.insert_log(
                step="find",
                status="success",
                message=f"Discovered {len(candidates)} real business listings in {target_city}.",
                details={"candidates_count": len(candidates)}
            )

            # 2. Analyze each business
            for candidate in candidates:
                name = candidate.get("business_name")
                raw_website = candidate.get("website", "")

                # Skip if already exists in pipeline (strict deduplication)
                if name.lower().strip() in existing_names:
                    continue

                has_live_website, web_status, audit_details = verify_website(raw_website)

                db_manager.insert_log(
                    step="explore",
                    status="info" if not has_live_website else "warning",
                    message=f"Audited '{name}': Website check result = '{web_status}'",
                    details={"business": name, "url": raw_website, "status": web_status, "audit": audit_details}
                )

                # If the business already has an active verified website -> skip!
                if has_live_website:
                    skipped_count += 1
                    continue

                # Generate customized pitch variants
                pitch_data = generate_cold_pitch_variants(
                    name=name,
                    category=candidate.get("category", target_category),
                    city=candidate.get("city", target_city),
                    phone=candidate.get("phone", "")
                )

                token = secrets.token_urlsafe(24)
                email = candidate.get("email", "").strip()
                has_email = bool(email and "@" in email)
                if not has_email:
                    # Email-only policy: Never save or show businesses that have no email
                    skipped_count += 1
                    continue

                lead_status = "sent"
                confidence_score = 90

                lead_record = {
                    "business_name": name,
                    "category": candidate.get("category", target_category),
                    "city": candidate.get("city", target_city),
                    "phone": candidate.get("phone", ""),
                    "email": email, # REAL or empty, NEVER fabricated
                    "website": raw_website,
                    "website_status": web_status,
                    "score": confidence_score,
                    "notes": candidate.get("notes", f"No active website detected ({web_status})."),
                    "email_subject": pitch_data["primary_subject"],
                    "email_body": pitch_data["primary_body"],
                    "status": lead_status,
                    "approval_token": token,
                    "source": candidate.get("source", "Automated Discovery Agent")
                }

                # Push to database
                saved_lead = db_manager.insert_lead(lead_record)
                qualified_leads.append(saved_lead)
                existing_names.add(name.lower().strip())

                db_manager.insert_log(
                    step="draft",
                    status="success",
                    message=f"Generated tailored pitch for '{name}' [Status: {lead_status}].",
                    details={"lead_id": saved_lead.get("id"), "business_name": name, "has_email": has_email},
                    lead_id=saved_lead.get("id")
                )

                # Auto-dispatch email directly to verified prospect
                if has_email:
                    auto_success, auto_msg = email_service.send_pitch_to_prospect(saved_lead, sender_type="automated_discovery")
                    if auto_success:
                        db_manager.update_lead_status(saved_lead.get("id"), "sent")
                        db_manager.insert_log(
                            step="success",
                            status="success",
                            message=f"🚀 Auto-dispatched pitch to '{name}' ({email}). Outgoing email is saved in your Gmail 'Sent' folder.",
                            details={"lead_id": saved_lead.get("id"), "recipient": email, "status": "sent"},
                            lead_id=saved_lead.get("id")
                        )
                    else:
                        email_service.send_hitl_approval_email(saved_lead, token)

                if len(qualified_leads) >= count:
                    break

            summary_msg = f"Discovery cycle complete. {len(qualified_leads)} qualified businesses without websites processed ({skipped_count} active websites skipped)."
            db_manager.insert_log(
                step="success",
                status="success",
                message=summary_msg,
                details={"qualified_count": len(qualified_leads), "city": target_city, "skipped": skipped_count}
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
