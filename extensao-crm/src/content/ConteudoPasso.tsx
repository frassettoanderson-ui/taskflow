// Editor do conteúdo de uma mensagem (resposta simples ou etapa de fluxo):
// texto, imagem, vídeo, áudio (arquivo ou gravado aqui) ou documento + "digitando/gravando" antes de enviar.
import { useEffect, useRef, useState } from 'react';
import { VARIAVEIS, type PassoFluxo, type Simulacao, type TipoPasso } from '../shared/dados';
import { lerArquivoComoDataUrl } from '../ui/formato';
import { IconDocumento, IconImagem, IconMicrofone, IconRaio, IconVideo } from '../ui/icones';
import { BotoesIA } from './BotoesIA';
import { useCRM } from './contexto';

export type ConteudoEditavel = Pick<PassoFluxo, 'tipo' | 'texto' | 'arquivo' | 'nomeArquivo' | 'ptt' | 'duracaoSeg' | 'simular' | 'simularSeg'>;

const ACEITA: Record<TipoPasso, string> = { texto: '', image: 'image/*', video: 'video/*', audio: 'audio/*', document: '*/*' };
const ICONE: Record<TipoPasso, (p: { tam?: number }) => JSX.Element> = { texto: IconRaio, image: IconImagem, video: IconVideo, audio: IconMicrofone, document: IconDocumento };
const NOME: Record<TipoPasso, string> = { texto: 'Texto', image: 'Imagem', video: 'Vídeo', audio: 'Áudio', document: 'Arquivo' };
const LIMITE_MB = 16;

/** Nome amigável de cada dado do cliente (o código {{...}} fica escondido de quem não é técnico). */
const NOME_VARIAVEL: Record<string, string> = {
  primeiro_nome: 'Primeiro nome',
  nome: 'Nome completo',
  saudacao: 'Bom dia / Boa tarde',
  periodo_dia: 'manhã / tarde / noite',
  numero: 'Número',
  email: 'E-mail',
  empresa: 'Empresa',
  cargo: 'Cargo',
  cidade: 'Cidade',
  estado: 'Estado',
  origem: 'Origem',
  produtos: 'Produtos',
  valor_negocio: 'Valor do negócio',
  mencionar_todos: 'Marcar todos (grupo)',
};
const PRINCIPAIS = ['primeiro_nome', 'nome', 'saudacao', 'numero'];

export function ConteudoPasso({ valor, aoMudar, mostrarVariaveis = true }: { valor: ConteudoEditavel; aoMudar: (p: Partial<ConteudoEditavel>) => void; mostrarVariaveis?: boolean }) {
  const { avisar } = useCRM();

  const escolherArquivo = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > LIMITE_MB * 1024 * 1024) return avisar(`Arquivo acima de ${LIMITE_MB} MB`, true);
    aoMudar({ arquivo: await lerArquivoComoDataUrl(f), nomeArquivo: f.name });
  };

  return (
    <>
      <div className="seletor-tipo">
        {(Object.keys(NOME) as TipoPasso[]).map((t) => {
          const Icone = ICONE[t];
          return (
            <button
              key={t}
              type="button"
              aria-pressed={valor.tipo === t}
              onClick={() =>
                aoMudar({
                  tipo: t,
                  arquivo: t === valor.tipo ? valor.arquivo : undefined,
                  nomeArquivo: t === valor.tipo ? valor.nomeArquivo : undefined,
                  simular: t === 'audio' && valor.simular === 'nenhuma' ? 'gravando' : valor.simular,
                  ptt: t === 'audio' ? valor.ptt !== false : valor.ptt,
                })
              }
            >
              <Icone />
              {NOME[t]}
            </button>
          );
        })}
      </div>

      {valor.tipo === 'audio' ? (
        <GravadorAudio valor={valor} aoMudar={aoMudar} />
      ) : (
        valor.tipo !== 'texto' && (
          <label className="campo campo--largo">
            <span>Arquivo (até {LIMITE_MB} MB)</span>
            <input className="entrada" type="file" accept={ACEITA[valor.tipo]} onChange={(e) => escolherArquivo(e.target.files?.[0])} />
            {valor.nomeArquivo && <small style={{ color: 'var(--tinta-3)' }}>Atual: {valor.nomeArquivo}</small>}
          </label>
        )
      )}
      {valor.tipo === 'image' && valor.arquivo && <img src={valor.arquivo} alt="" className="campo--largo" style={{ maxHeight: 160, objectFit: 'contain', borderRadius: 5 }} />}

      {valor.tipo !== 'audio' && (
        <label className="campo campo--largo">
          <span>{valor.tipo === 'texto' ? 'Mensagem' : 'Legenda (opcional)'}</span>
          <textarea className="entrada" rows={valor.tipo === 'texto' ? 5 : 2} value={valor.texto} onChange={(e) => aoMudar({ texto: e.target.value })} placeholder="{{saudacao}}, {{primeiro_nome}}! Tudo bem?" />
          {valor.tipo === 'texto' && <BotoesIA texto={valor.texto} aoResultado={(t) => aoMudar({ texto: t })} />}
          {mostrarVariaveis && <Variaveis aoInserir={(v) => aoMudar({ texto: `${valor.texto}{{${v}}}` })} />}
        </label>
      )}

      <label className="campo">
        <span>Antes de mandar, o cliente vê</span>
        <select className="entrada" value={valor.simular} onChange={(e) => aoMudar({ simular: e.target.value as Simulacao })}>
          <option value="nenhuma">Nada (manda na hora)</option>
          <option value="digitando">"digitando..."</option>
          <option value="gravando">"gravando áudio..."</option>
        </select>
      </label>
      <label className="campo">
        <span>Durante quantos segundos</span>
        <input className="entrada" type="number" min={1} max={30} disabled={valor.simular === 'nenhuma'} value={valor.simularSeg} onChange={(e) => aoMudar({ simularSeg: Number(e.target.value) || 1 })} />
      </label>
    </>
  );
}

/** Botões para colocar dados do cliente no texto (o nome dele, bom dia/boa tarde...). */
function Variaveis({ aoInserir }: { aoInserir: (v: string) => void }) {
  const [todas, setTodas] = useState(false);
  const lista = todas ? [...VARIAVEIS] : PRINCIPAIS;
  return (
    <div className="variaveis">
      <span className="variaveis__rotulo">Colocar no texto:</span>
      {lista.map((v) => (
        <button key={v} type="button" className="variavel" title={`Entra como {{${v}}} e vira o dado de cada cliente`} onClick={() => aoInserir(v)}>
          {NOME_VARIAVEL[v] ?? v}
        </button>
      ))}
      <button type="button" className="variavel variavel--mais" onClick={() => setTodas((x) => !x)}>
        {todas ? 'menos' : 'mais dados'}
      </button>
    </div>
  );
}

function GravadorAudio({ valor, aoMudar }: { valor: ConteudoEditavel; aoMudar: (p: Partial<ConteudoEditavel>) => void }) {
  const { avisar } = useCRM();
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<number>();

  useEffect(() => () => pararTudo(), []);

  const pararTudo = () => {
    clearInterval(timer.current);
    rec.current?.stream.getTracks().forEach((t) => t.stop());
  };

  const comecar = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? { mimeType: 'audio/webm;codecs=opus' } : undefined);
      const partes: Blob[] = [];
      mr.ondataavailable = (e) => e.data.size && partes.push(e.data);
      mr.onstop = async () => {
        clearInterval(timer.current);
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(partes, { type: mr.mimeType || 'audio/webm' });
        const r = new FileReader();
        r.onload = () => aoMudar({ arquivo: r.result as string, nomeArquivo: 'audio.webm', ptt: true, duracaoSeg: segundos, simular: valor.simular === 'nenhuma' ? 'gravando' : valor.simular });
        r.readAsDataURL(blob);
      };
      rec.current = mr;
      setSegundos(0);
      mr.start();
      setGravando(true);
      timer.current = window.setInterval(() => setSegundos((s) => s + 1), 1000);
    } catch {
      avisar('Não consegui usar o microfone. Permita o microfone para este site.', true);
    }
  };

  const parar = () => {
    rec.current?.stop();
    setGravando(false);
  };

  return (
    <div className="campo campo--largo">
      <span>Áudio</span>
      <div className="gravador">
        {gravando ? (
          <button type="button" className="btn btn--perigo" onClick={parar}>
            Parar ({segundos}s)
          </button>
        ) : (
          <button type="button" className="btn" onClick={comecar}>
            <IconMicrofone tam={16} />
            Gravar áudio
          </button>
        )}
        <label className="btn btn--pequeno">
          Escolher arquivo
          <input type="file" accept="audio/*" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > LIMITE_MB * 1024 * 1024) return avisar(`Arquivo acima de ${LIMITE_MB} MB`, true);
            aoMudar({ arquivo: await lerArquivoComoDataUrl(f), nomeArquivo: f.name, ptt: valor.ptt !== false });
          }} />
        </label>
      </div>
      {valor.arquivo && <audio src={valor.arquivo} controls className="campo--largo" style={{ marginTop: 8 }} />}
      <label className="campo--linha" style={{ marginTop: 6 }}>
        <input type="checkbox" checked={valor.ptt !== false} onChange={(e) => aoMudar({ ptt: e.target.checked })} />
        Enviar como mensagem de voz (com a onda sonora, igual a um áudio gravado)
      </label>
    </div>
  );
}
