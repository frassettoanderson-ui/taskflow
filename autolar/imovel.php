<?php
require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/includes/functions.php';

$id = input_int('id', 0);
$stmt = $pdo->prepare('SELECT * FROM imoveis WHERE id = ? AND ativo = 1');
$stmt->execute([$id]);
$im = $stmt->fetch();

if (!$im) {
    http_response_code(404);
    $page_titulo = 'Imóvel não encontrado — ' . EMPRESA_NOME;
    include __DIR__ . '/includes/header.php';
    echo '<section class="section"><div class="container empty-state"><h3>Imóvel não encontrado</h3><p>Este anúncio pode ter sido negociado ou removido.</p><a class="btn btn-gold mt-2" href="' . e(url('imoveis.php')) . '">Ver todos os imóveis</a></div></section>';
    include __DIR__ . '/includes/footer.php';
    exit;
}

$imagens = imagens_do_registro($pdo, 'imovel_imagens', 'imovel_id', $id);
$difs    = diferenciais_do_registro($pdo, 'imovel_diferenciais', 'imovel_id', $id);
$capaUrl = imagem_capa($imagens, 'imoveis');

$titulo  = $im['titulo'] ?: (rotulo_tipo_imovel($im['tipo']) . ' em ' . $im['cidade']);
$ehAlug  = ($im['finalidade'] === 'aluguel');
$local   = trim(($im['bairro'] ? $im['bairro'] . ', ' : '') . $im['cidade']);
$msgWa   = "Olá! Tenho interesse no imóvel \"{$titulo}\" ({$local}) — " . fmt_moeda($im['preco'])
         . ($ehAlug ? '/mês' : '') . ' anunciado no site. Podemos conversar?';

$rel = $pdo->prepare("SELECT * FROM imoveis WHERE ativo=1 AND id<>? AND cidade=? AND finalidade=? ORDER BY destaque DESC, criado_em DESC LIMIT 3");
$rel->execute([$id, $im['cidade'], $im['finalidade']]);
$semelhantes = $rel->fetchAll();
$capas = capas_por_ids($pdo, 'imovel_imagens', 'imovel_id', array_column($semelhantes, 'id'));

$page_titulo = $titulo . ' — ' . EMPRESA_NOME;
$page_desc   = "$titulo. " . fmt_moeda($im['preco']) . ($ehAlug ? '/mês' : '') . ' na Autolar Imóveis.';
$page_atual  = 'imoveis';
include __DIR__ . '/includes/header.php';
?>

<section class="section catalog" style="padding-top:2rem">
  <div class="container">
    <div class="crumbs" style="color:var(--slate-500);font-size:.85rem;margin-bottom:1.2rem">
      <a href="<?= e(url('index.php')) ?>">Início</a> /
      <a href="<?= e(url('imoveis.php')) ?>">Imóveis</a> /
      <?= e($titulo) ?>
    </div>

    <div class="detail-layout">

      <div class="gallery" data-gallery>
        <div class="gallery-main">
          <div class="gallery-badges">
            <span class="badge <?= $ehAlug ? 'badge-blue':'badge-gold' ?>"><?= $ehAlug ? 'Aluguel' : 'Venda' ?></span>
            <?php if (!empty($im['novo'])): ?><span class="badge badge-green">Novo</span><?php endif; ?>
            <?php if ($im['status'] !== 'disponivel'): ?><span class="badge badge-dark"><?= e(rotulo_status_imovel($im['status'])) ?></span><?php endif; ?>
          </div>
          <img data-gallery-main src="<?= e($capaUrl) ?>" alt="<?= e($titulo) ?>">
          <?php if (count($imagens) > 1): ?>
            <button class="gallery-nav prev" data-gallery-prev aria-label="Anterior">‹</button>
            <button class="gallery-nav next" data-gallery-next aria-label="Próximo">›</button>
          <?php endif; ?>
        </div>
        <?php if ($imagens): ?>
        <div class="gallery-thumbs">
          <?php foreach ($imagens as $i => $img): $u = imagem_url($img['arquivo'], 'imoveis'); ?>
            <img data-gallery-thumb data-full="<?= e($u) ?>" src="<?= e($u) ?>" class="<?= $i===0?'is-active':'' ?>" alt="Foto <?= $i+1 ?>">
          <?php endforeach; ?>
        </div>
        <?php endif; ?>

        <div class="detail-section">
          <h2><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V8l7-4 7 4v13"/><path d="M9 21v-6h6v6"/></svg> Características</h2>
          <div class="spec-grid">
            <div class="spec"><div class="k">Tipo</div><div class="v"><?= e(rotulo_tipo_imovel($im['tipo'])) ?></div></div>
            <div class="spec"><div class="k">Finalidade</div><div class="v"><?= $ehAlug ? 'Aluguel' : 'Venda' ?></div></div>
            <div class="spec"><div class="k">Cidade</div><div class="v"><?= e($im['cidade']) ?></div></div>
            <?php if ($im['bairro']): ?><div class="spec"><div class="k">Bairro</div><div class="v"><?= e($im['bairro']) ?></div></div><?php endif; ?>
            <?php if ($im['quartos']): ?><div class="spec"><div class="k">Quartos</div><div class="v"><?= (int)$im['quartos'] ?><?= $im['suites'] ? ' (' . (int)$im['suites'] . ' suíte' . ($im['suites']>1?'s':'') . ')' : '' ?></div></div><?php endif; ?>
            <?php if ($im['banheiros']): ?><div class="spec"><div class="k">Banheiros</div><div class="v"><?= (int)$im['banheiros'] ?></div></div><?php endif; ?>
            <?php if ($im['vagas']): ?><div class="spec"><div class="k">Vagas</div><div class="v"><?= (int)$im['vagas'] ?></div></div><?php endif; ?>
            <?php if ($im['area']): ?><div class="spec"><div class="k">Área útil</div><div class="v"><?= e(fmt_area($im['area'])) ?></div></div><?php endif; ?>
            <?php if ($im['area_total']): ?><div class="spec"><div class="k">Área total</div><div class="v"><?= e(fmt_area($im['area_total'])) ?></div></div><?php endif; ?>
            <?php if ($im['condominio']): ?><div class="spec"><div class="k">Condomínio</div><div class="v"><?= e(fmt_moeda($im['condominio'])) ?>/mês</div></div><?php endif; ?>
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

        <?php if ($im['descricao']): ?>
        <div class="detail-section">
          <h2><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg> Descrição</h2>
          <p class="detail-desc"><?= e($im['descricao']) ?></p>
        </div>
        <?php endif; ?>

        <?php if ($im['endereco']): ?>
        <div class="detail-section">
          <h2><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg> Localização</h2>
          <p class="detail-desc"><?= e($im['endereco']) ?> — <?= e($local) ?></p>
        </div>
        <?php endif; ?>
      </div>

      <aside class="detail-aside">
        <div class="detail-card imovel">
          <span class="eyebrow"><?= e(rotulo_tipo_imovel($im['tipo'])) ?> · <?= $ehAlug ? 'Aluguel' : 'Venda' ?></span>
          <h1><?= e($titulo) ?></h1>
          <div class="loc"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg> <?= e($local) ?></div>
          <div class="detail-price"><?= e(fmt_moeda($im['preco'])) ?><?php if ($ehAlug): ?><span style="font-size:1rem;color:var(--slate-500);font-weight:600">/mês</span><?php endif; ?></div>

          <div class="detail-actions">
            <a class="btn btn-wa btn-lg btn-block" href="<?= e(whatsapp_link($msgWa)) ?>" target="_blank" rel="noopener">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Z"/></svg>
              Tenho interesse
            </a>
            <a class="btn btn-dark btn-block" href="tel:<?= preg_replace('/\D/','',CONTATO_TELEFONE) ?>">Ligar agora</a>
          </div>

          <div class="spec-grid" style="margin-bottom:0">
            <?php if ($im['quartos']): ?><div class="spec"><div class="k">Quartos</div><div class="v"><?= (int)$im['quartos'] ?></div></div><?php endif; ?>
            <?php if ($im['banheiros']): ?><div class="spec"><div class="k">Banheiros</div><div class="v"><?= (int)$im['banheiros'] ?></div></div><?php endif; ?>
            <?php if ($im['vagas']): ?><div class="spec"><div class="k">Vagas</div><div class="v"><?= (int)$im['vagas'] ?></div></div><?php endif; ?>
            <?php if ($im['area']): ?><div class="spec"><div class="k">Área</div><div class="v"><?= e(fmt_area($im['area'])) ?></div></div><?php endif; ?>
          </div>
        </div>
      </aside>

    </div>

    <?php if ($semelhantes): ?>
    <div class="detail-section" style="margin-top:3.5rem">
      <div class="heading-center" style="margin-bottom:1.6rem"><h2>Imóveis semelhantes</h2></div>
      <div class="cards-grid cards-grid--wide">
        <?php foreach ($semelhantes as $im): include __DIR__ . '/includes/card-imovel.php'; endforeach; ?>
      </div>
    </div>
    <?php endif; ?>
  </div>
</section>

<?php include __DIR__ . '/includes/footer.php'; ?>
