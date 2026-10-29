@echo off
setlocal
cd /d "%~dp0"
title Servidor
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0launch.ps1"
if errorlevel 1 pause
exit /b 0
