@echo off
REM One-click launcher: backend (port 8000) + frontend (port 5173). CPU only - no GPU needed.
cd /d "%~dp0backend"
pip install -q -r requirements.txt
start "backend" cmd /k python -m uvicorn app:app --port 8000
cd /d "%~dp0frontend"
if not exist node_modules call npm install
start "frontend" cmd /k npm run dev
timeout /t 6 >nul
start http://localhost:5173
