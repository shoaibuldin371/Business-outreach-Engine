import os
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from config import settings
from agent import discovery_agent
from supabase_client import db_manager

scheduler = BackgroundScheduler()

def scheduled_job():
    """Runs the 3-hour automated business outreach discovery agent."""
    print(f"[SCHEDULER] Triggering 3-hour discovery job for '{settings.DEFAULT_CITY}'...")
    db_manager.insert_log(
        step="find",
        status="info",
        message=f"3-Hour Scheduled Automation triggered for '{settings.DEFAULT_CITY}' ({settings.DEFAULT_CATEGORY}).",
        details={"interval_hours": settings.AUTOMATION_INTERVAL_HOURS}
    )
    result = discovery_agent.run_discovery_cycle(
        category=settings.DEFAULT_CATEGORY,
        city=settings.DEFAULT_CITY,
        count=5
    )
    print(f"[SCHEDULER] Job result: {result.get('status')} - {result.get('message')}")

def start_scheduler():
    """Starts the background scheduler if not already running."""
    if not scheduler.running:
        interval_hours = max(1, settings.AUTOMATION_INTERVAL_HOURS)
        scheduler.add_job(
            scheduled_job,
            trigger=IntervalTrigger(hours=interval_hours),
            id="outreach_discovery_3hr",
            name="3-Hour Business Discovery Agent",
            replace_existing=True
        )
        scheduler.start()
        print(f"[OK] APScheduler started: Discovery agent scheduled to run every {interval_hours} hours.")

def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        print("APScheduler stopped.")
