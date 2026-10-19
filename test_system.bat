@echo off
echo ========================================================
echo Running Complete End-to-End Test Suite
echo ========================================================
cd /d "%~dp0backend"
if exist "..\business-outreach-engine\.venv\Scripts\python.exe" (
    "..\business-outreach-engine\.venv\Scripts\python.exe" -m pytest test_engine.py -v
) else (
    python -m pytest test_engine.py -v
)
pause
