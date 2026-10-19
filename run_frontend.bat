@echo off
echo ========================================================
echo Starting Business Outreach Engine - Next.js Frontend
echo Port: 3000 (Vercel-ready)
echo ========================================================
cd /d "%~dp0frontend"
npm run dev
pause
