// Zera APENAS a ÁREA DE TESTE (sandbox). Nunca toca nos dados reais.
// Uso: node reset.js --sim
require('dotenv').config();
const db = require('./db');

if (!process.argv.includes('--sim')) {
  console.log('⚠️  Isto APAGA os dados da ÁREA DE TESTE (lançamentos, membros, fornecedores,');
  console.log('   despesas fixas, bancos, centros de custo e formas de pagamento de teste).');
  console.log('   Os dados REAIS (pastor/frank) NÃO são afetados.');
  console.log('   Para confirmar, rode:  node reset.js --sim');
  process.exit(1);
}

(async () => {
  try {
    const { rows: igr } = await db.query('SELECT id FROM igrejas WHERE teste = TRUE ORDER BY id LIMIT 1');
    if (!igr.length) { console.error('Área de teste não encontrada. Rode o schema.sql.'); process.exit(1); }
    const id = igr[0].id;

    for (const tabela of ['lancamentos', 'despesas_fixas', 'membros', 'fornecedores', 'bancos', 'centros_custo', 'formas_pagamento']) {
      await db.query(`DELETE FROM ${tabela} WHERE igreja_id = $1`, [id]);
    }
    console.log(`✓ Área de TESTE (igreja_id=${id}) zerada. Dados reais intactos.`);
    process.exit(0);
  } catch (e) {
    console.error('Erro no reset:', e.message);
    process.exit(1);
  }
})();
