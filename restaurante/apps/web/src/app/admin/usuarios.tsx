'use client';

import { useCallback, useEffect, useState } from 'react';
import { chamarApi } from './api';

type Usuario = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  papelLabel: string;
  oQueFaz: string;
  pedidosLancados: number;
};

type Papel = { valor: string; label: string; oQueFaz: string };

export function Usuarios({
  papel,
  onErro,
  onAviso,
}: {
  papel: string;
  onErro: (e: string | null) => void;
  onAviso: (t: string) => void;
}) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [papeis, setPapeis] = useState<Papel[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [novo, setNovo] = useState(false);
  const [trocandoSenha, setTrocandoSenha] = useState<string | null>(null);

  /** Só o dono mexe em usuários — o gerente apenas vê. */
  const souDono = papel === 'OWNER';

  const carregar = useCallback(async () => {
    const [u, p] = await Promise.all([
      chamarApi<Usuario[]>('/admin/usuarios'),
      chamarApi<Papel[]>('/admin/papeis'),
    ]);
    if (u.ok) setUsuarios(u.dados);
    if (p.ok) setPapeis(p.dados);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function agir(caminho: string, opcoes: any, sucesso?: string) {
    setOcupado(true);
    onErro(null);
    const r = await chamarApi(caminho, opcoes);
    setOcupado(false);
    if (!r.ok) return onErro(r.erro), null;
    if (sucesso) onAviso(sucesso);
    await carregar();
    return r.dados;
  }

  return (
    <>
      {!souDono && (
        <p className="hint" style={{ marginTop: 0 }}>
          Você é <strong>gerente</strong>: pode ver a equipe, mas criar e apagar usuário é só do
          dono.
        </p>
      )}

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="grupo-cabecalho">
          <div className="stat-label" style={{ margin: 0 }}>
            Equipe ({usuarios.length})
          </div>
          {souDono && !novo && (
            <button className="ghost" style={{ width: 'auto' }} onClick={() => setNovo(true)}>
              + Nova pessoa
            </button>
          )}
        </div>

        {novo && (
          <FormularioUsuario
            papeis={papeis}
            ocupado={ocupado}
            onCancelar={() => setNovo(false)}
            onCriar={async (d) => {
              const r = await agir('/admin/usuarios', { metodo: 'POST', corpo: d }, 'Pessoa cadastrada.');
              if (r) setNovo(false);
            }}
          />
        )}

        {usuarios.map((u) => (
          <div className="chamado" key={u.id}>
            <span className="qual">
              <strong>{u.nome}</strong>
              <div className="sub">{u.email}</div>
              <div className="sub">
                {u.papelLabel} — {u.oQueFaz}
              </div>
              {u.pedidosLancados > 0 && (
                <div className="sub">{u.pedidosLancados} pedido(s) lançados</div>
              )}
            </span>

            {souDono && (
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <select
                  value={u.papel}
                  disabled={ocupado}
                  onChange={(e) =>
                    agir(
                      `/admin/usuarios/${u.id}`,
                      { metodo: 'PATCH', corpo: { role: e.target.value } },
                      'Perfil alterado.',
                    )
                  }
                  style={{ padding: '6px 8px', fontSize: 12.5 }}
                >
                  {papeis.map((p) => (
                    <option key={p.valor} value={p.valor}>
                      {p.label}
                    </option>
                  ))}
                </select>

                <button
                  className="ghost"
                  style={{ padding: '6px 10px', fontSize: 12.5 }}
                  onClick={() => setTrocandoSenha(trocandoSenha === u.id ? null : u.id)}
                >
                  senha
                </button>

                <button
                  className="remover"
                  disabled={ocupado}
                  onClick={() => {
                    if (!confirm(`Apagar ${u.nome}? Ele perde o acesso na hora.`)) return;
                    agir(`/admin/usuarios/${u.id}`, { metodo: 'DELETE' }, 'Pessoa removida.');
                  }}
                >
                  apagar
                </button>
              </span>
            )}
          </div>
        ))}

        {trocandoSenha && (
          <TrocarSenha
            ocupado={ocupado}
            onCancelar={() => setTrocandoSenha(null)}
            onTrocar={async (senha) => {
              const r = await agir(
                `/admin/usuarios/${trocandoSenha}/senha`,
                { metodo: 'PATCH', corpo: { password: senha } },
                'Senha trocada.',
              );
              if (r) setTrocandoSenha(null);
            }}
          />
        )}
      </section>

      <section className="card">
        <div className="stat-label">O que cada perfil enxerga</div>
        {papeis.map((p) => (
          <div className="regra-linha" key={p.valor}>
            <span>
              <strong>{p.label}</strong>
            </span>
            <span style={{ textAlign: 'right', maxWidth: 420 }}>{p.oQueFaz}</span>
          </div>
        ))}
      </section>
    </>
  );
}

function FormularioUsuario({
  papeis,
  ocupado,
  onCriar,
  onCancelar,
}: {
  papeis: Papel[];
  ocupado: boolean;
  onCriar: (d: unknown) => Promise<void>;
  onCancelar: () => void;
}) {
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'WAITER' });

  const escolhido = papeis.find((p) => p.valor === f.role);

  return (
    <div className="grupo">
      <div className="form-linha">
        <div>
          <label>Nome</label>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Maria Silva" />
        </div>
        <div>
          <label>E-mail (será o login)</label>
          <input
            type="email"
            value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })}
            placeholder="maria@seurestaurante.com"
          />
        </div>
      </div>

      <div className="form-linha">
        <div>
          <label>Senha inicial</label>
          <input
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
            placeholder="mínimo 6 caracteres"
          />
        </div>
        <div>
          <label>Perfil</label>
          <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} style={{ width: '100%' }}>
            {papeis.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {escolhido && <p className="hint" style={{ marginTop: 0 }}>{escolhido.oQueFaz}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          disabled={ocupado || !f.name.trim() || !f.email.includes('@') || f.password.length < 6}
          onClick={() => onCriar(f)}
        >
          Cadastrar
        </button>
        <button className="ghost" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
      <p className="hint">
        Entregue a senha para a pessoa e peça que ela troque. (A troca pelo próprio usuário ainda
        não existe — por enquanto é você quem redefine aqui.)
      </p>
    </div>
  );
}

function TrocarSenha({
  ocupado,
  onTrocar,
  onCancelar,
}: {
  ocupado: boolean;
  onTrocar: (senha: string) => Promise<void>;
  onCancelar: () => void;
}) {
  const [senha, setSenha] = useState('');

  return (
    <div className="grupo">
      <label>Nova senha</label>
      <div className="cupom-caixa">
        <input
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="mínimo 6 caracteres"
          style={{ textTransform: 'none' }}
        />
        <button disabled={ocupado || senha.length < 6} onClick={() => onTrocar(senha)}>
          Trocar
        </button>
        <button className="ghost" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
