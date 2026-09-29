"use client";
import { useActionState, useState } from "react";
import { salvarFornecedorAcao } from "../../loja-acoes";
import { mascaraTelefone, soDigitos } from "@/lib/format";

const mascaraDoc = (v: string) => {
  const d = soDigitos(v).slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
};

export function FormFornecedor() {
  const [estado, acao, pend] = useActionState(salvarFornecedorAcao, undefined);
  const [aberto, setAberto] = useState(false);
  const [tel, setTel] = useState("");
  const [doc, setDoc] = useState("");
  if (!aberto)
    return <button onClick={() => setAberto(true)} className="w-full rounded-xl border border-dashed border-ouro-escuro py-2.5 text-sm font-semibold text-ouro-escuro">+ Cadastrar fornecedor</button>;
  return (
    <form action={(fd) => { acao(fd); setTel(""); setDoc(""); }} className="space-y-2 rounded-2xl border filete bg-white p-3">
      <input name="nome" required placeholder="Nome do fornecedor" className="campo !py-2" />
      <input name="documento" value={doc} onChange={(e) => setDoc(mascaraDoc(e.target.value))} placeholder="CNPJ ou CPF" inputMode="numeric" className="campo !py-2" />
      <input name="telefone" value={tel} onChange={(e) => setTel(mascaraTelefone(e.target.value))} placeholder="Telefone / WhatsApp" inputMode="tel" className="campo !py-2" />
      <input name="email" type="email" placeholder="E-mail" className="campo !py-2" />
      {estado?.erro && <p className="text-xs text-rubi">{estado.erro}</p>}
      {estado?.ok && <p className="text-xs text-jade">{estado.ok}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setAberto(false)} className="flex-1 rounded-xl border filete py-2 text-sm">Fechar</button>
        <button disabled={pend} className="botao-ouro flex-1 py-2 text-sm">{pend ? "…" : "Salvar"}</button>
      </div>
    </form>
  );
}
