// Cria/atualiza um usuário do sistema.
// Uso:    node criar-usuario.js "Nome" email@exemplo.com senha [papel] [--provisoria]
// Exemplos:
//   node criar-usuario.js "Anderson" admin@igreja.com igreja123
//   node criar-usuario.js "Pr. Mário Cesar Gaspar" prmariocesargaspar@gmail.com 123456 pastor --provisoria
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

const args = process.argv.slice(2);
const provisoria = args.includes('--provisoria');
const [nome, email, senha, papel] = args.filter((a) => a !== '--provisoria');

if (!nome || !email || !senha) {
  console.log('Uso: node criar-usuario.js "Nome" email@exemplo.com senha [papel] [--provisoria]');
  process.exit(1);
}

(async () => {
  try {
    const { rows: igr } = await db.query('SELECT id FROM igrejas ORDER BY id LIMIT 1');
    if (!igr.length) {
      console.error('Nenhuma igreja cadastrada. Rode o schema.sql primeiro.');
      process.exit(1);
    }
    const igreja_id = igr[0].id;
    const hash = await bcrypt.hash(senha, 10);

    await db.query(
      `INSERT INTO usuarios (igreja_id, nome, email, senha, papel, senha_provisoria)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (email) DO UPDATE
         SET senha = EXCLUDED.senha, nome = EXCLUDED.nome,
             papel = EXCLUDED.papel, senha_provisoria = EXCLUDED.senha_provisoria`,
      [igreja_id, nome, email.toLowerCase().trim(), hash, papel || 'admin', provisoria]
    );

    console.log(`✓ Usuário "${email}" criado/atualizado (papel: ${papel || 'admin'}${provisoria ? ', senha provisória' : ''}).`);
    process.exit(0);
  } catch (e) {
    console.error('Erro:', e.message);
    process.exit(1);
  }
})();
