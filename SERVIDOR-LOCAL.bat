@echo off
cd /d "%~dp0"
title Mirador - http://localhost:8000
where node >nul 2>&1 || (echo Instala Node.js LTS desde https://nodejs.org/ & pause & exit /b 1)
echo.
echo  Mirador: http://localhost:8000
echo  Cierra esta ventana para detener el servidor.
echo.
call npm run dev
