# Instala o OX Show no PC da academia (rodar como Administrador).
# Nao mexe no REAPER, no OBS, no Lumikit nem no evento das 21h: a agenda vem DESATIVADA.
$ErrorActionPreference = 'Stop'
$origem  = Split-Path -Parent $MyInvocation.MyCommand.Path
$destino = 'C:\OXShow'
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

# 2. Arquivos do programa (config.json e dados.json so na primeira vez, para nao apagar o que o cliente programou)
New-Item -ItemType Directory -Force $destino | Out-Null
Get-ScheduledTask -TaskName 'OX Show' -ErrorAction SilentlyContinue | Stop-ScheduledTask -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name like 'python%'" | Where-Object { $_.CommandLine -like '*OXShow\oxshow.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
foreach ($f in 'oxshow.py','painel.html','telao.html','iniciar.bat','desinstalar.ps1') { Copy-Item (Join-Path $origem $f) $destino -Force }
foreach ($f in 'config.json','dados.json') { if (-not (Test-Path "$destino\$f")) { Copy-Item (Join-Path $origem $f) $destino } }

# 3. Pastas de midia + os dois videos que o OBS usa hoje (copiados, os originais ficam onde estao)
foreach ($p in 'midia\videos','midia\imagens','midia\musicas\Geral') { New-Item -ItemType Directory -Force "$destino\$p" | Out-Null }
$videos = @(
  @{ de = "$env:USERPROFILE\Desktop\Nova pasta\Red Zone Final*";            para = 'Red Zone.mp4' },
  @{ de = "$env:USERPROFILE\Documents\videos telao\*telao int03*";          para = 'telao int03.mp4' }
)
foreach ($v in $videos) {
  $alvo = "$destino\midia\videos\$($v.para)"
  $achado = Get-ChildItem $v.de -File -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($achado -and -not (Test-Path $alvo)) { Copy-Item $achado.FullName $alvo; Write-Host "Video copiado: $($v.para)" }
  elseif (-not $achado) { Write-Host "Aviso: nao achei $($v.de) - coloque o video em $destino\midia\videos" -ForegroundColor Yellow }
}

# 4. PIN do painel
$cfgPath = "$destino\config.json"
$cfg = [IO.File]::ReadAllText($cfgPath)
if ($cfg -match '"pin":\s*""') {
  $pin = [string](Get-Random -Minimum 100000 -Maximum 999999)
  $cfg = $cfg -replace '"pin":\s*""', "`"pin`": `"$pin`""
  [IO.File]::WriteAllText($cfgPath, $cfg, (New-Object Text.UTF8Encoding $false))
} else { $pin = ([regex]::Match($cfg, '"pin":\s*"([^"]*)"')).Groups[1].Value }

# 5. Libera a porta 8710 so para a rede local
if (-not (Get-NetFirewallRule -DisplayName 'OX Show' -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName 'OX Show' -Direction Inbound -Protocol TCP -LocalPort 8710 -Action Allow -Profile Any -RemoteAddress LocalSubnet | Out-Null
}

# 6. Inicia junto com o Windows, no usuario logado (precisa da tela para o telao)
$acao = New-ScheduledTaskAction -Execute $pyw -Argument "`"$destino\oxshow.py`"" -WorkingDirectory $destino
$gatilho = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Seconds 0)
$quem = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
Register-ScheduledTask -TaskName 'OX Show' -Action $acao -Trigger $gatilho -Settings $ajustes -Principal $quem -Force | Out-Null
Start-ScheduledTask -TaskName 'OX Show'

Start-Sleep -Seconds 3
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '192.168.*' } | Select-Object -First 1).IPAddress
try { Invoke-WebRequest 'http://127.0.0.1:8710/' -UseBasicParsing -TimeoutSec 5 | Out-Null; $ok = $true } catch { $ok = $false }
Write-Host ''
if ($ok) { Write-Host 'OX Show instalado e rodando.' -ForegroundColor Green } else { Write-Host "Instalado, mas nao respondeu. Veja $destino\oxshow.log ou rode iniciar.bat." -ForegroundColor Yellow }
Write-Host "Painel: http://${ip}:8710   (neste PC: http://localhost:8710)"
Write-Host "PIN:    $pin"
Write-Host 'Musicas: coloque os MP3 em C:\OXShow\midia\musicas\Geral (cada pasta vira uma playlist).'
Read-Host 'Enter para fechar'
