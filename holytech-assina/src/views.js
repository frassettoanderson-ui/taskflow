// Páginas HTML (server-side). Identidade HolyTech: papel #F2F1EC, tinta #0E0E10, amarelo #FDBB01.
import { config } from './config.js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const B = config.base
const fmt = (d) => d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '—'

function layout(titulo, corpo, extraHead = '') {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)} · HolyTech Assina</title><meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@112,700;112,800&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${B}/static/estilo.css">${extraHead}</head>
<body><header class="topo"><div class="marca"><span class="ponto"></span>HolyTech <b>Assina</b></div></header>
<main>${corpo}</main>
<footer class="rodape">Assinatura eletrônica operada pela HolyTech Solutions · <a href="${B}/v">verificar documento</a></footer></body></html>`
}

export function paginaMensagem(titulo, texto) {
  return layout(titulo, `<section class="cartao centro"><h1>${esc(titulo)}</h1><p class="sub">${esc(texto)}</p></section>`)
}

export function paginaAssinar({ token, doc, sig, conta, canais }) {
  if (sig.status === 'assinado') {
    return layout('Documento assinado', `<section class="cartao centro"><div class="selo ok">Assinado</div><h1>Você já assinou este documento</h1>
<p class="sub">${esc(doc.titulo)}</p><p class="sub">Assinado em ${fmt(sig.assinado_em)}.</p>
<a class="botao" href="${B}/v/${esc(doc.codigo)}">Ver verificação</a></section>`)
  }
  if (doc.status !== 'pendente') return paginaMensagem('Documento indisponível', 'Este documento não está mais aceitando assinaturas.')
  const estado = { token, base: B, otpValidado: !!sig.otp_validado_em, selfie: !!sig.selfie_hash, canais }
  return layout('Assinar documento', `
<section class="cartao centro">
  <p class="rotulo">${esc(conta.nome)} enviou para você assinar</p>
  <h1>${esc(doc.titulo)}</h1>
  <p class="sub">Signatário: <b>${esc(sig.nome)}</b>${sig.papel === 'testemunha' ? ' (testemunha)' : ''}</p>
</section>

<section class="cartao">
  <div class="passo-cab"><span class="num">1</span><h2>Leia o documento</h2></div>
  <div id="visor" class="visor"><p class="sub centro">Carregando o documento…</p></div>
  <p class="centro"><a class="link" href="${B}/s/${esc(token)}/documento.pdf" target="_blank" rel="noopener">Abrir o PDF em outra aba</a></p>
</section>

<section class="cartao" id="passo-codigo">
  <div class="passo-cab"><span class="num">2</span><h2>Confirme que é você</h2></div>
  <p class="sub centro">Enviaremos um código de 6 dígitos para confirmar sua identidade.</p>
  <div id="codigo-canais" class="canais"></div>
  <div id="codigo-digitar" class="oculto">
    <p class="sub centro" id="codigo-destino"></p>
    <input id="codigo" class="campo-codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000">
    <button class="botao" id="btn-validar">Confirmar código</button>
    <p class="centro"><button class="link" id="btn-reenviar">Enviar outro código</button></p>
  </div>
  <p class="msg" id="msg-codigo"></p>
</section>

<section class="cartao bloqueado" id="passo-selfie">
  <div class="passo-cab"><span class="num">3</span><h2>Tire uma selfie</h2></div>
  <p class="sub centro">A foto é tirada agora pela câmera e serve apenas para comprovar a autoria desta assinatura. Ela fica guardada de forma criptografada e não aparece no documento.</p>
  <div class="camera"><video id="video" playsinline muted></video><canvas id="canvas" class="oculto"></canvas><img id="previa" class="oculto" alt="Sua selfie"></div>
  <div class="acoes">
    <button class="botao" id="btn-camera">Abrir câmera</button>
    <button class="botao oculto" id="btn-foto">Tirar foto</button>
    <button class="botao secundario oculto" id="btn-refazer">Tirar outra</button>
    <button class="botao oculto" id="btn-usar">Usar esta foto</button>
  </div>
  <p class="msg" id="msg-selfie"></p>
</section>

<section class="cartao bloqueado" id="passo-assinar">
  <div class="passo-cab"><span class="num">4</span><h2>Assinar</h2></div>
  <label class="aceite"><input type="checkbox" id="aceite"> <span>Li o documento, concordo com o seu conteúdo e reconheço esta assinatura eletrônica como válida (MP 2.200-2/2001, art. 10, § 2º).</span></label>
  <button class="botao grande" id="btn-assinar" disabled>Assinar documento</button>
  <p class="msg" id="msg-assinar"></p>
</section>

<script>window.ASSINA = ${JSON.stringify(estado).replace(/</g, '\\u003c')}</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script src="${B}/static/assinar.js"></script>`)
}

export function paginaVerificar(v, aviso = '') {
  if (!v) {
    return layout('Verificar documento', `<section class="cartao centro"><h1>Verificar documento</h1>
<p class="sub">Informe o código de verificação que aparece no certificado de assinatura.</p>
${aviso ? `<p class="msg erro">${esc(aviso)}</p>` : ''}
<form class="linha" onsubmit="event.preventDefault();location.href='${B}/v/'+encodeURIComponent(this.c.value.trim().toUpperCase())">
<input name="c" class="campo" placeholder="XXXX-XXXX-XXXX" maxlength="14" required><button class="botao">Verificar</button></form></section>`)
  }
  const st = v.status === 'concluido' ? '<div class="selo ok">Concluído</div>' : v.status === 'cancelado' ? '<div class="selo erro">Cancelado</div>' : '<div class="selo">Aguardando assinaturas</div>'
  return layout('Verificação', `
<section class="cartao centro">${st}<h1>${esc(v.titulo)}</h1>
<p class="sub">Solicitante: <b>${esc(v.solicitante)}</b> · Código <b>${esc(v.codigo)}</b></p>
<p class="sub">Criado em ${fmt(v.criado_em)}${v.concluido_em ? ` · Concluído em ${fmt(v.concluido_em)}` : ''}</p></section>
<section class="cartao"><h2 class="centro">Signatários</h2><ul class="lista">
${v.signatarios.map(s => `<li><b>${esc(s.nome)}</b>${s.papel === 'testemunha' ? ' (testemunha)' : ''}<span>${s.status === 'assinado' ? `Assinou em ${fmt(s.assinado_em)} · código via ${s.canal === 'whatsapp' ? 'WhatsApp' : s.canal === 'email' ? 'e-mail' : esc(s.canal || '—')}${s.selfie ? ' · selfie' : ''}` : 'Pendente'}</span></li>`).join('')}
</ul></section>
${v.carimbo ? `<section class="cartao centro"><h2>Carimbo de tempo HolyTech</h2>
<p class="sub">${fmt(v.carimbo.hora)} · ${esc(v.carimbo.fonte)}</p>
<div class="selo ${v.carimbo.valido ? 'ok' : 'erro'}">${v.carimbo.valido ? 'Assinatura do carimbo válida' : 'Assinatura do carimbo inválida'}</div>
<p class="sub mono">Chave ${esc(v.carimbo.chave)} · <a class="link" href="${B}/chave-publica.pem">chave pública</a></p></section>` : ''}
<section class="cartao centro"><h2>Conferir um PDF</h2>
<p class="sub">Envie o arquivo que você recebeu. A conferência é feita no seu navegador: o arquivo não sai do seu computador.</p>
<input type="file" id="arquivo" accept="application/pdf" class="campo">
<p class="msg" id="resultado"></p>
<p class="sub mono">SHA-256 final: ${esc(v.hash_final || '—')}<br>SHA-256 original: ${esc(v.hash_original)}</p></section>
<script>
document.getElementById('arquivo').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return
  const h = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await f.arrayBuffer()))).map(b => b.toString(16).padStart(2, '0')).join('')
  const el = document.getElementById('resultado')
  if (h === ${JSON.stringify(v.hash_final || '')}) { el.textContent = 'Este é o documento final assinado, íntegro e sem alterações.'; el.className = 'msg ok' }
  else if (h === ${JSON.stringify(v.hash_original)}) { el.textContent = 'Este é o documento original enviado para assinatura (sem o certificado).'; el.className = 'msg ok' }
  else { el.textContent = 'Este arquivo NÃO corresponde ao documento assinado (pode ter sido alterado).'; el.className = 'msg erro' }
})
</script>`)
}
