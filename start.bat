@echo off
REM One-click launcher: backend (port 8000) + frontend (port 5173). CPU only - no GPU needed.
set PY=python
where python >nul 2>nul || set PY=py
where %PY% >nul 2>nul || (echo Python was not found. Install it from python.org and tick "Add python.exe to PATH". & pause & exit /b 1)
where npm >nul 2>nul || (echo Node.js was not found. Install the LTS version from nodejs.org, then run this again. & pause & exit /b 1)
cd /d "%~dp0backend"
echo Installing backend libraries (first time can take a few minutes)...
%PY% -m pip install -q -r requirements.txt
start "backend" cmd /k %PY% -m uvicorn app:app --port 8000
cd /d "%~dp0frontend"
if not exist node_modules (echo Installing frontend libraries - first time only... & call npm install)
start "frontend" cmd /k npm run dev
timeout /t 8 >nul
start http://localhost:5173
