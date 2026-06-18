# Agente e-Contínuo — GestorOA

Programa que roda na máquina do escritório, **vigia uma pasta na Área de Trabalho**
e **envia automaticamente** todo PDF novo (guias, DARFs, etc.) para o GestorOA,
que identifica empresa/obrigação e dá a **baixa automática**.

## Instalação (usuário final — recomendado)

1. No sistema: **Sistema → e-Contínuo → Baixar agente (instalador)** → baixa o `gestoroa-agente.exe`.
2. Dê **dois cliques** no `.exe`. Na primeira vez ele pergunta:
   - **Endereço do sistema** (já vem preenchido)
   - **API key** (pegue em *e-Contínuo → Caixa do Robô → Integração*)
   - **Nome do setor/departamento** (ex.: Fiscal)
3. Ele **cria a pasta na Área de Trabalho** (ex.: `GestorOA - Fiscal`), salva a
   configuração e **se registra para iniciar junto com o Windows** (rodando oculto).
4. Pronto: arraste os PDFs para essa pasta — sobem sozinhos. Cada departamento
   roda o instalador na sua máquina e ganha a sua própria pasta.

Subpastas dentro da pasta também são vigiadas. Os arquivos enviados vão para
`_enviados/` e os recusados para `_erros/` (motivo no `agente.log`).

## Desenvolvimento (rodar a partir do código)

```
npm install
npm start            # node agent.cjs (modo assistente no terminal)
npm run build:exe    # gera dist/gestoroa-agente.exe (pkg, node18-win-x64)
```

## Contrato usado
`POST {apiUrl}/api/v1/robo/ingest` — header `x-api-key`, multipart campo `arquivos` (PDF).
