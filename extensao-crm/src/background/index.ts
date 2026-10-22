// Service worker: abre o WhatsApp pelo ícone e avisa lembretes vencidos.
// O envio de agendamentos acontece dentro da aba do WhatsApp (content script), que é quem tem o WPP.
import { alterar, exportarTudo, gravar, ler, novoId, type RegistroWebhook } from '../shared/dados';
import { chamarIA, montarPrompt, type PedidoIA } from '../shared/ia';
import type { PedidoWebhook } from '../shared/webhook';

const WA = 'https://web.whatsapp.com/';

async function abrirWhatsApp(chatId?: string) {
  const [aba] = await chrome.tabs.query({ url: `${WA}*` });
  if (aba?.id) {
    await chrome.tabs.update(aba.id, { active: true });
    if (aba.windowId) await chrome.windows.update(aba.windowId, { focused: true });
    if (chatId) chrome.tabs.sendMessage(aba.id, { tipo: 'abrir-chat', chatId }).catch(() => {});
  } else {
    await chrome.tabs.create({ url: WA });
  }
}

chrome.action.onClicked.addListener(() => abrirWhatsApp());

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('lembretes', { periodInMinutes: 1 });
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('lembretes', { periodInMinutes: 1 });
});

const avisados = new Set<string>();

const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

/** Um arquivo por dia da semana na pasta Downloads/CRM WhatsApp: guarda sempre os últimos 7 dias. */
export async function baixarBackup() {
  const json = JSON.stringify(await exportarTudo());
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  await chrome.downloads.download({
    url: `data:application/json;base64,${btoa(bin)}`,
    filename: `CRM WhatsApp/backup-${DIAS[new Date().getDay()]}.json`,
    conflictAction: 'overwrite',
    saveAs: false,
  });
}

async function backupDoDia() {
  const config = await ler('config');
  const b = config.backupAuto;
  if (!b.ativo) return;
  const agora = new Date();
  const hoje = agora.toLocaleDateString('sv-SE');
  const [h, m] = b.hora.split(':').map(Number);
  if (b.ultimo === hoje || agora.getHours() * 60 + agora.getMinutes() < h * 60 + m) return;
  await gravar('config', { ...config, backupAuto: { ...b, ultimo: hoje } });
  await baixarBackup().catch(() => {});
}

chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== 'lembretes') return;
  backupDoDia();
  const agora = Date.now();
  const lembretes = await ler('lembretes');
  for (const l of lembretes) {
    if (l.feito || l.quando > agora || avisados.has(l.id)) continue;
    avisados.add(l.id);
    chrome.notifications.create(`lembrete:${l.id}`, {
      type: 'basic',
      iconUrl: 'icone.png',
      title: `Lembrete: ${l.nomeContato || 'contato'}`,
      message: l.texto,
      priority: 2,
      buttons: [{ title: 'Abrir conversa' }, { title: 'Marcar como feito' }],
    });
  }
});

async function lembreteDaNotificacao(notifId: string) {
  if (!notifId.startsWith('lembrete:')) return null;
  const id = notifId.slice('lembrete:'.length);
  return (await ler('lembretes')).find((l) => l.id === id) ?? null;
}

chrome.notifications.onClicked.addListener(async (n) => {
  const l = await lembreteDaNotificacao(n);
  if (l) abrirWhatsApp(l.chatId);
});

chrome.notifications.onButtonClicked.addListener(async (n, botao) => {
  const l = await lembreteDaNotificacao(n);
  if (!l) return;
  if (botao === 0) abrirWhatsApp(l.chatId);
  else await alterar('lembretes', (ls) => ls.map((x) => (x.id === l.id ? { ...x, feito: true } : x)));
  chrome.notifications.clear(n);
});

// ---------- webhooks ----------

/** `soId`: só esse webhook, mesmo desligado ou sem o evento (botão "Enviar teste"). */
async function enviarWebhooks(p: PedidoWebhook, soId?: string) {
  const ativos = (await ler('webhooks')).filter((w) => (soId ? w.id === soId : w.ativo && w.eventos.includes(p.evento)) && /^https?:\/\//.test(w.url));
  if (!ativos.length) return;
  const corpo = { evento: p.evento, em: new Date().toISOString(), ...p.dados };
  const registros: RegistroWebhook[] = [];
  for (const w of ativos) {
    const r: RegistroWebhook = { id: novoId(), webhookId: w.id, evento: p.evento, em: Date.now(), ok: false, corpo };
    try {
      const resp = await fetch(w.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      r.ok = resp.ok;
      r.codigo = resp.status;
    } catch {
      // servidor sem CORS: manda mesmo assim, só não dá para ler a resposta
      try {
        await fetch(w.url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(corpo) });
        r.ok = true;
        r.erro = 'Enviado sem confirmação (o servidor não libera CORS)';
      } catch (e) {
        r.erro = (e as Error).message;
      }
    }
    registros.push(r);
  }
  await alterar('registrosWebhook', (l) => [...registros, ...l].slice(0, 30));
}

// ---------- IA ----------

chrome.runtime.onMessage.addListener((msg, _remetente, responder) => {
  if (msg?.tipo !== 'ia') return;
  (async () => {
    const cfg = await ler('ia');
    const { sistema, usuario } = montarPrompt(msg as PedidoIA, cfg);
    return chamarIA(cfg, sistema, usuario);
  })().then(
    (texto) => responder({ ok: true, texto }),
    (e) => responder({ ok: false, erro: (e as Error).message }),
  );
  return true; // resposta assíncrona
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.tipo === 'webhook') enviarWebhooks(msg as PedidoWebhook).catch(() => {});
  if (msg?.tipo === 'webhook-teste') enviarWebhooks({ tipo: 'webhook', evento: 'ficha', dados: { teste: true, mensagem: 'Teste do CRM WhatsApp' } }, msg.id).catch(() => {});
  if (msg?.tipo === 'abrir-whatsapp') abrirWhatsApp(msg.chatId);
  if (msg?.tipo === 'backup-agora') baixarBackup().catch(() => {});
});
