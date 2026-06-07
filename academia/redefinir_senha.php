<?php
require 'conexao.php';
$token = $_GET['token'] ?? '';
$erro = ''; $sucesso = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $token = $_POST['token'] ?? '';
    $nova = $_POST['nova_senha'] ?? '';
    $conf = $_POST['confirmar'] ?? '';
    if (strlen($nova) < 6) { $erro = 'A senha deve ter pelo menos 6 caracteres.'; }
    elseif ($nova !== $conf) { $erro = 'As senhas não coincidem.'; }
    else {
        $stmt = $pdo->prepare("SELECT * FROM reset_tokens WHERE token=? AND expira > NOW() AND usado=0");
        $stmt->execute([$token]);
        $t = $stmt->fetch();
        if (!$t) { $erro = 'Link inválido ou expirado.'; }
        else {
            $hash = password_hash($nova, PASSWORD_BCRYPT, ['cost'=>10]);
            $pdo->prepare("UPDATE usuarios SET senha=? WHERE id=?")->execute([$hash, $t['usuario_id']]);
            $pdo->prepare("UPDATE reset_tokens SET usado=1 WHERE token=?")->execute([$token]);
            $sucesso = 'Senha redefinida com sucesso!';
        }
    }
} else {
    $stmt = $pdo->prepare("SELECT * FROM reset_tokens WHERE token=? AND expira > NOW() AND usado=0");
    $stmt->execute([$token]);
    if (!$stmt->fetch()) { $erro = 'Link inválido ou expirado.'; }
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Taskflow — Redefinir senha</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Dancing+Script:wght@700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'DM Sans',sans-serif;background:#1a1a1a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:20px}
    .logo{text-align:center;margin-bottom:32px}
    .logo-tesk{font-size:48px;font-weight:700;color:#F26522;letter-spacing:-1px}
    .logo-flow{font-family:'Dancing Script',cursive;font-size:32px;color:rgba(255,255,255,.8)}
    .card{background:#242424;border-radius:16px;border:1px solid rgba(255,255,255,.07);padding:28px;width:100%;max-width:380px}
    h3{font-size:18px;font-weight:600;margin-bottom:20px}
    .field{margin-bottom:14px}
    .field label{display:block;font-size:11px;color:#888;margin-bottom:5px;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
    .field input{width:100%;height:48px;padding:0 14px;background:#2e2e2e;border:1px solid rgba(255,255,255,.08);border-radius:10px;font-size:14px;color:#fff;font-family:'DM Sans',sans-serif;outline:none}
    .field input:focus{border-color:#F26522}
    .btn{width:100%;height:50px;background:#F26522;color:white;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;margin-top:8px;font-family:'DM Sans',sans-serif}
    .erro{background:rgba(226,75,74,.12);border:1px solid rgba(226,75,74,.25);border-radius:8px;padding:10px 14px;font-size:13px;color:#f09595;margin-bottom:14px}
    .sucesso{background:rgba(29,158,117,.12);border:1px solid rgba(29,158,117,.25);border-radius:8px;padding:10px 14px;font-size:13px;color:#5DCAA5;margin-bottom:14px}
    a{color:#F26522;font-size:13px}
  </style>
</head>
<body>
<div class="logo"><div class="logo-tesk">tesk</div><div class="logo-flow">flow</div></div>
<div class="card">
  <h3>Redefinir senha</h3>
  <?php if($erro): ?><div class="erro"><?= htmlspecialchars($erro) ?></div><?php endif; ?>
  <?php if($sucesso): ?>
    <div class="sucesso"><?= htmlspecialchars($sucesso) ?></div>
    <a href="login.php">Ir para o login</a>
  <?php elseif(!$erro): ?>
  <form method="POST">
    <input type="hidden" name="token" value="<?= htmlspecialchars($token) ?>">
    <div class="field"><label>Nova senha</label><input type="password" name="nova_senha" placeholder="Mínimo 6 caracteres" required></div>
    <div class="field"><label>Confirmar senha</label><input type="password" name="confirmar" placeholder="Repita a senha" required></div>
    <button type="submit" class="btn">Salvar nova senha</button>
  </form>
  <?php else: ?>
    <a href="login.php">Voltar ao login</a>
  <?php endif; ?>
</div>
</body>
</html>
