// Cria o primeiro usuario admin (e alguns centros de custo de exemplo).
// Uso: node criar-usuario.js "Nome" email@exemplo.com senha123
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

const [, , nome, email, senha] = process.argv;
if (!nome || !email || !senha) {
  console.log('Uso: node criar-usuario.js "Nome" email@exemplo.com senha');
  process.exit(1);
}

const CENTROS_EXEMPLO = ['Manutenção Geral', 'Energia', 'Internet', 'Aluguel', 'Pastoral'];

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
      `INSERT INTO usuarios (igreja_id, nome, email, senha, papel)
       VALUES ($1,$2,$3,$4,'admin')
       ON CONFLICT (email) DO UPDATE SET senha = EXCLUDED.senha, nome = EXCLUDED.nome`,
      [igreja_id, nome, email.toLowerCase().trim(), hash]
    );

    for (const c of CENTROS_EXEMPLO) {
      await db.query(
        `INSERT INTO centros_custo (igreja_id, nome) SELECT $1::int, $2::text
         WHERE NOT EXISTS (SELECT 1 FROM centros_custo WHERE igreja_id=$1::int AND nome=$2::text)`,
        [igreja_id, c]
      );
    }

    console.log(`✓ Usuario "${email}" criado. Centros de custo de exemplo adicionados.`);
    process.exit(0);
  } catch (e) {
    console.error('Erro:', e.message);
    process.exit(1);
  }
})();
