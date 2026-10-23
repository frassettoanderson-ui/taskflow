// Assinatura em toda mensagem de texto digitada no WhatsApp Web ("Anderson - Comercial").
// Ao apertar Enter ou o botão enviar, se o texto ainda não estiver assinado, troca o texto do campo
// pelo texto assinado e aperta enviar de novo. O texto já assinado passa direto (sem assinar duas vezes).
import { aoMudar, assinar, ler, type Assinatura } from '../shared/dados';
import { wa } from './wa';

const CAMPO = 'footer div[contenteditable="true"]';

let cfg: Assinatura | null = null;
let ocupado = false;

function botaoEnviar(el: Element | null) {
  const b = el?.closest('footer button');
  if (!b) return null;
  const rotulo = b.getAttribute('aria-label') ?? '';
  return /^(enviar|send)$/i.test(rotulo) || b.querySelector('span[data-icon="send"], span[data-icon="wds-ic-send-filled"]') ? b : null;
}

/** true = a extensão assumiu o envio (o evento original deve ser cancelado). */
function interceptar(): boolean {
  if (ocupado || !cfg?.ativa || !cfg.nome.trim()) return false;
  const campo = document.querySelector<HTMLElement>(CAMPO);
  const texto = (campo?.innerText ?? '').replace(/\n+$/, '');
  if (!texto.trim()) return false;
  const final = assinar(texto, cfg);
  if (final === texto) return false;
  ocupado = true;
  wa('enviarDoCampo', final)
    .catch(() => false)
    .finally(() => {
      ocupado = false;
    });
  return true;
}

export function iniciarAssinador() {
  ler('config').then((c) => (cfg = c.assinatura));
  const desliga = aoMudar('config', (c) => (cfg = c.assinatura));

  const tecla = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    if (!(e.target as HTMLElement)?.closest?.(CAMPO)) return;
    if (interceptar()) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  const clique = (e: MouseEvent) => {
    if (!e.isTrusted || !botaoEnviar(e.target as Element)) return;
    if (interceptar()) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  window.addEventListener('keydown', tecla, true);
  window.addEventListener('click', clique, true);
  return () => {
    desliga();
    window.removeEventListener('keydown', tecla, true);
    window.removeEventListener('click', clique, true);
  };
}
