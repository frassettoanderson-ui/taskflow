// Fluxo do signatário: ler → código → selfie (câmera ao vivo) → assinar.
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
  const liberar = (id) => $(id).classList.remove('bloqueado')
  const feito = (id) => $(id).classList.add('feito')

  // 1) Documento (pdf.js; fallback: link para abrir o PDF)
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

  // 2) Código
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
      $('codigo-destino').textContent = `Código enviado para ${r.destino}`
      msg('msg-codigo', ''); $('codigo').focus()
    } catch (e) { msg('msg-codigo', e.message, 'erro') }
  }
  $('btn-reenviar').onclick = () => canalAtual && pedirCodigo(canalAtual)
  $('btn-validar').onclick = async () => {
    try { await post('validar', { codigo: $('codigo').value }); codigoOk() }
    catch (e) { msg('msg-codigo', e.message, 'erro') }
  }
  function codigoOk() {
    feito('passo-codigo'); $('codigo-canais').classList.add('oculto'); $('codigo-digitar').classList.add('oculto')
    msg('msg-codigo', 'Identidade confirmada.', 'ok'); liberar('passo-selfie')
  }

  // 3) Selfie: só câmera ao vivo (sem galeria)
  let stream = null
  const video = $('video'), canvas = $('canvas'), previa = $('previa')
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
    msg('msg-selfie', 'Enviando…')
    try {
      await post('selfie', { imagem: previa.src, origem: 'camera' })
      if (stream) stream.getTracks().forEach(t => t.stop())
      $('btn-refazer').classList.add('oculto'); $('btn-usar').classList.add('oculto')
      feito('passo-selfie'); msg('msg-selfie', 'Selfie registrada.', 'ok'); liberar('passo-assinar')
    } catch (e) { msg('msg-selfie', e.message, 'erro') }
  }

  // 4) Assinar
  $('aceite').onchange = (e) => { $('btn-assinar').disabled = !e.target.checked }
  $('btn-assinar').onclick = async () => {
    $('btn-assinar').disabled = true; msg('msg-assinar', 'Assinando…')
    try {
      const r = await post('assinar', { aceite: true })
      document.querySelector('main').innerHTML = `<section class="cartao centro"><div class="selo ok">Assinado</div><h1>Documento assinado</h1>
        <p class="sub">Sua assinatura foi registrada com sucesso. Quando todos assinarem, o documento final com o certificado fica disponível.</p>
        <a class="botao" href="${r.verificacao}">Ver verificação</a></section>`
      window.scrollTo(0, 0)
    } catch (e) { msg('msg-assinar', e.message, 'erro'); $('btn-assinar').disabled = false }
  }

  // Retomada (página recarregada no meio do fluxo)
  if (A.otpValidado) codigoOk()
  if (A.otpValidado && A.selfie) { feito('passo-selfie'); $('btn-camera').classList.add('oculto'); msg('msg-selfie', 'Selfie registrada.', 'ok'); liberar('passo-assinar') }
})()
