@echo off
echo ========================================================
echo Starting Business Outreach Engine - FastAPI Backend
echo Port: 8000 (Railway-ready)
echo ========================================================
cd /d "%~dp0backend"
if exist "..\business-outreach-engine\.venv\Scripts\python.exe" (
    "..\business-outreach-engine\.venv\Scripts\python.exe" -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
) else (
    python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
)
pause
