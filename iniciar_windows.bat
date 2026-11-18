@echo off
cd /d "%~dp0"
py -3 backend\app.py
if errorlevel 1 python backend\app.py
pause
