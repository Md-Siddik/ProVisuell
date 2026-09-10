@echo off
REM Starts both dev servers in their own windows. Double-click this any
REM time after restarting your PC or reopening the project — the backend
REM (port 5000) never auto-starts on its own, so nothing in the app will
REM work (login, orders, messages, notifications...) until this has run.
REM Close either window to stop that server; closing this launcher window
REM does NOT stop them.

start "ProVisuell - Backend (5000)" cmd /k "cd /d %~dp0Server && npm run dev"
start "ProVisuell - Frontend (5173)" cmd /k "cd /d %~dp0 && npm run dev"

echo Both servers are starting in their own windows.
echo Backend:  http://localhost:5000/api/health
echo Frontend: http://localhost:5173
