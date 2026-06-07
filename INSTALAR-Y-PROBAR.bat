@echo off
cd /d "%~dp0"
title Mirador - Instalar y probar

echo.
echo  Proyecto: %CD%
echo.

where node >nul 2>&1 || (echo ERROR: Instala Node.js LTS desde https://nodejs.org/ & goto fin)
where python >nul 2>&1 || (echo ERROR: Instala Python desde https://www.python.org/ & goto fin)

echo [1/4] npm install...
call npm install
if errorlevel 1 goto fin

echo.
echo [2/4] Preparar tests...
call node scripts\write-e2e.mjs
if errorlevel 1 goto fin

echo.
echo [3/4] Ejecutar pruebas...
call npx playwright test
set ERR=%ERRORLEVEL%

echo.
if %ERR%==0 (echo === OK: todas las pruebas pasaron ===) else (echo === FALLO: codigo %ERR% ===)
:fin
echo.
pause
exit /b %ERR%
