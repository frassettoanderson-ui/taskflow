# Instala o OX Controle no PC da academia (rodar como Administrador).
# Nao mexe no REAPER, no Lumikit nem no evento das 21h.
$ErrorActionPreference = 'Stop'
$origem  = Split-Path -Parent $MyInvocation.MyCommand.Path
$destino = 'C:\OXControle'
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { Write-Host 'Abra o PowerShell como Administrador e rode de novo.' -ForegroundColor Red; Read-Host 'Enter para sair'; exit 1 }

# 1. Python (o mesmo que o REAPER ja usa)
$py = "$env:LOCALAPPDATA\Python\bin\python.exe"
if (-not (Test-Path $py)) { $py = (Get-Command python -ErrorAction SilentlyContinue).Source }
if (-not $py) { Write-Host 'Python nao encontrado.' -ForegroundColor Red; Read-Host 'Enter para sair'; exit 1 }
$pyw = Join-Path (Split-Path $py) 'pythonw.exe'
if (-not (Test-Path $pyw)) { $pyw = $py }
$ErrorActionPreference = 'Continue'
& $py -c "import serial" 2>$null
$temSerial = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = 'Stop'
if (-not $temSerial) { Write-Host 'Aviso: pyserial nao encontrado, a luz ambiente (COM25) nao vai funcionar.' -ForegroundColor Yellow }
Write-Host "Python: $py"

# 2. Copia os arquivos (mantem config.json se ja existir)
New-Item -ItemType Directory -Force $destino | Out-Null
Get-ScheduledTask -TaskName 'OX Controle' -ErrorAction SilentlyContinue | Stop-ScheduledTask -ErrorAction SilentlyContinue
foreach ($f in 'agente.py','painel.html','iniciar.bat','desinstalar.ps1') { Copy-Item (Join-Path $origem $f) $destino -Force }
if (-not (Test-Path "$destino\config.json")) { Copy-Item (Join-Path $origem 'config.json') $destino }

# 3. PIN do painel
$cfgPath = "$destino\config.json"
$cfg = [IO.File]::ReadAllText($cfgPath)
if ($cfg -match '"pin":\s*""') {
  $pin = [string](Get-Random -Minimum 100000 -Maximum 999999)
  $cfg = $cfg -replace '"pin":\s*""', "`"pin`": `"$pin`""
  [IO.File]::WriteAllText($cfgPath, $cfg, (New-Object Text.UTF8Encoding $false))
} else { $pin = ([regex]::Match($cfg, '"pin":\s*"([^"]*)"')).Groups[1].Value }

# 4. Libera a porta 8710 na rede local
if (-not (Get-NetFirewallRule -DisplayName 'OX Controle' -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName 'OX Controle' -Direction Inbound -Protocol TCP -LocalPort 8710 -Action Allow -Profile Any -RemoteAddress LocalSubnet | Out-Null
}

# 5. Inicia junto com o Windows (no usuario logado, para enxergar o OBS)
$acao = New-ScheduledTaskAction -Execute $pyw -Argument "`"$destino\agente.py`"" -WorkingDirectory $destino
$gatilho = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Seconds 0)
$quem = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
Register-ScheduledTask -TaskName 'OX Controle' -Action $acao -Trigger $gatilho -Settings $ajustes -Principal $quem -Force | Out-Null
Start-ScheduledTask -TaskName 'OX Controle'

# 6. Confere o websocket do OBS
$ws = "$env:APPDATA\obs-studio\plugin_config\obs-websocket\config.json"
if ((Test-Path $ws) -and -not ((Get-Content $ws -Raw | ConvertFrom-Json).server_enabled)) {
  Write-Host 'Aviso: o websocket do OBS esta DESLIGADO. OBS > Ferramentas > Configuracoes do servidor WebSocket > Ativar.' -ForegroundColor Yellow
}

Start-Sleep -Seconds 3
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '192.168.*' } | Select-Object -First 1).IPAddress
try { Invoke-WebRequest 'http://127.0.0.1:8710/' -UseBasicParsing -TimeoutSec 5 | Out-Null; $ok = $true } catch { $ok = $false }
Write-Host ''
if ($ok) { Write-Host 'OX Controle instalado e rodando.' -ForegroundColor Green } else { Write-Host "Instalado, mas o agente nao respondeu. Veja $destino\agente.log ou rode iniciar.bat." -ForegroundColor Yellow }
Write-Host "Painel: http://${ip}:8710   (neste PC: http://localhost:8710)"
Write-Host "PIN:    $pin"
Read-Host 'Enter para fechar'
