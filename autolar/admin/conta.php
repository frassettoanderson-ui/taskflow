<?php
require __DIR__ . '/auth-check.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_validar()) {
        flash_set('err', 'Sessão expirada. Tente novamente.');
        redirecionar('admin/conta.php');
    }
    $nome  = input_str('nome');
    $email = input_str('email');
    $atual = $_POST['senha_atual'] ?? '';
    $nova  = $_POST['senha_nova'] ?? '';
    $nova2 = $_POST['senha_nova2'] ?? '';

    $st = $pdo->prepare('SELECT * FROM admins WHERE id=?');
    $st->execute([$ADMIN['id']]);
    $row = $st->fetch();

    if (!password_verify($atual, $row['senha_hash'])) {
        flash_set('err', 'A senha atual está incorreta.');
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        flash_set('err', 'Informe um e-mail válido.');
    } elseif ($nova !== '' && strlen($nova) < 8) {
        flash_set('err', 'A nova senha deve ter pelo menos 8 caracteres.');
    } elseif ($nova !== '' && $nova !== $nova2) {
        flash_set('err', 'A confirmação da nova senha não confere.');
    } else {
        if ($nova !== '') {
            $up = $pdo->prepare('UPDATE admins SET nome=?, email=?, senha_hash=? WHERE id=?');
            $up->execute([$nome ?: $row['nome'], $email, password_hash($nova, PASSWORD_DEFAULT), $ADMIN['id']]);
            flash_set('ok', 'Dados e senha atualizados com sucesso.');
        } else {
            $up = $pdo->prepare('UPDATE admins SET nome=?, email=? WHERE id=?');
            $up->execute([$nome ?: $row['nome'], $email, $ADMIN['id']]);
            flash_set('ok', 'Dados atualizados com sucesso.');
        }
        redirecionar('admin/conta.php');
    }
    redirecionar('admin/conta.php');
}

$st = $pdo->prepare('SELECT * FROM admins WHERE id=?');
$st->execute([$ADMIN['id']]);
$me = $st->fetch();

$admin_titulo = 'Minha conta';
$admin_sub = 'Atualize seus dados e senha';
$admin_atual = 'conta';
include __DIR__ . '/includes/admin-header.php';
?>
<div style="max-width:520px">
  <form method="post" class="form-section">
    <?= csrf_field() ?>
    <h3>Dados de acesso</h3>
    <div class="field"><label>Nome</label><input type="text" name="nome" value="<?= e($me['nome']) ?>"></div>
    <div class="field"><label>E-mail</label><input type="email" name="email" value="<?= e($me['email']) ?>" required></div>

    <h3 style="margin-top:1.4rem">Alterar senha</h3>
    <div class="field"><label>Senha atual</label><input type="password" name="senha_atual" required placeholder="Confirme com sua senha atual"></div>
    <div class="field"><label>Nova senha <span class="hint">(deixe em branco para não alterar)</span></label><input type="password" name="senha_nova"></div>
    <div class="field"><label>Confirmar nova senha</label><input type="password" name="senha_nova2"></div>

    <div style="display:flex;justify-content:flex-end"><button class="btn btn-gold">Salvar alterações</button></div>
  </form>
</div>
<?php include __DIR__ . '/includes/admin-footer.php'; ?>
