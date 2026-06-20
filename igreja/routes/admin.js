const express = require('express');
const db = require('../db');
const router = express.Router();

// Só super-admin acessa o painel global
function requireSuperAdmin(req, res, next) {
  if (req.session && req.session.usuario && req.session.usuario.super_admin) return next();
  return res.status(403).json({ erro: 'Acesso restrito ao super-admin' });
}

// GET /api/admin/igrejas — todas as igrejas (tenants) com contagens
router.get('/igrejas', requireSuperAdmin, async (req, res) => {
  const { rows } = await db.query(`
    SELECT i.id, i.nome, i.slug, i.teste, i.criado_em,
      (SELECT COUNT(*) FROM usuarios u WHERE u.igreja_id = i.id) AS usuarios,
      (SELECT COUNT(*) FROM membros m WHERE m.igreja_id = i.id) AS membros,
      (SELECT COUNT(*) FROM lancamentos l WHERE l.igreja_id = i.id) AS lancamentos
    FROM igrejas i
    ORDER BY i.teste ASC, i.id ASC
  `);
  res.json(rows.map((r) => ({
    ...r,
    usuarios: Number(r.usuarios),
    membros: Number(r.membros),
    lancamentos: Number(r.lancamentos),
  })));
});

module.exports = router;
