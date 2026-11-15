# Academia D'Zimba: site institucional

Site da **Academia D'Zimba** (Imbituba/SC), feito do zero em 09/11/2026 tendo como única referência o Instagram **@academiadzimba**.

- **Endereço:** Av. Renato Ramos da Silva, 3724, Vila Nova, Imbituba/SC, CEP 88780-000
- **WhatsApp:** (48) 99947-4500 (`wa.me/5548999474500`)
- **Horário:** seg a sex 06h às 22h (sem fechar ao meio-dia) · sáb 07h30 às 11h30
- **Google:** nota 4,9 com 67 avaliações (nov/2026). Coordenadas -28.2663531, -48.6970028
- Tem parceria com o Movimento Betel (`../betel/`), que aparece nos posts da academia

## No ar (15/11/2026)
**https://dzimba.89-117-79-163.sslip.io/** (endereço provisório até ter domínio próprio)
- VPS antiga 89.117.79.163, nginx estático em `/var/www/dzimba`, config `/etc/nginx/sites-available/dzimba` (cópia em `_dev/nginx-dzimba.conf`)
- Certificado Let's Encrypt via certbot (webroot), com renovação automática. HTTP redireciona para HTTPS.
- **Atualizar o site:** `bash _dev/deploy.sh` de dentro da pasta `dzimba/` (envia por tar via ssh)
- Quando houver domínio: apontar o registro A para 89.117.79.163, incluir o domínio no `server_name` e rodar certbot de novo

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
- `assets/img/fotos/`: **fotos reais** capturadas das fotos públicas do Google Maps (espaço e equipe) e do Instagram (alunas, 60 anos de casados, Novembro Azul, Save the date 12/12). A resolução é de captura de tela (cerca de 1100 px), então **pedir os originais** para a academia.
- `assets/img/logo-provisorio.png` e `mascote-hero.jpg`: recortes provisórios da arte do Novembro Azul (o mascote-hero não é mais usado na v2)

## Falta (pedir para a academia)
1. **Logo em vetor ou PNG em alta** e o **mascote em PNG sem fundo** (verde padrão)
2. **Fotos originais** em alta e autorização de uso (principalmente as que mostram alunos)
3. **Curso de Corrida 12/12:** a landing já existe (ver a seção abaixo); falta o que está listado nela.
4. **Planos e preços** (não existe seção ainda). Confirmar também se há aula experimental grátis; o site evita prometer isso.
5. Confirmar se pode usar as **3 avaliações do Google** (Déborah, Leonardo Mello, Bruno Rist) com nome
6. Domínio próprio (hoje está no endereço sslip). As meta tags OG ainda usam caminho relativo.

## Landing do Curso de Corrida de Rua (12/12/2026): `corrida/`
**No ar:** https://dzimba.89-117-79-163.sslip.io/corrida/ · painel em `/corrida/painel/` (a chave está na VPS em `/root/segredos/dzimba-corrida-painel`)
Segue o molde da conferência Diamond da Abarim (`../site/diamond/`).
- **Dados do evento:** 12/12/2026.
  - Credenciamento na academia das 7h30 às 11h.
  - Curso às 15h no Auditório do Praia Hotel.
  - Palestrante Marcos Paulo Huber.
  - Programa de 6 tópicos; certificado de 5 horas.
  - Praia Hotel: coordenadas -28.2464727, -48.6672617 (Centro). O link "Ver no mapa" usa essas coordenadas.
- **Front (v3, 15/11):** depois da crítica à v2 (herói ruim no PC, arte do percurso fraca, palestrante sem valor, certificado amador, sem seção de preço e botões sem levar ao checkout):
  - herói no PC em duas colunas (texto centralizado na metade escura da foto, corredores à direita; cronômetro e botão lado a lado, tudo na primeira tela);
  - percurso com **mapa real** de Imbituba (`img/mapa.svg`, gerado do OpenStreetMap/Overpass + rota a pé do OSRM, 4,5 km); a rota se desenha com a rolagem, com marcos de km e contador;
  - palestrante com texto, credenciais e **trajetória em linha do tempo** (fatos públicos: Unisul 2007, Gama Filho 2009, Unisul 2010–2016, mestrado 2012, livro Univinte 2024, coordenação na Univinte e escolinha da ADRA). **Foto:** basta colocar `img/marcos-1.jpg` (retrato 9:11); sem o arquivo o bloco some sozinho;
  - seção **Investimento** (ingresso) com o preço vindo da API (`VALOR`);
  - **todo botão "Garantir" abre o checkout**. Sem `MP_ACCESS_TOKEN`, o checkout tem um botão só, "Enviar inscrição pelo WhatsApp", com nome/WhatsApp/e-mail/nível/valor preenchidos; com o token vira PIX + cartão sozinho.
- **Front (v2, 15/11):** a v1 foi rejeitada ("só colou o post, preguiça"), então **o cartaz não é mais usado**. A ideia da v2 é "rolar = correr":
  - barra de ritmo no topo;
  - herói com foto e cronômetro de largada;
  - manifesto que acende palavra por palavra;
  - percurso fixo, em que o corredor anda na rota da D'Zimba até o Praia Hotel;
  - programa em 6 "parciais" com foto e visor trocando;
  - palestrante tipográfico;
  - **número de peito e certificado com o nome digitado ao vivo** (o nome vai para o modal de pagamento e para a mensagem do WhatsApp).
  - GSAP 3.12.5 + ScrollTrigger; sem GSAP a página aparece parada.
  - Fotos em `img/` geradas pelo Codex (hero, grupo, tenis, relogio, forca), sem marcas. Trocar por fotos reais se a academia tiver.
  - `corrida/index.html` + `css/style.css` + `js/main.js`, mais `obrigado/` (volta do cartão), `validar/` (confere o código do certificado) e `painel/` (arquivo único). Ao mudar, subir o `?v=` (hoje v=4).
- **API:** `corrida/api/` (Express + pdf-lib).
  - Na VPS fica em **`/opt/dzimba-corrida`** (fora da pasta pública), no pm2 `dzimba-corrida` na porta **8404**.
  - O nginx usa `location ^~ /corrida/api/` → `127.0.0.1:8404/api/`.
  - O `.env` e o `data/` (inscritos.json, config.json) só existem na VPS; o deploy não sobrescreve.
- **Pagamento:** Mercado Pago da academia.
  - PIX na própria página.
  - Cartão pelo Checkout Pro, com a taxa repassada: `VALOR/(1-TAXA_CARTAO)`.
- **WhatsApp:** Evolution Go da VPS antiga (127.0.0.1:8081), instância `dzimba-corrida`; o token está em `/root/segredos/dzimba-corrida-evo-token`.
  - A imagem foi trocada para `ox/evolution-go:0.7.2-ox405` para corrigir o "Client outdated 405"; o backup do compose está em /root/backups.
  - Pareia pelo QR do painel.
  - 5 min depois do pagamento, a pessoa é colocada no grupo escolhido no painel; se o WhatsApp não deixar, ela recebe o link.
- **Certificado (refeito 15/11):** arte própria em `api/assets/certificado.html` (A4 deitado: faixa preta com logo e selo 5h + papel marfim com moldura guilhochê, texto, conteúdo programático, assinaturas).
  - Gerar o fundo: Chrome headless `--force-device-scale-factor=2.5 --window-size=1123,794 --screenshot` → `certificado-fundo.jpg` (e cópia 1400px em `img/certificado-limpo.jpg` para a prévia da página). As posições do nome/código ficam em `CERT_POS` no server.js (o HTML calcula e grava em `data-pos`).
  - Nome em Cormorant Garamond SemiBold Italic (instância estática gerada com fontTools do arquivo variável do google/fonts; o TTF baixado do CSS do Google vinha quebrado). **Não usar `subset: true`** nessa fonte no pdf-lib: perde letras.
  - Código de verificação `XXXX-XXXX` (HMAC do id) no canto; `/api/validar/:codigo` só confirma quem teve presença marcada ou certificado enviado. A legenda do WhatsApp manda o código e o link de `/corrida/validar/`.
  - No painel se marca quem foi credenciado. Às **19h30 de 12/12** (`CERT_AUTO_EM`) o PDF vai sozinho no WhatsApp, até 6 por minuto.
  - O painel também manda antes, em lote ou um a um.
- **Testar local:** `ADMIN_KEY=x PORT=8499 node server.js` em `corrida/api`, mais o servidor `dzimba-corrida` do launch.json (porta 8171, faz proxy de `/corrida/api/` para 8499).

### Falta (corrida)
1. **Access Token de produção do Mercado Pago da academia** (`APP_USR-...`, conta com chave PIX cadastrada). Vai em `MP_ACCESS_TOKEN` no `/opt/dzimba-corrida/.env`, depois `pm2 restart dzimba-corrida`.
2. **Valor real** (hoje `VALOR=999.00`, provisório)
3. **Parear o WhatsApp** (48) 99947-4500 pelo QR do painel e **criar o grupo** e escolher no painel
4. **Fotos do Marcos Paulo Huber** (não há nenhuma pública): salvar como `corrida/img/marcos-1.jpg` e rodar o deploy
5. Confirmar com o Marcos os dados da trajetória usados na página
6. Opcional: fotos reais de corrida da academia
