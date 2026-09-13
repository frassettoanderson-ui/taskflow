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
    <h1>Qual sonho<br><span class="script">vamos realizar</span><br>com você hoje?</h1>
    <p class="hero-sub"><?= e(EMPRESA_SLOGAN) ?></p>
    <div class="hero-rule"></div>
  </div>
</section>

<!-- ===================== CARDS DE ESCOLHA ===================== -->
<section class="choice">
  <div class="container">
    <div class="choice-grid">

      <a class="choice-card choice-card--imovel reveal" href="<?= e(url('imoveis.php')) ?>" aria-label="Ver imóveis à venda">
        <img class="choice-bg" src="<?= e(url('assets/img/card-imoveis.jpg')) ?>" alt="Imóveis à venda na Autolar" loading="lazy">
        <div class="choice-content">
          <span class="accent" aria-hidden="true"></span>
          <div class="choice-text">
            <span class="t-default">Imóveis</span>
            <span class="t-hover">Clique aqui e veja nossos imóveis disponíveis
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </span>
          </div>
        </div>
      </a>

      <a class="choice-card choice-card--auto reveal" data-d="1" href="<?= e(url('automoveis.php')) ?>" aria-label="Ver veículos à venda">
        <img class="choice-bg" src="<?= e(url('assets/img/card-carros.jpg')) ?>" alt="Carros à venda na Autolar" loading="lazy">
        <div class="choice-content">
          <span class="accent" aria-hidden="true"></span>
          <div class="choice-text">
            <span class="t-default">Automóveis</span>
            <span class="t-hover">Clique aqui e veja nossos carros disponíveis
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </span>
          </div>
        </div>
      </a>

    </div>
  </div>
</section>

<!-- ===================== DESTAQUE: THE FARM 437 ===================== -->
<section class="thefarm-banner reveal" aria-label="Oportunidade em destaque: The Farm 437">
  <img class="thefarm-banner__bg" src="<?= e(url('assets/img/thefarm437/hero.jpg')) ?>" alt="" loading="lazy" aria-hidden="true">
  <span class="thefarm-banner__star" aria-hidden="true"></span>
  <div class="container thefarm-banner__body">
    <span class="eyebrow"><span class="ln"></span>Oportunidade em destaque<span class="ln"></span></span>
    <h3>The Farm <em>437</em></h3>
    <p class="thefarm-banner__sub">Três cabanas em 4.000 m² em Imaruí, com renda ativa de Airbnb, nota 5,0 e faturamento acima de R$ 100 mil por ano.</p>
    <div class="thefarm-banner__price">R$ 1.200.000,00</div>
    <div class="thefarm-banner__cta">
      <a class="btn btn-gold btn-lg" href="<?= e(url('thefarm437')) ?>">Conhecer a propriedade</a>
      <a class="btn btn-lg thefarm-banner__ghost" href="<?= e(url('imovel.php?id=19')) ?>">Ver ficha do imóvel</a>
    </div>
  </div>
</section>

<!-- ===================== DESTAQUE FIPE ===================== -->
<section class="section" style="padding-top:clamp(44px,6vw,72px);padding-bottom:clamp(56px,8vw,90px)">
  <div class="container">
    <div class="troca-banner reveal">
      <div class="troca-img" style="background-image:url('<?= e(url('uploads/veiculos/seed-hilux.jpg')) ?>')" aria-hidden="true"></div>
      <div class="troca-body">
        <span class="eyebrow"><span class="ln"></span>Troca facilitada</span>
        <h3>Aceitamos seu <b>automóvel</b> como parte do pagamento</h3>
        <p>Traga seu veículo na negociação do seu novo imóvel e deixe a conquista mais perto. Fazemos uma avaliação justa, sem compromisso.</p>
        <a class="btn btn-gold" href="<?= e(whatsapp_link('Olá! Tenho um veículo e gostaria de usá-lo como parte do pagamento de um imóvel. Podemos avaliar?')) ?>" target="_blank" rel="noopener">Quero uma avaliação</a>
      </div>
    </div>
  </div>
</section>

<!-- ===================== POR QUE ESCOLHER ===================== -->
<section class="section why-sec" id="sobre">
  <div class="container">
    <div class="heading-center reveal">
      <span class="eyebrow">Quem somos</span>
      <h2>Por que escolher a Autolar?</h2>
      <p>Especialistas em imóveis e automóveis em Imbituba e região, com a transparência e a atenção de um corretor especializado.</p>
    </div>

    <div class="why-grid">
      <div class="why-card reveal">
        <div class="why-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V9l6-4v4l6-4v16"/><path d="M21 21V11l-6-4"/><path d="M3 21h18"/></svg></div>
        <h3>Imóveis e automóveis</h3>
        <p>Compra, venda e negociação de casas, apartamentos, terrenos e veículos — tudo num só lugar.</p>
      </div>
      <div class="why-card reveal" data-d="1">
        <div class="why-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13l1.4-4A2 2 0 0 1 7.3 7.7h6.4a2 2 0 0 1 1.9 1.3L17 13"/><path d="M3 13h15v3H3z"/><circle cx="6.5" cy="17.5" r="1.3"/><circle cx="14.5" cy="17.5" r="1.3"/><circle cx="19" cy="8" r="3.2"/></svg></div>
        <h3>Automóvel na negociação</h3>
        <p>Você pode usar seu veículo como parte do pagamento do seu imóvel — consulte avaliação.</p>
      </div>
      <div class="why-card reveal" data-d="2">
        <div class="why-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg></div>
        <h3>Máxima transparência</h3>
        <p>Negociação clara e honesta do começo ao fim, sem surpresas e sem letras miúdas.</p>
      </div>
      <div class="why-card reveal">
        <div class="why-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5"/><path d="m8.5 13-1.5 8 5-3 5 3-1.5-8"/></svg></div>
        <h3>Corretor especializado</h3>
        <p>Atendimento profissional e regularizado — CRECI 9348-J. Você bem assessorado em cada passo.</p>
      </div>
      <div class="why-card reveal" data-d="1">
        <div class="why-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H7l-3 3V5z"/><path d="M8 9h8M8 12h5"/></svg></div>
        <h3>Atendimento próximo</h3>
        <p>Gente de verdade do seu lado: acompanhamento humano e ágil, do primeiro contato à entrega das chaves.</p>
      </div>
      <div class="why-card reveal" data-d="2">
        <div class="why-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg></div>
        <h3>Imbituba e região</h3>
        <p>Conhecimento local pra encontrar a oportunidade certa, no bairro e no momento certos.</p>
      </div>
    </div>
  </div>
</section>

<!-- ===================== CONTATO ===================== -->
<section class="section contato" id="contato">
  <div class="container">
    <div class="heading-center reveal">
      <span class="eyebrow">Contato</span>
      <h2>Fale com a Autolar</h2>
      <p>Tire suas dúvidas ou conte o que você procura — respondemos rápido.</p>
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
