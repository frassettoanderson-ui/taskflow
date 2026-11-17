// Testes do atendimento automático: rodam o código real de src/content/atendimento.ts
// contra um WhatsApp simulado. Rodar com: npm test
import { ler, gravar, passoVazio, type ConfigAtendimento } from '../src/shared/dados';
import { iniciarAtendimento } from '../src/content/atendimento';
import { sim } from './simulador';

const HORA = 3600;
const espera = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

function texto(t: string) {
  return { ...passoVazio('texto'), texto: t, simular: 'nenhuma' as const, simularSeg: 0 };
}

async function configurar(p: Partial<ConfigAtendimento>) {
  await gravar('atendimento', {
    ...(await ler('atendimento')),
    saudacaoAtiva: true,
    iaAtiva: true,
    primeiroContato: [texto('Olá! Seja bem-vindo.')],
    retorno: [texto('Que bom te ver de novo!')],
    novaConversaHoras: 12,
    esperaMin: 1,
    esperaMax: 1,
    limiteSeguidas: 8,
    voltaIA: 'novaConversa',
    nomeAssinatura: '',
    ...p,
  });
}

/** espera o atendimento terminar o que tiver para fazer */
async function assentar(ms = 2600) {
  await espera(ms);
}

let falhas = 0;
let n = 0;
const enviadosPara = (chat: string) => sim.enviados.filter((e) => e.chatId === chat).map((e) => e.texto);

async function caso(nome: string, fn: () => Promise<void>) {
  n++;
  sim.limpar();
  await gravar('atendimentoChats', {});
  await gravar('registroAtendimento', []);
  await gravar('contatos', {});
  try {
    await fn();
    console.log(`  ok   ${nome}`);
  } catch (e) {
    falhas++;
    const reg = (await ler('registroAtendimento')).map((r) => `        registro: ${r.texto}`).reverse().join('\n');
    console.log(`  FALHOU ${nome}\n        ${(e as Error).message}\n${reg}`);
  }
}

function igual<T>(real: T, esperado: T, msg: string) {
  if (JSON.stringify(real) !== JSON.stringify(esperado)) throw new Error(`${msg}\n        esperado: ${JSON.stringify(esperado)}\n        veio:     ${JSON.stringify(real)}`);
}

async function main() {
  iniciarAtendimento(() => {});
  console.log('Atendimento automático');

  await caso('primeiro contato: manda a saudação de primeiro contato e a IA responde', async () => {
    await configurar({});
    sim.cliente('a1@c.us', 'oi');
    await assentar();
    igual(enviadosPara('a1@c.us'), ['Olá! Seja bem-vindo.', 'Resposta da IA'], 'mensagens enviadas');
  });

  await caso('cliente que volta depois de 13h: saudação de retorno', async () => {
    await configurar({});
    sim.historico('a2@c.us', false, 'oi', 30 * HORA);
    sim.historico('a2@c.us', true, 'olá', 29 * HORA);
    sim.cliente('a2@c.us', 'bom dia');
    await assentar();
    igual(enviadosPara('a2@c.us'), ['Que bom te ver de novo!', 'Resposta da IA'], 'mensagens enviadas');
  });

  await caso('contato salvo na agenda conta como cliente que volta', async () => {
    await configurar({});
    sim.salvos.add('a3@c.us');
    sim.cliente('a3@c.us', 'oi');
    await assentar();
    igual(enviadosPara('a3@c.us')[0], 'Que bom te ver de novo!', 'saudação');
  });

  await caso('conversa em andamento (menos de 12h): sem saudação, só a IA', async () => {
    await configurar({});
    sim.historico('a4@c.us', false, 'oi', 2 * HORA);
    sim.historico('a4@c.us', true, 'olá, tudo bem?', 2 * HORA);
    sim.cliente('a4@c.us', 'qual o horário de vocês?');
    await assentar();
    igual(enviadosPara('a4@c.us'), ['Resposta da IA'], 'mensagens enviadas');
  });

  await caso('mensagens picadas: responde uma vez só, com tudo junto', async () => {
    await configurar({ saudacaoAtiva: false });
    sim.historico('a5@c.us', true, 'olá', HORA);
    sim.cliente('a5@c.us', 'oi');
    await espera(300);
    sim.cliente('a5@c.us', 'queria saber');
    await espera(300);
    sim.cliente('a5@c.us', 'do preço');
    await assentar();
    igual(enviadosPara('a5@c.us').length, 1, 'quantidade de respostas');
    if (!sim.chamadasIA[0].includes('do preço')) throw new Error('a IA não recebeu a última mensagem');
  });

  await caso('mensagem cifrada (evento duplo do WhatsApp): responde uma vez', async () => {
    await configurar({ saudacaoAtiva: false });
    sim.historico('a6@c.us', true, 'olá', HORA);
    sim.cliente('a6@c.us', 'oi', { cifrada: true });
    await assentar();
    igual(enviadosPara('a6@c.us').length, 1, 'quantidade de respostas');
  });

  await caso('as mensagens do próprio robô NÃO contam como equipe assumindo', async () => {
    await configurar({});
    sim.cliente('a7@c.us', 'oi');
    await assentar();
    sim.cliente('a7@c.us', 'e o preço?');
    await assentar();
    igual(enviadosPara('a7@c.us').length, 3, 'saudação + 2 respostas da IA');
    const e = (await ler('atendimentoChats'))['a7@c.us'];
    igual(!!e?.humanoEm, false, 'conversa não pode estar com a equipe');
  });

  await caso('equipe escreve: a IA para nesta conversa', async () => {
    await configurar({ saudacaoAtiva: false });
    sim.historico('a8@c.us', false, 'oi', HORA);
    sim.equipe('a8@c.us', 'Oi, aqui é o Anderson');
    await espera(1600);
    sim.cliente('a8@c.us', 'beleza, e o preço?');
    await assentar();
    igual(enviadosPara('a8@c.us'), [], 'nada enviado pelo robô');
  });

  await caso('equipe responde enquanto o robô espera o cliente terminar: cancela', async () => {
    await configurar({ saudacaoAtiva: false, esperaMin: 3, esperaMax: 3 });
    sim.historico('a9@c.us', true, 'olá', HORA);
    sim.cliente('a9@c.us', 'oi');
    await espera(500);
    sim.equipe('a9@c.us', 'Fala!');
    await assentar(4200);
    igual(enviadosPara('a9@c.us'), [], 'nada enviado pelo robô');
  });

  await caso('a IA volta na próxima conversa (depois de 12h) quando configurado assim', async () => {
    await configurar({ saudacaoAtiva: false });
    await gravar('atendimentoChats', { 'b1@c.us': { seguidas: 0, visto: Date.now(), humanoEm: Date.now() - 20 * HORA * 1000, motivoHumano: 'equipe' } });
    sim.historico('b1@c.us', true, 'tchau', 20 * HORA);
    sim.cliente('b1@c.us', 'oi de novo');
    await assentar();
    igual(enviadosPara('b1@c.us'), ['Resposta da IA'], 'IA respondeu');
  });

  await caso('"só quando eu devolver": continua com a equipe na conversa nova', async () => {
    await configurar({ saudacaoAtiva: false, voltaIA: 'manual' });
    await gravar('atendimentoChats', { 'b2@c.us': { seguidas: 0, visto: Date.now(), humanoEm: Date.now() - 20 * HORA * 1000, motivoHumano: 'equipe' } });
    sim.historico('b2@c.us', true, 'tchau', 20 * HORA);
    sim.cliente('b2@c.us', 'oi de novo');
    await assentar();
    igual(enviadosPara('b2@c.us'), [], 'nada enviado');
  });

  await caso('cliente manda "sair": não recebe mais nada automático', async () => {
    await configurar({});
    sim.historico('b3@c.us', true, 'olá', HORA);
    sim.cliente('b3@c.us', 'Sair');
    await assentar();
    sim.cliente('b3@c.us', 'oi');
    await assentar();
    igual(enviadosPara('b3@c.us'), [], 'nada enviado');
  });

  await caso('limite de respostas seguidas: passa para a equipe', async () => {
    await configurar({ saudacaoAtiva: false, limiteSeguidas: 2 });
    sim.historico('b4@c.us', true, 'olá', HORA);
    for (const t of ['a', 'b', 'c']) {
      sim.cliente('b4@c.us', t);
      await assentar();
    }
    igual(enviadosPara('b4@c.us').length, 2, 'só 2 respostas');
    igual((await ler('atendimentoChats'))['b4@c.us']?.motivoHumano, 'limite', 'motivo');
  });

  await caso('IA pede ajuda ([ATENDENTE]): avisa o cliente e passa para a equipe', async () => {
    await configurar({ saudacaoAtiva: false });
    sim.historico('b5@c.us', true, 'olá', HORA);
    sim.ia = () => '[ATENDENTE] Vou chamar alguém da equipe.';
    sim.cliente('b5@c.us', 'quero pagar');
    await assentar();
    igual(enviadosPara('b5@c.us'), ['Vou chamar alguém da equipe.'], 'mensagem ao cliente');
    igual((await ler('atendimentoChats'))['b5@c.us']?.motivoHumano, 'ia', 'motivo');
  });

  await caso('IA decide não responder ([SEM_RESPOSTA]): nada sai e fica anotado', async () => {
    await configurar({ saudacaoAtiva: false });
    sim.historico('b6@c.us', true, 'olá', HORA);
    sim.ia = () => '[SEM_RESPOSTA]';
    sim.cliente('b6@c.us', 'ok obrigado');
    await assentar();
    igual(enviadosPara('b6@c.us'), [], 'nada enviado');
    const r = await ler('registroAtendimento');
    if (!r.some((x) => x.texto.includes('não precisava de resposta'))) throw new Error('registro não explicou');
  });

  await caso('grupo: ignora', async () => {
    await configurar({});
    sim.cliente('123@g.us', 'oi');
    await assentar();
    igual(enviadosPara('123@g.us'), [], 'nada enviado');
  });

  await caso('mensagem antiga (chegou com o WhatsApp fechado): ignora', async () => {
    await configurar({});
    sim.cliente('b7@c.us', 'oi', { segAtras: 3 * HORA });
    await assentar();
    igual(enviadosPara('b7@c.us'), [], 'nada enviado');
  });

  await caso('IA desligada e saudação ligada: só a saudação', async () => {
    await configurar({ iaAtiva: false });
    sim.cliente('b8@c.us', 'oi');
    await assentar();
    igual(enviadosPara('b8@c.us'), ['Olá! Seja bem-vindo.'], 'só saudação');
  });

  await caso('tudo desligado: não faz nada e anota o motivo', async () => {
    await configurar({ iaAtiva: false, saudacaoAtiva: false });
    sim.cliente('b9@c.us', 'oi');
    await assentar();
    igual(enviadosPara('b9@c.us'), [], 'nada enviado');
    if (!(await ler('registroAtendimento')).length) throw new Error('não anotou');
  });

  await caso('erro da IA (chave errada): não trava e anota o erro', async () => {
    await configurar({ saudacaoAtiva: false });
    sim.historico('c1@c.us', true, 'olá', HORA);
    sim.ia = () => new Error('API key not valid');
    sim.cliente('c1@c.us', 'oi');
    await assentar();
    const r = await ler('registroAtendimento');
    if (!r.some((x) => x.erro && x.texto.includes('API key'))) throw new Error('erro não anotado');
    sim.ia = () => 'Voltei';
    sim.cliente('c1@c.us', 'alô?');
    await assentar();
    igual(enviadosPara('c1@c.us'), ['Voltei'], 'segunda tentativa');
  });

  await caso('assinatura das mensagens automáticas', async () => {
    await configurar({ nomeAssinatura: 'Assistente virtual' });
    sim.cliente('c2@c.us', 'oi');
    await assentar();
    igual(enviadosPara('c2@c.us'), ['*Assistente virtual*:\nOlá! Seja bem-vindo.', '*Assistente virtual*:\nResposta da IA'], 'assinadas');
  });

  await caso('saudação vazia + IA ligada: a IA responde mesmo assim', async () => {
    await configurar({ primeiroContato: [] });
    sim.cliente('c3@c.us', 'oi');
    await assentar();
    igual(enviadosPara('c3@c.us'), ['Resposta da IA'], 'IA respondeu');
  });

  await caso('a IA recebe a conversa com quem é cliente e quem é empresa', async () => {
    await configurar({ saudacaoAtiva: false });
    sim.historico('c4@c.us', false, 'oi', HORA);
    sim.historico('c4@c.us', true, 'Olá, tudo bem?', HORA);
    sim.cliente('c4@c.us', 'tudo e vc');
    await assentar();
    const ctx = sim.chamadasIA[0] ?? '';
    if (!ctx.includes('Cliente: oi') || !ctx.includes('Empresa: Olá, tudo bem?') || !ctx.includes('Cliente: tudo e vc')) throw new Error(`contexto errado:\n${ctx}`);
  });

  console.log(falhas ? `\n${falhas} de ${n} falharam` : `\nTodos os ${n} passaram`);
  process.exit(falhas ? 1 : 0);
}

main();
