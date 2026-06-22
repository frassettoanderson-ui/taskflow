<?php
require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/includes/functions.php';
http_response_code(404);
$page_titulo = 'Página não encontrada — ' . EMPRESA_NOME;
include __DIR__ . '/includes/header.php';
?>
<section class="section" style="min-height:50vh;display:grid;place-items:center">
  <div class="container empty-state">
    <div style="font-size:5rem;font-weight:800;background:var(--gold-grad);-webkit-background-clip:text;background-clip:text;color:transparent">404</div>
    <h3>Página não encontrada</h3>
    <p>O endereço que você acessou não existe ou foi movido.</p>
    <a class="btn btn-gold mt-2" href="<?= e(url('index.php')) ?>">Voltar ao início</a>
  </div>
</section>
<?php include __DIR__ . '/includes/footer.php'; ?>
