# Academia D'Zimba: site institucional

Site da **Academia D'Zimba** (Imbituba/SC), feito do zero em 09/11/2026 tendo como única referência o Instagram **@academiadzimba**.

- **Endereço:** Av. Renato Ramos da Silva, 3724, Vila Nova, Imbituba/SC, CEP 88780-000
- **WhatsApp:** (48) 99947-4500 (`wa.me/5548999474500`)
- **Horário:** seg a sex 06h às 22h (sem fechar ao meio-dia) · sáb 07h30 às 11h30
- **Google:** nota 4,9 com 67 avaliações (nov/2026). Coordenadas -28.2663531, -48.6970028
- Tem parceria com o Movimento Betel (`../betel/`), que aparece nos posts da academia

## No ar (15/11/2026)
**https://academiadzimba.com.br/** (domínio próprio desde 15/11/2026, registrado no **Registro.br** com o DNS de lá: registros A de `@` e `www` → 89.117.79.163; quem edita a zona é o usuário, no painel do Registro.br)
- `www` e o endereço antigo `dzimba.89-117-79-163.sslip.io` redirecionam (301) para o domínio. A API `/corrida/api/` continua respondendo também no endereço antigo, para links e webhooks antigos.
- VPS antiga 89.117.79.163, nginx estático em `/var/www/dzimba`, config `/etc/nginx/sites-available/dzimba` (cópia em `_dev/nginx-dzimba.conf`)
- Certificados Let's Encrypt via certbot (webroot), com renovação automática: `academiadzimba.com.br` (+www) e o antigo do sslip. HTTP redireciona para HTTPS. O HTML vai com `Cache-Control: no-cache` (o navegador sempre confere a versão nova).
- `robots.txt` (bloqueia painel e API) e `sitemap.xml` na raiz.
- **Atualizar o site:** `bash _dev/deploy.sh` de dentro da pasta `dzimba/` (envia por tar via ssh)

## Stack e como rodar
HTML/CSS/JS puro, sem build. **v2 (15/11/2026)** refeita depois da crítica do usuário à v1 ("cara de site feito por IA", sem animação, seção de app inventada, comunidade sem foto).
- `index.html`: herói com foto real da passarela, faixas com frases da casa, números, **tour horizontal** pelos espaços, equipe, avaliações, placar de horários, **mural de fotos** da turma, local ("Da Vila Nova pra Imbituba"), chamada final com anilha girando
- **Não existe mais seção de app.** O post de 2023 citava o app SCA, mas não há link confirmado. Só volta se a academia mandar os links.
- `assets/css/style.css`: tokens no `:root`. Fontes: Big Shoulders Display (títulos), Barlow (texto), Permanent Marker (anotações "à mão")
- `assets/js/main.js`: status aberto/fechado (hora de Brasília), modo campanha, evento que some sozinho depois de `data-ate`, e animações com **GSAP 3.12.5 + ScrollTrigger** (cdnjs). Respeita `prefers-reduced-motion`. Sem GSAP, o site aparece normal (sem animação).
- Ao mudar CSS/JS, **subir o `?v=` no index.html**: o nginx guarda assets em cache por 7 dias
- Preview: servidor `dzimba` no `.claude/launch.json` da raiz, porta **8170**. No painel oculto o GSAP não anima (sem rAF); para testar, avançar com `gsap.ticker.tick()` em laço

## Ideias aplicadas (pesquisa de referências)
Phive (fotos espalhadas que se juntam, marca gigante, anilha rolando, menu flutuante embaixo), Essor (foto nítida sobre a própria cópia borrada), Gymbox (faixas com frases), Fenriz (fotos acendem do cinza para a cor, orgulho do bairro).

## Identidade (tirada do Instagram)
- **Mascote:** rato bodybuilder, principal ativo da marca. Troca de cor nas campanhas (verde no padrão, rosa no Outubro Rosa, azul no Novembro Azul).
- **Cores:** preto/grafite + verde-limão `--lime: #b4e31e`, que vem do logo e da **passarela verde do piso**. A barra de progresso na lateral esquerda do site imita essa passarela.
- **Modo campanha:** em `main.js`, `CAMPANHA = 'rosa' | 'azul'` troca a cor de destaque do site inteiro. Com `CAMPANHA_AUTO = true`, a troca é automática em outubro e novembro.

## Imagens
- `assets/img/fotos/`: **fotos reais** capturadas das fotos públicas do Google Maps (espaço e equipe) e do Instagram (alunas, 60 anos de casados, Save the date 12/12). A resolução é de captura de tela (cerca de 1100 px), então **pedir os originais** para a academia.
- **Logo oficial = o distintivo do rato mordendo a barra** (círculo verde, "D'ZIMBA ACADEMIA" prateado), enviado pelo usuário em 15/11. Recortada sem fundo em `assets/img/logo.png` (480px), `corrida/img/logo.png` (560px) e `favicon.png` (256px).
- ⚠️ **NUNCA usar a logo "D'ZIMBA" com o bonequinho fisiculturista verde em cima e "ACADEMIA" espaçado embaixo: é de uma CONCORRENTE.** Ela veio da arte do Novembro Azul do Instagram; essa arte, o `logo-provisorio.png` e o `mascote-hero.jpg` foram apagados (local e VPS) em 15/11. O certificado e a foto do grupo foram refeitos com a logo certa.

## Falta (pedir para a academia)
1. **Logo em vetor** (a de hoje é recorte de imagem 1280px) e o **mascote em PNG sem fundo**
2. **Fotos originais** em alta e autorização de uso (principalmente as que mostram alunos)
3. **Curso de Corrida 12/12:** a landing já existe (ver a seção abaixo); falta o que está listado nela.
4. **Planos e preços** (não existe seção ainda). Confirmar também se há aula experimental grátis; o site evita prometer isso.
5. Confirmar se pode usar as **3 avaliações do Google** (Déborah, Leonardo Mello, Bruno Rist) com nome

## Landing do Curso de Corrida de Rua (12/12/2026): `corrida/`
**No ar:** https://academiadzimba.com.br/corrida/ · painel em `/corrida/painel/` (senha simples escolhida pelo usuário em 15/11; fica em `ADMIN_KEY` no `.env` e em `/root/segredos/dzimba-corrida-painel`; a assinatura dos certificados usa `SEGREDO`, separado)
Segue o molde da conferência Diamond da Abarim (`../site/diamond/`).
- **Dados do evento:** 12/12/2026.
  - Credenciamento na academia das 7h30 às 11h.
  - Curso às 14h30 no Auditório (corrigido de 15h em 16/11) do Praia Hotel.
  - Palestrante Marcos Paulo Huber.
  - Programa de 6 tópicos; certificado de 5 horas.
  - Praia Hotel: coordenadas -28.2464727, -48.6672617 (Centro). O link "Ver no mapa" usa essas coordenadas.
- **Front (v3, 15/11):** depois da crítica à v2 (herói ruim no PC, arte do percurso fraca, palestrante sem valor, certificado amador, sem seção de preço e botões sem levar ao checkout):
  - herói no PC em duas colunas (texto centralizado na metade escura da foto, corredores à direita; cronômetro e botão lado a lado, tudo na primeira tela);
  - percurso com **mapa real** de Imbituba (`img/mapa.svg`, gerado do OpenStreetMap/Overpass + rota a pé do OSRM, 4,5 km); desde 16/11, quando a rolagem chega no mapa (`top 72%`) um **carro** (SVG, gira acompanhando a rua) sai do A e vai até o B uma vez (recomeça se a pessoa voltar de cima): a câmera (`.mapa__cam`) aproxima na D'Zimba, segue o carro com a linha se desenhando e o contador de km (no alto, à esquerda), abre na chegada (carro some, Praia Hotel pulsa, cartão B acende). **Desde 16/11 não é corrida** (usuário: "ficou parecendo que o evento se trata de uma corrida"): A = **Check-in** 7h30 às 11h na Academia D'Zimba, B = **Evento** 14h30 no Praia Hotel; nada de "largada/chegada" no mapa nem nos cartões. Em cima de cada pino há um prédio 3D (Codex, fundo magenta recortado, placa com texto lime em Impact por `_dev`/script): `img/predio-checkin.png` (academia, placa CHECK-IN) e `img/predio-evento.png` (hotel, placa EVENTO); nomes dos pinos ficam embaixo. ⚠️ **As animações NÃO respeitam "reduzir movimento"** (decisão do dono: o aparelho dele tem isso ligado e a página ficava toda parada); `anima` é sempre posto no `<head>`. Todo o resto aparece com fade ao rolar. Os marcos 1–4 km foram tirados ("não faz sentido", usuário);
  - palestrante com texto, credenciais e **trajetória em linha do tempo** (fatos públicos: Unisul 2007, Gama Filho 2009, Unisul 2010–2016, mestrado 2012, livro Univinte 2024, coordenação na Univinte e técnico do atletismo adulto de Tubarão; a escolinha da ADRA foi retirada a pedido do usuário). **Foto:** basta colocar `img/marcos-1.jpg` (retrato 9:11); sem o arquivo o bloco some sozinho;
  - seção **Investimento** (ingresso) com o preço do lote atual vindo da API, etiqueta do lote e a régua 1º/2º/3º lote;
  - **todo botão "Garantir" abre o checkout**. Sem `MP_ACCESS_TOKEN`, o checkout tem um botão só, "Enviar inscrição pelo WhatsApp", com nome/WhatsApp/e-mail/nível/valor preenchidos; com o token vira PIX + cartão sozinho.
- **Front (v2, 15/11):** a v1 foi rejeitada ("só colou o post, preguiça"), então **o cartaz não é mais usado**. A ideia da v2 é "rolar = correr":
  - barra de ritmo no topo;
  - herói com foto e cronômetro de largada;
  - manifesto que acende palavra por palavra;
  - percurso fixo, em que o carro anda na rota da D'Zimba até o Praia Hotel;
  - programa em 6 "parciais" com foto e visor trocando;
  - palestrante tipográfico;
  - **certificado com o nome digitado ao vivo** ao lado do campo de nome (desde 16/11 ocupa o lugar do número de peito, que saiu; título "Seu certificado está esperando"; não há mais certificado separado embaixo). O nome vai para o modal de pagamento e para a mensagem do WhatsApp).
  - GSAP 3.12.5 + ScrollTrigger; sem GSAP a página aparece parada.
  - Fotos (16/11): base nas pessoas REAIS mandadas pela academia (pasta `Downloads\site dazimba`). Capa `img/hero.jpg` (horizontal) + `img/hero-m.jpg` (vertical, celular ≤700px via `<picture>`) e `img/grupo.jpg` (fechamento) = arte Codex com o casal real (homem careca de barba, camiseta azul + mulher de boné branco) correndo na orla ao pôr do sol. Programa (6 parciais): `p1-fenomeno` (3.jpeg, real), `p2-perfil` (mulher de azul-marinho, real), `p3-volume` (qwer.jpeg, real), `p4-metodos`/`p5-calculo`/`p6-forca` (Codex, mesmo casal). ⚠️ O quadro das parciais é VERTICAL no PC (~4:5) e baixo/largo no celular: as 6 fotos são 1080×1350 (4:5) com as pessoas INTEIRAS, e cada `<img>` tem `object-position` com o foco vertical para o celular. Reprovado pelo usuário (16/11): corte em 3:2 que partia os atletas ao meio, cabeça cortada, foco no céu, relógio virado para a câmera (a 5 e a 6 foram refeitas no Codex já na vertical). `og.jpg?v=2` recortada da capa.
  - Vídeos (16/11): ⚠️ **SEM vídeo no herói** (o usuário não pediu e reprovou; a capa é só a foto). Único vídeo: `video/filme.mp4` (30 s, 1080p, ~7,5 MB) como FUNDO da seção do manifesto ("Correr é mais do que movimento"), tela cheia com véu escuro; toca mudo quando a seção chega perto. No celular usa `video/filme-m.mp4` (540×960, ~3 MB, recorte central). A faixa separada `.filme` foi tirada a pedido do usuário ("não curti dessa forma"), 16/11. Feitos na fal: 5 cenas estilo drone ao pôr do sol (seguindo por trás, giro em volta, tênis no asfalto, relógio, drone subindo revelando a orla); Veo 3.1 fast i2v 1080p + a cena do giro no Kling 2.5 (o Veo barrou a imagem dela na moderação). Gasto ≈ US$ 2,90. Mestres em alta ficaram só no scratchpad da sessão.
  - `corrida/index.html` + `css/style.css` + `js/main.js`, mais `obrigado/` (volta do cartão), `validar/` (confere o código do certificado) e `painel/` (arquivo único). Ao mudar, subir o `?v=` (hoje css v=20, js v=20). Vídeos tocam mesmo com "reduzir movimento"/economia de dados (decisão: o vídeo é parte da página); se o autoplay for bloqueado (iPhone em economia de bateria), começam no primeiro toque/rolagem.
- **Patrocínio (15/11):** seção `#patrocinio` **logo depois do herói** (pedido do usuário), com as logos dos patrocinadores em cartões claros (`img/patrocinadores/`: **Melo Logística** e **Axiis Bank** em SVG tirado dos PDFs, **CREF3/SC** em PNG, **Souza Construtora & Incorporadora** em PNG (16/11; logo veio branca em fundo azul, recortada e pintada no azul da marca #1f3a5f mantendo o amarelo; é vertical, então usa `marca--alta` / `li.alta`), e desde 16/11 **SulGesso** (`sulgesso.png`), **Rádio 89.3 FM Imbituba** (`radio-89.png`, alta) e **Whey no Palito** (`whey-no-palito.png`, selo redondo, alta), e **FisioNow** (`fisionow.png`, alta; veio em PNG com fundo branco e moldura, recortado)). Cartões pequenos (reduzidos 16/11) em flex com quebra centralizada (a última linha incompleta fica no meio): 4 por linha no PC, 3 por linha no celular (altura fixa 84px) e o chamado "Seja um patrocinador" (`#seja-patrocinador`). O título e o botão "Quero ser patrocinador" abrem o WhatsApp do **Patrick, (48) 9600-1619** (`wa.me/554896001619`), com a mensagem "Olá, gostaria de mais informações sobre como patrocinar o evento!". O FAQ e o link do rodapé vão para o mesmo lugar. ⚠️ **Não mostrar valores nem cotas na página** (decisão do usuário): a proposta em PDF com as cotas (Movimento/Atleta/Campeão) foi tirada do site; quem negocia é o Patrick. **Autorização dos contatos (cota Atleta):** a inscrição tem uma caixa opcional, desmarcada, "Autorizo compartilhar nome, WhatsApp e e-mail com os patrocinadores"; grava `patrocinadores` + `patrocinadoresEm` (também vai na mensagem do WhatsApp quando o pagamento é por lá). No painel: etiqueta "patrocinadores" no inscrito, caixa na inscrição manual e na edição, e o botão **Contatos p/ patrocinadores** baixa a planilha só dos pagos que autorizaram. **Novo patrocinador:** pegar a logo em vetor (PDF/SVG), recortar sem o fundo branco e colocar o `<li class="marca">` nas duas listas (seção e rodapé).
- **API:** `corrida/api/` (Express + pdf-lib).
  - `PUBLIC_BASE=https://academiadzimba.com.br/corrida` no `.env` da VPS (links do certificado, validação e volta do Mercado Pago).
  - Na VPS fica em **`/opt/dzimba-corrida`** (fora da pasta pública), no pm2 `dzimba-corrida` na porta **8404**.
  - O nginx usa `location ^~ /corrida/api/` → `127.0.0.1:8404/api/`.
  - O `.env` e o `data/` (inscritos.json, config.json) só existem na VPS; o deploy não sobrescreve.
- **Pagamento:** Mercado Pago da academia.
  - PIX na própria página.
  - Cartão pelo Checkout Pro, com a taxa repassada: `VALOR/(1-TAXA_CARTAO)`. Desde 18/11 em **até 3x** (`MAX_PARCELAS=3` no `.env` da VPS); os juros das parcelas são da maquininha e quem paga é o comprador (consultado em 18/11, lote de R$99: 1x R$104,19 · 2x total R$114,23 · 3x total R$115,89). O botão do cartão no checkout não mostra valor, só "(com juros da maquininha)" (pedido do usuário).
  - **Aprovação do cartão (18/11):** a inscrição pede **CPF** (máscara + validação dos dígitos no site e no servidor) e manda em `payer.identification` no Pix e no cartão, porque sem CPF o antifraude recusa mais (`cc_rejected_high_risk`). Cada recusa fica gravada em `rec.recusas` (webhook ou volta do MP) com o motivo em português (`MOTIVOS` no server.js); o painel mostra a etiqueta "Cartão recusado" com o motivo, e a planilha tem as colunas `cpf` e `cartao recusado`.
  - **Cartão recusado → Pix na hora:** a volta de falha do MP (`?pagamento=falhou&external_reference=...&payment_id=...`) chama `POST /api/pix-do-cartao`, que transforma a mesma inscrição em Pix do mesmo lote (sem a taxa do cartão) e o site já abre o QR com o aviso "O cartão não foi aprovado". Chamar de novo devolve o mesmo QR.
  - Conta do Patrick: o endereço estava pendente no MP (`address_pending`) em 18/11; completar o cadastro/validação de identidade ajuda a aprovar.
- **WhatsApp:** Evolution Go da VPS antiga (127.0.0.1:8081), instância `dzimba-corrida`; o token está em `/root/segredos/dzimba-corrida-evo-token`.
  - A imagem foi trocada para `ox/evolution-go:0.7.2-ox405` para corrigir o "Client outdated 405"; o backup do compose está em /root/backups.
  - Pareia pelo QR do painel.
  - **Se o QR não aparecer** ("no QR code available"): olhar `docker logs evolution-go-evogo-1`. Em 15/11 o Postgres da Evolution lotou ("too many clients already", 100/100) por tentativas repetidas de gerar QR; `docker restart evolution-go-evogo-1` liberou (só existe a instância `dzimba-corrida` nesse serviço, não derruba outro WhatsApp).
  - Foto e descrição do grupo: `_dev/grupo-whatsapp/` (`foto-grupo.html` gera `foto-grupo.jpg` 1080×1080 no Chrome headless; `descricao-grupo.txt`).
  - 5 min depois do pagamento, a pessoa é colocada no grupo escolhido no painel; se o WhatsApp não deixar, ela recebe o link.
- **Certificado (refeito 15/11):** arte própria em `api/assets/certificado.html` (A4 deitado: faixa preta com logo e selo 5h + papel marfim com moldura guilhochê, texto, conteúdo programático, assinaturas).
  - Gerar o fundo: Chrome headless `--force-device-scale-factor=2.5 --window-size=1123,794 --screenshot` → `certificado-fundo.jpg` (e cópia 1400px em `img/certificado-limpo.jpg` para a prévia da página). As posições do nome/código ficam em `CERT_POS` no server.js (o HTML calcula e grava em `data-pos`).
  - Nome em Cormorant Garamond SemiBold Italic (instância estática gerada com fontTools do arquivo variável do google/fonts; o TTF baixado do CSS do Google vinha quebrado). **Não usar `subset: true`** nessa fonte no pdf-lib: perde letras.
  - Código de verificação `XXXX-XXXX` (HMAC do id) no canto; `/api/validar/:codigo` só confirma quem teve presença marcada ou certificado enviado. A legenda do WhatsApp manda o código e o link de `/corrida/validar/`.
  - No painel se marca quem foi credenciado. Às **19h30 de 12/12** (`CERT_AUTO_EM`) o PDF vai sozinho no WhatsApp, até 6 por minuto.
  - O painel também manda antes, em lote ou um a um.
- **Testar local:** `ADMIN_KEY=x PORT=8499 node server.js` em `corrida/api`, mais o servidor `dzimba-corrida` do launch.json (porta 8171, faz proxy de `/corrida/api/` para 8499).

### Falta (corrida)
1. ~~Access Token do Mercado Pago~~ (18/11): **ligado**. App "Curso Corrida DZimba" (Checkout Pro) na conta MP **DECARVALHOPATRICK** (id 177629499, pessoa física, do Patrick); token em `MP_ACCESS_TOKEN` no `/opt/dzimba-corrida/.env` (backup `.env.bak-*`). Testado: `/api/config` enabled:true e Pix de R$1 gerou QR (cancelado na hora). Taxa do cartão repassada = `TAXA_CARTAO` 4,98% (padrão; ajustar se a taxa contratada for outra).
2. ~~Valor~~ (16/11): **venda por lotes**, `LOTES=30:99,30:119,30:139` no `.env` da VPS (vagas:valor). O lote muda sozinho quando as vagas pagas do lote acabam (cortesia não conta); total 90 vagas, depois esgota. A página e o `/api/config` só revelam o valor do lote ATUAL; os próximos aparecem como "valor maior" (pedido do usuário). Quem gerou o PIX/cartão paga o valor do lote em que gerou. O painel mostra o lote e as vendidas.
3. **Parear o WhatsApp** (48) 99947-4500 pelo QR do painel e **criar o grupo** e escolher no painel
4. ~~Fotos do Marcos~~ (15/11): `img/marcos-1.jpg` é a foto dele do Instagram @marcospaulohuber (post da Univinte, de camisa social) trocada no Codex para roupa de corrida na pista, com o rosto mantido. Alternativa na orla em `_dev/marcos-praia.jpg`. Se o Marcos mandar foto real de corrida, trocar.
5. Confirmar com o Marcos os dados da trajetória usados na página
6. Opcional: fotos reais de corrida da academia
