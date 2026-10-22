// Status programado: texto, imagem ou vídeo postado no status do seu WhatsApp no horário escolhido.
import { useState } from 'react';
import { alterar, novoId, type StatusProgramado } from '../shared/dados';
import { dataHora, lerArquivoComoDataUrl, paraCampoDataHora } from '../ui/formato';
import { useColecao } from '../ui/hooks';
import { IconLixo, IconMais } from '../ui/icones';
import { useCRM } from './contexto';

const CORES_FUNDO = ['#C8551F', '#1D2024', '#2F8A57', '#5B8DEF', '#B96AD9', '#E0A030', '#D9534F', '#2BB3B1'];
const ROTULO: Record<StatusProgramado['status'], string> = { pendente: 'Aguardando', postado: 'Postado', falhou: 'Falhou', cancelado: 'Cancelado' };
const LIMITE_MB = 15;

type Form = Omit<StatusProgramado, 'id' | 'status' | 'quando'> & { quando: string };

export function StatusProgramados() {
  const { avisar } = useCRM();
  const lista = useColecao('statusProgramados') ?? [];
  const [form, setForm] = useState<Form | null>(null);
  const ordenada = [...lista].sort((a, b) => (a.status === 'pendente' ? 0 : 1) - (b.status === 'pendente' ? 0 : 1) || a.quando - b.quando);

  const escolherArquivo = async (f: File | undefined) => {
    if (!f || !form) return;
    if (f.size > LIMITE_MB * 1024 * 1024) return avisar(`Arquivo acima de ${LIMITE_MB} MB`, true);
    setForm({ ...form, arquivo: await lerArquivoComoDataUrl(f), nomeArquivo: f.name });
  };

  const salvar = async () => {
    if (!form) return;
    if (form.tipo === 'texto' && !form.texto.trim()) return avisar('Escreva o texto do status', true);
    if (form.tipo !== 'texto' && !form.arquivo) return avisar('Escolha o arquivo', true);
    const quando = new Date(form.quando).getTime();
    if (!quando || quando < Date.now() - 60_000) return avisar('Escolha uma data e hora no futuro', true);
    await alterar('statusProgramados', (l) => {
      l.push({ ...form, id: novoId(), quando, status: 'pendente', texto: form.texto.trim() });
    });
    setForm(null);
    avisar(`Status programado para ${dataHora(quando)}`);
  };

  if (form)
    return (
      <div className="campos">
        <div className="campo campo--largo">
          <span>Tipo</span>
          <div className="abas" style={{ justifyContent: 'flex-start', paddingTop: 0 }}>
            {(['texto', 'image', 'video'] as const).map((t) => (
              <button key={t} className="aba" aria-pressed={form.tipo === t} onClick={() => setForm({ ...form, tipo: t, arquivo: undefined, nomeArquivo: undefined })}>
                {t === 'texto' ? 'Texto' : t === 'image' ? 'Imagem' : 'Vídeo'}
              </button>
            ))}
          </div>
        </div>
        {form.tipo !== 'texto' && (
          <label className="campo campo--largo">
            <span>Arquivo (até {LIMITE_MB} MB)</span>
            <input className="entrada" type="file" accept={form.tipo === 'image' ? 'image/*' : 'video/*'} onChange={(e) => escolherArquivo(e.target.files?.[0])} />
          </label>
        )}
        {form.tipo === 'image' && form.arquivo && <img src={form.arquivo} alt="" className="campo--largo" style={{ maxHeight: 160, objectFit: 'contain', borderRadius: 5 }} />}
        <label className="campo campo--largo">
          <span>{form.tipo === 'texto' ? 'Texto do status' : 'Legenda (opcional)'}</span>
          <textarea className="entrada" rows={3} value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} />
        </label>
        {form.tipo === 'texto' && (
          <div className="campo campo--largo">
            <span>Cor de fundo</span>
            <div className="paleta" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
              {CORES_FUNDO.map((c) => (
                <button key={c} className="paleta__cor" style={{ background: c }} aria-pressed={form.corFundo === c} onClick={() => setForm({ ...form, corFundo: c })} />
              ))}
            </div>
            <div className="previa-status" style={{ background: form.corFundo }}>
              {form.texto || 'Prévia do status'}
            </div>
          </div>
        )}
        <label className="campo">
          <span>Data e hora</span>
          <input className="entrada" type="datetime-local" value={form.quando} onChange={(e) => setForm({ ...form, quando: e.target.value })} />
        </label>
        <label className="campo campo--linha" style={{ alignSelf: 'end' }}>
          <input type="checkbox" checked={form.repetir24h} onChange={(e) => setForm({ ...form, repetir24h: e.target.checked })} />
          Postar de novo a cada 24 horas
        </label>
        <div className="linha-botoes campo--largo">
          <button className="btn" onClick={() => setForm(null)}>
            Voltar
          </button>
          <button className="btn btn--primario" onClick={salvar}>
            Programar status
          </button>
        </div>
      </div>
    );

  return (
    <>
      {ordenada.length === 0 ? (
        <div className="vazio">
          <strong>Nenhum status programado</strong>
          Programe um status de texto, imagem ou vídeo para sair sozinho no horário.
        </div>
      ) : (
        <table className="tabela">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Conteúdo</th>
              <th>Repete</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ordenada.map((s) => (
              <tr key={s.id}>
                <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{dataHora(s.quando)}</td>
                <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.erro || s.texto}>
                  {s.tipo === 'texto' ? s.texto : `${s.tipo === 'image' ? 'Imagem' : 'Vídeo'}: ${s.nomeArquivo ?? ''}`}
                </td>
                <td>{s.repetir24h ? 'Todo dia' : 'Não'}</td>
                <td>
                  <span className={`situacao situacao--${s.status === 'postado' ? 'enviado' : s.status}`} title={s.erro}>
                    {ROTULO[s.status]}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  {s.status === 'pendente' ? (
                    <button className="btn btn--pequeno" onClick={() => alterar('statusProgramados', (l) => l.map((x) => (x.id === s.id ? { ...x, status: 'cancelado' as const } : x)))}>
                      Cancelar
                    </button>
                  ) : (
                    <button className="icone-btn" title="Apagar" onClick={() => alterar('statusProgramados', (l) => l.filter((x) => x.id !== s.id))}>
                      <IconLixo tam={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="linha-botoes" style={{ marginTop: 14 }}>
        <button className="btn btn--primario" onClick={() => setForm({ tipo: 'texto', texto: '', corFundo: CORES_FUNDO[0], repetir24h: false, quando: paraCampoDataHora(Date.now() + 3600_000) })}>
          <IconMais tam={16} />
          Programar status
        </button>
      </div>
    </>
  );
}
