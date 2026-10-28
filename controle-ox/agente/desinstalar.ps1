# Remove o OX Controle (rodar como Administrador). Nao mexe em mais nada.
Get-ScheduledTask -TaskName 'OX Controle' -ErrorAction SilentlyContinue | Stop-ScheduledTask -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName 'OX Controle' -Confirm:$false -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName 'OX Controle' -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name like 'python%'" | Where-Object { $_.CommandLine -like '*OXControle\agente.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Write-Host 'OX Controle removido. A pasta C:\OXControle pode ser apagada a mao.'
Read-Host 'Enter para fechar'
