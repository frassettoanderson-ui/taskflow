<?php
require_once dirname(__DIR__) . '/config/config.php';
require_once dirname(__DIR__) . '/config/db.php';
require_once dirname(__DIR__) . '/includes/functions.php';

if (!empty($_SESSION['admin_id'])) {
    redirecionar('admin/index.php');
}

$erro = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_validar()) {
        $erro = 'Sessão expirada. Tente novamente.';
    } else {
        $email = input_str('email');
        $senha = $_POST['senha'] ?? '';
        $stmt = $pdo->prepare('SELECT * FROM admins WHERE email = ?');
        $stmt->execute([$email]);
        $adm = $stmt->fetch();

        if ($adm && password_verify($senha, $adm['senha_hash'])) {
            session_regenerate_id(true);
            $_SESSION['admin_id'] = (int)$adm['id'];
            // re-hash se o algoritmo padrão mudou
            if (password_needs_rehash($adm['senha_hash'], PASSWORD_DEFAULT)) {
                $up = $pdo->prepare('UPDATE admins SET senha_hash=? WHERE id=?');
                $up->execute([password_hash($senha, PASSWORD_DEFAULT), $adm['id']]);
            }
            redirecionar('admin/index.php');
        } else {
            $erro = 'E-mail ou senha incorretos.';
        }
    }
}
$logo_svg = '<svg viewBox="0 0 24 24" fill="none" stroke="url(#lg)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6bd64"/><stop offset="1" stop-color="#c9952b"/></linearGradient></defs><path d="M5 11l1.5-4A2 2 0 0 1 8.4 5.7h7.2a2 2 0 0 1 1.9 1.3L19 11"/><path d="M4 11h16a1 1 0 0 1 1 1v4H3v-4a1 1 0 0 1 1-1z"/><circle cx="7.5" cy="16.5" r="1.3"/><circle cx="16.5" cy="16.5" r="1.3"/></svg>';
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Entrar — Admin <?= e(EMPRESA_NOME) ?></title>
<meta name="robots" content="noindex,nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="icon" href="<?= e(url('assets/img/favicon.svg')) ?>" type="image/svg+xml">
<link rel="stylesheet" href="<?= e(url('assets/css/admin.css')) ?>">
</head>
<body>
<div class="auth-wrap">
  <div class="auth-card">
    <div class="auth-brand">
      <span class="mark"><?= $logo_svg ?></span>
      <span class="word"><span class="a">Auto</span><span class="l">lar</span></span>
      <span class="sub">painel administrativo</span>
    </div>
    <h1>Bem-vindo de volta</h1>
    <p class="muted">Entre para gerenciar veículos e imóveis.</p>

    <?php if ($erro): ?><div class="alert alert-err"><?= e($erro) ?></div><?php endif; ?>

    <form method="post" novalidate>
      <?= csrf_field() ?>
      <div class="field">
        <label for="email">E-mail</label>
        <input type="email" id="email" name="email" required autofocus value="<?= e($_POST['email'] ?? '') ?>" placeholder="seu@email.com">
      </div>
      <div class="field">
        <label for="senha">Senha</label>
        <input type="password" id="senha" name="senha" required placeholder="••••••••">
      </div>
      <button type="submit" class="btn btn-gold btn-block">Entrar</button>
    </form>
    <p class="muted" style="margin-top:1.2rem;font-size:.8rem">
      Primeiro acesso? Defina a senha em <b>/admin/instalar.php</b>.
    </p>
  </div>
</div>
</body>
</html>
