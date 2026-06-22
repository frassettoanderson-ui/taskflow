<?php
require __DIR__ . '/auth-check.php';

$q = input_str('q');
$where = '1=1';
$params = [];
if ($q !== '') {
    $where .= ' AND (marca LIKE ? OR modelo LIKE ? OR versao LIKE ?)';
    array_push($params, "%$q%", "%$q%", "%$q%");
}

$stmt = $pdo->prepare("SELECT COUNT(*) FROM veiculos WHERE $where");
$stmt->execute($params);
$total = (int)$stmt->fetchColumn();

$pag = paginacao($total, 12);
$stmt = $pdo->prepare("SELECT * FROM veiculos WHERE $where ORDER BY criado_em DESC LIMIT {$pag['por_pagina']} OFFSET {$pag['offset']}");
$stmt->execute($params);
$rows = $stmt->fetchAll();
$capas = capas_por_ids($pdo, 'veiculo_imagens', 'veiculo_id', array_column($rows, 'id'));

$admin_titulo = 'Automóveis';
$admin_sub = "$total veículo(s) cadastrado(s)";
$admin_atual = 'veiculos';
$admin_action = '<a class="btn btn-gold" href="' . e(url('admin/veiculo-form.php')) . '">+ Adicionar veículo</a>';
include __DIR__ . '/includes/admin-header.php';
?>

<div class="card-box">
  <div class="toolbar">
    <form method="get">
      <input type="text" name="q" value="<?= e($q) ?>" placeholder="Buscar por marca, modelo…">
      <button class="btn btn-ghost btn-sm">Buscar</button>
      <?php if ($q): ?><a class="btn btn-ghost btn-sm" href="<?= e(url('admin/veiculos.php')) ?>">Limpar</a><?php endif; ?>
    </form>
  </div>

  <div class="table-scroll">
    <table class="tbl">
      <thead>
        <tr><th></th><th>Veículo</th><th>Ano</th><th>KM</th><th>Preço</th><th>Status</th><th>Destaque</th><th></th></tr>
      </thead>
      <tbody>
        <?php if (!$rows): ?>
          <tr><td colspan="8"><div class="muted-empty">Nenhum veículo encontrado. <a href="<?= e(url('admin/veiculo-form.php')) ?>" style="color:var(--gold)">Adicionar o primeiro</a>.</div></td></tr>
        <?php else: foreach ($rows as $r): ?>
          <tr>
            <td><img class="thumb" src="<?= e(imagem_url($capas[$r['id']] ?? null, 'veiculos')) ?>" alt=""></td>
            <td>
              <div class="cell-title"><?= e($r['marca'] . ' ' . $r['modelo']) ?></div>
              <div class="cell-sub"><?= e($r['versao'] ?: rotulo_categoria_veic($r['categoria'])) ?> · <?= e(rotulo_combustivel($r['combustivel'])) ?></div>
            </td>
            <td><?= (int)$r['ano'] ?></td>
            <td><?= e(fmt_km($r['km'])) ?></td>
            <td><b><?= e(fmt_moeda($r['preco'])) ?></b></td>
            <td><?= pill_status($r['status']) ?><?= $r['ativo'] ? '' : ' <span class="pill pill-gray">Inativo</span>' ?></td>
            <td><?= $r['destaque'] ? '<span class="pill pill-gold">★ Sim</span>' : '<span class="pill pill-gray">—</span>' ?></td>
            <td>
              <div class="row-actions">
                <a class="btn btn-ghost btn-sm" href="<?= e(url('admin/veiculo-form.php?id=' . $r['id'])) ?>">Editar</a>
                <form method="post" action="<?= e(url('admin/veiculo-excluir.php')) ?>" data-confirm="Excluir este veículo e suas fotos? Esta ação não pode ser desfeita.">
                  <?= csrf_field() ?>
                  <input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
                  <button class="btn btn-danger btn-sm" type="submit">Excluir</button>
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
