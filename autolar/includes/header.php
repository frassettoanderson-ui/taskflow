<?php
/**
 * Cabeçalho compartilhado.
 * Antes de incluir, a página pode definir:
 *   $page_titulo  (string)  -> <title>
 *   $page_desc    (string)  -> meta description
 *   $page_atual   (string)  -> 'home'|'imoveis'|'automoveis'|'sobre'|'contato'
 */
if (!defined('EMPRESA_NOME')) {
    require_once dirname(__DIR__) . '/config/config.php';
}
require_once __DIR__ . '/functions.php';

$page_titulo = $page_titulo ?? EMPRESA_NOME_FULL;
$page_desc   = $page_desc   ?? 'Autolar Automóveis e Imóveis — compra, venda e negociação de veículos e imóveis. ' . EMPRESA_SLOGAN;
$page_atual  = $page_atual  ?? '';

function nav_active(string $id, string $atual): string {
    return $id === $atual ? ' class="is-active"' : '';
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($page_titulo) ?></title>
<meta name="description" content="<?= e($page_desc) ?>">
<meta name="theme-color" content="#18181a">
<meta property="og:title" content="<?= e($page_titulo) ?>">
<meta property="og:description" content="<?= e($page_desc) ?>">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Dancing+Script:wght@600;700&display=swap" rel="stylesheet">
<link rel="icon" href="<?= e(url('assets/img/favicon.svg')) ?>" type="image/svg+xml">
<link rel="stylesheet" href="<?= e(url('assets/css/style.css')) ?>">
</head>
<body>

<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="<?= e(url('index.php')) ?>" aria-label="<?= e(EMPRESA_NOME_FULL) ?>">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="url(#bm)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <defs><linearGradient id="bm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6bd64"/><stop offset="1" stop-color="#c9952b"/></linearGradient></defs>
          <path d="M5 11l1.5-4A2 2 0 0 1 8.4 5.7h7.2a2 2 0 0 1 1.9 1.3L19 11"/>
          <path d="M4 11h16a1 1 0 0 1 1 1v4H3v-4a1 1 0 0 1 1-1z"/>
          <circle cx="7.5" cy="16.5" r="1.3"/><circle cx="16.5" cy="16.5" r="1.3"/>
        </svg>
      </span>
      <span class="brand-text">
        <span class="brand-word"><span class="brand-auto">Auto</span><span class="brand-lar">lar</span></span>
        <span class="brand-sub">automóveis e imóveis</span>
      </span>
    </a>

    <button class="nav-toggle" id="navToggle" aria-label="Abrir menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>

    <nav class="nav" id="mainNav">
      <ul class="nav-links">
        <li><a href="<?= e(url('index.php')) ?>"<?= nav_active('home', $page_atual) ?>>Início</a></li>
        <li><a href="<?= e(url('imoveis.php')) ?>"<?= nav_active('imoveis', $page_atual) ?>>Imóveis</a></li>
        <li><a href="<?= e(url('automoveis.php')) ?>"<?= nav_active('automoveis', $page_atual) ?>>Automóveis</a></li>
        <li><a href="<?= e(url('index.php#sobre')) ?>"<?= nav_active('sobre', $page_atual) ?>>Quem somos</a></li>
        <li><a href="<?= e(url('index.php#contato')) ?>"<?= nav_active('contato', $page_atual) ?>>Contato</a></li>
      </ul>
      <div class="nav-cta">
        <a class="btn btn-outline-gold" href="<?= e(whatsapp_link()) ?>" target="_blank" rel="noopener">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.13a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.83 2.41a8.2 8.2 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.23 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z"/></svg>
          Fale conosco
        </a>
      </div>
    </nav>
  </div>
</header>
