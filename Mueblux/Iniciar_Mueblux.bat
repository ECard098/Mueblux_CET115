@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 goto usepython
py -3 servidor.py
goto finished
:usepython
python servidor.py
:finished
if errorlevel 1 pause
