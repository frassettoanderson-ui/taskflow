# Autolar — Site + Painel Admin

Site institucional com **catálogo duplo (automóveis + imóveis)** e **painel administrativo**.
**PHP 8 puro + MySQL/MariaDB — sem Node, sem build, sem Composer.**

> **🟢 STATUS: NO AR EM PRODUÇÃO** → https://www.autolarimbituba.com.br
> Substituiu o site antigo (Tecimob). HTTPS ativo com renovação automática.

---

## 1. Onde as coisas estão

| Item | Onde |
|---|---|
| Código local | `C:\Users\ander\Downloads\taskflow_backup_completo\autolar` |
| Servidor (produção) | VPS Hostinger **89.117.79.163** — Ubuntu 22.04 |
| Raiz do site na VPS | `/var/www/autolar` |
| Acesso | `ssh root@89.117.79.163` (chave já configurada na máquina do usuário) |
| Config nginx | `/etc/nginx/sites-enabled/autolar-teste` |
| Admin | `https://www.autolarimbituba.com.br/admin` (senha inicial via `/admin/instalar.php`) |
| Acesso alternativo (sem DNS) | `http://89.117.79.163:8095` |

**Stack na VPS:** nginx 1.18 + PHP-FPM 8.1 + MariaDB.

**Banco:** base `autolar_teste`, usuário `autolar_user`.
As credenciais **reais** ficam em `/var/www/autolar/config/db.php` **na VPS** (o `config/db.php` local é
só um placeholder da Hostinger compartilhada). Não versionar senha no repositório.

---

## 2. Deploy (como publicar alterações)

Não há build. Deploy = copiar arquivos alterados e ajustar dono:

```bash
scp arquivo.php root@89.117.79.163:/var/www/autolar/arquivo.php
ssh root@89.117.79.163 "chown www-data:www-data /var/www/autolar/arquivo.php"
```

### ⚠️ Armadilhas de deploy (já causaram bug antes)
- **NUNCA** sobrescrever `config/db.php` (apaga as credenciais reais) nem a pasta `uploads/`.
  Em deploy por tar: `tar --exclude='./config/db.php' --exclude='./uploads'`.
- **Caminhos dos assets:** CSS fica em `assets/css/style.css` e JS em `assets/js/main.js`.
  Já aconteceu de enviar para `assets/` (pasta errada) e o site "não atualizar" — confira o destino.
- Após deploy de CSS/JS, o cache-busting é automático (`?v=<filemtime>` no header/footer),
  mas o navegador do usuário às vezes exige **Ctrl+F5**.
- Validar sintaxe na VPS quando não houver PHP local: `ssh root@... "php -l /var/www/autolar/arquivo.php"`.

---

## 3. Domínio, DNS e e-mail (migração concluída)

- Domínio `autolarimbituba.com.br` está na **conta Hostinger do usuário**.
  🔑 O "provedor **HSTDOMAINS / HST Support Services**" que aparece no Registro.br **é a Hostinger** —
  por isso o Registro.br mostra o DNS travado. **Gerenciar tudo pelo hPanel da Hostinger**, não pelo Registro.br.
- **Nameservers:** `ns1.dns-parking.com` / `ns2.dns-parking.com` (Hostinger).
- **Zona DNS (hPanel → Domínios → DNS/Nameservers), 7 registros:**

| Tipo | Nome | Valor |
|---|---|---|
| A | `@` | `89.117.79.163` |
| A | `www` | `89.117.79.163` |
| MX (10) | `@` | `mail.meusemails.com.br` |
| TXT | `@` | `v=spf1 mx include:_spf.google.com include:spf.protection.outlook.com -all` |
| TXT | `@` | `google-site-verification=j7zYDKz7NCUPfjyR9ngIBR9UbLvH58FRNe9dfKvv60o` |
| TXT | `mail._domainkey` | DKIM (v=DKIM1; k=rsa; p=MIIBIjANBgkq…) |
| TXT | `_dmarc` | `v=DMARC1; p=none` |

- ⚠️ **O e-mail é externo (meusemails.com.br). NÃO mexer nos registros MX/SPF/DKIM** — quebra o e-mail
  `@autolarimbituba.com.br`. A Hostinger cria por padrão registros de e-mail dela
  (`hostingermail-*`, `autodiscover`, `autoconfig`, `mx1/mx2.hostinger.com`) — **esses devem ser apagados**.
- **HTTPS:** Let's Encrypt via `certbot --nginx`, válido até **12/10/2026**, renovação automática ativa.
  Reemitir se preciso: `certbot --nginx -d autolarimbituba.com.br -d www.autolarimbituba.com.br`.
- Ao trocar DNS, o "Ops… site não disponível" é a página de parking da Hostinger (IP `2.57.91.91`)
  ficando em cache no navegador/roteador do usuário — não é erro do servidor.

---

## 4. Limites de upload (já ajustados — não baixar)

| Onde | Valor |
|---|---|
| PHP-FPM (`/etc/php/8.1/fpm/php.ini`) | `upload_max_filesize 16M`, `post_max_size 64M`, `max_file_uploads 30` |
| nginx (`autolar-teste`) | `client_max_body_size 64M` |
| App (`config/config.php`) | `UPLOAD_MAX_BYTES` = 8 MB por imagem |

⚠️ **Sintoma clássico:** erro **"Sessão expirada. Tente novamente."** ao salvar no admin **não é sessão** —
é o POST estourando o limite do PHP, que descarta os dados (incluindo o token CSRF). Se voltar a acontecer,
verificar esses limites antes de investigar sessão/CSRF.

---

## 5. O que o site tem

**Home:** cards de escolha com imagem (P&B → cor no hover, com som), banner "Troca facilitada"
(foto da Hilux + texto), seção "Por que escolher" (6 motivos), contato.

**Catálogos (automóveis / imóveis):** cards com carrossel de fotos, badges (Imperdível com brilho,
Novo, Vídeo), **"Vendido"** com faixa diagonal + foto em P&B, carrossel de categorias (automóveis),
botão **"Filtrar"** em dropdown só no celular, scroll/responsivo completo.

**Página de detalhe:** galeria com **proporção adaptativa** — foto vertical (9:16) abre vertical
**sem cortar**, horizontal abre horizontal, vídeo em 16:9; sobras preenchidas com fundo desfocado.
Miniaturas rolam lateralmente.

**Vídeo:** campo "Vídeo (YouTube/Vimeo)" no cadastro; se preenchido, aparece botão
"Vídeo do imóvel/veículo" no card, abrindo modal.

**Página especial `thefarm437.php`** (landing de imóvel-investimento, Imaruí/SC — 3 cabanas, Airbnb ativo):
CSS/JS próprios em `assets/css/thefarm437.css` e `assets/js/thefarm437.js` (céu com estrela cadente + lightbox).
Header ganhou o hook `$page_head` para CSS extra. **Fotos são descobertas automaticamente** em
`assets/img/thefarm437/` pelo prefixo: `bella-NN`, `luz-NN`, `grand-NN`, `regiao-NN` (jpg/png/webp);
sem foto = placeholder. A seção **Terreno usa vídeo de drone** (`terreno.mp4`, 1600px/24fps/CRF31 ≈ 9 MB, sem áudio,
gerado por ffmpeg do original `DJI_0996.MP4`; poster `terreno-poster.jpg`) — autoplay mudo quando visível + botão tela cheia. Preço "sob consulta". Dados do Airbnb (5,0 · 38 + 15 avaliações) foram lidos dos anúncios reais.
Também está **cadastrada no catálogo como imóvel id 19** (tipo sítio, Imaruí, **R$ 1.200.000** desde 13/09, destaque),
com 14 fotos copiadas p/ `uploads/imoveis/` com marca d'água (script `cadastrar_thefarm437.php`, rodado 13/09/2026).
`imovel.php` tem o mapa `$paginasEspeciais = [19 => 'thefarm437']` que mostra o botão "Ver página completa".
**URL limpa:** `/thefarm437` (nginx: `location = /thefarm437` faz rewrite p/ o .php; `/thefarm437.php` → 301 p/ a limpa).
Backup do nginx antes da mudança em `/root/autolar-teste.nginx.bak-*`.
`fmt_moeda()` devolve **"Sob consulta"** quando o preço é 0. A **home** tem o banner `.thefarm-banner` (index.php + style.css) logo após os cards de escolha.

**Admin (`/admin`):**
- Marca d'água automática nas fotos enviadas (opacidade ~22%, em `aplicar_marca_dagua()` de
  `admin/includes/admin-functions.php`). Aplica só em uploads novos — fotos antigas têm a marca "queimada".
- Antes de enviar, o navegador **avisa** se alguma foto passa do limite (sem enviar nada, preservando o formulário).
- Cada miniatura tem **botão × para remover** aquela foto da seleção.
- Clicar na foto abre **lightbox** ampliado (ajuda a escolher a capa).

---

## 6. Decisões do cliente (respeitar)

- 🚫 **NUNCA mencionar "Tabela FIPE"** em nenhum lugar do site. A comunicação correta é
  **"Aceitamos seu automóvel como parte do pagamento"** + **"Consulte avaliação"**.
  (O cliente aceita o carro na negociação, mas não quer prometer valor de tabela.)
- Site é **só VENDA** — não existe aluguel/locação.
- **Endereço e horário de atendimento foram REMOVIDOS** do site (home e rodapé) por enquanto.
  Os valores continuam em `config/config.php`; recolocar quando o cliente passar os dados reais.
  (Ao recolocar, o `.footer-grid` volta de `1.4fr 1fr` para 4 colunas.)
- Contatos reais: WhatsApp **(48) 99179-7557** e **(48) 99634-6175**,
  e-mail **comercial@autolarimbituba.com.br**, CRECI 9348-J.
- Fotos recomendadas: lado maior **1600–1920px**, até ~1 MB, **capa sempre horizontal**
  (o card é 4:3 e corta foto vertical na capa).

---

## 7. Pendências / próximos passos

- [ ] Recolocar **endereço + horário** reais quando o cliente informar.
- [ ] **Conteúdo real**: os veículos/imóveis atuais são de demonstração e estão marcados como "vendido".
      O cliente vai cadastrar os reais pelo admin.
- [ ] (Opcional, já oferecido) **Redirect canônico** `autolarimbituba.com.br` → `www.` (hoje ambos abrem).
- [ ] (Opcional, já oferecido) **Redimensionar imagens automaticamente no upload** (~1920px),
      para o cliente não precisar se preocupar com tamanho.

---

## 8. Armadilhas técnicas conhecidas

- **CSS grid estourando:** listas com muitos filhos (ex.: 62 miniaturas) esticavam a página inteira.
  Corrigido com `min-width: 0` nos itens do grid (`.detail-layout > *`). Se algo "abrir gigante", é isso.
- **Screenshots do Chrome travam** nessa página (animações infinitas do botão WhatsApp/carrosséis).
  Preferir avaliações JS curtas e diretas em vez de screenshot para verificar.
- Testar em produção sem depender do cache local:
  `curl -s --resolve autolarimbituba.com.br:443:89.117.79.163 https://autolarimbituba.com.br/`

---

## 9. Estrutura de arquivos

- `index.php`, `automoveis.php`/`automovel.php`, `imoveis.php`/`imovel.php`, `contato.php`, `404.php`
- `config/config.php` (dados da empresa, limites) · `config/db.php` (credenciais — só na VPS)
- `includes/` — `header.php`, `footer.php`, `functions.php`, `card-veiculo.php`, `card-imovel.php`
- `admin/` — painel; `admin/includes/admin-functions.php` (uploads + marca d'água),
  `admin/includes/admin-footer.php` (JS de preview/validação/lightbox)
- `assets/css/style.css` (site) · `assets/css/admin.css` (painel) · `assets/js/main.js`
- `uploads/veiculos/`, `uploads/imoveis/` — fotos enviadas (**preservar sempre**)
