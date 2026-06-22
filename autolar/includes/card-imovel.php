<?php
/** Card de imóvel. Espera: $im (linha de imoveis) e opcional $capas (map id=>arquivo). */
$capaArq = $capas[$im['id']] ?? null;
$img = imagem_url($capaArq, 'imoveis');
$href = url('imovel.php?id=' . (int)$im['id']);
$ehAluguel = ($im['finalidade'] === 'aluguel');
?>
<a class="card card--imovel" href="<?= e($href) ?>">
  <div class="card-media">
    <img src="<?= e($img) ?>" alt="<?= e(($im['titulo'] ?: rotulo_tipo_imovel($im['tipo'])) . ' em ' . $im['cidade']) ?>" loading="lazy">
    <div class="card-badges">
      <span class="badge <?= $ehAluguel ? 'badge-blue' : 'badge-gold' ?>"><?= $ehAluguel ? 'Aluguel' : 'Venda' ?></span>
      <?php if (!empty($im['novo'])): ?><span class="badge badge-green">Novo</span><?php endif; ?>
    </div>
  </div>
  <div class="card-body">
    <span class="card-eyebrow"><?= e(rotulo_tipo_imovel($im['tipo'])) ?><?= $im['bairro'] ? ' · ' . e($im['bairro']) : '' ?>, <?= e($im['cidade']) ?></span>
    <h3 class="card-title"><?= e($im['titulo'] ?: (rotulo_tipo_imovel($im['tipo']) . ' em ' . $im['cidade'])) ?></h3>
    <div class="card-attrs">
      <?php if ($im['quartos']): ?><span class="card-attr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6"/><path d="M3 18h18M6 10V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3"/></svg><?= (int)$im['quartos'] ?> qts</span><?php endif; ?>
      <?php if ($im['banheiros']): ?><span class="card-attr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3Z"/><path d="M7 12V6a2 2 0 0 1 2-2"/></svg><?= (int)$im['banheiros'] ?> ban</span><?php endif; ?>
      <?php if ($im['vagas']): ?><span class="card-attr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l1-3a2 2 0 0 1 2-1h8a2 2 0 0 1 2 1l1 3"/><rect x="4" y="13" width="16" height="5" rx="1"/></svg><?= (int)$im['vagas'] ?> vagas</span><?php endif; ?>
      <?php if ($im['area']): ?><span class="card-attr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg><?= e(fmt_area($im['area'])) ?></span><?php endif; ?>
    </div>
    <div class="card-foot">
      <span class="card-price"><?= e(fmt_moeda($im['preco'])) ?><?php if ($ehAluguel): ?><small>por mês</small><?php endif; ?></span>
      <span class="btn btn-dark btn-sm">Ver detalhes</span>
    </div>
  </div>
</a>
