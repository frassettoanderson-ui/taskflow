// Representante da conta com assinatura automática — atalho de linha de comando (o painel faz o mesmo).
// Uso (na VPS):
//   node scripts/representante.mjs criar "<conta>" '{"nome":"...","cpf":"...","cargo":"Contador responsável","registro":"CRC/SC ...","email":"...","whatsapp":"..."}'
//   node scripts/representante.mjs listar "<conta>"
//   node scripts/representante.mjs revogar "<conta>" <representante_id>
import { pool, migrar } from '../src/db.js'
import { criarRepresentante, listarRepresentantes, revogarRepresentante } from '../src/representantes.js'

const [acao, a1, a2] = process.argv.slice(2)
await migrar()
async function contaPor(nomeOuId) {
  const r = await pool.query(`SELECT * FROM contas WHERE id::text = $1 OR lower(nome) = lower($1)`, [nomeOuId])
  if (!r.rows[0]) throw new Error(`conta não encontrada: ${nomeOuId}`)
  return r.rows[0]
}
if (acao === 'criar') {
  const x = await criarRepresentante(await contaPor(a1), JSON.parse(a2 || '{}'), { enviar: false })
  console.log(`Representante ${x.representante.nome} (${x.representante.id}) cadastrado.\nTermo ${x.termo.codigo} — link para ele assinar:\n${x.link}`)
} else if (acao === 'listar') {
  for (const x of await listarRepresentantes((await contaPor(a1)).id)) console.log(`${x.id}  ${x.nome}  ${x.cargo}${x.registro ? ' ' + x.registro : ''}  ${x.revogado_em ? 'REVOGADO' : x.autorizado_em ? 'AUTORIZADO' : 'aguardando assinatura do termo'}`)
} else if (acao === 'revogar') {
  const r = await revogarRepresentante((await contaPor(a1)).id, a2)
  console.log(`Autorização de ${r.nome} revogada.`)
} else console.log('Uso: criar "<conta>" \'{json}\' | listar "<conta>" | revogar "<conta>" <id>')
await pool.end()
