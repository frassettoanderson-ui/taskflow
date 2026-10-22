# CRM WhatsApp (extensão Chrome) — nome provisório

Extensão MV3 com **código próprio**, inspirada na WaSpeed (que é usada hoje, modificada, em `../waspeed-7.4.3.80/`).
Mesma ideia da migração Doma → HolyTech: reescrever os recursos, não remendar o build de terceiro.
Sem IA por enquanto (a Bia segue na WaSpeed modificada).

## Stack
- TypeScript + React 18, empacotado com **esbuild** (`build.mjs`) em `dist/`.
- **wa-js** do WPPConnect (`@wppconnect/wa-js`, Apache-2.0) faz a interação com o WhatsApp Web.
- Dados **só no navegador**: `chrome.storage.local` (`src/shared/dados.ts`), sem servidor. Backup = exportar/importar JSON nas Configurações.

## Como rodar
```powershell
cd extensao-crm
npm install
npm run build      # ou: npm run dev  (recompila ao salvar)
```
Chrome → `chrome://extensions` → Modo do desenvolvedor → **Carregar sem compactação** → pasta `extensao-crm/dist`.
Depois de cada build: ↻ no card da extensão e F5 no WhatsApp Web.
Não deixar a WaSpeed ligada junto (as duas mexem na lista de conversas).

## Arquitetura
| Parte | Arquivo | Mundo |
|---|---|---|
| wa-js + ponte | `vendor/wa-js.js`, `src/bridge/index.ts` | MAIN (página). Só executa a lista fixa de métodos de `src/shared/protocolo.ts` |
| Interface | `src/content/*` (React em Shadow DOM) | isolado; fala com a ponte por `window.postMessage` (`src/content/wa.ts`) |
| Service worker | `src/background/index.ts` | lembretes (alarme 1 min + notificação), abrir WhatsApp pelo ícone |

- Barra superior (40px) empurra o `#app` do WhatsApp para baixo; a ficha (340px) encolhe pela direita (classes `crmw-barra` / `crmw-ficha` no `<html>`).
- Filtro por etapa usa `WPP.chat.setChatList('custom', ids)` na própria lista do WhatsApp.
- Agendamentos são enviados pela aba do WhatsApp (`src/content/agendador.ts`, a cada 20s). Atraso > 6h ou envio interrompido vira "Falhou" (não reenvia sozinho).
- Fonte Archivo embutida como data URL (CSP do WhatsApp). Visual: tokens em `src/ui/estilo.css`, claro/escuro segue o WhatsApp.

## Fase 1 (feita, 22/10/2026)
Barra de etapas com contagem e filtro · ficha do contato (etapa, nome, valor com máscara, empresa, e-mail, etiquetas, anotações, lembretes) · funil em quadro com arrastar · respostas rápidas (texto/imagem/vídeo/áudio/arquivo, variáveis `{{nome}}` `{{primeiro_nome}}` `{{saudacao}}` `{{numero}}`, atalho `/` no campo de mensagem) · mensagens agendadas · configurações (etapas, backup).

## Fase 2 (feita, 22/10/2026, v0.2.0)
Vários funis (`funis`, contato guarda `posicoes[funilId] = etapaId`; migração automática da chave antiga `etapas` em `dados.ts`) · modo "Etiquetas do WhatsApp" (funil virtual `FUNIL_ETIQUETAS`, só conta Business) · abas fixas Não lidas/Individuais/Grupos (`setChatList` nativo) · ficha completa + lista de negócios · etiquetas do WhatsApp na ficha, criar/editar/apagar/ordenar nas Configurações · respostas com categorias, mais usadas, script (sequência), digitando/gravando, ações depois de enviar (arquivar, mover de etapa, etiqueta WA) · variáveis da ficha + `{{mencionar_todos}}` · agendamento recorrente + calendário · planilhas .xlsx no navegador (SheetJS 0.20.3, do cdn.sheetjs.com).
Registros antigos são normalizados na leitura (`normContato`, `normResposta`).

## Fase 5 parcial (22/10/2026, v0.3.0)
Nova conversa (`NovaConversa.tsx`), privacidade (`privacidade.ts`, CSS com seletores do WhatsApp: conferir ao vivo), notificações (`Notificacoes.tsx`), assinatura (`envio.ts` > prepararTexto), backup automático (`background`, permissão downloads, data URL base64), Google Agenda (link TEMPLATE na ficha).
**Fases 3 e 4 (disparo em massa e automação de mensagens) não serão feitas na extensão.**

## v0.4.0 (22/10/2026)
Status programado (`StatusProgramados.tsx`, aba em Agendadas; motor em `agendador.ts` > rodadaStatus) · notas com anexo · webhooks (`shared/webhook.ts` emite, background faz o POST; fallback no-cors) · IA (`shared/ia.ts` prompts + chamada no background; `AbaIA`, `BotoesIA`, `Assistente`). A IA nunca envia sozinha.

## Próximas fases
Ver `ROADMAP.md` (inventário da WaSpeed → o que falta reescrever).
