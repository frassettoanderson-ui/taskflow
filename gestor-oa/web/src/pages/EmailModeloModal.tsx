import { useRef, useState } from 'react';
import { Save, Send, X } from 'lucide-react';

// Variaveis disponiveis (colchetes substituidos no envio) - ordem do Acessorias
const TAGS: { tag: string; desc: string }[] = [
  { tag: 'NomeCompCli', desc: 'Nome completo do cliente' },
  { tag: 'Office', desc: "Escritorio (mesmo do 'From' dos e-mails)" },
  { tag: 'EmpresaCNPJ', desc: 'CNPJ da empresa do cliente' },
  { tag: 'EmpresaFantasia', desc: 'Nome Fantasia da empresa' },
  { tag: 'LinkDoc', desc: 'Nome e link de acesso do documento' },
  { tag: 'SigMail', desc: 'Assinatura do e-mail' },
  { tag: 'NomeResp', desc: 'Responsavel pelo departamento' },
  { tag: 'NomeDpto', desc: 'departamento do documento' },
  { tag: 'EmpresaID', desc: 'ID da empresa do cliente' },
  { tag: 'VctoDoc', desc: 'Data de vcto. / pgto. do documento' },
  { tag: 'Cmts', desc: 'Comentarios do documento' },
  { tag: 'ObrNome', desc: 'Nome da Obrigacao' },
  { tag: 'NomeCli', desc: 'Primeiro nome do cliente' },
  { tag: 'NCompResp', desc: 'Nome completo do responsavel pelo departamento' },
  { tag: 'EmpresaCli', desc: 'Nome da empresa do cliente' },
  { tag: 'EmpresaGrupo', desc: 'Grupo da empresa do cliente' },
  { tag: 'CompDoc', desc: 'Competencia do documento' },
  { tag: 'LogoEmpresa', desc: 'Logo da Empresa' },
  { tag: 'ObrMininome', desc: 'Mininome da Obrigacao' },
  { tag: 'Office', desc: "Escritorio (mesmo do 'From' dos e-mails)" },
];

const CORPO_INDIVIDUAL = `Ola [NomeCli], [NomeResp] da [Office] aqui, tudo bem?

Segue abaixo documento do departamento [NomeDpto]:

Empresa: [EmpresaCli]
Vencimento: [VctoDoc]
Obs: [Cmts]
Guia: [LinkDoc]

Qualquer duvida por favor entre em contato.
Att. [NomeResp]`;

const CORPO_AGENDADO = `Ola [NomeCli], [NomeResp] da [Office] aqui, tudo bem?

Segue abaixo lista de documentos da empresa [EmpresaCli] do departamento [NomeDpto]:

- [VctoDoc] [LinkDoc]
  [Cmts]

Qualquer duvida por favor entre em contato.
Att. [Office]`;

export interface ModeloEmail {
  tituloComVcto?: string;
  tituloSemVcto?: string;
  titulo?: string;
  corpo?: string;
}

interface Props {
  tipo: 'individual' | 'agendado';
  valor: ModeloEmail;
  onSalvar: (v: ModeloEmail) => void;
  onFechar: () => void;
}

export default function EmailModeloModal({ tipo, valor, onSalvar, onFechar }: Props) {
  const individual = tipo === 'individual';
  const [tituloComVcto, setTituloComVcto] = useState(valor.tituloComVcto ?? '');
  const [tituloSemVcto, setTituloSemVcto] = useState(valor.tituloSemVcto ?? '');
  const [titulo, setTitulo] = useState(valor.titulo ?? '');
  const [corpo, setCorpo] = useState(valor.corpo ?? (individual ? CORPO_INDIVIDUAL : CORPO_AGENDADO));
  const corpoRef = useRef<HTMLTextAreaElement>(null);

  function inserir(tag: string) {
    const el = corpoRef.current;
    const token = `[${tag}]`;
    if (!el) { setCorpo((c) => c + token); return; }
    const ini = el.selectionStart ?? corpo.length;
    const fim = el.selectionEnd ?? corpo.length;
    const novo = corpo.slice(0, ini) + token + corpo.slice(fim);
    setCorpo(novo);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = ini + token.length; });
  }

  function salvar() {
    onSalvar(individual
      ? { tituloComVcto, tituloSemVcto, corpo }
      : { titulo, corpo });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onFechar}>
      <div className="my-4 w-full max-w-5xl rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-lg font-medium text-marca-600">
            E-mail {individual ? 'individual' : 'agrupado'} a ser enviado aos clientes <span className="text-[13px] text-status-warn">(nao utilizar aspas)</span>
          </h2>
          <button onClick={onFechar} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="space-y-4 p-5">
          {/* Legenda de variaveis */}
          <div>
            <p className="mb-1 text-[12px] text-slate-500">Legenda das variaveis: os colchetes [...] serao substituidos no corpo do e-mail. Dica: <span className="text-marca-500">[clique p/ inserir]</span></p>
            <div className="columns-1 gap-x-6 text-[11px] sm:columns-2 lg:columns-3">
              {TAGS.map((t) => (
                <button key={t.tag} onClick={() => inserir(t.tag)} className="mb-0.5 block break-inside-avoid text-left hover:underline" title="Clique para inserir">
                  <span className="font-semibold text-marca-600">[{t.tag}]</span> <span className="text-slate-500">= {t.desc}</span>
                </button>
              ))}
            </div>
            {!individual && <p className="mt-1 text-[11px] text-status-ok">(Lista nao ordenada) = Dados dos envios agendados serao repetidos nesse formato.</p>}
          </div>

          {/* Titulos */}
          {individual ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-0.5 block text-[12px] font-medium text-slate-600">Titulo do e-mail ao enviar documento <span className="text-status-warn">com vencimento</span></label>
                <input className="block w-full rounded border border-slate-300 px-2 py-1.5 text-[12px]" placeholder="Padrao: Guia pgto [[ObrMininome]] - Vencimento: [VctoDoc]" value={tituloComVcto} onChange={(e) => setTituloComVcto(e.target.value)} />
              </div>
              <div>
                <label className="mb-0.5 block text-[12px] font-medium text-slate-600">Titulo do e-mail ao enviar documento <span className="text-status-warn">sem vencimento</span></label>
                <input className="block w-full rounded border border-slate-300 px-2 py-1.5 text-[12px]" placeholder="Padrao: Documento [[ObrMininome]]" value={tituloSemVcto} onChange={(e) => setTituloSemVcto(e.target.value)} />
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-0.5 block text-[12px] font-medium text-slate-600">Titulo do e-mail agrupado / agendado</label>
              <input className="block w-full rounded border border-slate-300 px-2 py-1.5 text-[12px]" placeholder="Padrao: Documentos do dpto [[NomeDpto]]" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
          )}

          {/* Corpo */}
          <textarea ref={corpoRef} className="block h-72 w-full rounded border border-slate-300 p-3 font-mono text-[13px] leading-relaxed outline-none focus:border-marca-400" value={corpo} onChange={(e) => setCorpo(e.target.value)} />
          <div className="text-right text-[11px] text-slate-400">{corpo.trim().split(/\s+/).filter(Boolean).length} palavras · {corpo.length} caracteres</div>
        </div>

        {/* Rodape */}
        <div className="grid grid-cols-1 gap-2 border-t border-slate-200 p-4 sm:grid-cols-3">
          <button onClick={salvar} className="flex items-center justify-center gap-2 rounded-md bg-status-ok py-2 text-sm font-medium text-white hover:bg-emerald-600"><Save size={16} /> Salvar modelo de e-mail</button>
          <button onClick={() => alert('Em construcao: envio de teste do modelo.')} className="flex items-center justify-center gap-2 rounded-md bg-marca-500 py-2 text-sm font-medium text-white hover:bg-marca-600"><Send size={16} /> Enviar modelo de e-mail</button>
          <button onClick={onFechar} className="flex items-center justify-center gap-2 rounded-md bg-status-danger py-2 text-sm font-medium text-white hover:bg-red-600"><X size={16} /> Cancelar</button>
        </div>
      </div>
    </div>
  );
}
