<?php
require __DIR__ . '/auth-check.php';

$q = input_str('q');
$where = '1=1';
$params = [];
if ($q !== '') {
    $where .= ' AND (titulo LIKE ? OR cidade LIKE ? OR bairro LIKE ?)';
    array_push($params, "%$q%", "%$q%", "%$q%");
}

$stmt = $pdo->prepare("SELECT COUNT(*) FROM imoveis WHERE $where");
$stmt->execute($params);
$total = (int)$stmt->fetchColumn();

$pag = paginacao($total, 12);
$stmt = $pdo->prepare("SELECT * FROM imoveis WHERE $where ORDER BY criado_em DESC LIMIT {$pag['por_pagina']} OFFSET {$pag['offset']}");
$stmt->execute($params);
$rows = $stmt->fetchAll();
$capas = capas_por_ids($pdo, 'imovel_imagens', 'imovel_id', array_column($rows, 'id'));

$admin_titulo = 'Imóveis';
$admin_sub = "$total imóvel(is) cadastrado(s)";
$admin_atual = 'imoveis';
$admin_action = '<a class="btn btn-blue" href="' . e(url('admin/imovel-form.php')) . '">+ Adicionar imóvel</a>';
include __DIR__ . '/includes/admin-header.php';
?>

<div class="card-box">
  <div class="toolbar">
    <form method="get">
      <input type="text" name="q" value="<?= e($q) ?>" placeholder="Buscar por título, cidade, bairro…">
      <button class="btn btn-ghost btn-sm">Buscar</button>
      <?php if ($q): ?><a class="btn btn-ghost btn-sm" href="<?= e(url('admin/imoveis.php')) ?>">Limpar</a><?php endif; ?>
    </form>
  </div>

  <div class="table-scroll">
    <table class="tbl">
      <thead>
        <tr><th></th><th>Imóvel</th><th>Finalidade</th><th>Cômodos</th><th>Preço</th><th>Status</th><th>Destaque</th><th></th></tr>
      </thead>
      <tbody>
        <?php if (!$rows): ?>
          <tr><td colspan="8"><div class="muted-empty">Nenhum imóvel encontrado. <a href="<?= e(url('admin/imovel-form.php')) ?>" style="color:var(--blue)">Adicionar o primeiro</a>.</div></td></tr>
        <?php else: foreach ($rows as $r): ?>
          <tr>
            <td><img class="thumb" src="<?= e(imagem_url($capas[$r['id']] ?? null, 'imoveis')) ?>" alt=""></td>
            <td>
              <div class="cell-title"><?= e($r['titulo'] ?: rotulo_tipo_imovel($r['tipo'])) ?></div>
              <div class="cell-sub"><?= e(rotulo_tipo_imovel($r['tipo'])) ?> · <?= e(($r['bairro']? $r['bairro'].', ':'').$r['cidade']) ?></div>
            </td>
            <td><span class="pill <?= $r['finalidade']==='aluguel'?'pill-blue':'pill-gold' ?>"><?= $r['finalidade']==='aluguel'?'Aluguel':'Venda' ?></span></td>
            <td><?= $r['quartos']?((int)$r['quartos'].' qts'):'—' ?><?= $r['area']?' · '.e(fmt_area($r['area'])):'' ?></td>
            <td><b><?= e(fmt_moeda($r['preco'])) ?></b></td>
            <td><?= pill_status($r['status']) ?><?= $r['ativo'] ? '' : ' <span class="pill pill-gray">Inativo</span>' ?></td>
            <td><?= $r['destaque'] ? '<span class="pill pill-gold">★ Sim</span>' : '<span class="pill pill-gray">—</span>' ?></td>
            <td>
              <div class="row-actions">
                <a class="btn btn-ghost btn-sm" href="<?= e(url('admin/imovel-form.php?id=' . $r['id'])) ?>">Editar</a>
                <form method="post" action="<?= e(url('admin/imovel-excluir.php')) ?>" data-confirm="Excluir este imóvel e suas fotos? Esta ação não pode ser desfeita.">
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
