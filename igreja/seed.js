// Gera massa de dados de teste: ~120 membros, fornecedores e ~12 meses de histórico.
// Uso: node seed.js
// ATENÇÃO: limpa lançamentos, membros, fornecedores e despesas fixas antes de popular.
require('dotenv').config();
const db = require('./db');

const PRIMEIROS = ['Ana', 'João', 'Maria', 'Pedro', 'Lucas', 'Mariana', 'Carlos', 'Fernanda', 'Rafael',
  'Juliana', 'Bruno', 'Camila', 'Diego', 'Patrícia', 'Gabriel', 'Aline', 'Rodrigo', 'Beatriz', 'Felipe',
  'Larissa', 'Marcos', 'Vanessa', 'Thiago', 'Daniela', 'André', 'Letícia', 'Gustavo', 'Carolina',
  'Eduardo', 'Priscila', 'Vinícius', 'Tatiane', 'Leonardo', 'Sabrina', 'Rogério', 'Débora', 'Anderson',
  'Cristiane', 'William', 'Jaqueline'];
const SOBRENOMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Lima', 'Carvalho', 'Ferreira',
  'Rodrigues', 'Almeida', 'Nascimento', 'Gomes', 'Martins', 'Araújo', 'Melo', 'Barbosa', 'Ribeiro',
  'Moraes', 'Cardoso', 'Teixeira', 'Dias', 'Castro', 'Campos', 'Pires', 'Moreira'];
const FORNECEDORES = ['CELESC DISTRIBUIDORA', 'SH BANTES INTERNET', 'IMOBILIARIA CENTRO', 'MERCADO LIVRE',
  'NUBANK', 'STRIPE BRASIL', 'DRIVE GOOGLE', 'LIDIANE BRINQUEDOS', 'CASA DE DESTINO',
  'SJD SOLUÇÕES EM CALHAS', 'PAPELARIA CENTRAL', 'ÁGUA & CIA', 'GRÁFICA RAPIDA'];

const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[rnd(0, arr.length - 1)];
const dinheiro = (a, b) => Math.round((Math.random() * (b - a) + a) * 100) / 100;

(async () => {
  const client = db.pool;
  try {
    // SEGURANÇA: o seed SÓ mexe na ÁREA DE TESTE (teste=TRUE). Nunca toca nos dados reais.
    const { rows: igr } = await client.query('SELECT id FROM igrejas WHERE teste = TRUE ORDER BY id LIMIT 1');
    if (!igr.length) {
      console.error('Área de teste não encontrada. Rode o schema.sql primeiro.');
      process.exit(1);
    }
    const igreja_id = igr[0].id;
    console.log(`Populando a ÁREA DE TESTE (igreja_id=${igreja_id})...`);

    console.log('Limpando dados antigos da área de teste...');
    await client.query('DELETE FROM lancamentos WHERE igreja_id=$1', [igreja_id]);
    await client.query('DELETE FROM despesas_fixas WHERE igreja_id=$1', [igreja_id]);
    await client.query('DELETE FROM membros WHERE igreja_id=$1', [igreja_id]);
    await client.query('DELETE FROM fornecedores WHERE igreja_id=$1', [igreja_id]);

    // Garante dados-base na área de teste (bancos, centros, formas)
    await client.query(`INSERT INTO bancos (igreja_id, nome) SELECT $1, b FROM (VALUES ('Sicoob'),('CREDIFOZ')) AS t(b)
      WHERE NOT EXISTS (SELECT 1 FROM bancos WHERE igreja_id=$1)`, [igreja_id]);
    await client.query(`INSERT INTO centros_custo (igreja_id, nome) SELECT $1, c FROM (VALUES ('Manutenção Geral'),('Energia'),('Aluguel'),('Internet'),('Pastoral')) AS t(c)
      WHERE NOT EXISTS (SELECT 1 FROM centros_custo WHERE igreja_id=$1)`, [igreja_id]);
    await client.query(`INSERT INTO formas_pagamento (igreja_id, nome) SELECT $1, f FROM (VALUES ('Pix'),('Cartão'),('Débito automático'),('Dinheiro')) AS t(f)
      WHERE NOT EXISTS (SELECT 1 FROM formas_pagamento WHERE igreja_id=$1)`, [igreja_id]);

    const { rows: bancos } = await client.query('SELECT id FROM bancos WHERE igreja_id=$1', [igreja_id]);
    const { rows: centros } = await client.query('SELECT id FROM centros_custo WHERE igreja_id=$1', [igreja_id]);
    const bancoId = () => pick(bancos).id;
    const centroId = () => pick(centros).id;

    // ─── Membros (~120) ───
    console.log('Criando membros...');
    const membros = [];
    const usados = new Set();
    while (membros.length < 120) {
      const nome = `${pick(PRIMEIROS)} ${pick(SOBRENOMES)} ${pick(SOBRENOMES)}`;
      if (usados.has(nome)) continue;
      usados.add(nome);
      const ano = rnd(1960, 2005);
      const r = await client.query(
        `INSERT INTO membros (igreja_id, nome, telefone, sexo, data_nascimento, ativo, origem)
         VALUES ($1,$2,$3,$4,$5,$6,'interno') RETURNING id`,
        [igreja_id, nome, `(47) 9${rnd(1000, 9999)}-${rnd(1000, 9999)}`,
         pick(['M', 'F']), `${ano}-${String(rnd(1, 12)).padStart(2, '0')}-${String(rnd(1, 28)).padStart(2, '0')}`,
         Math.random() > 0.12]
      );
      membros.push(r.rows[0].id);
    }

    // ─── Fornecedores ───
    console.log('Criando fornecedores...');
    const fornecedores = [];
    for (const nome of FORNECEDORES) {
      const r = await client.query(
        'INSERT INTO fornecedores (igreja_id, nome, telefone) VALUES ($1,$2,$3) RETURNING id',
        [igreja_id, nome, `(47) 3${rnd(100, 999)}-${rnd(1000, 9999)}`]
      );
      fornecedores.push(r.rows[0].id);
    }

    // ─── Despesas fixas (4 modelos) ───
    console.log('Criando despesas fixas...');
    const fixasDef = [
      ['Aluguel apto pastoral', 1550, 5],
      ['Energia galpão', 900, 10],
      ['Internet', 149.9, 15],
      ['Plataforma financeira', 89.9, 20],
    ];
    const fixas = [];
    for (const [desc, val, dia] of fixasDef) {
      const r = await client.query(
        `INSERT INTO despesas_fixas (igreja_id, descricao, valor, dia_vencimento, fornecedor_id, centro_custo_id, banco_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [igreja_id, desc, val, dia, pick(fornecedores), centroId(), bancoId()]
      );
      fixas.push({ id: r.rows[0].id, val });
    }

    // ─── Lançamentos: 12 meses (do mês atual para trás) ───
    console.log('Gerando ~12 meses de lançamentos...');
    const hoje = new Date();
    let totalLanc = 0;

    for (let back = 11; back >= 0; back--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - back, 1);
      const ano = d.getFullYear();
      const mes = d.getMonth() + 1;
      const mesAtual = back === 0; // mês corrente: deixa algumas pendentes
      const ultimoDia = mesAtual ? hoje.getDate() : 28;

      // Entradas (dízimos/ofertas) — 40 a 70 por mês
      const nEntradas = rnd(40, 70);
      for (let i = 0; i < nEntradas; i++) {
        const visitante = Math.random() < 0.15;
        const tipo_gasto = visitante ? 'OFERTA' : (Math.random() < 0.6 ? 'DIZIMO' : 'OFERTA');
        const valor = tipo_gasto === 'DIZIMO' ? dinheiro(50, 800) : dinheiro(5, 150);
        const dia = String(rnd(1, ultimoDia)).padStart(2, '0');
        await client.query(
          `INSERT INTO lancamentos
             (igreja_id, tipo, situacao, data, banco_id, valor, descricao, forma_pagamento,
              parcelamento, membro_id, visitante, tipo_gasto)
           VALUES ($1,'entrada','recebido',$2,$3,$4,'RECEITA PIX','Pix','À vista',$5,$6,$7)`,
          [igreja_id, `${ano}-${String(mes).padStart(2, '0')}-${dia}`, bancoId(), valor,
           visitante ? null : pick(membros), visitante, tipo_gasto]
        );
        totalLanc++;
      }

      // Despesas variáveis — 6 a 12 por mês
      const nSaidas = rnd(6, 12);
      for (let i = 0; i < nSaidas; i++) {
        const dia = String(rnd(1, ultimoDia)).padStart(2, '0');
        const situacao = mesAtual && Math.random() < 0.4 ? 'pendente' : 'pago';
        await client.query(
          `INSERT INTO lancamentos
             (igreja_id, tipo, situacao, data, banco_id, valor, descricao, forma_pagamento,
              parcelamento, fornecedor_id, centro_custo_id, tipo_gasto)
           VALUES ($1,'saida',$2,$3,$4,$5,'FORNECEDOR',$6,'À vista',$7,$8,'Venda')`,
          [igreja_id, situacao, `${ano}-${String(mes).padStart(2, '0')}-${dia}`, bancoId(),
           dinheiro(50, 2000), pick(['Pix', 'Cartão', 'Débito automático']), pick(fornecedores), centroId()]
        );
        totalLanc++;
      }

      // Despesas fixas do mês
      for (const f of fixas) {
        const situacao = mesAtual ? 'pendente' : 'pago';
        await client.query(
          `INSERT INTO lancamentos
             (igreja_id, tipo, situacao, data, banco_id, valor, descricao, forma_pagamento,
              parcelamento, fornecedor_id, centro_custo_id, tipo_gasto, despesa_fixa_id)
           VALUES ($1,'saida',$2,$3,(SELECT banco_id FROM despesas_fixas WHERE id=$4),
                   $5,'FORNECEDOR','Pix','Recorrente',
                   (SELECT fornecedor_id FROM despesas_fixas WHERE id=$4),
                   (SELECT centro_custo_id FROM despesas_fixas WHERE id=$4),'Estrutura',$4)
           ON CONFLICT DO NOTHING`,
          [igreja_id, situacao, `${ano}-${String(mes).padStart(2, '0')}-10`, f.id, f.val]
        );
        totalLanc++;
      }
    }

    console.log(`✓ Pronto! 120 membros, ${FORNECEDORES.length} fornecedores, ${totalLanc} lançamentos em 12 meses.`);
    process.exit(0);
  } catch (e) {
    console.error('Erro no seed:', e.message);
    process.exit(1);
  }
})();
