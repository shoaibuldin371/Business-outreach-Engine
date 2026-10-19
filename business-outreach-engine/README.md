# Business Outreach Engine — MVP

A local-first starter app for discovering business prospects through Google Places API, importing CSV leads, checking listed websites, prioritizing prospects, drafting personalized emails, and tracking a simple outreach pipeline.

## Quick start (Windows)
1. Install Python 3.11 or 3.12.
2. Extract the ZIP.
3. Double-click `run.bat`.
4. Edit `.env` to add your restricted Google Places API key and/or SMTP settings.
5. Start with CSV import and draft review before configuring email sending.

## Features
- Google Places Text Search (requires your API key, API access and billing configuration)
- CSV import/export
- Website reachability check (not a definitive proof of ownership/absence)
- Simple explainable lead score using listing data
- Editable personalized email drafts
- SQLite lead database
- Manual, explicitly approved SMTP send
- Opt-out status and basic pipeline tracking

## Important limitations
- A missing website in a listing is only a signal. Verify manually before contacting a business.
- Google Places does not provide email addresses in this workflow; use appropriate public business contact channels and verify addresses yourself.
- No unattended bulk campaigns, email harvesting, reply mailbox sync, automatic follow-up scheduler, or production authentication is included in this MVP.
- Follow provider terms, email rules, privacy requirements and opt-outs in your target market.
- This is a starter app, not yet a hardened multi-user production service.

## CSV columns
`business_name` is required. Optional: `category`, `city`, `website`, `phone`, `email`, `rating`, `review_count`, `notes`.
