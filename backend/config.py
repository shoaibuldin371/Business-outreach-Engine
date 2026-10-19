import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App info
    APP_NAME: str = "Business Outreach Engine API"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # Public URLs (critical for Gmail HITL approval links)
    BACKEND_PUBLIC_URL: str = os.getenv("BACKEND_PUBLIC_URL", "http://localhost:8000")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    
    # Supabase Configuration
    SUPABASE_URL: Optional[str] = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: Optional[str] = os.getenv("SUPABASE_KEY", "")
    
    # Email / SMTP Configuration
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "Mshoaibawan371@gmail.com")
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SENDER_EMAIL: str = os.getenv("SENDER_EMAIL", "Mshoaibawan371@gmail.com")
    SENDER_NAME: str = os.getenv("SENDER_NAME", "Muhammad Shoaib")
    
    # External APIs
    GOOGLE_PLACES_API_KEY: str = os.getenv("GOOGLE_PLACES_API_KEY", "")
    
    # Automation Schedule (every 3 hours)
    AUTOMATION_INTERVAL_HOURS: int = int(os.getenv("AUTOMATION_INTERVAL_HOURS", "3"))
    DEFAULT_CATEGORY: str = os.getenv("DEFAULT_CATEGORY", "dentists")
    DEFAULT_CITY: str = os.getenv("DEFAULT_CITY", "Dallas, TX")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "business-outreach-engine-secret-key-3hours")

    model_config = {
        "env_file": ".env",
        "extra": "allow"
    }

settings = Settings()
