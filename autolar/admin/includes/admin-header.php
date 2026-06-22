<?php
/** Layout do admin. Páginas definem: $admin_titulo, $admin_sub, $admin_atual. */
$admin_titulo = $admin_titulo ?? 'Painel';
$admin_atual  = $admin_atual ?? '';
$ADMIN = $GLOBALS['ADMIN'] ?? ['nome' => 'Admin'];

// nº de mensagens não lidas (badge)
$naoLidas = 0;
try { $naoLidas = (int)$pdo->query('SELECT COUNT(*) FROM mensagens WHERE lida=0')->fetchColumn(); } catch (Throwable $e) {}

function adm_active(string $id, string $atual): string { return $id === $atual ? ' class="is-active"' : ''; }
$logo_svg = '<svg viewBox="0 0 24 24" fill="none" stroke="url(#ag)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="ag" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6bd64"/><stop offset="1" stop-color="#c9952b"/></linearGradient></defs><path d="M5 11l1.5-4A2 2 0 0 1 8.4 5.7h7.2a2 2 0 0 1 1.9 1.3L19 11"/><path d="M4 11h16a1 1 0 0 1 1 1v4H3v-4a1 1 0 0 1 1-1z"/><circle cx="7.5" cy="16.5" r="1.3"/><circle cx="16.5" cy="16.5" r="1.3"/></svg>';
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($admin_titulo) ?> — Admin <?= e(EMPRESA_NOME) ?></title>
<meta name="robots" content="noindex,nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="icon" href="<?= e(url('assets/img/favicon.svg')) ?>" type="image/svg+xml">
<link rel="stylesheet" href="<?= e(url('assets/css/admin.css')) ?>">
</head>
<body>
<div class="admin">
  <aside class="sidebar" id="sidebar">
    <a class="brand" href="<?= e(url('admin/index.php')) ?>">
      <span class="mark"><?= $logo_svg ?></span>
      <span><span class="word"><span class="a">Auto</span><span class="l">lar</span></span><br><span class="sub">painel admin</span></span>
    </a>
    <nav class="menu">
      <a href="<?= e(url('admin/index.php')) ?>"<?= adm_active('dashboard',$admin_atual) ?>>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
        Dashboard
      </a>
      <a href="<?= e(url('admin/veiculos.php')) ?>"<?= adm_active('veiculos',$admin_atual) ?>>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12l1.6-4.6A2.5 2.5 0 0 1 8 6h8a2.5 2.5 0 0 1 2.4 1.4L20 12"/><path d="M3 12h18v5H2v-5z"/><circle cx="6.5" cy="17.5" r="1.4"/><circle cx="17.5" cy="17.5" r="1.4"/></svg>
        Automóveis
      </a>
      <a href="<?= e(url('admin/imoveis.php')) ?>"<?= adm_active('imoveis',$admin_atual) ?>>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M9.5 20v-6h5v6"/></svg>
        Imóveis
      </a>
      <a href="<?= e(url('admin/mensagens.php')) ?>"<?= adm_active('mensagens',$admin_atual) ?>>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v12H7l-3 3V5z"/></svg>
        Mensagens
        <?php if ($naoLidas > 0): ?><span class="badge-count"><?= $naoLidas ?></span><?php endif; ?>
      </a>
      <a href="<?= e(url('admin/conta.php')) ?>"<?= adm_active('conta',$admin_atual) ?>>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>
        Minha conta
      </a>
    </nav>
    <div class="sidebar-foot">
      <div class="who">Conectado como<br><b style="color:#fff"><?= e($ADMIN['nome']) ?></b></div>
      <a href="<?= e(url('index.php')) ?>" target="_blank">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M14 3h7v7"/><path d="M21 3l-9 9"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>
        Ver site
      </a>
      <a href="<?= e(url('admin/logout.php')) ?>">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg>
        Sair
      </a>
    </div>
  </aside>
  <div class="backdrop hidden" id="backdrop"></div>

  <main class="main">
    <div class="topbar">
      <div style="display:flex;align-items:center;gap:.8rem">
        <button class="mobile-menu-btn" id="menuBtn" aria-label="Menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
        </button>
        <div>
          <h1><?= e($admin_titulo) ?></h1>
          <?php if (!empty($admin_sub)): ?><div class="sub"><?= e($admin_sub) ?></div><?php endif; ?>
        </div>
      </div>
      <?php if (!empty($admin_action)): ?><div><?= $admin_action ?></div><?php endif; ?>
    </div>

    <?php foreach (flash_get() as $f): ?>
      <div class="alert <?= $f['tipo']==='ok'?'alert-ok':($f['tipo']==='info'?'alert-info':'alert-err') ?>"><?= e($f['msg']) ?></div>
    <?php endforeach; ?>
