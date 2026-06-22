# ============================================================================
#  build.ps1 — Gera o executável (.exe) do Gravador de Tela com PyInstaller
#  e prepara a pasta "dist" (portátil) com o FFmpeg embutido ao lado.
#
#  Uso (no PowerShell, dentro da pasta do projeto):
#      .\build.ps1
#
#  Resultado:
#      dist\GravadorDeTela.exe   <- programa
#      dist\ffmpeg.exe           <- FFmpeg embutido (copiado do seu sistema)
#  Essa pasta "dist" já é uma versão PORTÁTIL: pode zipar e enviar aos amigos.
#  Para gerar o INSTALADOR, depois rode o installer.iss no Inno Setup.
# ============================================================================

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host "==> 1/5  Instalando dependencias (runtime + build)..." -ForegroundColor Cyan
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip install -r requirements-build.txt

Write-Host "==> 2/5  Gerando o icone (icon.ico)..." -ForegroundColor Cyan
python gerar_icone.py

Write-Host "==> 3/5  Limpando builds anteriores..." -ForegroundColor Cyan
foreach ($p in @("build", "dist", "GravadorDeTela.spec")) {
    if (Test-Path $p) { Remove-Item $p -Recurse -Force }
}

Write-Host "==> 4/5  Empacotando com PyInstaller..." -ForegroundColor Cyan
pyinstaller --noconfirm --onefile --windowed `
    --name GravadorDeTela `
    --icon icon.ico `
    --add-data "icon.ico;." `
    --hidden-import pystray._win32 `
    --collect-all cv2 `
    gravador_tela.py

if (-not (Test-Path "dist\GravadorDeTela.exe")) {
    throw "Falhou: dist\GravadorDeTela.exe nao foi gerado."
}

Write-Host "==> 5/5  Copiando o FFmpeg para a pasta dist..." -ForegroundColor Cyan
if (Test-Path "vendor\ffmpeg.exe") {
    # Preferir o FFmpeg leve (essentials), baixado por baixar_ffmpeg_leve.ps1.
    Copy-Item "vendor\ffmpeg.exe" "dist\ffmpeg.exe" -Force
    $mb = [math]::Round((Get-Item "dist\ffmpeg.exe").Length / 1MB, 1)
    Write-Host "    Usando vendor\ffmpeg.exe (leve, $mb MB)" -ForegroundColor DarkGray
} else {
    $ff = (Get-Command ffmpeg -ErrorAction SilentlyContinue)
    if ($ff) {
        Copy-Item $ff.Source "dist\ffmpeg.exe" -Force
        $mb = [math]::Round((Get-Item "dist\ffmpeg.exe").Length / 1MB, 1)
        Write-Host "    FFmpeg do sistema: $($ff.Source) ($mb MB)" -ForegroundColor DarkGray
        Write-Host "    Dica: rode .\baixar_ffmpeg_leve.ps1 para um instalador menor." -ForegroundColor Yellow
    } else {
        Write-Host "    AVISO: ffmpeg.exe nao encontrado. Rode .\baixar_ffmpeg_leve.ps1" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "PRONTO!" -ForegroundColor Green
Write-Host "  Versao portatil: pasta 'dist' (GravadorDeTela.exe + ffmpeg.exe)."
Write-Host "  Para gerar o instalador: abra 'installer.iss' no Inno Setup e clique em Compile."
