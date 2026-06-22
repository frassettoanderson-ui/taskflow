<?php
/** Card de veículo. Espera: $v (linha de veiculos) e opcional $capas (map id=>arquivo). */
$capaArq = $capas[$v['id']] ?? null;
$img = imagem_url($capaArq, 'veiculos');
$href = url('automovel.php?id=' . (int)$v['id']);
?>
<a class="card card--veiculo" href="<?= e($href) ?>">
  <div class="card-media">
    <img src="<?= e($img) ?>" alt="<?= e($v['marca'] . ' ' . $v['modelo']) ?>" loading="lazy">
    <div class="card-badges">
      <?php if (!empty($v['destaque'])): ?><span class="badge badge-gold">Destaque</span><?php endif; ?>
      <?php if (($v['status'] ?? '') === 'reservado'): ?><span class="badge badge-amber">Reservado</span><?php endif; ?>
      <?php if (($v['status'] ?? '') === 'vendido'): ?><span class="badge badge-dark">Vendido</span><?php endif; ?>
    </div>
  </div>
  <div class="card-body">
    <span class="card-eyebrow"><?= e($v['marca']) ?> · <?= e(rotulo_categoria_veic($v['categoria'])) ?></span>
    <h3 class="card-title"><?= e($v['modelo']) ?></h3>
    <span class="card-sub"><?= e($v['versao'] ?: '') ?></span>
    <div class="card-attrs">
      <span class="card-attr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg><?= (int)$v['ano'] ?><?= $v['ano_modelo'] ? '/' . (int)$v['ano_modelo'] : '' ?></span>
      <span class="card-attr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 18 0"/><path d="M12 12l4-2"/></svg><?= e(fmt_km($v['km'])) ?></span>
      <span class="card-attr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4v16M5 8h6a3 3 0 0 1 3 3v9"/><circle cx="5" cy="4" r="0"/></svg><?= e(rotulo_cambio($v['cambio'])) ?></span>
    </div>
    <div class="card-foot">
      <span class="card-price"><?= e(fmt_moeda($v['preco'])) ?></span>
      <span class="btn btn-dark btn-sm">Ver detalhes</span>
    </div>
  </div>
</a>
