const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const router = express.Router();

// Líderes da igreja (papel 'admin' ou 'pastor') ou super-admin gerenciam usuários
function requireAdmin(req, res, next) {
  const u = req.session && req.session.usuario;
  if (u && (u.papel === 'admin' || u.papel === 'pastor' || u.super_admin)) return next();
  return res.status(403).json({ erro: 'Apenas líderes (admin/pastor) podem gerenciar usuários' });
}

const PAPEIS = ['admin', 'tesoureiro', 'pastor', 'contador', 'leitura'];
const senhaProvisoria = () => Math.random().toString(36).slice(-4) + Math.random().toString(36).slice(-4);

// Lista os usuários DA IGREJA do solicitante (isolado por tenant)
router.get('/', requireAdmin, async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const { rows } = await db.query(
    `SELECT id, nome, email, papel, ativo, senha_provisoria, criado_em
     FROM usuarios WHERE igreja_id=$1 AND super_admin=FALSE ORDER BY nome`,
    [igreja_id]
  );
  res.json(rows);
});

// Cria usuário na igreja do solicitante, com senha provisória (retornada para compartilhar)
router.post('/', requireAdmin, async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const { nome, email, papel } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Nome é obrigatório' });
  if (!email || !email.includes('@')) return res.status(400).json({ erro: 'E-mail inválido' });
  const p = PAPEIS.includes(papel) ? papel : 'leitura';
  const emailNorm = email.toLowerCase().trim();
  try {
    const ja = await db.query('SELECT 1 FROM usuarios WHERE email=$1', [emailNorm]);
    if (ja.rows.length) return res.status(409).json({ erro: 'E-mail já está em uso' });
    const senha = senhaProvisoria();
    const hash = await bcrypt.hash(senha, 10);
    await db.query(
      `INSERT INTO usuarios (igreja_id, nome, email, senha, papel, senha_provisoria)
       VALUES ($1,$2,$3,$4,$5,TRUE)`,
      [igreja_id, nome.trim(), emailNorm, hash, p]
    );
    res.status(201).json({ ok: true, senha }); // admin compartilha; usuário troca no 1º login
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao criar usuário' });
  }
});

// Edita nome, papel e ativo (não mexe em super-admin; não permite auto-desativar)
router.put('/:id', requireAdmin, async (req, res) => {
  const { igreja_id, id: meuId } = req.session.usuario;
  const { nome, papel, ativo } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ erro: 'Nome é obrigatório' });
  const p = PAPEIS.includes(papel) ? papel : 'leitura';
  let ativoFinal = ativo !== false;
  if (String(req.params.id) === String(meuId)) ativoFinal = true; // não se auto-desativa
  await db.query(
    `UPDATE usuarios SET nome=$1, papel=$2, ativo=$3
     WHERE id=$4 AND igreja_id=$5 AND super_admin=FALSE`,
    [nome.trim(), p, ativoFinal, req.params.id, igreja_id]
  );
  res.json({ ok: true });
});

// Reseta a senha (gera provisória, retorna para o admin compartilhar)
router.post('/:id/reset-senha', requireAdmin, async (req, res) => {
  const { igreja_id } = req.session.usuario;
  const senha = senhaProvisoria();
  const hash = await bcrypt.hash(senha, 10);
  const r = await db.query(
    `UPDATE usuarios SET senha=$1, senha_provisoria=TRUE
     WHERE id=$2 AND igreja_id=$3 AND super_admin=FALSE RETURNING id`,
    [hash, req.params.id, igreja_id]
  );
  if (!r.rows.length) return res.status(404).json({ erro: 'Usuário não encontrado' });
  res.json({ ok: true, senha });
});

module.exports = router;
