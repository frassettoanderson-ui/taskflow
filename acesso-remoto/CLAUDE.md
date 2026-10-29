# HolyTech Remoto — "AnyDesk próprio"

Acesso remoto aos PCs usando **RustDesk** com **servidor próprio** (nada passa pelos servidores públicos do RustDesk).

## Servidor (no ar desde 29/10/2026)
- VPS OX Cloud `178.238.226.21` (`ssh oxcloud-vps`), pasta `/opt/rustdesk` (docker compose: `hbbs` + `hbbr`, imagem `rustdesk/rustdesk-server:1.1.14`, network_mode host).
- UFW: 21115-21117/tcp e 21116/udp liberadas. 21118/21119 (cliente web) fechadas.
- Chave pública: `RO+BSgUSgcTp5rY1AY62i+3jptBiYajH5B8GCiMMj64=` — vem de `/opt/rustdesk/data/id_ed25519*`. **Nunca apagar essa pasta**: chave nova = todos os clientes param.

## Instalador (`HolyTech-Remoto-Setup.exe`)
- `instalador.iss` (Inno Setup 6) embute o MSI oficial do RustDesk, instala em silêncio, aponta para o servidor (`--config` + `--option`), define a senha permanente (opcional, pedida na tela) e mostra o ID no final.
- Gerar: `.\build.ps1` (baixa o MSI em `vendor\` e compila em `Output\`).
- Limitação: o programa instalado continua se chamando "RustDesk" (só o instalador tem nome/ícone HolyTech). Renomear o app em si exige compilar o RustDesk do código-fonte.

## Falta
- PC do Anderson registrado (ID 469100913) em 29/10. Falta testar o instalador num 2º PC e conectar de verdade. A recriação automática do serviço (RustDesk antigo removido) ainda não foi testada pelo instalador.
- Opcional: subdomínio (ex. `remoto.holytechsolution.com.br`) no lugar do IP.
