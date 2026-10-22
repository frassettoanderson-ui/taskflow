# Roteiro: o que falta reescrever da WaSpeed

Base: inventário da WaSpeed 7.4.3.80 feito em 22/10/2026, comparado depois com a 7.4.3.91. Ela usa o mesmo wa-js (4.6.0) por baixo.
Ficam de fora: login/licença, upsell, comunicados do servidor deles, recursos que dependem dos servidores da WAScript.

## Fase 1 (feita)
Etapas do funil com filtro · ficha do contato · funil em quadro · respostas rápidas com "/" · mensagens agendadas · lembretes com notificação · backup JSON.

## Fase 2: completar o CRM do dia a dia (feita 22/10/2026, falta testar no Chrome)
Ficou de fora: "duplicar cartão ao mover" (no nosso modelo o contato já pode estar em vários funis ao mesmo tempo).
- **Vários funis** (cada um com suas colunas), em vez de um só. Opção "duplicar cartão ao mover".
- **Ficha completa:** cidade, estado, sexo, nascimento, cargo, origem do lead, produtos de interesse, observações, lista de valores do negócio (descrição, data, valor).
- **Variáveis novas** nas respostas a partir da ficha (`{{empresa}}`, `{{cidade}}`, `{{valor_negocio}}`...).
- **Respostas rápidas:** categorias com cor, filtro "mais usadas", simular digitando/gravando, script (sequência de várias respostas), ações extras (arquivar, mover de etapa).
- **Agendamento recorrente:** diário, semanal, quinzenal, mensal, anual, a cada N dias. Calendário com todos.
- **Etiquetas do WhatsApp Business:** mostrar e aplicar as etiquetas nativas (`WPP.labels`) além das nossas. Novo na 7.4.3.91: **criar e editar etiqueta** pelo Web (nome, cor da paleta do WhatsApp, visualização) e **ordenar as etiquetas** no quadro (`labels.addNewLabel`, `editLabel`, `getLabelColorPalette`).
- **Mencionar todos** em grupos como variável das respostas (`{{mencionar_todos}}`; a WaSpeed corrigiu esse recurso na 7.4.3.91).
- **Exportar para planilha** (contatos de uma etapa, ficha, funil) gerada no próprio navegador (SheetJS), sem servidor.
- **Abas fixas do inbox:** Não lidas, Grupos, Conversas individuais.

## Fase 3: envio em massa (NÃO será feita)
Decisão 22/10/2026: a extensão não terá disparo para listas. Para envio a muitos contatos, o caminho é a API oficial do WhatsApp Business (Meta Cloud API) com modelos aprovados e opt-in, fora da extensão.

<details><summary>Escopo original (descartado)</summary>

- Listas de contatos: por etapa, etiqueta, grupo (extrair participantes), planilha .xlsx/.csv, colar números. Validar número no WhatsApp antes.
- Intervalo aleatório entre envios, pausa a cada X envios, horário permitido, teste para mim, pausar/retomar/cancelar, relatório com falhas.
- **Obrigatório:** variação de texto por envio (spintax/variáveis), nada de mensagem idêntica em série; limites diários conservadores (regras dos incidentes de restrição).
- Ações pós-envio: mover de etapa, etiquetar, arquivar.

</details>

## Fase 4: automação (NÃO será feita na extensão)
Mesmo motivo da fase 3: nada de mensagens automáticas para contatos. Se for preciso, avaliar via API oficial.

<details><summary>Escopo original (descartado)</summary>

- **Auto atendimento:** gatilhos (qualquer mensagem, palavra-chave, primeira mensagem, primeira do dia), dias/horários, regras por etapa/etiqueta, ignorar grupos/arquivadas, simular digitação, resposta = sequência de ações.
- **Follow up:** ao entrar/sair de uma etapa ou após X tempo, cancelar se o cliente responder.
- **Fluxos (chatbot visual):** editor de blocos (texto com opções de resposta, mídia, lista, variável, espera, transferir para outro fluxo) + simulador. É o item mais trabalhoso.

</details>

## Fase 5: extras (parte feita 22/10/2026, v0.3.0)
Feito: nova conversa com número fora da agenda + link wa.me · modo privacidade com escolha por item · central de notificações (lembretes de hoje e vencidos, agendamentos com falha, busca) · assinatura do atendente nas mensagens enviadas pela extensão · backup automático diário em Downloads/CRM WhatsApp (7 arquivos, um por dia da semana) · lembrete no Google Agenda por link.
v0.4.0: status programado (texto/imagem/vídeo, repetir a cada 24h), anotações com anexo, webhooks (POST para URL própria, eventos: etapa, ficha, mensagem recebida, resposta enviada, agendamento enviado; últimos 30 envios).
Não feito: mostrar mensagens apagadas (expõe o que a outra pessoa apagou).

Escopo original:
- Iniciar conversa com número fora da agenda; gerador de link wa.me.
- Status programado (texto/imagem/vídeo), repostar a cada 24h.
- Modo privacidade (desfocar fotos, nomes, mensagens), escolhendo item por item o que fica oculto.
- Central de notificações: lembretes e agendamentos do dia num só lugar, agrupados em hoje/ontem/data, com busca e "marcar como lido".
- Mostrar mensagens apagadas (só na sessão).
- Anotações com mídia; Google Agenda por link.
- Webhooks para URL própria (nova mensagem, mudança de etapa).
- Assinatura do atendente nas mensagens.
- Backup automático diário.

## IA (feita 22/10/2026, v0.4.0)
Corrigir ortografia, Melhorar texto e Criar com IA nos editores de resposta e agendamento; Assistente da conversa (botão IA ou Ctrl+Shift+I) sugere a próxima resposta lendo as últimas 20 mensagens + ficha. Sempre rascunho: vai para o campo, a pessoa revisa e envia. Chave própria (Groq/Gemini/OpenAI) chamada pelo service worker. Não há agente respondendo sozinho.

Referência original:
Novo na 7.4.3.91: menu de IA no editor de mensagens com **Corrigir ortografia**, **Melhorar texto** e **Criar texto com IA** (a partir de um pedido). O "Melhorar" usa um prompt de copy de vendas com uma regra boa de copiar: só usar escassez/urgência se o texto original já tiver ("últimas vagas", "só hoje" nunca inventados). Com chave própria (Groq/Gemini) roda sem servidor.

## Não reproduzir agora (precisam de servidor)
Multi-atendimento/transferência entre atendentes, API do WhatsApp por token, Pixel/API de Conversões Meta, transcrição de áudio, IA. Se forem necessários, entram num backend nosso (VPS) depois.
