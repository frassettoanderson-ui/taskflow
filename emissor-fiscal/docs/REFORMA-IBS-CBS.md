# Reforma Tributária (IBS/CBS) — mapeamento para o Emissor Fiscal

> Status: **mapeamento / planejamento**. Nada implementado ainda.
> Objetivo deste doc: dimensionar o esforço e listar o que muda no nosso código,
> **sem** escrever o código agora.

## 1. O que é (resumo direto)

A EC 132/2023 + LC 214/2025 substituem 5 tributos por um **IVA Dual**:

| Tributo velho | Some em | Vira |
|---|---|---|
| PIS + COFINS (federal) | → | **CBS** (Contribuição sobre Bens e Serviços) |
| ICMS (estadual) + ISS (municipal) | → | **IBS** (Imposto sobre Bens e Serviços) |
| — (novo) | | **IS** (Imposto Seletivo — "imposto do pecado") |

Dual = CBS é federal, IBS é estadual/municipal, mas **calculados juntos** sobre a mesma base.

## 2. A mudança que quebra o nosso cálculo atual

Hoje o `NFeBuilder` monta ICMS/PIS/COFINS no modelo **"por dentro"** (o imposto
integra a própria base). O IVA é **"por fora"**:

- **Valor do produto** = o que o vendedor quer receber (líquido).
- **IBS + CBS** são calculados **sobre** esse valor e **somados** ao total da nota.
- IBS e CBS **não** integram a própria base nem a base um do outro.

Ou seja: `vNF = vProd + IBS + CBS + IS` (na transição, ainda somados aos grupos antigos).
Isso é **lógica de cálculo nova**, não só um campo a mais no XML.

## 3. Cronograma da transição (por que precisa calcular os DOIS sistemas)

| Ano | O que acontece | Alíquotas de teste |
|---|---|---|
| **2026** | Fase de teste. IBS/CBS destacados na nota, mas compensáveis. | **CBS 0,9% / IBS 0,1%** |
| 2027 | CBS "pra valer"; PIS/COFINS extintos. IS entra. | CBS cheia |
| 2029–2032 | ICMS/ISS reduzem gradualmente; IBS sobe. | proporção anual |
| 2033 | Modelo pleno; ICMS/ISS/PIS/COFINS extintos. | IBS/CBS cheias |

**Consequência para o emissor:** entre 2026 e 2032 o XML precisa carregar **os grupos
antigos E os novos ao mesmo tempo**. Não é "trocar", é "conviver".

## 4. O que muda no XML da NF-e

O leiaute novo entra pela **NT 2025.002** (grupos de tributação IBS/CBS/IS).
Em alto nível, cada item ganha um grupo tipo:

- `IBSCBS` → CST do IBS/CBS + `cClassTrib` (classificação tributária) + bases e valores
  de **IBS UF**, **IBS Município** e **CBS**.
- `IS` (quando aplicável) → Imposto Seletivo.
- Grupos de **crédito presumido**, **diferimento**, **monofasia** conforme a operação.
- Totais novos no `total` (vIBS, vCBS, vIS...).

⚠️ **Verificação nº 1 antes de codar:** confirmar a versão do **NFePHP** que já traz os
schemas XSD da NT 2025.002 e as classes `Make` para os grupos IBS/CBS. O projeto vem
adicionando esse suporte ("RT"); precisamos **fixar a versão** que tenha os grupos, ou
o `signNFe`/validação XSD rejeita.

## 5. Tabelas novas (isto é DADO, não código)

O produto de referência (ScriptCase) lista — e nós precisaríamos das mesmas,
com prefixo sugerido `rt_` para isolar:

- `rt_ncm_anexos` — NCM com anexos da LC 214
- `rt_cst_ibscbs` — CST do IBS/CBS
- `rt_cst_classtrib` — CST × ClassTrib (a chave do cálculo)
- `rt_credito_presumido`
- `rt_operacoes` — tabela de operações fiscais
- `rt_nbs` — Nomenclatura Brasileira de Serviços
- `rt_servicos_nacional` — códigos de serviço nacionais
- `rt_anexos_lc214`
- `rt_cfx` — evolução do CFOP para o novo padrão de operações (nome "CFX" é do material de referência; confirmar o oficial)

**Ordem de cálculo** (conforme o material): `Tipo de Operação → Produto → Operação Fiscal`
define o par CST+ClassTrib, que por sua vez define alíquota e regra de crédito.

## 6. Onde isso encaixa no nosso código

| Camada | O que muda |
|---|---|
| `src/Fiscal/NFe/NFeBuilder.php` | novo método `montarIbsCbs()` por item; ajustar totais |
| **cálculo** | novo `src/Fiscal/Reforma/CalculoIvaDual.php` (por fora) |
| **tabelas** | carga das `rt_*` (seed em banco ou JSON versionado) |
| **cadastro de produto** (nos consumidores) | precisa dos campos **CST IBS/CBS** e **ClassTrib** por produto — cada produto deve ser conferido com o contador |
| composer | fixar versão do NFePHP com suporte à NT 2025.002 |

## 7. Estimativa de esforço (grosseira)

- Verificar/fixar suporte NFePHP + montar 1 item com IBS/CBS em homologação: **médio**.
- Carga e manutenção das tabelas `rt_*`: **médio-alto** (volume de dados + atualizações).
- Motor de cálculo IVA Dual com CST×ClassʼTrib + rateio por item: **alto** (é o coração).
- Conviver com grupos antigos na transição: **médio** (duplica caminhos).

## 8. Decisões em aberto (quando formos implementar)

1. As tabelas `rt_*` ficam **no emissor** (fonte única) ou em cada consumidor?
   → Recomendação: no emissor, expostas por endpoint, pra não duplicar.
2. Quem guarda **CST IBS/CBS + ClassTrib por produto**: o cadastro de produto do
   consumidor manda no payload, ou o emissor deriva por NCM+operação?
   → Provável híbrido: consumidor manda, emissor valida.
3. Homologação da reforma: SEFAZ tem ambiente próprio de teste da NT 2025.002 —
   validar disponibilidade por UF antes de prometer prazo.

---
*Referências a confirmar na hora de implementar: NT 2025.002 (Portal da NF-e),
LC 214/2025, e a release do NFePHP com os grupos IBS/CBS.*
