<?php /* Rodapé compartilhado */ ?>
<footer class="site-footer" id="rodape">
  <div class="container">
    <div class="footer-grid">

      <div class="footer-col footer-about">
        <a class="brand brand--footer" href="<?= e(url('index.php')) ?>">
          <span class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="url(#bmf)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <defs><linearGradient id="bmf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6bd64"/><stop offset="1" stop-color="#c9952b"/></linearGradient></defs>
              <path d="M5 11l1.5-4A2 2 0 0 1 8.4 5.7h7.2a2 2 0 0 1 1.9 1.3L19 11"/>
              <path d="M4 11h16a1 1 0 0 1 1 1v4H3v-4a1 1 0 0 1 1-1z"/>
              <circle cx="7.5" cy="16.5" r="1.3"/><circle cx="16.5" cy="16.5" r="1.3"/>
            </svg>
          </span>
          <span class="brand-text">
            <span class="brand-word"><span class="brand-auto">Auto</span><span class="brand-lar">lar</span></span>
            <span class="brand-sub">automóveis e imóveis</span>
          </span>
        </a>
        <p>Conectando você às melhores oportunidades em veículos e imóveis.</p>
      </div>

      <div class="footer-col">
        <h4>Fale conosco</h4>
        <ul class="footer-list">
          <li><a href="<?= e(whatsapp_link()) ?>" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm4.52 11.97c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74 2.48 1.07 2.48.71 2.93.67.45-.04 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z"/></svg>
            <?= e(CONTATO_TELEFONE) ?></a></li>
          <li><a href="<?= e(SOCIAL_INSTAGRAM) ?>" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>
            <?= e(SOCIAL_INSTAGRAM_USER) ?></a></li>
          <li><a href="<?= e(SOCIAL_FACEBOOK) ?>" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7h2.3l.4-2.7h-2.7V9.5c0-.8.2-1.3 1.4-1.3h1.4V5.8c-.7-.1-1.4-.1-2.1-.1-2.1 0-3.5 1.3-3.5 3.6v2H8.3V14h2.3v7h2.9Z"/></svg>
            <?= e(SOCIAL_FACEBOOK_USER) ?></a></li>
        </ul>
      </div>

      <div class="footer-col">
        <h4>Endereço</h4>
        <ul class="footer-list">
          <li><span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>
            <span><?= e(EMPRESA_ENDERECO_LINHA1) ?><br><?= e(EMPRESA_ENDERECO_LINHA2) ?><br><?= e(EMPRESA_CEP) ?></span>
          </span></li>
        </ul>
      </div>

      <div class="footer-col">
        <h4>Horário de atendimento</h4>
        <ul class="footer-list">
          <li><span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            <span><?= e(HORARIO_SEMANA) ?><br><?= e(HORARIO_SABADO) ?></span>
          </span></li>
        </ul>
      </div>

    </div>

    <div class="footer-bottom">
      <span>© <?= date('Y') ?> <?= e(EMPRESA_NOME_FULL) ?>. Todos os direitos reservados.</span>
      <span><?= e(EMPRESA_CRECI) ?></span>
    </div>
  </div>
</footer>

<?php include __DIR__ . '/whatsapp-button.php'; ?>
<script src="<?= e(url('assets/js/main.js')) ?>" defer></script>
</body>
</html>
