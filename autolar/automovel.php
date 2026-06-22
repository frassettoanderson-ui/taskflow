<?php
require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/includes/functions.php';

$id = input_int('id', 0);
$stmt = $pdo->prepare('SELECT * FROM veiculos WHERE id = ? AND ativo = 1');
$stmt->execute([$id]);
$v = $stmt->fetch();

if (!$v) {
    http_response_code(404);
    $page_titulo = 'Veículo não encontrado — ' . EMPRESA_NOME;
    include __DIR__ . '/includes/header.php';
    echo '<section class="section"><div class="container empty-state"><h3>Veículo não encontrado</h3><p>Este anúncio pode ter sido vendido ou removido.</p><a class="btn btn-gold mt-2" href="' . e(url('automoveis.php')) . '">Ver todos os veículos</a></div></section>';
    include __DIR__ . '/includes/footer.php';
    exit;
}

$imagens = imagens_do_registro($pdo, 'veiculo_imagens', 'veiculo_id', $id);
$difs    = diferenciais_do_registro($pdo, 'veiculo_diferenciais', 'veiculo_id', $id);
$capaUrl = imagem_capa($imagens, 'veiculos');

$titulo = trim($v['marca'] . ' ' . $v['modelo']);
$msgWa = "Olá! Tenho interesse no veículo {$titulo} " . (int)$v['ano']
       . ' (' . fmt_moeda($v['preco']) . ') anunciado no site. Ainda está disponível?';

/* semelhantes */
$rel = $pdo->prepare("SELECT * FROM veiculos WHERE ativo=1 AND id<>? AND categoria=? ORDER BY destaque DESC, criado_em DESC LIMIT 3");
$rel->execute([$id, $v['categoria']]);
$semelhantes = $rel->fetchAll();
$capas = capas_por_ids($pdo, 'veiculo_imagens', 'veiculo_id', array_column($semelhantes, 'id'));

$page_titulo = $titulo . ' ' . (int)$v['ano'] . ' — ' . EMPRESA_NOME;
$page_desc   = "$titulo {$v['ano']}, " . fmt_km($v['km']) . ', ' . rotulo_cambio($v['cambio']) . '. ' . fmt_moeda($v['preco']) . ' na Autolar.';
$page_atual  = 'automoveis';
include __DIR__ . '/includes/header.php';
?>

<section class="section catalog" style="padding-top:2rem">
  <div class="container">
    <div class="crumbs" style="color:var(--slate-500);font-size:.85rem;margin-bottom:1.2rem">
      <a href="<?= e(url('index.php')) ?>">Início</a> /
      <a href="<?= e(url('automoveis.php')) ?>">Automóveis</a> /
      <?= e($titulo) ?>
    </div>

    <div class="detail-layout">

      <!-- Galeria -->
      <div class="gallery" data-gallery>
        <div class="gallery-main">
          <div class="gallery-badges">
            <?php if (!empty($v['destaque'])): ?><span class="badge badge-gold">Destaque</span><?php endif; ?>
            <?php if ($v['status'] !== 'disponivel'): ?><span class="badge <?= $v['status']==='vendido'?'badge-dark':'badge-amber' ?>"><?= e(rotulo_status_veic($v['status'])) ?></span><?php endif; ?>
          </div>
          <img data-gallery-main src="<?= e($capaUrl) ?>" alt="<?= e($titulo) ?>">
          <?php if (count($imagens) > 1): ?>
            <button class="gallery-nav prev" data-gallery-prev aria-label="Anterior">‹</button>
            <button class="gallery-nav next" data-gallery-next aria-label="Próximo">›</button>
          <?php endif; ?>
        </div>
        <?php if ($imagens): ?>
        <div class="gallery-thumbs">
          <?php foreach ($imagens as $i => $img): $u = imagem_url($img['arquivo'], 'veiculos'); ?>
            <img data-gallery-thumb data-full="<?= e($u) ?>" src="<?= e($u) ?>" class="<?= $i===0?'is-active':'' ?>" alt="Foto <?= $i+1 ?>">
          <?php endforeach; ?>
        </div>
        <?php endif; ?>

        <!-- Ficha técnica -->
        <div class="detail-section">
          <h2><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3h6l1 4-2 1v13H10V8L8 7z"/></svg> Ficha técnica</h2>
          <div class="spec-grid">
            <div class="spec"><div class="k">Marca</div><div class="v"><?= e($v['marca']) ?></div></div>
            <div class="spec"><div class="k">Modelo</div><div class="v"><?= e($v['modelo']) ?></div></div>
            <?php if ($v['versao']): ?><div class="spec"><div class="k">Versão</div><div class="v"><?= e($v['versao']) ?></div></div><?php endif; ?>
            <div class="spec"><div class="k">Ano</div><div class="v"><?= (int)$v['ano'] ?><?= $v['ano_modelo'] ? '/' . (int)$v['ano_modelo'] : '' ?></div></div>
            <div class="spec"><div class="k">Quilometragem</div><div class="v"><?= e(fmt_km($v['km'])) ?></div></div>
            <div class="spec"><div class="k">Câmbio</div><div class="v"><?= e(rotulo_cambio($v['cambio'])) ?></div></div>
            <div class="spec"><div class="k">Combustível</div><div class="v"><?= e(rotulo_combustivel($v['combustivel'])) ?></div></div>
            <?php if ($v['cor']): ?><div class="spec"><div class="k">Cor</div><div class="v"><?= e($v['cor']) ?></div></div><?php endif; ?>
            <?php if ($v['portas']): ?><div class="spec"><div class="k">Portas</div><div class="v"><?= (int)$v['portas'] ?></div></div><?php endif; ?>
            <div class="spec"><div class="k">Categoria</div><div class="v"><?= e(rotulo_categoria_veic($v['categoria'])) ?></div></div>
          </div>
        </div>

        <?php if ($difs): ?>
        <div class="detail-section">
          <h2><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg> Diferenciais</h2>
          <div class="tags">
            <?php foreach ($difs as $d): ?>
              <span class="tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 5 5 9-11"/></svg><?= e($d) ?></span>
            <?php endforeach; ?>
          </div>
        </div>
        <?php endif; ?>

        <?php if ($v['descricao']): ?>
        <div class="detail-section">
          <h2><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg> Descrição</h2>
          <p class="detail-desc"><?= e($v['descricao']) ?></p>
        </div>
        <?php endif; ?>
      </div>

      <!-- Aside -->
      <aside class="detail-aside">
        <div class="detail-card">
          <span class="eyebrow"><?= e($v['marca']) ?> · <?= (int)$v['ano'] ?></span>
          <h1><?= e($v['modelo']) ?></h1>
          <?php if ($v['versao']): ?><div class="loc"><?= e($v['versao']) ?></div><?php endif; ?>
          <div class="detail-price"><?= e(fmt_moeda($v['preco'])) ?></div>

          <div class="detail-actions">
            <a class="btn btn-wa btn-lg btn-block" href="<?= e(whatsapp_link($msgWa)) ?>" target="_blank" rel="noopener">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Z"/></svg>
              Tenho interesse
            </a>
            <a class="btn btn-dark btn-block" href="tel:<?= preg_replace('/\D/','',CONTATO_TELEFONE) ?>">Ligar agora</a>
          </div>

          <div class="spec-grid" style="margin-bottom:0">
            <div class="spec"><div class="k">Ano</div><div class="v"><?= (int)$v['ano'] ?></div></div>
            <div class="spec"><div class="k">KM</div><div class="v"><?= e(fmt_km($v['km'])) ?></div></div>
            <div class="spec"><div class="k">Câmbio</div><div class="v"><?= e(rotulo_cambio($v['cambio'])) ?></div></div>
            <div class="spec"><div class="k">Combustível</div><div class="v"><?= e(rotulo_combustivel($v['combustivel'])) ?></div></div>
          </div>
        </div>
      </aside>

    </div>

    <?php if ($semelhantes): ?>
    <div class="detail-section" style="margin-top:3.5rem">
      <div class="heading-center" style="margin-bottom:1.6rem"><h2>Veículos semelhantes</h2></div>
      <div class="cards-grid">
        <?php foreach ($semelhantes as $v): include __DIR__ . '/includes/card-veiculo.php'; endforeach; ?>
      </div>
    </div>
    <?php endif; ?>
  </div>
</section>

<?php include __DIR__ . '/includes/footer.php'; ?>
