# Remove o OX Show (rodar como Administrador). Nao apaga a pasta C:\OXShow (midia e programacao ficam).
Get-ScheduledTask -TaskName 'OX Show' -ErrorAction SilentlyContinue | Stop-ScheduledTask -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName 'OX Show' -Confirm:$false -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName 'OX Show' -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name like 'python%'" | Where-Object { $_.CommandLine -like '*OXShow\oxshow.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*OXShow\navegador*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Write-Host 'OX Show removido. A pasta C:\OXShow continua (pode apagar a mao).'
Read-Host 'Enter para fechar'
