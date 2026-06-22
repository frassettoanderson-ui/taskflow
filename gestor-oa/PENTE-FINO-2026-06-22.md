# Pente-fino GestorOA — 22/06/2026

Auditoria das áreas **Sistema**, **Obrigações** e **Empresas** (foco no que foi feito até aqui).
Base: telas comparadas ao Acessórias + materiais/transcrições enviados.

---

## A) Corrigido nesta varredura
- **Ficha da empresa › Solicitações App**: o botão "Ver solicitações" apontava para `/portal-gestao/solicitacoes` (rota inexistente → tela em branco/redirect). Corrigido para `/area-vip/solicitacoes`. ✅ deployado.

## Verificações que passaram (sem problema)
- **Rotas do menu**: nenhuma entrada de menu "pendurada" (não há itens `emBreve` ativos no Layout). Todos os itens do menu levam a rotas válidas.
- **Navegações (`navigate(...)`)**: todos os destinos usados nas telas existem em `App.tsx` (conferido um a um) — exceto o link de Solicitações acima, já corrigido.
- **Endpoints chamados pelo front novo existem no back**: `/regimes`, `/matrizes`, `/processos/recorrencias`, `/obrigacoes`, `/grupos-empresa`, `/motivos-cancelamento`, `/departamentos`, `/empresas/:id/(contatos|tarefas|anexos|identificadores|responsaveis)`. Todos montados em `routes.ts`.

---

## B) Pontas soltas reais (recomendo resolver)

1. **+ Nova empresa (`EmpresaForm.tsx`) ainda usa o layout ANTIGO** (form simples em coluna), não a nova estrutura da ficha (form fixo + 12 ícones). Combinamos que a mesma estrutura serve para o cadastro novo. → Etapa C: aplicar `EmpresaFicha` (modo "novo") no `+ Nova empresa`.

2. **Botão "Editar" (amarelo) dos Contatos e das Tarefas** abre nada (só visual). Falta a edição inline. (Remover/adicionar já funcionam.)

3. **Obrigações da empresa (seção 6 da ficha)** reaproveita o componente antigo `AbaObrigacoes`, cujo layout difere do print do original (que tem: contadores 👍/👎/⚠️/➡️, coluna "Tempo previsto (min)", "Ativa? Sim/Não" por linha, agrupado por departamento colapsável, e ícones 👁/lista/impressora no topo). → revisar para bater com o original.

4. **Componentes ÓRFÃOS após a reescrita da ficha** (ao trocar abas pelos 12 ícones):
   - ✅ **RESOLVIDO `AbaComunicacao.tsx` (WhatsApp por empresa)**: as transcrições confirmam que o original **NÃO tem** WhatsApp como seção/funcionalidade por empresa. No Acessórias o WhatsApp aparece só como **link na Home do App/Área VIP** (título + link, em "Aplicativo e Área VIP") e como canal de suporte. Nossa Área VIP já replica isso ("Link's personalizados da Home", com ícone WhatsApp/Instagram). Então a aba foi invenção nossa (M8) → **arquivo removido**. Obs.: o backend de WhatsApp (M8 WhatsAppProvider/rotas de comunicação) ficou sem uso pelo front da ficha; manter por ora, decidir depois se remove.
   - ⏳ **PENDENTE `AbaDocumentos.tsx` (GED/Documentos da empresa)**: avaliar se o original mostra documentos por empresa em algum lugar (provável via Robô/AC Docs / Armazenamento) e direcionar para lá, ou remover. Código existe mas ninguém chama.

## C) Placeholders intencionais (modo de trabalho "caminho pronto + Em construção")
Esses são esperados — apareceram como `Em construcao` mas são telas/recursos que decidimos deixar para depois:
- **Empresas (lista) › exportações**: PDF, Excel Compacto/Completo/com Contatos, "Empresas inativas em uso", exportar e-mails em bloco.
- **Lista de Entregas**: exports (PDF relação / com comentários / grade), "filtros removedores", envio de e-mail agendado na baixa.
- **Usuários / Matrizes / EmailModelo**: PDF, "Enviar modelo", duplicar matriz, histórico de alterações de passos.
- **DepartamentoForm**: "Replicar marcações/responsáveis", edição dos e-mails (individual/agendamento).
- **ComunicadosAdmin**: "Registro de Leitura".
- **AreaVip**: "Log's de alteração do Link".
- **ImportarCsv**: detecção automática de CNPJs.
- **Processos**: filtros adicionais.

## D) Lacunas de MODELO já mapeadas (precisam de campo novo no schema p/ funcionar de verdade)
- **Contato**: "Recebe e-mails ref. documentos postados", "Checar block-list", "Trazer novos sempre com TODOS os deptos", **horários de acesso ao App** (Domingos / Seg-Sex / Sábados), **Último acesso**. Hoje são visuais. (departamentos permitidos e obrigações específicas JÁ persistem.)
- **Processos recorrentes (seção 9)**: "Gestor do processo" e "Não cria no mês atual" — visuais (o back só guarda matriz + dia do mês). (matriz + dia JÁ persistem.)
- **Anexos (seção 12)**: "Descrição" e "Departamento" do arquivo não persistem (modelo `EmpresaAnexo` não tem esses campos). O upload do arquivo funciona.
- **"Cadastro: data [criador]"** no topo da ficha: falta o NOME do usuário criador no modelo `Empresa` (só temos `createdAt`). Hoje mostro só a data.
- **Tarefas**: o botão Editar (vide B2).

## E) Itens da seção 1 (Endereço) que ficaram visuais por falta de uso real
- Os campos novos (Insc. Estaduais c/ data+UF, Empresa isenta, NIRE, Insc. Municipal, Website, Data abertura) JÁ persistem (migration aplicada). OK.

---

## Sugestão de ordem para amanhã
1. Aplicar a estrutura nova no **+ Nova empresa** (Etapa C) — fecha a tela de Empresas.
2. Revisar **Obrigações da empresa** (seção 6) p/ bater com o print.
3. Decidir os campos de **modelo do Contato** (horários/recebe-emails/último acesso) e implementar.
4. Edição inline de Contatos e Tarefas (botão amarelo).
5. Campo "criador" na Empresa p/ o "Cadastro: [usuário]".

> Nada acima quebra o uso atual — são telas funcionais com pontos a completar. O único bug real (link de Solicitações) já foi corrigido e deployado.
