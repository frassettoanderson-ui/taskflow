const express = require('express');
const db = require('../db');
const router = express.Router();

// Cadastro publico de membro (sem login) — usado pelo formulario que a pessoa preenche.
// Hoje a igreja e unica (id da primeira). Quando virar multi-igreja, recebe um token/slug.
router.post('/cadastro-membro', async (req, res) => {
  const { nome, telefone, endereco, data_nascimento, sexo } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Nome é obrigatório' });

  try {
    const { rows: igr } = await db.query('SELECT id FROM igrejas ORDER BY id LIMIT 1');
    if (!igr.length) return res.status(500).json({ erro: 'Igreja não configurada' });
    const igreja_id = igr[0].id;

    // Trava: não permite mesmo nome + mesmo telefone
    const dup = await db.query(
      `SELECT 1 FROM membros WHERE igreja_id=$1
         AND lower(btrim(nome)) = lower(btrim($2))
         AND regexp_replace(coalesce(telefone,''),'\\D','','g') = regexp_replace($3,'\\D','','g')
       LIMIT 1`,
      [igreja_id, nome, telefone || '']
    );
    if (dup.rows.length) return res.status(409).json({ erro: 'Você já está cadastrado (mesmo nome e telefone).' });

    await db.query(
      `INSERT INTO membros (igreja_id, nome, telefone, endereco, data_nascimento, sexo, origem)
       VALUES ($1,$2,$3,$4,$5,$6,'publico')`,
      [igreja_id, nome.trim(), telefone || '', endereco || '', data_nascimento || null, sexo || null]
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao cadastrar' });
  }
});

module.exports = router;
