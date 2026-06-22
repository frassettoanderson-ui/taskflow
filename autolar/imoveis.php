<?php
require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/includes/functions.php';

/* ----------------------------- Filtros (GET) ----------------------------- */
$f_fin     = input_enum('finalidade', ['venda','aluguel']);
$f_tipo    = input_enum('tipo', ['casa','apartamento','terreno','comercial','sitio','sobrado']);
$f_cidade  = input_str('cidade');
$f_bairro  = input_str('bairro');
$f_pmin    = input_moeda('preco_min');
$f_pmax    = input_moeda('preco_max');
$f_quartos = input_int('quartos');
$f_banh    = input_int('banheiros');
$f_vagas   = input_int('vagas');
$f_areamin = input_float('area_min');
$f_q       = input_str('q');
$f_dif     = $_GET['dif'] ?? [];
if (!is_array($f_dif)) $f_dif = [];
$f_dif = array_values(array_filter(array_map('strval', $f_dif)));

$ordemMap = [
    'recentes' => 'criado_em DESC',
    'menor'    => 'preco ASC',
    'maior'    => 'preco DESC',
    'area'     => 'area DESC',
];
$f_ordem = input_enum('ordem', array_keys($ordemMap), 'recentes');

/* ----------------------------- WHERE dinâmico ---------------------------- */
$where = ['ativo = 1'];
$params = [];
if ($f_fin !== '')    { $where[] = 'finalidade = ?'; $params[] = $f_fin; }
if ($f_tipo !== '')   { $where[] = 'tipo = ?';       $params[] = $f_tipo; }
if ($f_cidade !== '') { $where[] = 'cidade = ?';     $params[] = $f_cidade; }
if ($f_bairro !== '') { $where[] = 'bairro = ?';     $params[] = $f_bairro; }
if ($f_pmin !== null) { $where[] = 'preco >= ?';     $params[] = $f_pmin; }
if ($f_pmax !== null) { $where[] = 'preco <= ?';     $params[] = $f_pmax; }
if ($f_quartos !== null) { $where[] = 'quartos >= ?'; $params[] = $f_quartos; }
if ($f_banh !== null) { $where[] = 'banheiros >= ?'; $params[] = $f_banh; }
if ($f_vagas !== null){ $where[] = 'vagas >= ?';     $params[] = $f_vagas; }
if ($f_areamin !== null) { $where[] = 'area >= ?';   $params[] = $f_areamin; }
if ($f_q !== '') {
    $where[] = '(titulo LIKE ? OR cidade LIKE ? OR bairro LIKE ?)';
    array_push($params, "%$f_q%", "%$f_q%", "%$f_q%");
}
foreach ($f_dif as $d) {
    $where[] = 'EXISTS (SELECT 1 FROM imovel_diferenciais idf WHERE idf.imovel_id = imoveis.id AND idf.nome = ?)';
    $params[] = $d;
}
$whereSql = implode(' AND ', $where);
$temFiltro = ($f_fin || $f_tipo || $f_cidade || $f_bairro || $f_pmin || $f_pmax || $f_quartos || $f_banh || $f_vagas || $f_areamin || $f_q || $f_dif);

/* ----------------------------- Consulta ---------------------------------- */
$stmt = $pdo->prepare("SELECT COUNT(*) FROM imoveis WHERE $whereSql");
$stmt->execute($params);
$total = (int)$stmt->fetchColumn();

$pag = paginacao($total);
$sql = "SELECT * FROM imoveis WHERE $whereSql ORDER BY {$ordemMap[$f_ordem]} LIMIT {$pag['por_pagina']} OFFSET {$pag['offset']}";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$imoveis = $stmt->fetchAll();
$capas = capas_por_ids($pdo, 'imovel_imagens', 'imovel_id', array_column($imoveis, 'id'));

/* destaques */
$destaques = [];
if (!$temFiltro && $pag['pagina'] === 1) {
    $d = $pdo->query("SELECT * FROM imoveis WHERE ativo=1 AND destaque=1 AND status='disponivel' ORDER BY criado_em DESC LIMIT 4")->fetchAll();
    $destaques = $d;
    $capasDest = capas_por_ids($pdo, 'imovel_imagens', 'imovel_id', array_column($d, 'id'));
}

$cidades = valores_distintos($pdo, 'imoveis', 'cidade');
/* bairros dependentes da cidade selecionada */
if ($f_cidade !== '') {
    $bst = $pdo->prepare("SELECT DISTINCT bairro AS v FROM imoveis WHERE ativo=1 AND cidade=? AND bairro IS NOT NULL AND bairro<>'' ORDER BY bairro");
    $bst->execute([$f_cidade]);
    $bairros = array_column($bst->fetchAll(), 'v');
} else {
    $bairros = valores_distintos($pdo, 'imoveis', 'bairro');
}
$difsDisponiveis = ['Piscina','Mobiliado','Condomínio fechado','Churrasqueira','Área gourmet','Vista para o mar','Academia','Jardim','Alto padrão'];

$page_titulo = 'Imóveis — ' . EMPRESA_NOME_FULL;
$page_desc   = 'Casas, apartamentos, terrenos e oportunidades para morar ou investir com a Autolar.';
$page_atual  = 'imoveis';
include __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <span class="watermark" aria-hidden="true">A</span>
  <div class="container">
    <div class="crumbs"><a href="<?= e(url('index.php')) ?>">Início</a> / Imóveis</div>
    <h1>Imóveis</h1>
    <p>Casas, apartamentos, terrenos e oportunidades para você viver ou investir.</p>
  </div>
</section>

<!-- Tabs Comprar/Alugar -->
<section class="section" style="padding-bottom:0">
  <div class="container text-center">
    <div class="tabs tabs--blue">
      <a href="<?= e(qs_merge(['finalidade'=>null,'pg'=>null])) ?>" class="<?= $f_fin===''?'is-active':'' ?>">Todos</a>
      <a href="<?= e(qs_merge(['finalidade'=>'venda','pg'=>null])) ?>" class="<?= $f_fin==='venda'?'is-active':'' ?>">Comprar</a>
      <a href="<?= e(qs_merge(['finalidade'=>'aluguel','pg'=>null])) ?>" class="<?= $f_fin==='aluguel'?'is-active':'' ?>">Alugar</a>
    </div>
  </div>
</section>

<?php if ($destaques): ?>
<section class="featured">
  <div class="container">
    <div class="heading-center" style="margin-bottom:1.6rem"><h2>Destaques da semana</h2></div>
    <div class="cards-grid cards-grid--wide">
      <?php foreach ($destaques as $im): $capas = $capasDest; include __DIR__ . '/includes/card-imovel.php'; endforeach; ?>
    </div>
  </div>
</section>
<?php $capas = capas_por_ids($pdo, 'imovel_imagens', 'imovel_id', array_column($imoveis, 'id')); endif; ?>

<!-- Catálogo -->
<section class="section catalog">
  <div class="container">
    <div class="catalog-layout">

      <aside class="filters" id="filtros">
        <h3><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5h18M6 12h12M10 19h4"/></svg> Filtrar</h3>
        <form method="get" action="<?= e(url('imoveis.php')) ?>">
          <input type="hidden" name="ordem" value="<?= e($f_ordem) ?>">
          <?php if ($f_fin !== ''): ?><input type="hidden" name="finalidade" value="<?= e($f_fin) ?>"><?php endif; ?>

          <div class="filter-group">
            <label class="flabel" for="q">Busca</label>
            <input type="text" id="q" name="q" value="<?= e($f_q) ?>" placeholder="Bairro, cidade, título…">
          </div>

          <div class="filter-group">
            <label class="flabel" for="tipo">Tipo de imóvel</label>
            <select id="tipo" name="tipo">
              <option value="">Todos</option>
              <?php foreach (['casa','apartamento','sobrado','terreno','comercial','sitio'] as $t): ?>
                <option value="<?= $t ?>" <?= $f_tipo===$t?'selected':'' ?>><?= e(rotulo_tipo_imovel($t)) ?></option>
              <?php endforeach; ?>
            </select>
          </div>

          <div class="filter-group">
            <label class="flabel" for="cidade">Cidade</label>
            <select id="cidade" name="cidade">
              <option value="">Todas</option>
              <?php foreach ($cidades as $c): ?>
                <option value="<?= e($c) ?>" <?= $f_cidade===$c?'selected':'' ?>><?= e($c) ?></option>
              <?php endforeach; ?>
            </select>
          </div>

          <div class="filter-group">
            <label class="flabel" for="bairro">Bairro</label>
            <select id="bairro" name="bairro">
              <option value="">Todos</option>
              <?php foreach ($bairros as $b): ?>
                <option value="<?= e($b) ?>" <?= $f_bairro===$b?'selected':'' ?>><?= e($b) ?></option>
              <?php endforeach; ?>
            </select>
          </div>

          <div class="filter-group">
            <label class="flabel">Faixa de valor (R$)</label>
            <div class="filter-row">
              <input type="text" inputmode="numeric" data-mask="money" name="preco_min" value="<?= $f_pmin !== null ? e(number_format($f_pmin,0,',','.')) : '' ?>" placeholder="Mín.">
              <input type="text" inputmode="numeric" data-mask="money" name="preco_max" value="<?= $f_pmax !== null ? e(number_format($f_pmax,0,',','.')) : '' ?>" placeholder="Máx.">
            </div>
          </div>

          <div class="filter-group">
            <label class="flabel">Cômodos (a partir de)</label>
            <div class="filter-row">
              <select name="quartos"><option value="">Quartos</option><?php for($i=1;$i<=5;$i++):?><option value="<?=$i?>" <?=$f_quartos===$i?'selected':''?>><?=$i?>+ qts</option><?php endfor;?></select>
              <select name="banheiros"><option value="">Banheiros</option><?php for($i=1;$i<=5;$i++):?><option value="<?=$i?>" <?=$f_banh===$i?'selected':''?>><?=$i?>+ ban</option><?php endfor;?></select>
            </div>
            <div class="filter-row" style="margin-top:.55rem">
              <select name="vagas"><option value="">Vagas</option><?php for($i=1;$i<=5;$i++):?><option value="<?=$i?>" <?=$f_vagas===$i?'selected':''?>><?=$i?>+ vagas</option><?php endfor;?></select>
              <input type="number" name="area_min" value="<?= $f_areamin !== null ? (int)$f_areamin : '' ?>" placeholder="Área mín. m²">
            </div>
          </div>

          <div class="filter-group">
            <label class="flabel">Diferenciais</label>
            <div class="check-list">
              <?php foreach ($difsDisponiveis as $d): ?>
                <label class="check"><input type="checkbox" name="dif[]" value="<?= e($d) ?>" <?= in_array($d, $f_dif, true)?'checked':'' ?>> <?= e($d) ?></label>
              <?php endforeach; ?>
            </div>
          </div>

          <div class="filter-actions">
            <button type="submit" class="btn btn-blue btn-block">Aplicar filtros</button>
            <a class="btn btn-outline-gold btn-block" href="<?= e(url('imoveis.php')) ?>">Limpar</a>
          </div>
        </form>
      </aside>

      <div>
        <div class="results-bar">
          <span class="count"><b><?= $total ?></b> imóve<?= $total === 1 ? 'l' : 'is' ?> encontrado<?= $total === 1 ? '' : 's' ?></span>
          <span style="display:flex;gap:.6rem;align-items:center">
            <button class="btn btn-outline-gold btn-sm filters-toggle" type="button">Filtros</button>
            <select onchange="if(this.value)location.href=this.value" style="padding:.5rem .8rem;border:1.5px solid var(--line);border-radius:10px">
              <option value="<?= e(qs_merge(['ordem'=>'recentes','pg'=>null])) ?>" <?= $f_ordem==='recentes'?'selected':'' ?>>Mais recentes</option>
              <option value="<?= e(qs_merge(['ordem'=>'menor','pg'=>null])) ?>" <?= $f_ordem==='menor'?'selected':'' ?>>Menor valor</option>
              <option value="<?= e(qs_merge(['ordem'=>'maior','pg'=>null])) ?>" <?= $f_ordem==='maior'?'selected':'' ?>>Maior valor</option>
              <option value="<?= e(qs_merge(['ordem'=>'area','pg'=>null])) ?>" <?= $f_ordem==='area'?'selected':'' ?>>Maior área</option>
            </select>
          </span>
        </div>

        <?php if ($imoveis): ?>
          <div class="cards-grid cards-grid--wide">
            <?php foreach ($imoveis as $im): include __DIR__ . '/includes/card-imovel.php'; endforeach; ?>
          </div>
          <?= render_paginacao($pag) ?>
        <?php else: ?>
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <h3>Nenhum imóvel encontrado</h3>
            <p>Tente ajustar os filtros ou <a href="<?= e(url('imoveis.php')) ?>" style="color:var(--gold)">limpar a busca</a>.</p>
          </div>
        <?php endif; ?>
      </div>

    </div>
  </div>
</section>

<?php include __DIR__ . '/includes/footer.php'; ?>
