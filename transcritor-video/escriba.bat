@echo off
REM ============================================================
REM  Escriba - app de transcricao (janela grafica)
REM  Duplo-clique abre o programa numa janela do Edge/Chrome.
REM ============================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"
set "HF_HUB_DISABLE_SYMLINKS_WARNING=1"

REM Garante o ffmpeg no PATH (localiza o do winget se preciso).
where ffmpeg >nul 2>&1
if errorlevel 1 (
    for /d %%D in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_*") do (
        for /d %%E in ("%%D\ffmpeg-*") do (
            if exist "%%E\bin\ffmpeg.exe" set "PATH=%%E\bin;!PATH!"
        )
    )
)

REM Python da venv embutida (sem console = pythonw). Nunca cai no Python do
REM sistema (que nao tem as dependencias): tenta pythonw da venv, depois
REM python da venv, e so em ultimo caso o pythonw do sistema.
set "PY=%~dp0venv\Scripts\pythonw.exe"
if not exist "%PY%" set "PY=%~dp0venv\Scripts\python.exe"
if not exist "%PY%" set "PY=pythonw"

start "" "%PY%" "%~dp0server.py"
