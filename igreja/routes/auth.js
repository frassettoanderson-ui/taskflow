const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');

const router = express.Router();

// Anti força-bruta no login e anti-abuso no cadastro
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 12, standardHeaders: true, legacyHeaders: false,
  message: { erro: 'Muitas tentativas de login. Tente novamente em alguns minutos.' },
});
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 6, standardHeaders: true, legacyHeaders: false,
  message: { erro: 'Muitos cadastros a partir deste acesso. Tente mais tarde.' },
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Informe email e senha' });

  try {
    const { rows } = await db.query(
      `SELECT u.*, i.nome AS igreja_nome, i.teste AS igreja_teste, i.slug AS igreja_slug
       FROM usuarios u JOIN igrejas i ON i.id = u.igreja_id
       WHERE u.email = $1 AND u.ativo = TRUE`,
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(senha, user.senha))) {
      return res.status(401).json({ erro: 'Email ou senha invalidos' });
    }
    req.session.usuario = {
      id: user.id,
      nome: user.nome,
      papel: user.papel,
      igreja_id: user.igreja_id,
      igreja_nome: user.igreja_nome,
      igreja_slug: user.igreja_slug,
      teste: user.igreja_teste === true,
      senha_provisoria: user.senha_provisoria,
    };
    res.json({ ok: true, usuario: req.session.usuario });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// POST /api/auth/signup — auto-cadastro de uma nova igreja (tenant) + usuário dono
function slugify(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'igreja';
}
router.post('/signup', signupLimiter, async (req, res) => {
  const { igreja_nome, nome, email, senha } = req.body;
  if (!igreja_nome || !igreja_nome.trim()) return res.status(400).json({ erro: 'Informe o nome da igreja' });
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Informe seu nome' });
  if (!email || !email.includes('@')) return res.status(400).json({ erro: 'Informe um e-mail válido' });
  if (!senha || senha.length < 6) return res.status(400).json({ erro: 'A senha deve ter ao menos 6 caracteres' });

  const client = await db.pool.connect();
  try {
    const emailNorm = email.toLowerCase().trim();
    const ja = await client.query('SELECT 1 FROM usuarios WHERE email=$1', [emailNorm]);
    if (ja.rows.length) return res.status(409).json({ erro: 'Este e-mail já está em uso' });

    // slug único
    let base = slugify(igreja_nome), slug = base, n = 1;
    while ((await client.query('SELECT 1 FROM igrejas WHERE slug=$1', [slug])).rows.length) slug = `${base}-${++n}`;

    await client.query('BEGIN');
    const { rows: ig } = await client.query(
      'INSERT INTO igrejas (nome, teste, slug) VALUES ($1, FALSE, $2) RETURNING id', [igreja_nome.trim(), slug]);
    const igreja_id = ig[0].id;

    const hash = await bcrypt.hash(senha, 10);
    const { rows: us } = await client.query(
      `INSERT INTO usuarios (igreja_id, nome, email, senha, papel) VALUES ($1,$2,$3,$4,'admin') RETURNING id, nome, papel`,
      [igreja_id, nome.trim(), emailNorm, hash]);

    // dados-base pra igreja começar usável
    await client.query(`INSERT INTO bancos (igreja_id, nome) VALUES ($1,'Caixa')`, [igreja_id]);
    await client.query(`INSERT INTO centros_custo (igreja_id, nome) SELECT $1, c FROM (VALUES ('Geral'),('Manutenção'),('Aluguel')) AS t(c)`, [igreja_id]);
    await client.query(`INSERT INTO formas_pagamento (igreja_id, nome) SELECT $1, f FROM (VALUES ('Pix'),('Dinheiro'),('Cartão')) AS t(f)`, [igreja_id]);
    await client.query('COMMIT');

    req.session.usuario = {
      id: us[0].id, nome: us[0].nome, papel: us[0].papel,
      igreja_id, igreja_nome: igreja_nome.trim(), igreja_slug: slug, teste: false, senha_provisoria: false,
    };
    res.status(201).json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(e);
    res.status(500).json({ erro: 'Erro ao criar a conta' });
  } finally {
    client.release();
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session.usuario) return res.status(401).json({ erro: 'Nao autenticado' });
  res.json({ usuario: req.session.usuario });
});

// POST /api/auth/trocar-senha  { senha_nova } — limpa a flag de senha provisória
router.post('/trocar-senha', async (req, res) => {
  if (!req.session.usuario) return res.status(401).json({ erro: 'Nao autenticado' });
  const { senha_nova } = req.body;
  if (!senha_nova || senha_nova.length < 4) {
    return res.status(400).json({ erro: 'A senha deve ter pelo menos 4 caracteres' });
  }
  try {
    const hash = await bcrypt.hash(senha_nova, 10);
    await db.query('UPDATE usuarios SET senha=$1, senha_provisoria=FALSE WHERE id=$2',
      [hash, req.session.usuario.id]);
    req.session.usuario.senha_provisoria = false;
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao trocar a senha' });
  }
});

module.exports = router;
