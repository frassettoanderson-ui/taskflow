<?php
require __DIR__ . '/auth-check.php';

/* Ações (CSRF) */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_validar()) { flash_set('err', 'Sessão expirada.'); redirecionar('admin/mensagens.php'); }
    $acao = input_str('acao');
    $mid  = input_int('id', 0);
    if ($mid) {
        if ($acao === 'lida')      $pdo->prepare('UPDATE mensagens SET lida=1 WHERE id=?')->execute([$mid]);
        elseif ($acao === 'nao_lida') $pdo->prepare('UPDATE mensagens SET lida=0 WHERE id=?')->execute([$mid]);
        elseif ($acao === 'excluir')  { $pdo->prepare('DELETE FROM mensagens WHERE id=?')->execute([$mid]); flash_set('ok','Mensagem excluída.'); }
    }
    redirecionar('admin/mensagens.php' . (input_str('pg') ? '?pg=' . (int)input_str('pg') : ''));
}

$total = contar($pdo, 'SELECT COUNT(*) FROM mensagens');
$pag = paginacao($total, 15);
$rows = $pdo->query("SELECT * FROM mensagens ORDER BY lida ASC, criado_em DESC LIMIT {$pag['por_pagina']} OFFSET {$pag['offset']}")->fetchAll();

$admin_titulo = 'Mensagens';
$admin_sub = "$total mensagem(ns) recebida(s)";
$admin_atual = 'mensagens';
include __DIR__ . '/includes/admin-header.php';
?>

<div class="card-box">
  <div class="table-scroll">
    <table class="tbl">
      <thead>
        <tr><th>De</th><th>Mensagem</th><th>Recebida</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        <?php if (!$rows): ?>
          <tr><td colspan="5"><div class="muted-empty">Nenhuma mensagem recebida ainda.</div></td></tr>
        <?php else: foreach ($rows as $m): $isEmail = filter_var($m['contato'], FILTER_VALIDATE_EMAIL); ?>
          <tr style="<?= $m['lida'] ? '' : 'background:#fffdf6' ?>">
            <td>
              <div class="cell-title"><?= e($m['nome']) ?></div>
              <div class="cell-sub">
                <?php if ($isEmail): ?><a href="mailto:<?= e($m['contato']) ?>" style="color:var(--blue)"><?= e($m['contato']) ?></a>
                <?php else: ?><a href="https://wa.me/<?= preg_replace('/\D/','',$m['contato']) ?>" target="_blank" style="color:var(--green)"><?= e($m['contato']) ?></a><?php endif; ?>
              </div>
            </td>
            <td style="max-width:480px">
              <?php if ($m['assunto']): ?><div class="cell-sub" style="color:var(--gold);font-weight:600;margin-bottom:.2rem"><?= e($m['assunto']) ?></div><?php endif; ?>
              <div style="white-space:pre-line"><?= e($m['mensagem']) ?></div>
            </td>
            <td style="white-space:nowrap"><?= e(fmt_data($m['criado_em'])) ?></td>
            <td><?= $m['lida'] ? '<span class="pill pill-gray">Lida</span>' : '<span class="pill pill-amber">Nova</span>' ?></td>
            <td>
              <div class="row-actions">
                <form method="post">
                  <?= csrf_field() ?>
                  <input type="hidden" name="id" value="<?= (int)$m['id'] ?>">
                  <input type="hidden" name="pg" value="<?= (int)$pag['pagina'] ?>">
                  <input type="hidden" name="acao" value="<?= $m['lida'] ? 'nao_lida' : 'lida' ?>">
                  <button class="btn btn-ghost btn-sm"><?= $m['lida'] ? 'Marcar não lida' : 'Marcar lida' ?></button>
                </form>
                <form method="post" data-confirm="Excluir esta mensagem?">
                  <?= csrf_field() ?>
                  <input type="hidden" name="id" value="<?= (int)$m['id'] ?>">
                  <input type="hidden" name="acao" value="excluir">
                  <button class="btn btn-danger btn-sm">Excluir</button>
                </form>
              </div>
            </td>
          </tr>
        <?php endforeach; endif; ?>
      </tbody>
    </table>
  </div>
  <?= adm_pager($pag) ?>
</div>

<?php include __DIR__ . '/includes/admin-footer.php'; ?>
