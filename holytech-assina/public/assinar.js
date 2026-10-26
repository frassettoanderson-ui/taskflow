// Fluxo do signatário, uma tela por vez:
// 1 documento (ler + aceite) → 2 código (WhatsApp ou e-mail) → 3 selfie (ao usar a foto, assina) → 4 baixar a via final.
(function () {
  const A = window.ASSINA
  const url = (p) => `${A.base}/s/${A.token}/${p}`
  const $ = (id) => document.getElementById(id)
  const post = async (p, corpo) => {
    const r = await fetch(url(p), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo || {}) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.erro || 'Falha na operação')
    return j
  }
  const msg = (id, t, tipo) => { const el = $(id); el.textContent = t || ''; el.className = 'msg' + (tipo ? ' ' + tipo : '') }
  const ehCelular = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))

  const TELAS = ['documento', 'codigo', 'selfie', 'final']
  let telaAtual = 'documento'
  function mostrar(t) {
    telaAtual = t
    for (const x of TELAS) $('tela-' + x).classList.toggle('oculto', x !== t)
    const i = TELAS.indexOf(t)
    document.querySelectorAll('#etapas li').forEach((li, k) => { li.classList.toggle('feita', k < i); li.classList.toggle('atual', k === i) })
    window.scrollTo(0, 0)
    if (t === 'selfie') iniciarSelfie()
    if (t === 'final') aguardarFinal()
  }

  // ── 1) Documento ───────────────────────────────────────────────────────────
  ;(async () => {
    const visor = $('visor')
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      const pdf = await pdfjsLib.getDocument(url('documento.pdf')).promise
      visor.innerHTML = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const pag = await pdf.getPage(i)
        const vp = pag.getViewport({ scale: 1.5 })
        const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height
        visor.appendChild(cv)
        await pag.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise
      }
    } catch { visor.innerHTML = '<p class="sub centro">Não foi possível exibir aqui. Use o link abaixo para abrir o PDF.</p>' }
  })()
  $('aceite').onchange = (e) => { $('btn-assinar').disabled = !e.target.checked }
  // Assinar: segue para o que ainda falta (retomada: código já confirmado / foto já registrada)
  $('btn-assinar').onclick = () => {
    if (!A.otpValidado) return mostrar('codigo')
    if (!A.selfie) return mostrar('selfie')
    concluir()
  }

  // ── 2) Código ──────────────────────────────────────────────────────────────
  let canalAtual = null
  const caixaCanais = $('codigo-canais')
  if (!A.canais.length) caixaCanais.innerHTML = '<p class="msg erro">Nenhum meio de envio de código disponível. Fale com quem enviou o documento.</p>'
  for (const c of A.canais) {
    const b = document.createElement('button'); b.className = 'canal'
    b.innerHTML = `Receber por ${c.id === 'whatsapp' ? 'WhatsApp' : c.id === 'email' ? 'e-mail' : 'teste'}<span>${c.destino}</span>`
    b.onclick = () => pedirCodigo(c.id)
    caixaCanais.appendChild(b)
  }
  async function pedirCodigo(canal) {
    msg('msg-codigo', 'Enviando…')
    try {
      const r = await post('codigo', { canal })
      canalAtual = canal
      caixaCanais.classList.add('oculto'); $('codigo-digitar').classList.remove('oculto')
      $('aviso-spam').classList.toggle('oculto', canal !== 'email')
      $('codigo-destino').textContent = `Código enviado para ${r.destino}`
      msg('msg-codigo', ''); $('codigo').focus()
    } catch (e) { msg('msg-codigo', e.message, 'erro') }
  }
  $('btn-reenviar').onclick = () => canalAtual && pedirCodigo(canalAtual)
  $('btn-trocar').onclick = () => {
    $('codigo-digitar').classList.add('oculto'); caixaCanais.classList.remove('oculto'); $('aviso-spam').classList.add('oculto'); msg('msg-codigo', '')
  }
  $('btn-validar').onclick = async () => {
    try {
      await post('validar', { codigo: $('codigo').value })
      A.otpValidado = true
      if (A.selfie) concluir(); else mostrar('selfie')
    } catch (e) { msg('msg-codigo', e.message, 'erro') }
  }
  $('codigo').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-validar').click() })

  // ── 3) Selfie (ao usar a foto, conclui a assinatura) ───────────────────────
  let stream = null, acompanhando = null
  const video = $('video'), canvas = $('canvas'), previa = $('previa')
  function iniciarSelfie() {
    // No computador: QR para tirar a selfie no celular; esta tela avança quando o celular terminar
    if (!ehCelular && !acompanhando) {
      $('celular').classList.remove('oculto')
      acompanhando = setInterval(async () => {
        try {
          const e = await (await fetch(url('estado'), { cache: 'no-store' })).json()
          if (e.assinado) { clearInterval(acompanhando); acompanhando = null; mostrar('final') }
          else if (e.selfie && telaAtual === 'selfie') { clearInterval(acompanhando); acompanhando = null; A.selfie = true; concluir() }
        } catch { /* tenta de novo */ }
      }, 4000)
    }
  }
  $('btn-camera').onclick = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 1280 } }, audio: false })
      video.srcObject = stream; await video.play()
      $('btn-camera').classList.add('oculto'); $('btn-foto').classList.remove('oculto'); msg('msg-selfie', '')
    } catch { msg('msg-selfie', 'Não foi possível abrir a câmera. Permita o acesso à câmera no navegador e tente de novo.', 'erro') }
  }
  $('btn-foto').onclick = () => {
    const w = video.videoWidth, h = video.videoHeight
    if (!w || !h) return
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d'); ctx.translate(w, 0); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0, w, h)
    previa.src = canvas.toDataURL('image/jpeg', 0.85)
    video.classList.add('oculto'); previa.classList.remove('oculto')
    $('btn-foto').classList.add('oculto'); $('btn-refazer').classList.remove('oculto'); $('btn-usar').classList.remove('oculto')
  }
  $('btn-refazer').onclick = () => {
    previa.classList.add('oculto'); video.classList.remove('oculto')
    $('btn-foto').classList.remove('oculto'); $('btn-refazer').classList.add('oculto'); $('btn-usar').classList.add('oculto')
  }
  $('btn-usar').onclick = async () => {
    $('btn-usar').disabled = true; $('btn-refazer').disabled = true
    msg('msg-selfie', 'Enviando a foto e concluindo a assinatura…')
    try {
      await post('selfie', { imagem: previa.src, origem: 'camera' })
      if (stream) stream.getTracks().forEach(t => t.stop())
      A.selfie = true
      await concluir()
    } catch (e) { msg('msg-selfie', e.message, 'erro'); $('btn-usar').disabled = false; $('btn-refazer').disabled = false }
  }

  // Assinar de fato (o aceite foi dado na tela 1)
  async function concluir() {
    try {
      if (acompanhando) { clearInterval(acompanhando); acompanhando = null }
      await post('assinar', { aceite: true })
      mostrar('final')
    } catch (e) {
      const alvo = telaAtual === 'documento' ? 'msg-documento' : telaAtual === 'codigo' ? 'msg-codigo' : 'msg-selfie'
      msg(alvo, e.message, 'erro')
    }
  }

  // ── 4) Pronto: libera o download quando a via final estiver gerada ─────────
  function aguardarFinal() {
    $('final-email').textContent = A.temEmail ? 'Você também vai receber a via final assinada no seu e-mail.' : ''
    const verificar = async () => {
      try {
        const e = await (await fetch(url('estado'), { cache: 'no-store' })).json()
        if (e.documento === 'concluido') {
          $('btn-baixar').classList.remove('desativado')
          $('final-texto').textContent = 'Sua assinatura foi registrada. A via final, com o certificado de assinatura, já está disponível.'
          return
        }
        $('final-texto').textContent = 'Sua assinatura foi registrada. A via final fica disponível quando todos assinarem.'
      } catch { /* tenta de novo */ }
      setTimeout(verificar, 3000)
    }
    verificar()
  }
})()
