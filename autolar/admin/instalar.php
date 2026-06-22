<?php
/**
 * Instalador de senha do administrador (primeiro acesso).
 * Funciona APENAS enquanto não houver uma senha válida definida.
 * Depois de usar, EXCLUA este arquivo do servidor.
 */
require_once dirname(__DIR__) . '/config/config.php';
require_once dirname(__DIR__) . '/config/db.php';
require_once dirname(__DIR__) . '/includes/functions.php';

// Pega o admin (menor id)
$adm = $pdo->query('SELECT * FROM admins ORDER BY id ASC LIMIT 1')->fetch();

// Verifica se já existe senha válida
$jaConfigurado = false;
if ($adm) {
    $info = password_get_info($adm['senha_hash']);
    if (!empty($info['algo'])) $jaConfigurado = true; // hash bcrypt/argon válido
}

$msg = '';
$ok = false;

if (!$jaConfigurado && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_validar()) {
        $msg = 'Sessão expirada. Recarregue e tente novamente.';
    } else {
        $nome  = input_str('nome') ?: 'Administrador';
        $email = input_str('email');
        $s1    = $_POST['senha'] ?? '';
        $s2    = $_POST['senha2'] ?? '';

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $msg = 'Informe um e-mail válido.';
        } elseif (strlen($s1) < 8) {
            $msg = 'A senha deve ter pelo menos 8 caracteres.';
        } elseif ($s1 !== $s2) {
            $msg = 'As senhas não conferem.';
        } else {
            $hash = password_hash($s1, PASSWORD_DEFAULT);
            if ($adm) {
                $up = $pdo->prepare('UPDATE admins SET nome=?, email=?, senha_hash=? WHERE id=?');
                $up->execute([$nome, $email, $hash, $adm['id']]);
            } else {
                $ins = $pdo->prepare('INSERT INTO admins (nome, email, senha_hash) VALUES (?,?,?)');
                $ins->execute([$nome, $email, $hash]);
            }
            $ok = true;
        }
    }
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Instalar admin — <?= e(EMPRESA_NOME) ?></title>
<meta name="robots" content="noindex,nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= e(url('assets/css/admin.css')) ?>">
</head>
<body>
<div class="auth-wrap">
  <div class="auth-card">
    <div class="auth-brand">
      <span class="word"><span class="a">Auto</span><span class="l">lar</span></span>
      <span class="sub">instalador</span>
    </div>

    <?php if ($jaConfigurado): ?>
      <h1>Já configurado ✔</h1>
      <div class="alert alert-info" style="margin-top:1rem">
        A senha do administrador já foi definida. Por segurança, <b>exclua o arquivo
        <code>admin/instalar.php</code></b> do servidor.
      </div>
      <a class="btn btn-gold btn-block" href="<?= e(url('admin/login.php')) ?>">Ir para o login</a>

    <?php elseif ($ok): ?>
      <h1>Tudo pronto! 🎉</h1>
      <div class="alert alert-ok" style="margin-top:1rem">
        Senha definida com sucesso. Agora <b>exclua o arquivo
        <code>admin/instalar.php</code></b> e faça login.
      </div>
      <a class="btn btn-gold btn-block" href="<?= e(url('admin/login.php')) ?>">Fazer login</a>

    <?php else: ?>
      <h1>Definir acesso</h1>
      <p class="muted">Crie o login do administrador.</p>
      <?php if ($msg): ?><div class="alert alert-err"><?= e($msg) ?></div><?php endif; ?>
      <form method="post" novalidate>
        <?= csrf_field() ?>
        <div class="field"><label>Nome</label><input type="text" name="nome" value="<?= e($adm['nome'] ?? 'Administrador') ?>"></div>
        <div class="field"><label>E-mail</label><input type="email" name="email" required value="<?= e($adm['email'] ?? '') ?>"></div>
        <div class="field"><label>Senha (mín. 8 caracteres)</label><input type="password" name="senha" required></div>
        <div class="field"><label>Confirmar senha</label><input type="password" name="senha2" required></div>
        <button type="submit" class="btn btn-gold btn-block">Definir senha</button>
      </form>
    <?php endif; ?>
  </div>
</div>
</body>
</html>
