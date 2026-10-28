@echo off
rem Roda o agente com janela aberta (para ver erros). Feche a tarefa "OX Controle" antes.
cd /d "%~dp0"
set PY=%LOCALAPPDATA%\Python\bin\python.exe
if not exist "%PY%" set PY=python
"%PY%" agente.py
pause
