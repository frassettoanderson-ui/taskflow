// Zera o sistema: apaga TODOS os dados, mantendo apenas a igreja e o login admin.
// Uso: node reset.js --sim
// (o --sim é obrigatório para evitar execução acidental)
require('dotenv').config();
const db = require('./db');

if (!process.argv.includes('--sim')) {
  console.log('⚠️  Isto APAGA todos os lançamentos, membros, fornecedores, despesas fixas,');
  console.log('   bancos, centros de custo e formas de pagamento (mantém só o login admin).');
  console.log('   Para confirmar, rode:  node reset.js --sim');
  process.exit(1);
}

(async () => {
  try {
    await db.query(`
      TRUNCATE TABLE
        lancamentos, despesas_fixas, membros, fornecedores,
        bancos, centros_custo, formas_pagamento
      RESTART IDENTITY CASCADE;
    `);
    console.log('✓ Sistema zerado. Mantidos: igreja e login admin.');
    console.log('  Cadastre bancos, centros de custo e formas de pagamento em Configuração > Cadastros.');
    process.exit(0);
  } catch (e) {
    console.error('Erro no reset:', e.message);
    process.exit(1);
  }
})();
