<?php
require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/includes/functions.php';

$page_titulo = EMPRESA_NOME_FULL . ' — Automóveis e Imóveis em Imbituba/SC';
$page_desc   = 'A Autolar transforma sonhos em conquistas. Compra, venda e negociação de veículos e imóveis com atendimento personalizado.';
$page_atual  = 'home';
$flash = flash_get();

include __DIR__ . '/includes/header.php';
?>

<!-- ============================== HERO ============================== -->
<section class="hero">
  <div class="container hero-inner reveal">
    <h1>Qual sonho<br><span class="script">vamos realizar</span>com você hoje?</h1>
    <p class="hero-sub"><?= e(EMPRESA_SLOGAN) ?></p>
    <div class="hero-rule"></div>
  </div>
</section>

<!-- ===================== CARDS DE ESCOLHA ===================== -->
<section class="choice">
  <div class="container">
    <div class="choice-grid">

      <article class="choice-card reveal">
        <div class="choice-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M9.5 20v-6h5v6"/>
          </svg>
        </div>
        <h3>IMÓVEIS</h3>
        <p>Casas, apartamentos, terrenos e oportunidades para você viver ou investir.</p>
        <a class="btn btn-gold btn-lg" href="<?= e(url('imoveis.php')) ?>">Encontrar meu imóvel</a>
      </article>

      <article class="choice-card reveal">
        <div class="choice-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 12l1.6-4.6A2.5 2.5 0 0 1 8 6h8a2.5 2.5 0 0 1 2.4 1.4L20 12"/>
            <path d="M3 12h18a1 1 0 0 1 1 1v4H2v-4a1 1 0 0 1 1-1z"/>
            <circle cx="6.5" cy="17.5" r="1.6"/><circle cx="17.5" cy="17.5" r="1.6"/>
          </svg>
        </div>
        <h3>AUTOMÓVEIS</h3>
        <p>Veículos selecionados para compra, venda e negociação.</p>
        <a class="btn btn-gold btn-lg" href="<?= e(url('automoveis.php')) ?>">Encontrar meu veículo</a>
      </article>

    </div>
  </div>
</section>

<!-- ===================== POR QUE ESCOLHER ===================== -->
<section class="section" id="sobre">
  <div class="container">
    <div class="heading-center reveal">
      <h2>Por que escolher a Autolar?</h2>
    </div>

    <div class="feature-row reveal">
      <div class="feature">
        <div class="feature-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17.5" cy="9" r="2.3"/><path d="M16 14.2A5 5 0 0 1 21 20"/></svg></div>
        <p>Atendimento personalizado</p>
      </div>
      <div class="feature">
        <div class="feature-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg></div>
        <p>Negociações seguras</p>
      </div>
      <div class="feature">
        <div class="feature-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M7 16l3.5-4 3 2.5L20 7"/><path d="M16 7h4v4"/></svg></div>
        <p>Avaliação profissional</p>
      </div>
      <div class="feature">
        <div class="feature-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m11 12 2-2 5 5-1.5 1.5a2 2 0 0 1-2.8 0L11 14"/><path d="M3 9l4-4 4 2 3 0"/><path d="M3 9l4 4"/><path d="M13 10l3.5-1L21 11"/></svg></div>
        <p>Veículos aceitos na negociação</p>
      </div>
      <div class="feature">
        <div class="feature-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5"/><path d="m8.5 13-1.5 8 5-3 5 3-1.5-8"/></svg></div>
        <p>Mais de 25 anos conectando pessoas a oportunidades</p>
      </div>
    </div>
  </div>
</section>

<!-- ===================== CONTATO ===================== -->
<section class="section contato" id="contato">
  <div class="container">
    <div class="heading-center reveal">
      <h2>Fale com a Autolar</h2>
    </div>

    <div class="contato-grid">
      <div class="contato-card reveal">
        <?php foreach ($flash as $f): ?>
          <div class="alert <?= $f['tipo'] === 'ok' ? 'alert-ok' : 'alert-err' ?>"><?= e($f['msg']) ?></div>
        <?php endforeach; ?>

        <form method="post" action="<?= e(url('contato.php')) ?>" novalidate>
          <?= csrf_field() ?>
          <div class="field">
            <label for="nome">Nome*</label>
            <input type="text" id="nome" name="nome" required maxlength="120" placeholder="Seu nome completo">
          </div>
          <div class="field">
            <label for="contato">E-mail ou telefone*</label>
            <input type="text" id="contato" name="contato" required maxlength="160" placeholder="seu@email.com ou (48) 99999-9999">
          </div>
          <div class="field">
            <label for="assunto">Assunto</label>
            <select id="assunto" name="assunto">
              <option value="">Selecione…</option>
              <option>Tenho interesse em um imóvel</option>
              <option>Tenho interesse em um veículo</option>
              <option>Quero anunciar / vender</option>
              <option>Avaliação na negociação</option>
              <option>Outro assunto</option>
            </select>
          </div>
          <div class="field">
            <label for="mensagem">Mensagem*</label>
            <textarea id="mensagem" name="mensagem" required maxlength="2000" placeholder="Como podemos ajudar você?"></textarea>
          </div>
          <button type="submit" class="btn btn-gold btn-lg btn-block">Enviar mensagem</button>
        </form>
      </div>

      <aside class="contato-aside reveal">
        <div class="info-block">
          <span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg></span>
          <div><h4>Endereço</h4><p><?= e(EMPRESA_ENDERECO_LINHA1) ?><br><?= e(EMPRESA_ENDERECO_LINHA2) ?><br><?= e(EMPRESA_CEP) ?></p></div>
        </div>
        <div class="info-block">
          <span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>
          <div><h4>Horário</h4><p><?= e(HORARIO_SEMANA) ?><br><?= e(HORARIO_SABADO) ?></p></div>
        </div>
        <div class="info-block">
          <span class="ico"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Z"/></svg></span>
          <div><h4>WhatsApp & Redes</h4><p>
            <a href="<?= e(whatsapp_link()) ?>" target="_blank" rel="noopener"><?= e(CONTATO_TELEFONE) ?></a><br>
            <a href="<?= e(SOCIAL_INSTAGRAM) ?>" target="_blank" rel="noopener"><?= e(SOCIAL_INSTAGRAM_USER) ?></a>
          </p></div>
        </div>
        <a class="btn btn-wa btn-lg btn-block" href="<?= e(whatsapp_link()) ?>" target="_blank" rel="noopener">
          Chamar no WhatsApp
        </a>
      </aside>
    </div>
  </div>
</section>

<!-- ===================== FAIXA SLOGAN ===================== -->
<section class="slogan-band">
  <span class="watermark" aria-hidden="true">A</span>
  <div class="container">
    <span class="script">Valorizamos o seu imóvel,</span>
    <span class="plain">o seu carro e o seu sonho.</span>
  </div>
</section>

<?php include __DIR__ . '/includes/footer.php'; ?>
