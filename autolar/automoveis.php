<?php
require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/includes/functions.php';

/* ----------------------------- Filtros (GET) ----------------------------- */
$f_marca   = input_str('marca');
$f_modelo  = input_str('modelo');
$f_cat     = input_enum('categoria', ['hatch','sedan','suv','picape','eletrico','utilitario','cupe','outro']);
$f_cambio  = input_enum('cambio', ['manual','automatico','automatizado','cvt']);
$f_comb    = input_enum('combustivel', ['flex','gasolina','diesel','eletrico','hibrido','gnv']);
$f_anomin  = input_int('ano_min');
$f_pmin    = input_moeda('preco_min');
$f_pmax    = input_moeda('preco_max');
$f_kmmax   = input_int('km_max');
$f_q       = input_str('q');
$f_dif     = $_GET['dif'] ?? [];
if (!is_array($f_dif)) $f_dif = [];
$f_dif = array_values(array_filter(array_map('strval', $f_dif)));

$ordemMap = [
    'recentes' => 'criado_em DESC',
    'menor'    => 'preco ASC',
    'maior'    => 'preco DESC',
    'ano'      => 'ano DESC',
    'km'       => 'km ASC',
];
$f_ordem = input_enum('ordem', array_keys($ordemMap), 'recentes');

/* ----------------------------- WHERE dinâmico ---------------------------- */
$where = ['ativo = 1'];
$params = [];
if ($f_marca !== '')  { $where[] = 'marca = ?';        $params[] = $f_marca; }
if ($f_modelo !== '') { $where[] = 'modelo LIKE ?';    $params[] = '%' . $f_modelo . '%'; }
if ($f_cat !== '')    { $where[] = 'categoria = ?';    $params[] = $f_cat; }
if ($f_cambio !== '') { $where[] = 'cambio = ?';       $params[] = $f_cambio; }
if ($f_comb !== '')   { $where[] = 'combustivel = ?';  $params[] = $f_comb; }
if ($f_anomin !== null) { $where[] = 'ano >= ?';       $params[] = $f_anomin; }
if ($f_pmin !== null) { $where[] = 'preco >= ?';       $params[] = $f_pmin; }
if ($f_pmax !== null) { $where[] = 'preco <= ?';       $params[] = $f_pmax; }
if ($f_kmmax !== null){ $where[] = 'km <= ?';          $params[] = $f_kmmax; }
if ($f_q !== '') {
    $where[] = '(marca LIKE ? OR modelo LIKE ? OR versao LIKE ?)';
    array_push($params, "%$f_q%", "%$f_q%", "%$f_q%");
}
foreach ($f_dif as $d) {
    $where[] = 'EXISTS (SELECT 1 FROM veiculo_diferenciais vd WHERE vd.veiculo_id = veiculos.id AND vd.nome = ?)';
    $params[] = $d;
}
$whereSql = implode(' AND ', $where);
$temFiltro = ($f_marca || $f_modelo || $f_cat || $f_cambio || $f_comb || $f_anomin || $f_pmin || $f_pmax || $f_kmmax || $f_q || $f_dif);

/* ----------------------------- Consulta ---------------------------------- */
$stmt = $pdo->prepare("SELECT COUNT(*) FROM veiculos WHERE $whereSql");
$stmt->execute($params);
$total = (int)$stmt->fetchColumn();

$pag = paginacao($total);
$sql = "SELECT * FROM veiculos WHERE $whereSql
        ORDER BY {$ordemMap[$f_ordem]}
        LIMIT {$pag['por_pagina']} OFFSET {$pag['offset']}";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$veiculos = $stmt->fetchAll();
$capas = capas_por_ids($pdo, 'veiculo_imagens', 'veiculo_id', array_column($veiculos, 'id'));

/* destaques (só na 1ª página sem filtros) */
$destaques = [];
if (!$temFiltro && $pag['pagina'] === 1) {
    $d = $pdo->query("SELECT * FROM veiculos WHERE ativo = 1 AND destaque = 1 AND status = 'disponivel' ORDER BY criado_em DESC LIMIT 6")->fetchAll();
    $destaques = $d;
    $capasDest = capas_por_ids($pdo, 'veiculo_imagens', 'veiculo_id', array_column($d, 'id'));
}

$marcas = valores_distintos($pdo, 'veiculos', 'marca');
$difsDisponiveis = ['Único dono','4x4','7 lugares','Teto solar','Couro','Multimídia','Blindado','Garantia de fábrica'];

$categorias = [
    ['eletrico','Carros elétricos','linear-gradient(135deg,#0ea5e9,#0369a1)'],
    ['hatch','Hatches','linear-gradient(135deg,#ef4444,#991b1b)'],
    ['picape','Picapes','linear-gradient(135deg,#78716c,#44403c)'],
    ['sedan','Sedans','linear-gradient(135deg,#334155,#0f172a)'],
    ['suv','SUVs','linear-gradient(135deg,#0d9488,#134e4a)'],
    ['utilitario','Utilitários','linear-gradient(135deg,#a16207,#713f12)'],
];

$page_titulo = 'Automóveis — ' . EMPRESA_NOME_FULL;
$page_desc   = 'Veículos selecionados para compra, venda e negociação na Autolar. SUVs, sedans, hatches, picapes e carros elétricos.';
$page_atual  = 'automoveis';
include __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <span class="watermark" aria-hidden="true">A</span>
  <div class="container">
    <div class="crumbs"><a href="<?= e(url('index.php')) ?>">Início</a> / Automóveis</div>
    <h1>Automóveis</h1>
    <p>Veículos selecionados para compra, venda e negociação.</p>
  </div>
</section>

<!-- Categorias (filtro rápido) -->
<section class="section" style="padding-bottom:0">
  <div class="container" data-cats>
    <div class="results-bar" style="margin-bottom:1rem">
      <h2 style="font-size:1.15rem">Categorias</h2>
      <span>
        <button class="pg-link" data-cats-nav="prev" aria-label="Anterior">‹</button>
        <button class="pg-link" data-cats-nav="next" aria-label="Próximo">›</button>
      </span>
    </div>
    <div class="cats-track">
      <?php foreach ($categorias as [$slug, $label, $grad]): ?>
        <a class="cat-card" style="background:<?= e($grad) ?>" href="<?= e(url('automoveis.php?categoria=' . $slug)) ?>">
          <span><?= e($label) ?></span>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<?php if ($destaques): ?>
<section class="featured">
  <div class="container">
    <div class="heading-center" style="margin-bottom:1.6rem"><h2>Melhores oportunidades</h2></div>
    <div class="cards-grid">
      <?php foreach ($destaques as $v): $capas = $capasDest; include __DIR__ . '/includes/card-veiculo.php'; endforeach; ?>
    </div>
  </div>
</section>
<?php $capas = capas_por_ids($pdo, 'veiculo_imagens', 'veiculo_id', array_column($veiculos, 'id')); endif; ?>

<!-- Catálogo -->
<section class="section catalog">
  <div class="container">
    <div class="catalog-layout">

      <!-- Sidebar de filtros -->
      <aside class="filters" id="filtros">
        <h3>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5h18M6 12h12M10 19h4"/></svg>
          Filtrar
        </h3>
        <form method="get" action="<?= e(url('automoveis.php')) ?>">
          <input type="hidden" name="ordem" value="<?= e($f_ordem) ?>">

          <div class="filter-group">
            <label class="flabel" for="q">Busca</label>
            <input type="text" id="q" name="q" value="<?= e($f_q) ?>" placeholder="Marca, modelo…">
          </div>

          <div class="filter-group">
            <label class="flabel" for="marca">Marca</label>
            <select id="marca" name="marca">
              <option value="">Todas</option>
              <?php foreach ($marcas as $m): ?>
                <option value="<?= e($m) ?>" <?= $f_marca === $m ? 'selected' : '' ?>><?= e($m) ?></option>
              <?php endforeach; ?>
            </select>
          </div>

          <div class="filter-group">
            <label class="flabel" for="modelo">Modelo</label>
            <input type="text" id="modelo" name="modelo" value="<?= e($f_modelo) ?>" placeholder="Ex.: Creta">
          </div>

          <div class="filter-group">
            <label class="flabel">Faixa de preço (R$)</label>
            <div class="filter-row">
              <input type="text" inputmode="numeric" data-mask="money" name="preco_min" value="<?= $f_pmin !== null ? e(number_format($f_pmin,0,',','.')) : '' ?>" placeholder="Mín.">
              <input type="text" inputmode="numeric" data-mask="money" name="preco_max" value="<?= $f_pmax !== null ? e(number_format($f_pmax,0,',','.')) : '' ?>" placeholder="Máx.">
            </div>
          </div>

          <div class="filter-group">
            <label class="flabel">Ano e KM</label>
            <div class="filter-row">
              <input type="number" name="ano_min" value="<?= $f_anomin !== null ? (int)$f_anomin : '' ?>" placeholder="Ano a partir de">
              <input type="number" name="km_max" value="<?= $f_kmmax !== null ? (int)$f_kmmax : '' ?>" placeholder="KM até">
            </div>
          </div>

          <div class="filter-group">
            <label class="flabel" for="cambio">Câmbio</label>
            <select id="cambio" name="cambio">
              <option value="">Qualquer</option>
              <?php foreach (['manual','automatico','automatizado','cvt'] as $c): ?>
                <option value="<?= $c ?>" <?= $f_cambio === $c ? 'selected' : '' ?>><?= e(rotulo_cambio($c)) ?></option>
              <?php endforeach; ?>
            </select>
          </div>

          <div class="filter-group">
            <label class="flabel" for="combustivel">Combustível</label>
            <select id="combustivel" name="combustivel">
              <option value="">Qualquer</option>
              <?php foreach (['flex','gasolina','diesel','eletrico','hibrido','gnv'] as $c): ?>
                <option value="<?= $c ?>" <?= $f_comb === $c ? 'selected' : '' ?>><?= e(rotulo_combustivel($c)) ?></option>
              <?php endforeach; ?>
            </select>
          </div>

          <div class="filter-group">
            <label class="flabel">Diferenciais</label>
            <div class="check-list">
              <?php foreach ($difsDisponiveis as $d): ?>
                <label class="check"><input type="checkbox" name="dif[]" value="<?= e($d) ?>" <?= in_array($d, $f_dif, true) ? 'checked' : '' ?>> <?= e($d) ?></label>
              <?php endforeach; ?>
            </div>
          </div>

          <div class="filter-actions">
            <button type="submit" class="btn btn-gold btn-block">Aplicar filtros</button>
            <a class="btn btn-outline-gold btn-block" href="<?= e(url('automoveis.php')) ?>">Limpar</a>
          </div>
        </form>
      </aside>

      <!-- Resultados -->
      <div>
        <div class="results-bar">
          <span class="count"><b><?= $total ?></b> veículo<?= $total === 1 ? '' : 's' ?> encontrado<?= $total === 1 ? '' : 's' ?></span>
          <span style="display:flex;gap:.6rem;align-items:center">
            <button class="btn btn-outline-gold btn-sm filters-toggle" type="button">Filtros</button>
            <select onchange="if(this.value)location.href=this.value" style="padding:.5rem .8rem;border:1.5px solid var(--line);border-radius:10px">
              <option value="<?= e(qs_merge(['ordem'=>'recentes','pg'=>null])) ?>" <?= $f_ordem==='recentes'?'selected':'' ?>>Mais recentes</option>
              <option value="<?= e(qs_merge(['ordem'=>'menor','pg'=>null])) ?>" <?= $f_ordem==='menor'?'selected':'' ?>>Menor preço</option>
              <option value="<?= e(qs_merge(['ordem'=>'maior','pg'=>null])) ?>" <?= $f_ordem==='maior'?'selected':'' ?>>Maior preço</option>
              <option value="<?= e(qs_merge(['ordem'=>'ano','pg'=>null])) ?>" <?= $f_ordem==='ano'?'selected':'' ?>>Ano mais novo</option>
              <option value="<?= e(qs_merge(['ordem'=>'km','pg'=>null])) ?>" <?= $f_ordem==='km'?'selected':'' ?>>Menor KM</option>
            </select>
          </span>
        </div>

        <?php if ($veiculos): ?>
          <div class="cards-grid">
            <?php foreach ($veiculos as $v): include __DIR__ . '/includes/card-veiculo.php'; endforeach; ?>
          </div>
          <?= render_paginacao($pag) ?>
        <?php else: ?>
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <h3>Nenhum veículo encontrado</h3>
            <p>Tente ajustar os filtros ou <a href="<?= e(url('automoveis.php')) ?>" style="color:var(--gold)">limpar a busca</a>.</p>
          </div>
        <?php endif; ?>
      </div>

    </div>
  </div>
</section>

<?php include __DIR__ . '/includes/footer.php'; ?>
