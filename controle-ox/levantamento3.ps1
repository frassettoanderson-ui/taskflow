$desk = [Environment]::GetFolderPath('Desktop'); $d = "$desk\levantamento-ox3"
New-Item -ItemType Directory -Force $d | Out-Null
$obs = "$env:APPDATA\obs-studio"

# OBS: cenas, plugins e configuracoes de plugins (sem a senha do websocket)
New-Item -ItemType Directory -Force "$d\obs-cenas","$d\obs-plugin-config" | Out-Null
Copy-Item "$obs\basic\scenes\*.json" "$d\obs-cenas" -EA SilentlyContinue
Get-ChildItem "$obs\plugin_config" -Directory -EA SilentlyContinue | ? { $_.Name -ne 'obs-websocket' } | % {
  Copy-Item $_.FullName "$d\obs-plugin-config\$($_.Name)" -Recurse -EA SilentlyContinue
}
& {
  "== plugins (Program Files) =="; Get-ChildItem 'C:\Program Files\obs-studio\obs-plugins\64bit' -Filter *.dll -EA SilentlyContinue | % Name
  "== plugins (ProgramData) =="; Get-ChildItem 'C:\ProgramData\obs-studio\plugins' -EA SilentlyContinue | % Name
  "== plugins (AppData) =="; Get-ChildItem "$obs\plugins" -EA SilentlyContinue | % Name
  "== plugin_config =="; Get-ChildItem "$obs\plugin_config" -EA SilentlyContinue | % Name
  "== global.ini (secoes) =="; Select-String "$obs\global.ini" -Pattern '^\[' -EA SilentlyContinue | % Line
} | Out-File "$d\obs-plugins.txt" -Encoding utf8

# Porta COM25: detalhes do adaptador USB-serial
& {
  Get-PnpDevice -PresentOnly -EA SilentlyContinue | ? { $_.FriendlyName -match 'COM\d+|CH340|Serial' } | % {
    "== $($_.FriendlyName) | $($_.InstanceId)"
    Get-PnpDeviceProperty -InstanceId $_.InstanceId -EA SilentlyContinue | ? { $_.KeyName -match 'LocationInfo|LocationPaths|Parent|BusReportedDeviceDesc|Manufacturer|InstallDate|FirstInstallDate|LastArrivalDate' } | % { "  $($_.KeyName) = $($_.Data)" }
  }
} | Out-File "$d\com25.txt" -Encoding utf8

# Tarefas agendadas e programas que iniciam com o Windows
& {
  "== tarefas =="
  Get-ScheduledTask -EA SilentlyContinue | ? { $_.TaskPath -eq '\' } | % {
    $a = ($_.Actions | % { "$($_.Execute) $($_.Arguments)" }) -join ' ; '
    $t = ($_.Triggers | % { "$($_.CimClass.CimClassName) $($_.StartBoundary)" }) -join ' ; '
    "$($_.TaskName) | $($_.State) | $a | $t"
  }
  "== inicializar =="
  Get-ChildItem "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup","C:\ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp" -EA SilentlyContinue | % FullName
  Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run','HKLM:\Software\Microsoft\Windows\CurrentVersion\Run' -EA SilentlyContinue | Out-String
} | Out-File "$d\tarefas.txt" -Encoding utf8

Compress-Archive "$d\*" "$desk\levantamento-ox3.zip" -Force
"Pronto: levantamento-ox3.zip na Area de Trabalho"
Read-Host "Aperte Enter para fechar"
