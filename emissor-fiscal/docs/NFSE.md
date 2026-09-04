# NFS-e — arquitetura e estado

A NFS-e é o ponto mais fragmentado do fisco brasileiro (cada município podia ter
seu sistema). A estratégia aqui **não** é integrar cidade por cidade, e sim:

## Camadas

1. **Padrão Nacional (ADN / SEFIN Nacional)** — `PadraoNacionalProvider`.
   Uma integração cobre todos os municípios que aderiram ao padrão nacional
   (a maioria, e a adesão caminha para 100%). **É o default.**
2. **Adaptadores por PROVEDOR** — para municípios ainda fora do padrão. A maioria
   usa o mesmo layout **ABRASF** (1.0/2.0/2.03) ou provedores conhecidos
   (GINFES, ISSNet, WebISS, Betha). ~5 adaptadores cobrem centenas de cidades.
   O `sped-nfse` do NFePHP ajuda nesses casos.
3. Só se implementa o adaptador de uma cidade quando há **cliente real** nela.

## Como o código resolve o provider

```
ProviderRegistry (config/nfse-municipios.json)
  código IBGE do município -> nome do provider   ("_default": "nacional")
NFSeService.emitir() -> registry.paraMunicipio(cMun) -> provider.emitir()
```

Todo provider implementa a interface `NFSeProvider` (emitir/consultar/cancelar) e
fala o mesmo **payload normalizado** — quem varia é a tradução interna.

## Estado atual

- ✅ Arquitetura: interface, registry, service, rotas, payload normalizado.
- ✅ `PadraoNacionalProvider`: **emitir** e **consultar** (fluxo DPS -> assina ->
  gzip/base64 -> REST com **mTLS** pelo certificado do emitente).
- ⏳ **cancelar** (Padrão Nacional): é por **evento** (pedido de cancelamento
  e101101) — monta XML do evento, assina, `POST /nfse/{chave}/eventos`.
  Ainda **não implementado** (lança erro explicativo).
- ⏳ **Nunca testado em produção restrita (homologação).**
- 🔜 Adaptadores municipais (ABRASF etc.) — só quando surgir cliente fora do padrão.

## ⚠️ Verificar em homologação (produção restrita) antes de produção

- **Credenciamento**: o emitente precisa estar habilitado no ambiente nacional
  para o(s) município(s) — sem isso, rejeita.
- **URLs/endpoints**: confirmar as bases e caminhos vigentes no MOC
  (`sefin.producaorestrita.nfse.gov.br` p/ teste; `sefin.nfse.gov.br` p/ produção).
- **Leiaute do DPS**: versão do schema e obrigatoriedade dos campos (o builder
  cobre o caso simples de serviço; ISS retido, deduções, construção civil,
  cLocIncid especial, tributos federais retidos etc. ainda não).
- **cTribNac / item da lista (LC 116)**: confirmar o código correto por serviço
  com o contador — cada município pode ter particularidade.
- **Formato do Id do infDPS** e dos campos de resposta (`chaveAcesso`,
  `nfseXmlGZipB64`).

Referência: https://www.gov.br/nfse (MOC, esquemas XSD, ambiente de testes).

## Relação com a Reforma

A NFS-e nacional já nasce alinhada à Reforma (IBS/CBS entram no lugar do ISS na
transição). Ver [`REFORMA-IBS-CBS.md`](./REFORMA-IBS-CBS.md).
