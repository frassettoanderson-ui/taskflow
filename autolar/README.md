# Autolar — Site + Painel Admin (PHP + MySQL)

Site institucional com **catálogo duplo (automóveis + imóveis)** e **painel
administrativo** para gerenciar os dois estoques. Feito para rodar na
**hospedagem compartilhada da Hostinger** (PHP 8 + MySQL), **sem Node, sem build,
sem Composer**. O deploy é só: *subir os arquivos + importar o banco*.

---

## 1. O que está incluso

```
public_html/                 (este é o conteúdo da pasta "autolar/")
├── index.php                Home (segue o layout de referência)
├── automoveis.php           Catálogo de veículos + filtros (server-side)
├── automovel.php            Detalhe do veículo (?id=)
├── imoveis.php              Catálogo de imóveis + filtros
├── imovel.php               Detalhe do imóvel (?id=)
├── contato.php              Processa o formulário de contato
├── 404.php                  Página de erro amigável
├── config/
│   ├── config.php           >>> dados da empresa (WhatsApp, e-mail, endereço)
│   └── db.php               >>> credenciais do banco
├── includes/                header, footer, funções, cards, botão WhatsApp
├── assets/                  css / js / imagens fixas (logo, hero, placeholders)
├── uploads/                 fotos enviadas pelo admin (veiculos/ e imoveis/)
├── admin/                   painel (login, dashboard, CRUDs, mensagens)
├── database.sql             estrutura + dados de exemplo + admin inicial
└── .htaccess                regras do Apache + proteção de pastas
```

---

## 2. Passo a passo do deploy na Hostinger

### Passo 1 — Criar o banco MySQL (hPanel)
1. Entre no **hPanel** → **Bancos de Dados → Bancos de Dados MySQL**.
2. Crie um **novo banco** e um **usuário** (defina uma senha forte).
3. Anote os 4 dados:
   - **Host** (geralmente `localhost`)
   - **Nome do banco** (ex.: `u123456789_autolar`)
   - **Usuário** (ex.: `u123456789_autolar`)
   - **Senha**

### Passo 2 — Importar o `database.sql`
1. No hPanel, abra o **phpMyAdmin** do banco recém-criado.
2. Selecione o banco na lista à esquerda.
3. Aba **Importar** → escolha o arquivo `database.sql` → **Executar**.
4. As tabelas e os dados de exemplo serão criados.

### Passo 3 — Preencher `config/db.php`
Abra `config/db.php` e troque pelas credenciais do Passo 1:
```php
$DB_HOST = 'localhost';
$DB_NAME = 'u123456789_autolar';
$DB_USER = 'u123456789_autolar';
$DB_PASS = 'SUA_SENHA_DO_BANCO';
```

### Passo 4 — Preencher `config/config.php`
Ajuste os dados da empresa (aparecem no site inteiro):
```php
define('WHATSAPP_NUMERO', '5548999999999'); // só números: DDI+DDD+numero
define('CONTATO_EMAIL',   'contato@autolar.com.br');
define('CONTATO_TELEFONE','(48) 99999-9999');
// ...endereço, horário, redes sociais, CRECI...
```

### Passo 5 — Subir os arquivos para `public_html`
Use o **Gerenciador de Arquivos** do hPanel **ou FTP**.
- **Site na raiz do domínio:** coloque **o conteúdo da pasta `autolar/`**
  diretamente dentro de `public_html/` (o `index.php` deve ficar em
  `public_html/index.php`). Deixe `BASE_URL` como `''` em `config/config.php`.
- **Site numa subpasta** (ex.: `seudominio.com/autolar`): suba a pasta inteira
  e defina em `config/config.php`:
  ```php
  define('BASE_URL', '/autolar');
  ```

> Dica: pelo Gerenciador de Arquivos, você pode subir um `.zip` da pasta e usar
> a opção **Extrair**.

### Passo 6 — Permissões da pasta `uploads/`
A pasta `uploads/` (e `uploads/veiculos/`, `uploads/imoveis/`) precisa permitir
gravação para o admin salvar fotos.
- No Gerenciador de Arquivos: clique direito em `uploads` → **Permissions** →
  marque **755** (ou **775** se 755 não funcionar) e aplique **recursivamente**.

### Passo 7 — Definir a senha do administrador
1. Acesse no navegador: `https://seudominio.com/admin/instalar.php`
2. Informe **nome, e-mail e senha** (mín. 8 caracteres).
3. **Importante:** depois de concluir, **EXCLUA o arquivo
   `admin/instalar.php`** do servidor (segurança).

### Passo 8 — Entrar no painel
- Acesse `https://seudominio.com/admin/` e faça login.
- Para trocar a senha depois: menu **Minha conta**.

Pronto! Já dá para cadastrar veículos e imóveis com fotos. ✅

---

## 3. E-mail do formulário de contato

O formulário **sempre grava a mensagem no banco** (visível em *Admin → Mensagens*)
e **também tenta enviar por e-mail** usando a função `mail()` do PHP (padrão da
Hostinger). Não é preciso configurar nada para o básico funcionar.

### Quer usar SMTP (mais confiável)?
A função `mail()` às vezes cai no spam. Para usar uma conta de e-mail real via
SMTP, a forma mais simples sem Composer é o **PHPMailer** (3 arquivos):

1. Baixe o PHPMailer e copie `src/PHPMailer.php`, `src/SMTP.php`,
   `src/Exception.php` para `includes/phpmailer/`.
2. Em `contato.php`, substitua o trecho do `@mail(...)` por:
   ```php
   require __DIR__ . '/includes/phpmailer/Exception.php';
   require __DIR__ . '/includes/phpmailer/PHPMailer.php';
   require __DIR__ . '/includes/phpmailer/SMTP.php';
   $mailer = new PHPMailer\PHPMailer\PHPMailer(true);
   $mailer->isSMTP();
   $mailer->Host = 'smtp.hostinger.com';
   $mailer->SMTPAuth = true;
   $mailer->Username = 'contato@autolar.com.br'; // conta criada no hPanel
   $mailer->Password = 'SENHA_DO_EMAIL';
   $mailer->SMTPSecure = 'ssl';
   $mailer->Port = 465;
   $mailer->CharSet = 'UTF-8';
   $mailer->setFrom('contato@autolar.com.br', 'Autolar');
   $mailer->addAddress(CONTATO_EMAIL);
   $mailer->addReplyTo($contato);
   $mailer->Subject = $assuntoMail;
   $mailer->Body = $corpo;
   $mailer->send();
   ```
3. Crie a conta de e-mail em **hPanel → E-mails** e use os dados de SMTP que a
   Hostinger fornece.

---

## 4. Personalização

- **Logo:** o logo é desenhado por CSS/SVG em `includes/header.php` e
  `includes/footer.php` (fácil de trocar). Para usar uma imagem real, substitua o
  bloco `.brand-mark`/`.brand-text` por `<img src="assets/img/logo.png">`.
- **Imagem do hero (home):** por padrão usa `assets/img/hero.svg`. Para uma foto
  real, suba `assets/img/hero.jpg` e troque em `assets/css/style.css`:
  ```css
  .hero { --hero-img: url('../img/hero.jpg'); }
  ```
- **Cores:** todas centralizadas em `:root` no topo de `assets/css/style.css`.
- **Placeholders:** quando um anúncio não tem foto, é exibido um placeholder
  da marca (`assets/img/placeholder-*.svg`).

---

## 5. Segurança aplicada

- **PDO + prepared statements** em 100% das consultas (anti SQL Injection).
- **`htmlspecialchars()`** em toda saída dinâmica (anti XSS).
- **Senhas** com `password_hash()` / `password_verify()` (bcrypt).
- **CSRF token** em todos os formulários que gravam dados.
- **Upload** valida MIME real (JPG/PNG/WEBP), tamanho e gera nome único; a pasta
  `uploads/` bloqueia execução de scripts via `.htaccess`.
- Pastas `config/` e `includes/` bloqueadas para acesso direto via `.htaccess`.
- Após instalar, **apague `admin/instalar.php`**.

---

## 6. Testar localmente (opcional)

Com **XAMPP/Laragon**:
1. Copie a pasta para `htdocs/autolar`.
2. Crie o banco no phpMyAdmin local e importe `database.sql`.
3. Ajuste `config/db.php` (usuário `root`, senha em branco no XAMPP).
4. Acesse `http://localhost/autolar/` e defina a senha em
   `http://localhost/autolar/admin/instalar.php`.

---

## 7. Login de exemplo / dados de teste

- O `database.sql` já cria alguns **veículos e imóveis de exemplo** e **2
  mensagens** para você ver as telas populadas. Pode excluí-los pelo painel.
- O admin inicial **não tem senha** por padrão — ela é definida no
  `admin/instalar.php` (Passo 7). Isso evita senha-padrão exposta.

Qualquer dúvida, os pontos de configuração estão **comentados** dentro de
`config/config.php` e `config/db.php`.
