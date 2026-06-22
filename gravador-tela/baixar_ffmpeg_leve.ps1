# ============================================================================
#  baixar_ffmpeg_leve.ps1
#  Baixa a versao "essentials" do FFmpeg (bem menor que a "full"), extrai o
#  ffmpeg.exe e o guarda em vendor\ffmpeg.exe. Se a pasta dist\ existir, ja
#  atualiza dist\ffmpeg.exe tambem (assim basta recompilar o instalador).
#
#  Uso:
#      powershell -ExecutionPolicy Bypass -File .\baixar_ffmpeg_leve.ps1
# ============================================================================

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
$tmp = Join-Path $env:TEMP "ffmpeg_leve_tmp"
$zip = Join-Path $tmp "ffmpeg.zip"

# Esconder a barra de progresso acelera muito o Invoke-WebRequest.
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

Write-Host "==> Baixando FFmpeg essentials (~90 MB)..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $url -OutFile $zip

Write-Host "==> Extraindo..." -ForegroundColor Cyan
Expand-Archive -Path $zip -DestinationPath $tmp -Force

$exe = Get-ChildItem -Path $tmp -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1
if (-not $exe) { throw "ffmpeg.exe nao encontrado dentro do zip baixado." }

New-Item -ItemType Directory -Force -Path "vendor" | Out-Null
Copy-Item $exe.FullName "vendor\ffmpeg.exe" -Force
$mb = [math]::Round((Get-Item "vendor\ffmpeg.exe").Length / 1MB, 1)
Write-Host "==> Salvo em vendor\ffmpeg.exe ($mb MB)" -ForegroundColor Green

# Se ja existe dist\, atualiza para nao precisar rodar build.ps1 de novo.
if (Test-Path "dist") {
    Copy-Item $exe.FullName "dist\ffmpeg.exe" -Force
    Write-Host "==> dist\ffmpeg.exe atualizado (agora leve)." -ForegroundColor Green
}

Remove-Item $tmp -Recurse -Force

Write-Host ""
Write-Host "PRONTO! Agora recompile o instalador:" -ForegroundColor Green
Write-Host '  & "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer.iss'
