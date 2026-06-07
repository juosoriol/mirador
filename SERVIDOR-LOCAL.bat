@echo off
cd /d "%~dp0"
title Mirador - http://localhost:8000
where python >nul 2>&1 || (echo Instala Python con "Add to PATH" & pause & exit /b 1)
echo.
echo  Mirador: http://localhost:8000
echo  Cierra esta ventana para detener el servidor.
echo.
python -m http.server 8000
