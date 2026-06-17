# Agente e-Contínuo — GestorOA

Programinha que fica rodando na máquina do escritório, **vigia uma pasta** e
**envia automaticamente** todo PDF novo (guias, DARFs, etc.) para o GestorOA,
que então identifica a empresa/obrigação e dá a **baixa automática**.

## Como funciona

1. Você aponta o agente para uma pasta (ex.: `C:\GestorOA\guias`).
2. Tudo que cair lá em `.pdf` é enviado para o sistema.
3. Os arquivos enviados com sucesso vão para a subpasta `enviados\`.
4. Os que o sistema recusou vão para `erros\` (com o motivo no `agente.log`).
5. Falha de rede: o arquivo **fica na pasta** e é reenviado na próxima varredura.

## Instalação (modo simples)

1. Instale o **Node.js 18+** (https://nodejs.org) na máquina.
2. Copie esta pasta `agent` para a máquina (ex.: `C:\GestorOA\agent`).
3. Dentro dela rode uma vez:
   ```
   npm install
   ```
4. Copie `agent.config.example.json` para `agent.config.json` e preencha:
   - **apiUrl**: endereço do sistema (ex.: `http://89.117.79.163:8090`)
   - **apiKey**: pegue em **Sistema › e-Contínuo › Caixa do Robô › Integração (API)** (botão Gerar/Regenerar)
   - **pasta**: a pasta que será vigiada (ex.: `C:\\GestorOA\\guias`)
5. Dê um duplo-clique em **`iniciar.bat`** (ou rode `npm start`).

## Rodar sozinho ao ligar o PC (recomendado)

Opção fácil — **Agendador de Tarefas do Windows**:
- Criar Tarefa → Disparador: "Ao fazer logon" → Ação: iniciar programa
  `node` com argumento `index.js` e "Iniciar em" = pasta do agente.
- Marque "Executar estando o usuário conectado ou não".

## Gerar um .exe (opcional, dispensa instalar Node no cliente)

```
npm install
npm run build:exe
```
Gera `dist\gestoroa-agent.exe`. Copie o `.exe` + `agent.config.json` para a
máquina do cliente e coloque para iniciar no logon (Agendador de Tarefas).

## Contrato usado (referência técnica)

`POST {apiUrl}/api/v1/robo/ingest`
- header `x-api-key: <apiKey do escritório>`
- multipart, campo `arquivos` (1..50 PDFs)
