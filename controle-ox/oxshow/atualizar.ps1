# Atualiza o OX Show ja instalado em C:\OXShow (mantem config, PIN, dados e midias).
# Se existir token-nuvem.txt ao lado, liga a conexao com o OX Cloud (painel de qualquer rede).
$ErrorActionPreference = 'Stop'
$origem = Split-Path -Parent $MyInvocation.MyCommand.Path
$destino = 'C:\OXShow'
if (-not (Test-Path "$destino\oxshow.py")) { Write-Host 'OX Show nao esta instalado neste PC.' -ForegroundColor Red; Read-Host 'Enter para sair'; exit 1 }

$py = "$env:LOCALAPPDATA\Python\bin\python.exe"
if (-not (Test-Path $py)) { $py = (Get-Command python -ErrorAction SilentlyContinue).Source }

Get-ScheduledTask -TaskName 'OX Show' -ErrorAction SilentlyContinue | Stop-ScheduledTask -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
foreach ($f in 'oxshow.py','painel.html','telao.html','iniciar.bat','desinstalar.ps1') { Copy-Item (Join-Path $origem $f) $destino -Force }

$tokenArq = Join-Path $origem 'token-nuvem.txt'
if (Test-Path $tokenArq) {
  $token = (Get-Content $tokenArq -Raw).Trim()
  # edita o config.json pelo Python para nao estragar acentos/formatacao
  $codigo = "import json,sys; p=sys.argv[1]; c=json.load(open(p,encoding='utf-8')); c['nuvem']={'url':'https://oxcloudbr.com.br','token':sys.argv[2]}; json.dump(c,open(p,'w',encoding='utf-8'),ensure_ascii=False,indent=2)"
  & $py -c $codigo "$destino\config.json" $token
  Write-Host 'Conexao com o OX Cloud configurada.'
}

Start-ScheduledTask -TaskName 'OX Show'
Start-Sleep -Seconds 4
try { Invoke-WebRequest 'http://127.0.0.1:8710/' -UseBasicParsing -TimeoutSec 5 | Out-Null; $ok = $true } catch { $ok = $false }
Write-Host ''
if ($ok) { Write-Host 'OX Show atualizado e rodando.' -ForegroundColor Green } else { Write-Host "Atualizado, mas nao respondeu. Veja $destino\oxshow.log" -ForegroundColor Yellow }
$log = Get-Content "$destino\oxshow.log" -Tail 40 -ErrorAction SilentlyContinue | Select-String 'OX Cloud' | Select-Object -Last 1
if ($log) { Write-Host $log.Line }
Read-Host 'Enter para sair'
