@echo off
REM ============================================================
REM  Transcritor de videos do YouTube - atalho para Windows
REM  Duplo-clique: cole o link e tecle Enter.
REM  Ou pelo terminal:  transcrever.bat "URL" [--modelo small] [--manter-audio]
REM ============================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"
set "HF_HUB_DISABLE_SYMLINKS_WARNING=1"

REM Garante o ffmpeg no PATH desta sessao. (O Explorer pode ainda estar com um
REM PATH antigo, de antes da instalacao do ffmpeg; aqui localizamos sozinhos.)
where ffmpeg >nul 2>&1
if errorlevel 1 (
    for /d %%D in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_*") do (
        for /d %%E in ("%%D\ffmpeg-*") do (
            if exist "%%E\bin\ffmpeg.exe" set "PATH=%%E\bin;!PATH!"
        )
    )
)

REM Usa o Python da venv embutida (nao depende de qual Python esta no PATH).
set "PY=%~dp0venv\Scripts\python.exe"
if not exist "%PY%" set "PY=python"

REM Se veio link/argumentos pela linha de comando, usa direto.
if not "%~1"=="" (
    chcp 65001 >nul
    "%PY%" transcrever.py %*
    goto fim
)

REM Modo duplo-clique: pergunta o link.
REM (O 'set /p' fica ANTES do chcp 65001 de proposito: o code page UTF-8
REM  atrapalha a leitura do 'set /p' no Windows.)
echo.
echo === Transcritor de videos do YouTube ===
echo.
set "URL="
set /p "URL=Cole o link do YouTube e tecle Enter: "
if "!URL!"=="" (
    echo.
    echo Nenhum link informado. Saindo.
    pause
    exit /b 1
)

REM Agora sim, UTF-8 para os acentos aparecerem certos na tela.
chcp 65001 >nul
"%PY%" transcrever.py "!URL!"

:fim
echo.
REM Abre a pasta com as transcricoes, se existir.
if exist "transcricoes" start "" "transcricoes"
pause
