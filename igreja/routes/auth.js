const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Informe email e senha' });

  try {
    const { rows } = await db.query(
      'SELECT * FROM usuarios WHERE email = $1 AND ativo = TRUE',
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
      senha_provisoria: user.senha_provisoria,
    };
    res.json({ ok: true, usuario: req.session.usuario });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro interno' });
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
