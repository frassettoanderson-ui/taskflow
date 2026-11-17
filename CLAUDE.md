# Índice de Projetos — taskflow_backup_completo

> Pasta guarda-chuva (backup) com **19 projetos independentes** (+ HolyDoctor em `C:\dev\holytech\doctor`), cada um na sua subpasta.
> Para continuar um projeto: **abra um chat novo apontando o diretório de trabalho para a subpasta dele** — o `CLAUDE.md` de cada pasta carrega o contexto automaticamente.

## Mapa rápido

| Pasta | Projeto | Stack | Como continuar |
|-------|---------|-------|----------------|
| `academia/` | **Taskflow** — gestão de ocorrências/tarefas (Kanban + chat + notificações) | PHP + MySQL (Hostinger) | abrir chat em `academia/` |
| `betel/` | **Movimento Betel** — site institucional do movimento de mulheres (Imbituba/SC) | HTML/CSS/JS puro | abrir chat em `betel/` |
| `autolar/` | **Autolar** — site automóveis+imóveis + admin | PHP puro + MySQL | abrir chat em `autolar/` |
| `financas/` | **Finanças da Família** — PWA de finanças pessoais | Node/TS + Prisma/Postgres + React/Vite | abrir chat em `financas/` |
| `gestor-oa/` | **GestorOA** — SaaS de obrigações acessórias | Monorepo Node/TS + Prisma + React PWA | abrir chat em `gestor-oa/` |
| `gravador-tela/` | **Gravador de Tela (Windows)** | Python + FFmpeg | abrir chat em `gravador-tela/` |
| `igreja/` | **Financeiro Igreja** — dízimos/ofertas/despesas | Node/Express + Postgres | abrir chat em `igreja/` |
| *(fora daqui)* `C:\dev\holytech\food` | **HolyFood** (ex-Sistema para Restaurantes) — SaaS de canal próprio + portal/marketplace. A pasta `restaurante/` daqui ficou só como registro (03/11/2026) | Monorepo TS: NestJS + Next.js + Prisma/Postgres + Redis | abrir chat em `C:\dev\holytech\food` |
| `site/` | **Abarim** — landing Casa de Oração (Imbituba/SC) | HTML/CSS/JS puro | abrir chat em `site/` |
| `transcritor-video/` | **Transcritor YouTube** — áudio→txt em PT | Python (yt-dlp + faster-whisper) | abrir chat em `transcritor-video/` |
| `kypa/` | **Kypá Cosméticos** — remodelação do site da loja (demo, cores por linha + motion) | HTML/CSS/JS + GSAP | abrir chat em `kypa/` |
| `xadrez-mestre/` | **Xadrez Mestre** — extensão coach para chess.com (Stockfish local + IA explica) | Extensão MV3 (JS puro) + Gemini | abrir chat em `xadrez-mestre/` |
| `holytech-site/` | **HolyTech Solutions** — site institucional + landings Holyshop/Holycar/Holybarber/Holyweb (no ar em holytechsolution.com.br) | HTML/CSS/JS estático + build Node | abrir chat em `holytech-site/` |
| `versatil/` | **Versátil** — loja de logística reversa: e-commerce + disparo em grupos WhatsApp + PDV (esboço) | Next.js + Node/Prisma/Postgres + Asaas + Evolution | abrir chat em `versatil/` |
| `extensao-crm/` | **CRM WhatsApp** (nome provisório) — extensão Chrome própria, reescrita inspirada na WaSpeed (funil, ficha, respostas rápidas, agendamentos) | Extensão MV3 TS/React + esbuild + wa-js; dados em chrome.storage | abrir chat em `extensao-crm/` |
| `holytech-assina/` | **Holysign** (ex-HolyTech Assina) — assinatura eletrônica estilo Autentique (cadastro aberto, painel, API/webhook, código + selfie + carimbo HolyTech); no ar em holytechsolution.com.br/holysign | Node/Express + Postgres + pdf-lib | abrir chat em `holytech-assina/` |
| `controle-ox/` | **OX Show** — telão + música do dia + luz (Lumikit via API) + luz ambiente (COM25) da OXFITNESS num programa só, com cenas/eventos/agenda; substitui OBS+REAPER | Python stdlib (local) + HTML | abrir chat em `controle-ox/` |
| *(fora daqui)* `C:\dev\holytech\doctor` | **HolyDoctor**: gestão de clínicas em geral (agenda, prontuário, orçamento, financeiro, comissões), inspirado no Clinicorp; por enquanto só a especificação | Next + Prisma + Postgres (stack HolyTech) | abrir chat em `C:\dev\holytech\doctor` |
| `bora-conta/` | **Bora Contá** — landing do podcast, leva pro YouTube @boraconta e Instagram @boracontaoficial | HTML/CSS/JS puro | abrir chat em `bora-conta/` |
| `dzimba/` | **Academia D'Zimba**: site da academia de Imbituba/SC (mascote rato + verde-limão), feito a partir do Instagram; imagens provisórias | HTML/CSS/JS puro | abrir chat em `dzimba/` |
| `sonoridade/` | **Sonoridade**: app de estudo de violão/guitarra/baixo com foco em louvor (biblioteca de cifras + VS com click tirando o seu instrumento + exercícios + aulas do Evaldo); uso pessoal + amigos; por enquanto só o plano | proposta: PWA Next/React + Node/Prisma/Postgres | abrir chat em `sonoridade/` |
| `oxcycle/` | **OXCYCLE**: jogo 3D da sala de spinning da OXFITNESS (telão próprio; sensores ANT+ de cadência e braçadeira cardíaca); por enquanto só a demonstração | Three.js (HTML/JS) + ponte ANT+ (a fazer) | abrir chat em `oxcycle/` |
| `container-barbearia/` | **Container Barbearia** — site das 3 unidades em Imbituba (Centro com hora marcada; Vila Nova e Nova Brasília por ordem de chegada); v2 "contêiner + colmeia de LED" no ar em containerbarbearia.com.br | HTML/CSS/JS estático + GSAP (gerado por _dev/gerar.py) | abrir chat em `container-barbearia/` |
| `acesso-remoto/` | **HolyTech Remoto** — "AnyDesk próprio": servidor RustDesk na VPS OX Cloud + instalador com servidor embutido | Inno Setup + RustDesk (Docker na VPS) | abrir chat em `acesso-remoto/` |

## Observações
- `financas/` é um **repositório git próprio** embutido; os demais fazem parte deste repo raiz.
- **Produtos HolyTech** ficam juntos em `C:\dev\holytech\` (`varejo/` = Shop/Web/Car/HolyNota, `doctor/`, `marcas/`); o `README.md` de lá lista também os que ainda moram aqui (holytech-site, holytech-assina, acesso-remoto).
- `_arquivo/` guarda dumps SQL antigos e o zip de deploy do Autolar (não é projeto).
- Vários desses projetos também vivem fora daqui (VPS, OneDrive). O `CLAUDE.md` de cada um aponta o que está **no ar** e o que **falta**.
