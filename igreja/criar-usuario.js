// Cria/atualiza um usuário do sistema.
// Uso:    node criar-usuario.js "Nome" email@exemplo.com senha [papel] [--provisoria] [--real]
// Por padrão o usuário vai para a ÁREA DE TESTE (sandbox). Use --real para dar acesso aos dados REAIS.
// Exemplos:
//   node criar-usuario.js "Anderson" admin@igreja.com Ron@010101            (área de teste)
//   node criar-usuario.js "Pr. Mário Cesar Gaspar" prmariocesargaspar@gmail.com 123456 pastor --provisoria --real
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

const args = process.argv.slice(2);
const provisoria = args.includes('--provisoria');
const real = args.includes('--real');
const [nome, email, senha, papel] = args.filter((a) => !a.startsWith('--'));

if (!nome || !email || !senha) {
  console.log('Uso: node criar-usuario.js "Nome" email senha [papel] [--provisoria] [--real]');
  process.exit(1);
}

(async () => {
  try {
    // Resolve a área: --real => igreja real (teste=false); senão => área de teste (teste=true)
    const { rows: igr } = await db.query(
      `SELECT id FROM igrejas WHERE teste = $1 ORDER BY id LIMIT 1`, [!real]
    );
    if (!igr.length) {
      console.error('Área não encontrada. Rode o schema.sql primeiro (cria as áreas real e de teste).');
      process.exit(1);
    }
    const igreja_id = igr[0].id;
    const hash = await bcrypt.hash(senha, 10);

    await db.query(
      `INSERT INTO usuarios (igreja_id, nome, email, senha, papel, senha_provisoria)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (email) DO UPDATE
         SET senha = EXCLUDED.senha, nome = EXCLUDED.nome, papel = EXCLUDED.papel,
             senha_provisoria = EXCLUDED.senha_provisoria, igreja_id = EXCLUDED.igreja_id`,
      [igreja_id, nome, email.toLowerCase().trim(), hash, papel || 'admin', provisoria]
    );

    console.log(`✓ Usuário "${email}" (papel: ${papel || 'admin'}${provisoria ? ', senha provisória' : ''}) → área ${real ? 'REAL' : 'de TESTE'}.`);
    process.exit(0);
  } catch (e) {
    console.error('Erro:', e.message);
    process.exit(1);
  }
})();
