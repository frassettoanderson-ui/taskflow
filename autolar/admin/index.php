<?php
require __DIR__ . '/auth-check.php';

$totVeic   = contar($pdo, 'SELECT COUNT(*) FROM veiculos');
$totImov   = contar($pdo, 'SELECT COUNT(*) FROM imoveis');
$destVeic  = contar($pdo, 'SELECT COUNT(*) FROM veiculos WHERE destaque=1 AND ativo=1');
$destImov  = contar($pdo, 'SELECT COUNT(*) FROM imoveis WHERE destaque=1 AND ativo=1');
$dispVeic  = contar($pdo, "SELECT COUNT(*) FROM veiculos WHERE status='disponivel' AND ativo=1");
$dispImov  = contar($pdo, "SELECT COUNT(*) FROM imoveis WHERE status='disponivel' AND ativo=1");
$msgNaoLid = contar($pdo, 'SELECT COUNT(*) FROM mensagens WHERE lida=0');
$msgTotal  = contar($pdo, 'SELECT COUNT(*) FROM mensagens');

$admin_titulo = 'Dashboard';
$admin_sub = 'Visão geral da loja Autolar';
$admin_atual = 'dashboard';
include __DIR__ . '/includes/admin-header.php';
?>

<div class="stat-grid">
  <div class="stat gold">
    <div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12l1.6-4.6A2.5 2.5 0 0 1 8 6h8a2.5 2.5 0 0 1 2.4 1.4L20 12"/><path d="M3 12h18v5H2v-5z"/><circle cx="6.5" cy="17.5" r="1.4"/><circle cx="17.5" cy="17.5" r="1.4"/></svg></div>
    <div class="n"><?= $totVeic ?></div><div class="l">Veículos cadastrados</div>
  </div>
  <div class="stat blue">
    <div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/></svg></div>
    <div class="n"><?= $totImov ?></div><div class="l">Imóveis cadastrados</div>
  </div>
  <div class="stat green">
    <div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 21l-4.9-2.8.9-5.5-4-3.9 5.5-.8z"/></svg></div>
    <div class="n"><?= $destVeic + $destImov ?></div><div class="l">Em destaque</div>
  </div>
  <div class="stat red">
    <div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v12H7l-3 3V5z"/></svg></div>
    <div class="n"><?= $msgNaoLid ?></div><div class="l">Mensagens não lidas</div>
  </div>
</div>

<div class="split">
  <!-- Gerenciar Automóveis -->
  <section class="panel">
    <div class="panel-head gold">
      <span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12l1.6-4.6A2.5 2.5 0 0 1 8 6h8a2.5 2.5 0 0 1 2.4 1.4L20 12"/><path d="M3 12h18v5H2v-5z"/><circle cx="6.5" cy="17.5" r="1.4"/><circle cx="17.5" cy="17.5" r="1.4"/></svg></span>
      <div><h2>Gerenciar Automóveis</h2><p><?= $dispVeic ?> disponíveis · <?= $destVeic ?> em destaque</p></div>
    </div>
    <div class="actions">
      <a class="btn btn-gold btn-block" href="<?= e(url('admin/veiculo-form.php')) ?>">+ Adicionar veículo</a>
      <a class="btn btn-ghost btn-block" href="<?= e(url('admin/veiculos.php')) ?>">Ver todos os veículos</a>
    </div>
  </section>

  <!-- Gerenciar Imóveis -->
  <section class="panel">
    <div class="panel-head blue">
      <span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M9.5 20v-6h5v6"/></svg></span>
      <div><h2>Gerenciar Imóveis</h2><p><?= $dispImov ?> disponíveis · <?= $destImov ?> em destaque</p></div>
    </div>
    <div class="actions">
      <a class="btn btn-blue btn-block" href="<?= e(url('admin/imovel-form.php')) ?>">+ Adicionar imóvel</a>
      <a class="btn btn-ghost btn-block" href="<?= e(url('admin/imoveis.php')) ?>">Ver todos os imóveis</a>
    </div>
  </section>
</div>

<section class="panel" style="margin-top:20px">
  <div class="panel-head">
    <span class="ico" style="background:#fdecec;color:var(--red)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v12H7l-3 3V5z"/></svg></span>
    <div><h2>Mensagens de contato</h2><p><?= $msgTotal ?> no total · <?= $msgNaoLid ?> não lidas</p></div>
  </div>
  <a class="btn btn-ghost" href="<?= e(url('admin/mensagens.php')) ?>">Ver mensagens</a>
</section>

<?php include __DIR__ . '/includes/admin-footer.php'; ?>
