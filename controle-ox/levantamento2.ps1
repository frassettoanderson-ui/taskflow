$desk = [Environment]::GetFolderPath('Desktop'); $d = "$desk\levantamento-ox2"
New-Item -ItemType Directory -Force $d | Out-Null
function Baixa($base, $pasta) {
  New-Item -ItemType Directory -Force "$d\$pasta" | Out-Null
  try {
    $w = Invoke-WebRequest $base -UseBasicParsing -TimeoutSec 8
    [IO.File]::WriteAllText("$d\$pasta\index.html", $w.Content)
    $srcs = [regex]::Matches($w.Content, '(?:src|href)=["'']?([^"''\s>]+\.(?:js|json|css))') | % { $_.Groups[1].Value } | Sort-Object -Unique
    foreach ($s in $srcs) {
      $u = if ($s -match '^http') { $s } else { $base + '/' + ($s -replace '^\.?/', '') }
      try { Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 8 -OutFile ("$d\$pasta\" + ($s -replace '[\\/:*?"<>|]', '_')) } catch { "$u ERRO" | Add-Content "$d\$pasta\erros.txt" }
    }
  } catch { "$base ERRO $($_.Exception.Message)" | Add-Content "$d\$pasta\erros.txt" }
}
Baixa 'http://127.0.0.1:5000' 'lumikit-web'
Baixa 'http://192.168.0.231' 'mesa'
function CopiaTexto($origem, $pasta) {
  if (-not (Test-Path $origem)) { return }
  Get-ChildItem $origem -Recurse -File -EA SilentlyContinue | Select-Object FullName, Length | Out-File "$d\$pasta-lista.txt" -Width 300
  Get-ChildItem $origem -Recurse -File -EA SilentlyContinue | ? { $_.Extension -match '^\.(rpp|lua|eel|py|txt|ini|json|xml|cfg|bat|ps1|reaperkeymap)$' -and $_.Length -lt 5MB } | % {
    $dest = Join-Path "$d\$pasta" ($_.FullName.Substring($origem.Length).TrimStart('\'))
    New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
    Copy-Item $_.FullName $dest
  }
}
CopiaTexto 'C:\Automacao' 'automacao'
CopiaTexto "$env:APPDATA\REAPER\Scripts" 'reaper-scripts'
Copy-Item "$env:APPDATA\REAPER\reaper.ini","$env:APPDATA\REAPER\reaper-kb.ini" $d -EA SilentlyContinue
New-Item -ItemType Directory -Force "$d\lumikit" | Out-Null
Get-ChildItem 'C:\Program Files\Lumikit' | Select-Object Name, Length | Out-File "$d\lumikit-lista.txt"
Get-ChildItem 'C:\Program Files\Lumikit' -File | ? { $_.Extension -match '^\.(ini|cfg|xml|json|txt)$' } | Copy-Item -Destination "$d\lumikit"
Get-ChildItem ([Environment]::GetFolderPath('MyDocuments')) -Filter *.show -Recurse -EA SilentlyContinue | Copy-Item -Destination $d
Compress-Archive "$d\*" "$desk\levantamento-ox2.zip" -Force
"Pronto: levantamento-ox2.zip na Area de Trabalho"
Read-Host "Aperte Enter para fechar"
