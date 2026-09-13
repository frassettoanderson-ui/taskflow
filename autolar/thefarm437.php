<?php
/**
 * ============================================================================
 *  THE FARM 437 — página especial (Imaruí/SC)
 * ============================================================================
 *  Landing de um imóvel que já opera como negócio (Airbnb): 3 unidades em
 *  4.000 m². Fotos das galerias são descobertas automaticamente pela pasta
 *  assets/img/thefarm437/ pelo prefixo do nome do arquivo:
 *     terreno-01.jpg  bella-01.jpg  luz-01.jpg  grand-01.jpg  regiao-01.jpg
 *  (jpg/jpeg/png/webp; ordenação natural pelo nome). Sem foto = placeholder.
 * ----------------------------------------------------------------------------
 */
require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/includes/functions.php';

$page_titulo = 'The Farm 437 — Cabanas em Imaruí/SC | ' . EMPRESA_NOME;
$page_desc   = 'Três cabanas em 4.000 m² em Imaruí/SC, com operação de hospedagem ativa e avaliação 5,0 no Airbnb. Um imóvel que já é um negócio. Valor sob consulta.';
$page_atual  = 'imoveis';
$page_head   = '<link rel="stylesheet" href="' . e(url('assets/css/thefarm437.css')) . '?v=' . @filemtime(ROOT_PATH . '/assets/css/thefarm437.css') . '">'
             . '<meta property="og:image" content="' . e(url('assets/img/thefarm437/hero.jpg')) . '">';

$wa_msg   = 'Olá! Vi a página do The Farm 437 (Imaruí) no site da Autolar e quero mais informações.';
$wa_link  = whatsapp_link($wa_msg);
$wa_link2 = 'https://wa.me/' . WHATSAPP_NUMERO_2 . '?text=' . rawurlencode($wa_msg);
$instagram = 'https://www.instagram.com/thefarm.437/';

/** Lista as fotos de um grupo (prefixo do arquivo) em assets/img/thefarm437/. */
function tf_fotos(string $prefixo): array
{
    $dir = ROOT_PATH . '/assets/img/thefarm437/';
    $arqs = glob($dir . $prefixo . '-*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', GLOB_BRACE) ?: [];
    natsort($arqs);
    return array_values(array_map(fn($f) => url('assets/img/thefarm437/' . basename($f)), $arqs));
}

/** Placeholder elegante enquanto a foto real não chega. */
function tf_placeholder(string $rotulo, string $extra = ''): string
{
    return '<div class="tf-ph ' . $extra . '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">'
         . '<path d="M3 20 12 4l9 16H3Z"/><path d="M9 20v-5h6v5"/><path d="M12 4v3"/></svg>'
         . '<span>' . e($rotulo) . '</span></div>';
}

/** Galeria: 1 foto grande + 4 miniaturas; abre lightbox com todas as fotos do grupo. */
function tf_galeria(string $grupo, string $rotulo): void
{
    $fotos = tf_fotos($grupo);
    echo '<div class="tf-gal" aria-label="Fotos: ' . e($rotulo) . '">';
    if (!$fotos) {
        echo '<div class="tf-gal__main">' . tf_placeholder('Foto em breve · ' . $rotulo) . '</div>';
        for ($i = 0; $i < 4; $i++) echo '<div class="tf-gal__thumb">' . tf_placeholder('') . '</div>';
        echo '</div>';
        return;
    }
    $total = count($fotos);
    // foto grande vertical: mostra inteira (sem cortar) sobre uma cópia desfocada, como na página de detalhe
    $dim  = @getimagesize(ROOT_PATH . '/assets/img/thefarm437/' . basename($fotos[0]));
    $vert = $dim && $dim[1] > $dim[0];
    echo '<div class="tf-gal__main' . ($vert ? ' tf-gal__main--v' : '') . '"><a href="' . e($fotos[0]) . '" data-lb="' . e($grupo) . '" data-lb-i="0">'
       . ($vert ? '<img class="tf-gal__bg" src="' . e($fotos[0]) . '" alt="" aria-hidden="true" loading="lazy">' : '')
       . '<img src="' . e($fotos[0]) . '" alt="' . e($rotulo) . '" loading="lazy"></a></div>';
    if ($total === 1) { echo '</div>'; return; } // foto única: sem fileira de miniaturas
    for ($i = 1; $i <= 4; $i++) {
        echo '<div class="tf-gal__thumb">';
        if (isset($fotos[$i])) {
            echo '<a href="' . e($fotos[$i]) . '" data-lb="' . e($grupo) . '" data-lb-i="' . $i . '">'
               . '<img src="' . e($fotos[$i]) . '" alt="' . e($rotulo) . ' — foto ' . ($i + 1) . '" loading="lazy">';
            if ($i === 4 && $total > 5) echo '<span class="tf-gal__more">+' . ($total - 5) . '</span>';
            echo '</a>';
        } else {
            echo tf_placeholder('');
        }
        echo '</div>';
    }
    // fotos além da 5ª entram só no lightbox
    for ($i = 5; $i < $total; $i++) {
        echo '<a hidden href="' . e($fotos[$i]) . '" data-lb="' . e($grupo) . '" data-lb-i="' . $i . '" aria-hidden="true"></a>';
    }
    echo '</div>';
}

$svg_check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>';
$svg_star  = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"/></svg>';
$svg_ig    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>';
$svg_wa    = '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm4.52 11.97c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74 2.48 1.07 2.48.71 2.93.67.45-.04 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z"/></svg>';

$amen_cabana = [
    '<b>36 m²</b> totalmente mobiliados', '<b>Banheira de hidromassagem</b> para dois',
    '<b>Lareira</b> (calefator) para as noites frias', 'Ar-condicionado quente/frio 12.000 BTUs',
    'Cozinha completa e equipada', 'Cama queen no mezanino', 'Smart TV com streaming', 'Chuveiro a gás',
    'Mesa para dois + deck com poltronas', 'Wi-Fi de alta velocidade',
];
$amen_grand = [
    '<b>130 m²</b> em dois pavimentos', '<b>Suíte master com closet</b>', 'Segunda suíte',
    'Sala e cozinha em <b>plano aberto</b>', 'Cozinha com <b>ilha</b>', 'Mezanino para TV', 'Lavabo e lavanderia',
    'Porão / despensa', '<b>Deck</b> externo com <b>firepit</b>', 'Chuveiros a gás', 'Infraestrutura para ar-condicionado',
];

include __DIR__ . '/includes/header.php';
?>

<main class="tf">

  <!-- ============================================================ HERO -->
  <section class="tf-hero">
    <div class="tf-hero__img"><img src="<?= e(url('assets/img/thefarm437/hero.jpg')) ?>" alt="Cabanas do The Farm 437 sob o céu estrelado de Imaruí" fetchpriority="high"></div>
    <div class="tf-hero__veil"></div>
    <div class="tf-sky" data-sky data-sky-top="0" data-sky-bottom="52" aria-hidden="true"></div>

    <div class="tf-wrap tf-hero__inner">
      <span class="tf-eyebrow" data-rise="1">Imaruí · Santa Catarina</span>
      <h1 data-rise="2">The Farm <em>437</em><small>Cabanas · Natureza · Renda</small></h1>
      <p class="tf-hero__sub" data-rise="3">Três cabanas em 4.000 m² de silêncio, com a Lagoa de Imaruí no horizonte
        — e um negócio de hospedagem que já funciona, com nota 5,0 no Airbnb.</p>
      <div class="tf-hero__cta" data-rise="4">
        <a class="btn btn-gold btn-lg" href="<?= e($wa_link) ?>" target="_blank" rel="noopener"><?= $svg_wa ?> Quero conhecer</a>
        <a class="btn btn-lg btn-ghost" href="#oportunidade">Ver a propriedade</a>
      </div>
    </div>

    <a class="tf-hero__scroll" href="#oportunidade" aria-label="Rolar para baixo"><span></span>Descer</a>
  </section>

  <!-- ============================================================ NÚMEROS -->
  <section class="tf-stats tf-night">
    <div class="tf-wrap">
      <div class="tf-stats__grid">
        <div class="tf-stat reveal" data-d="1"><b>4.000<i> m²</i></b><span>de terreno cercado</span></div>
        <div class="tf-stat reveal" data-d="2"><b>3</b><span>unidades independentes</span></div>
        <div class="tf-stat reveal" data-d="3"><b>5,0<i> ★</i></b><span>nota no Airbnb · 53 avaliações</span></div>
        <div class="tf-stat reveal" data-d="4"><b>+100<i> mil</i></b><span>de faturamento anual (R$)</span></div>
      </div>
    </div>
  </section>

  <div class="tf-dawn" aria-hidden="true"></div>

  <!-- ============================================================ OPORTUNIDADE -->
  <section class="tf-sec tf-cream tf-intro" id="oportunidade">
    <div class="tf-wrap tf-intro__grid">
      <div class="reveal">
        <span class="tf-eyebrow">A oportunidade</span>
        <h2>Mais que um imóvel.<br>Um negócio <em>já em funcionamento.</em></h2>
      </div>
      <div class="tf-intro__txt reveal" data-d="2">
        <p class="tf-lead">O The Farm 437 não é um terreno com potencial — é uma operação de hospitalidade viva, com marca própria,
          hóspedes recorrentes, avaliações máximas e faturamento comprovado.</p>
        <p>São duas cabanas de casal com hidromassagem e lareira, hoje anunciadas no Airbnb com selo <strong>Preferido dos hóspedes</strong>,
          mais uma casa principal de 130 m² que pode ser sua residência ou a terceira unidade de renda. Tudo mobiliado,
          equipado e pronto: quem compra, começa a receber no dia seguinte.</p>
        <a class="tf-intro__ig" href="<?= e($instagram) ?>" target="_blank" rel="noopener"><?= $svg_ig ?> @thefarm.437 no Instagram</a>
      </div>
    </div>
  </section>

  <!-- ============================================================ TERRENO -->
  <section class="tf-sec tf-cream tf-terreno" id="terreno" style="padding-top:0">
    <div class="tf-wrap">
      <!-- Vídeo aéreo (drone): roda sem som em loop quando entra na tela; botão abre em tela cheia -->
      <div class="tf-video reveal">
        <video id="tfVideo" muted loop playsinline preload="metadata"
               poster="<?= e(url('assets/img/thefarm437/terreno-poster.jpg')) ?>" aria-label="Filmagem aérea do terreno do The Farm 437">
          <source src="<?= e(url('assets/img/thefarm437/terreno.mp4')) ?>" type="video/mp4">
        </video>
        <div class="tf-video__veil"></div>
        <span class="tf-video__tag"><i></i> Filmagem aérea</span>
        <button class="tf-video__full" type="button" data-video-full aria-label="Assistir em tela cheia">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>
          <span>Tela cheia</span>
        </button>
        <div class="tf-video__cap">
          <span class="tf-eyebrow">O terreno</span>
          <h2>4.000 m² ao pé da montanha, <em>de frente para a lagoa.</em></h2>
        </div>
      </div>

      <div class="tf-terreno__body reveal" data-d="2">
        <p class="tf-lead">Dentro de um condomínio de acesso restrito, sem vizinhos colados e sem barulho de cidade.
          Cavalos passam em frente às cabanas; do alto do morro, um mirante 360° revela a lagoa encontrando o mar.</p>
        <div class="tf-feats">
          <div class="tf-feat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 10h18M3 15h18M6 7v11M12 7v11M18 7v11"/></svg><div><b>Todo cercado</b><small>Cercas estilo fazenda em todo o perímetro</small></div></div>
          <div class="tf-feat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20V8l4-3v15M16 20V5l4 3v12M2 20h20"/></svg><div><b>Duas entradas privativas</b><small>Acessos independentes para as unidades</small></div></div>
          <div class="tf-feat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3c-3 4-6 7-6 11a6 6 0 0 0 12 0c0-4-3-7-6-11Z"/></svg><div><b>Poço artesiano</b><small>Água própria, independência da rede</small></div></div>
          <div class="tf-feat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 17c3-1 5-4 9-4s6 3 9 4M3 17v3h18v-3M8 13l2-6 3 3 2-4 3 7"/></svg><div><b>Vista panorâmica</b><small>Lagoa de Imaruí e montanhas de todas as unidades</small></div></div>
          <div class="tf-feat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><div><b>Condomínio com portão eletrônico</b><small>Segurança, silêncio e privacidade</small></div></div>
          <div class="tf-feat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><div><b>20 min das praias</b><small>Imbituba a 20 min · centro de Imaruí a 2 km</small></div></div>
        </div>
      </div>
    </div>
  </section>

  <!-- ============================================================ CABANAS -->
  <section class="tf-sec tf-cream tf-cabanas" id="cabanas" style="padding-top:0">
    <div class="tf-wrap">
      <div class="tf-cabanas__head reveal">
        <span class="tf-eyebrow">As unidades</span>
        <h2>Três casas, <em>três formas de viver</em> o mesmo lugar.</h2>
        <p>Duas cabanas idênticas em conforto e charme, hoje alugadas por temporada, e uma casa principal ampla para morar,
          receber ou multiplicar a renda.</p>
      </div>

      <!-- Cabana Bella -->
      <article class="tf-cabana" id="bella">
        <div class="tf-cabana__gal reveal"><?php tf_galeria('bella', 'Cabana Bella'); ?></div>
        <div class="reveal" data-d="2">
          <div class="tf-cabana__num">01</div>
          <h3>Cabana Bella<small>36 m² · casal · em operação</small></h3>
          <p class="tf-cabana__desc">Um refúgio pensado para dois: hidromassagem com vista, lareira acesa e o silêncio
            do campo. É a unidade mais avaliada do The Farm — e as notas falam por si.</p>
          <div class="tf-chips">
            <span class="tf-chip tf-chip--dark"><?= $svg_star ?> 5,0 · 38 avaliações</span>
            <span class="tf-chip"><?= $svg_check ?> Preferido dos hóspedes</span>
            <span class="tf-chip"><?= $svg_check ?> Top 10% do Airbnb</span>
          </div>
          <ul class="tf-amen"><?php foreach ($amen_cabana as $a) echo "<li>$a</li>"; ?></ul>
        </div>
      </article>

      <!-- Cabana Luz -->
      <article class="tf-cabana tf-cabana--flip" id="luz">
        <div class="tf-cabana__gal reveal"><?php tf_galeria('luz', 'Cabana Luz'); ?></div>
        <div class="reveal" data-d="2">
          <div class="tf-cabana__num">02</div>
          <h3>Cabana Luz<small>36 m² · casal · em operação</small></h3>
          <p class="tf-cabana__desc">Irmã gêmea da Bella, com o mesmo padrão de acabamento e a mesma vista para a lagoa.
            Juntas, as duas cabanas podem ser alugadas em bloco para dois casais, com o espaço todo exclusivo.</p>
          <div class="tf-chips">
            <span class="tf-chip tf-chip--dark"><?= $svg_star ?> 5,0 · 15 avaliações</span>
            <span class="tf-chip"><?= $svg_check ?> Preferido dos hóspedes</span>
            <span class="tf-chip"><?= $svg_check ?> 100% em localização</span>
          </div>
          <ul class="tf-amen"><?php foreach ($amen_cabana as $a) echo "<li>$a</li>"; ?></ul>
        </div>
      </article>

      <!-- Grand House -->
      <article class="tf-cabana" id="grand-house">
        <div class="tf-cabana__gal reveal"><?php tf_galeria('grand', 'Grand House'); ?></div>
        <div class="reveal" data-d="2">
          <div class="tf-cabana__num">03</div>
          <h3>Grand House<small>130 m² · 2 suítes · casa principal</small></h3>
          <p class="tf-cabana__desc">A casa grande do terreno: duas suítes, cozinha com ilha em plano aberto, mezanino e um deck
            com firepit para as noites estreladas. Hoje reservada pelo proprietário — ou seja, ainda nem entrou na conta.</p>
          <div class="tf-chips">
            <span class="tf-chip tf-chip--dark"><?= $svg_check ?> Não listada — potencial extra</span>
            <span class="tf-chip"><?= $svg_check ?> Morar ou alugar</span>
          </div>
          <ul class="tf-amen"><?php foreach ($amen_grand as $a) echo "<li>$a</li>"; ?></ul>
        </div>
      </article>
    </div>
  </section>

  <div class="tf-dusk" aria-hidden="true"></div>

  <!-- ============================================================ NEGÓCIO -->
  <section class="tf-sec tf-night tf-biz" id="negocio">
    <div class="tf-wrap">
      <div class="tf-biz__grid">
        <div class="reveal">
          <span class="tf-eyebrow">O negócio</span>
          <h2>Comprou, <em>já está faturando.</em></h2>
          <p class="tf-lead">O The Farm 437 opera há dois anos no Airbnb. Marca, fotos, avaliações, rotina de limpeza,
            cesta de café da manhã — tudo isso vai junto com a escritura.</p>
          <div class="tf-big">
            <small>Faturamento anual</small>
            <b>R$ 100 mil<i>+</i></b>
            <p>Com apenas <strong>duas</strong> das três unidades em operação. A Grand House é upside puro: alugue-a, ou more
              nela e administre tudo de perto.</p>
          </div>
        </div>
        <div class="tf-proofs reveal" data-d="2">
          <div class="tf-proof"><?= $svg_star ?><b>5,0 de 5</b><span>Nota máxima nas duas cabanas, em 53 avaliações públicas</span></div>
          <div class="tf-proof"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3 4 7v5c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7l-8-4Z"/><path d="m9 12 2 2 4-4"/></svg><b>Preferido dos hóspedes</b><span>Selo do Airbnb para o top 10% das acomodações</span></div>
          <div class="tf-proof"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><b>2 anos</b><span>de operação contínua e histórico de reservas</span></div>
          <div class="tf-proof"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s-7-4.4-7-11a7 7 0 0 1 14 0c0 6.6-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg><b>100%</b><span>dos hóspedes deram 5 estrelas para a localização nos últimos 12 meses</span></div>
          <div class="tf-proof tf-proof--wide">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 19h16M6 19V9l6-5 6 5v10"/><path d="M10 19v-5h4v5"/></svg>
            <div><b>Locação em bloco</b><span>As duas cabanas juntas atendem dois casais com o terreno exclusivo — diária maior, mesma operação.</span></div>
          </div>
        </div>
      </div>

      <div class="tf-inclui reveal">
        <div>
          <span class="tf-eyebrow">O que vai junto</span>
          <h3>Chave na mão, <em class="tf-em">de verdade.</em></h3>
        </div>
        <ul class="tf-inclui__list">
          <li><?= $svg_check ?><span><b>Mobília e decoração completas</b> nas três unidades</span></li>
          <li><?= $svg_check ?><span><b>Enxoval, roupões e amenidades</b> de hotel</span></li>
          <li><?= $svg_check ?><span><b>Cozinhas equipadas</b> (air fryer, forno, cafeteira, kit fondue)</span></li>
          <li><?= $svg_check ?><span><b>Anúncios ativos</b> com histórico e avaliações no Airbnb</span></li>
          <li><?= $svg_check ?><span><b>Marca e Instagram</b> @thefarm.437</span></li>
          <li><?= $svg_check ?><span><b>Áreas comuns</b>: jardim com fonte, deck, slackline e espaço para piscina</span></li>
          <li><?= $svg_check ?><span><b>Serviços extras já formatados</b>: decoração romântica, pedidos de casamento, dia de spa</span></li>
          <li><?= $svg_check ?><span><b>Autolar</b> intermediando com segurança jurídica — CRECI 9348-J</span></li>
        </ul>
      </div>
    </div>
  </section>

  <div class="tf-dawn" aria-hidden="true"></div>

  <!-- ============================================================ REGIÃO -->
  <section class="tf-sec tf-cream tf-regiao" id="regiao">
    <div class="tf-wrap tf-regiao__grid">
      <div class="reveal">
        <span class="tf-eyebrow">Imaruí · SC</span>
        <h2>Entre a lagoa, a serra <em>e as praias do sul.</em></h2>
        <p class="tf-lead">Imaruí é a cidade tranquila às margens da maior lagoa do sul catarinense. Pesca artesanal, restaurantes
          de frutos do mar, trilhas e um pôr do sol que virou motivo de viagem.</p>
        <p>A vinte minutos estão as praias de Imbituba; um pouco mais, a Praia do Rosa e o centro histórico de Laguna.
          Florianópolis fica a cerca de uma hora e meia — perto o bastante para o hóspede de fim de semana, longe o bastante
          para desligar de verdade.</p>
        <ul class="tf-dist">
          <li><span>Centro de Imaruí</span><b>2 km</b></li>
          <li><span>Praias de Imbituba</span><b>20 min</b></li>
          <li><span>Praia do Rosa</span><b>≈ 35 km</b></li>
          <li><span>Laguna (centro histórico)</span><b>≈ 30 km</b></li>
          <li><span>Florianópolis</span><b>≈ 100 km</b></li>
        </ul>
      </div>
      <div class="tf-regiao__mosaic reveal" data-d="2">
        <?php
        $reg = tf_fotos('regiao');
        for ($i = 0; $i < 3; $i++) {
            echo '<div>';
            if (isset($reg[$i])) echo '<a href="' . e($reg[$i]) . '" data-lb="regiao" data-lb-i="' . $i . '"><img src="' . e($reg[$i]) . '" alt="Região de Imaruí" loading="lazy"></a>';
            else echo tf_placeholder($i === 0 ? 'Foto em breve · Lagoa de Imaruí' : '');
            echo '</div>';
        }
        ?>
      </div>
    </div>
  </section>

  <div class="tf-dusk" aria-hidden="true"></div>

  <!-- ============================================================ CTA FINAL -->
  <section class="tf-cta" id="contato-thefarm">
    <div class="tf-cta__img"><img src="<?= e(url('assets/img/thefarm437/noite.jpg')) ?>" alt="" loading="lazy"></div>
    <div class="tf-cta__veil"></div>
    <div class="tf-sky" data-sky data-sky-top="0" data-sky-bottom="40" aria-hidden="true"></div>
    <div class="tf-wrap reveal">
      <span class="tf-eyebrow">Agende uma visita</span>
      <h2>Venha ver <em>o céu daqui.</em></h2>
      <p>Visitas acompanhadas pela equipe Autolar. Enviamos os números completos da operação para compradores qualificados.</p>
      <div class="tf-cta__price">Valor sob consulta</div>
      <div class="tf-cta__btns">
        <a class="btn btn-gold btn-lg" href="<?= e($wa_link) ?>" target="_blank" rel="noopener"><?= $svg_wa ?> <?= e(CONTATO_TELEFONE) ?></a>
        <a class="btn btn-lg btn-ghost" style="background:rgba(255,255,255,.06);color:#fff;border-color:rgba(255,255,255,.35)" href="<?= e($wa_link2) ?>" target="_blank" rel="noopener"><?= $svg_wa ?> <?= e(CONTATO_TELEFONE_2) ?></a>
      </div>
      <a class="tf-cta__ig" href="<?= e($instagram) ?>" target="_blank" rel="noopener"><?= $svg_ig ?> Conheça o dia a dia em @thefarm.437</a>
    </div>
  </section>

</main>

<!-- Lightbox das galerias -->
<div class="tf-lb" id="tfLightbox" role="dialog" aria-modal="true" aria-label="Foto ampliada">
  <button class="tf-lb__close" type="button" aria-label="Fechar">×</button>
  <button class="tf-lb__btn tf-lb__prev" type="button" aria-label="Anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 5-7 7 7 7"/></svg></button>
  <img src="" alt="">
  <button class="tf-lb__btn tf-lb__next" type="button" aria-label="Próxima"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 5 7 7-7 7"/></svg></button>
  <div class="tf-lb__count"></div>
</div>

<script src="<?= e(url('assets/js/thefarm437.js')) ?>?v=<?= @filemtime(ROOT_PATH . '/assets/js/thefarm437.js') ?>" defer></script>
<?php include __DIR__ . '/includes/footer.php'; ?>
