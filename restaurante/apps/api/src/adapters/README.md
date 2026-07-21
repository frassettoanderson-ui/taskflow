# Portas & Adaptadores

Aqui mora tudo que fala com o **mundo de fora** (pagamento, WhatsApp, mapas, nota
fiscal, iFood, motoboy).

## A ideia, em português simples

Imagine a **tomada da parede**: o formato dela é sempre o mesmo, e você pluga o
aparelho que quiser. Aqui é igual:

- A **porta** (`*.port.ts`) é a tomada: diz *o que* o serviço precisa saber fazer.
- O **adaptador** (`fake-*.provider.ts`) é o aparelho plugado.

O resto do sistema só conhece a tomada. Trocar o Mercado Pago pela Stone, um dia,
mexe **só no adaptador** — nenhum outro arquivo do projeto precisa mudar.

## Estado atual (Etapa 0)

Todos os adaptadores são **fakes vazios**: têm a forma certa, mas ainda não fazem
nada de verdade. Isso é de propósito — conforme o CLAUDE.md, **nenhuma conta em
serviço externo será pedida antes da Etapa 7**.

| Porta | Para quê | Vira de verdade em |
|---|---|---|
| `PaymentProvider` | cobrar e dividir o dinheiro (split) | Etapa 1 ganha o FakePix; real na 7 |
| `MessagingProvider` | WhatsApp / IA / notificações | Etapa 7 |
| `MapProvider` | endereço, rota e cálculo de frete | Etapa 7 |
| `FiscalProvider` | NF-e / NFC-e | Etapa 7 |
| `MarketplaceImport` | puxar cardápio e pedidos do iFood | Etapa 7 |
| `DeliveryProvider` | despachar motoboy | Etapa 7 |
