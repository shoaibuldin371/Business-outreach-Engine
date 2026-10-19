import os, re, json, sqlite3, smtplib, requests
from email.message import EmailMessage
from datetime import datetime
from urllib.parse import urlparse
import pandas as pd
import streamlit as st
from dotenv import load_dotenv

load_dotenv()
APP_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(APP_DIR, 'leads.db')

st.set_page_config(page_title='Business Outreach Engine', page_icon='🚀', layout='wide')

# ---------- database ----------
def db():
    con = sqlite3.connect(DB_PATH, check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute('''CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT, business_name TEXT NOT NULL, category TEXT,
      city TEXT, website TEXT, phone TEXT, email TEXT, rating REAL, review_count INTEGER,
      website_status TEXT, score INTEGER DEFAULT 0, notes TEXT, email_subject TEXT,
      email_body TEXT, status TEXT DEFAULT 'New', source TEXT, created_at TEXT,
      last_contacted_at TEXT, opted_out INTEGER DEFAULT 0, UNIQUE(business_name, city))''')
    con.commit()
    return con

con = db()

def norm_url(url):
    url = (url or '').strip()
    if not url: return ''
    if not url.startswith(('http://', 'https://')): url = 'https://' + url
    return url

def check_website(url):
    if not url: return 'No website listed'
    try:
        r = requests.get(norm_url(url), timeout=8, headers={'User-Agent':'BusinessOutreachAudit/1.0'}, allow_redirects=True)
        if r.status_code < 400: return f'Live ({r.status_code})'
        return f'Needs review ({r.status_code})'
    except requests.RequestException:
        return 'Unreachable - verify manually'

def lead_score(website, rating, reviews, status):
    score = 0
    if not website: score += 50
    if reviews and reviews >= 30: score += 20
    elif reviews and reviews >= 10: score += 12
    elif reviews and reviews >= 3: score += 5
    if rating and rating >= 4.3: score += 15
    elif rating and rating >= 3.8: score += 8
    if status == 'Unreachable - verify manually': score += 5
    return min(score, 100)

def save_lead(row):
    website = str(row.get('website') or '').strip()
    status = row.get('website_status') or ('No website listed' if not website else check_website(website))
    rating = row.get('rating')
    reviews = row.get('review_count')
    score = lead_score(website, rating, reviews, status)
    vals = (str(row.get('business_name') or '').strip(), str(row.get('category') or ''), str(row.get('city') or ''), website,
            str(row.get('phone') or ''), str(row.get('email') or ''), float(rating) if pd.notna(rating) and str(rating) else None,
            int(reviews) if pd.notna(reviews) and str(reviews) else 0, status, score, str(row.get('notes') or ''),
            str(row.get('source') or 'Manual/CSV'), datetime.utcnow().isoformat(timespec='seconds'))
    if not vals[0]: return False
    con.execute('''INSERT INTO leads (business_name,category,city,website,phone,email,rating,review_count,website_status,score,notes,source,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(business_name,city) DO UPDATE SET
      category=excluded.category, website=excluded.website, phone=excluded.phone, email=excluded.email,
      rating=excluded.rating, review_count=excluded.review_count, website_status=excluded.website_status,
      score=excluded.score, notes=excluded.notes, source=excluded.source''', vals)
    con.commit(); return True

def draft_email(name, category, city, notes):
    first = (name or 'your team').strip()
    niche = category or 'your business'
    observation = notes.strip() if notes and notes.strip() else f"I came across {first} while researching {niche} businesses in {city or 'your area'}"
    subject = f'A website idea for {first}'
    body = f'''Hi {first} team,\n\n{observation}.\n\nI help businesses build clean, professional websites that showcase their services, build trust, and make it easier for potential customers to get in touch. I thought a tailored website could be worth exploring for {first}.\n\nWould you be open to a brief conversation? I can share a few ideas specific to your business, with no obligation.\n\nBest,\n{os.getenv('SENDER_NAME', 'Your Name')}\n{os.getenv('SENDER_BUSINESS', 'Web Development & Automation')}\n{os.getenv('SENDER_EMAIL', '')}\n\nIf this isn't relevant, reply “no thanks” and I won't follow up.'''
    return subject, body

def places_search(query, city, api_key):
    url = 'https://places.googleapis.com/v1/places:searchText'
    headers = {'Content-Type':'application/json','X-Goog-Api-Key':api_key,
               'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.primaryTypeDisplayName'}
    resp = requests.post(url, headers=headers, json={'textQuery': f'{query} in {city}', 'pageSize': 20}, timeout=20)
    resp.raise_for_status()
    output=[]
    for p in resp.json().get('places', []):
        output.append({'business_name':p.get('displayName',{}).get('text',''), 'category':p.get('primaryTypeDisplayName',{}).get('text',query),
                       'city':city, 'website':p.get('websiteUri',''), 'phone':p.get('nationalPhoneNumber',''),
                       'email':'', 'rating':p.get('rating'), 'review_count':p.get('userRatingCount',0),
                       'notes':f"Listed publicly on Google Maps; address: {p.get('formattedAddress','')}", 'source':'Google Places API'})
    return output

st.title('🚀 Business Outreach Engine')
st.caption('Discover prospects • verify website signals • score leads • draft personalized outreach • track replies')
st.warning('This is a starter MVP. Google Places API and SMTP require your own credentials. Website absence is a lead signal, not proof; verify before outreach. Sending is manual/approval-based by design.')

tabs = st.tabs(['Discover leads','Import CSV','Lead pipeline','Email drafts & send','Setup guide'])
with tabs[0]:
    st.subheader('Find local businesses')
    c1,c2,c3 = st.columns([2,2,1])
    with c1: category = st.text_input('Business category', 'dentists')
    with c2: city = st.text_input('City / market', 'Austin, Texas')
    with c3: st.write(''); st.write('')
    gkey = os.getenv('GOOGLE_PLACES_API_KEY','')
    if not gkey: st.info('Add GOOGLE_PLACES_API_KEY to .env to enable live discovery. You can still import a CSV below.')
    if st.button('Search businesses', type='primary', disabled=not bool(gkey.strip())):
        try:
            with st.spinner('Searching public business listings...'):
                results = places_search(category, city, gkey)
                count=0
                for r in results: count += int(save_lead(r))
            st.success(f'Processed {len(results)} results. New/updated records: {count}.')
        except Exception as e: st.error(f'Search failed: {e}. Check API key, billing and Places API access.')
    st.caption('The discovery step uses public business listing data. It does not automatically collect private email addresses.')

with tabs[1]:
    st.subheader('Import a prospect CSV')
    st.write('Required column: `business_name`. Optional: `category`, `city`, `website`, `phone`, `email`, `rating`, `review_count`, `notes`.')
    sample = pd.DataFrame([{'business_name':'Example Dental Studio','category':'Dentist','city':'Austin, Texas','website':'','phone':'','email':'','rating':4.7,'review_count':86,'notes':'Verify website status and contact details before outreach.'}])
    st.download_button('Download CSV template', sample.to_csv(index=False).encode('utf-8'), 'leads_template.csv', 'text/csv')
    up = st.file_uploader('Upload CSV', type=['csv'])
    if up is not None and st.button('Import leads'):
        try:
            frame = pd.read_csv(up).fillna('')
            if 'business_name' not in frame.columns: st.error('CSV must include business_name.')
            else:
                n=0
                for _, r in frame.iterrows(): n += int(save_lead(r.to_dict()))
                st.success(f'Imported/updated {n} lead records.')
        except Exception as e: st.error(f'Could not import CSV: {e}')

with tabs[2]:
    st.subheader('Lead pipeline')
    df = pd.read_sql_query('SELECT * FROM leads ORDER BY score DESC, created_at DESC', con)
    if df.empty: st.info('No leads yet. Use Discover leads or Import CSV.')
    else:
        c1,c2,c3 = st.columns(3)
        c1.metric('Total leads', len(df)); c2.metric('No website listed', int((df.website.fillna('')=='').sum())); c3.metric('High-priority leads', int((df.score>=60).sum()))
        search = st.text_input('Filter by business or city')
        if search: df = df[df.astype(str).apply(lambda col: col.str.contains(search, case=False, na=False)).any(axis=1)]
        st.dataframe(df[['id','business_name','category','city','website','website_status','rating','review_count','score','status','email']], use_container_width=True, hide_index=True)
        st.download_button('Export pipeline CSV', df.to_csv(index=False).encode('utf-8'), 'business_leads.csv', 'text/csv')
        st.caption('Score is a prioritization heuristic based on listing data; it does not guarantee business growth or buying intent.')

with tabs[3]:
    st.subheader('Review, personalize and send')
    df = pd.read_sql_query("SELECT * FROM leads WHERE opted_out=0 ORDER BY score DESC", con)
    if df.empty: st.info('Add leads first.')
    else:
        opts = {f"#{r.id} · {r.business_name} ({r.city})": int(r.id) for r in df.itertuples()}
        chosen = st.selectbox('Choose lead', list(opts.keys()))
        lead_id = opts[chosen]
        lead = con.execute('SELECT * FROM leads WHERE id=?',(lead_id,)).fetchone()
        if not lead['email']:
            st.warning('No email address on record. Add a verified, appropriate business contact email before sending.')
        notes = st.text_area('Verified, specific observation (avoid guessing)', lead['notes'] or '', key=f'notes{lead_id}')
        subject0, body0 = draft_email(lead['business_name'], lead['category'], lead['city'], notes)
        subject = st.text_input('Subject', lead['email_subject'] or subject0, key=f'subject{lead_id}')
        body = st.text_area('Email body', lead['email_body'] or body0, height=280, key=f'body{lead_id}')
        if st.button('Save draft'):
            con.execute('UPDATE leads SET notes=?, email_subject=?, email_body=?, status=? WHERE id=?',(notes,subject,body,'Draft ready',lead_id)); con.commit(); st.success('Draft saved.')
        st.divider()
        st.write('**SMTP configuration** is read from `.env`. Email sends only after this explicit button click.')
        smtp_host=os.getenv('SMTP_HOST',''); smtp_user=os.getenv('SMTP_USER',''); smtp_pass=os.getenv('SMTP_PASSWORD',''); sender=os.getenv('SENDER_EMAIL','')
        can_send=bool(lead['email'] and smtp_host and smtp_user and smtp_pass and sender)
        if not can_send: st.info('Sending is disabled until a recipient email and complete SMTP settings are configured.')
        consent = st.checkbox('I verified the recipient, reviewed this message, and confirmed the outreach is lawful and appropriate.', key=f'consent{lead_id}')
        if st.button('Send this email', type='primary', disabled=not (can_send and consent)):
            try:
                msg=EmailMessage(); msg['Subject']=subject; msg['From']=f"{os.getenv('SENDER_NAME','Web Team')} <{sender}>"; msg['To']=lead['email']; msg.set_content(body)
                with smtplib.SMTP(smtp_host, int(os.getenv('SMTP_PORT','587')), timeout=20) as server:
                    server.starttls(); server.login(smtp_user,smtp_pass); server.send_message(msg)
                con.execute("UPDATE leads SET email_subject=?,email_body=?,status='Contacted',last_contacted_at=? WHERE id=?",(subject,body,datetime.utcnow().isoformat(timespec='seconds'),lead_id)); con.commit()
                st.success('Email submitted to your SMTP server.')
            except Exception as e: st.error(f'Email send failed: {e}')
        if st.button('Mark as opted out'):
            con.execute("UPDATE leads SET opted_out=1,status='Opted out' WHERE id=?",(lead_id,)); con.commit(); st.success('Lead excluded from future drafts/sends in this app.')

with tabs[4]:
    st.subheader('Setup on Windows')
    st.markdown('''1. Install **Python 3.11 or 3.12** from python.org and enable “Add Python to PATH”.
2. Extract this ZIP into a normal folder.
3. Copy `.env.example` to `.env` and fill in the credentials you actually use.
4. Double-click `run.bat`.
5. In the browser, import a small test CSV first. Check all fields and email drafts before any sending.

**Google Places:** create a Google Cloud project, enable Places API (New), enable billing if required, create a restricted API key, and place it in `.env`.

**Email:** use a provider-approved SMTP account. Start with a test mailbox and send only to appropriate, verified business contacts. Respect opt-outs and applicable email/privacy laws. Do not use this app for bulk unsolicited spam.

**Security:** never upload `.env`, API keys, SMTP passwords, or `leads.db` publicly. This starter does not automatically scrape personal email addresses or send unattended campaigns.''')
