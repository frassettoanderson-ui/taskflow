# Gera Output\HolyTech-Remoto-Setup.exe
# Baixa o MSI oficial do RustDesk (GitHub) se ainda não estiver em vendor\ e compila o instalador.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$versao = '1.5.0'
$msi = "vendor\rustdesk-$versao-x86_64.msi"
if (-not (Test-Path $msi)) {
    New-Item -ItemType Directory -Force vendor | Out-Null
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest "https://github.com/rustdesk/rustdesk/releases/download/$versao/rustdesk-$versao-x86_64.msi" -OutFile $msi
}

$iscc = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
& $iscc instalador.iss
if ($LASTEXITCODE -ne 0) { throw "ISCC falhou ($LASTEXITCODE)" }
Get-Item Output\HolyTech-Remoto-Setup.exe | Select-Object FullName, Length
