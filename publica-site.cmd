@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0publica-site.ps1"
exit /b %errorlevel%
