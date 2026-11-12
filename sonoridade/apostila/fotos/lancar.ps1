param([string]$pasta)
$cx = "C:\Program Files\WindowsApps\OpenAI.Codex_26.1103.7773.0_x64__2p2nqsd0c76g0\app\resources\codex.exe"
Start-Process -FilePath $cx -ArgumentList @('exec','--skip-git-repo-check','-C',"`"$pasta`"",'-s','workspace-write','"Leia pedido.txt e estilo.txt nesta pasta e faça exatamente o que o pedido diz."') -RedirectStandardOutput "$pasta\log.txt" -RedirectStandardError "$pasta\erro.txt" -WindowStyle Hidden
