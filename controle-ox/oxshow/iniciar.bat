@echo off
rem Roda o OX Show com janela aberta (para ver erros). Pare a tarefa "OX Show" antes.
cd /d "%~dp0"
set PY=%LOCALAPPDATA%\Python\bin\python.exe
if not exist "%PY%" set PY=python
"%PY%" oxshow.py
pause
