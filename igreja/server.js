require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3002;
const BASE = process.env.BASE_PATH || ''; // ex.: '/igreja' em producao

const router = express.Router();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 8 },
  })
);

function requireLogin(req, res, next) {
  if (req.session && req.session.usuario) return next();
  return res.status(401).json({ erro: 'Nao autenticado' });
}

// ─── APIs ─────────────────────────────────────────
router.use('/api/auth', require('./routes/auth'));
// rota publica: formulario de cadastro de membro (sem login)
router.use('/api/publico', require('./routes/publico'));

router.use('/api/bancos', requireLogin, require('./routes/bancos'));
router.use('/api/centros-custo', requireLogin, require('./routes/centrosCusto'));
router.use('/api/fornecedores', requireLogin, require('./routes/fornecedores'));
router.use('/api/membros', requireLogin, require('./routes/membros'));
router.use('/api/lancamentos', requireLogin, require('./routes/lancamentos'));
router.use('/api/despesas-fixas', requireLogin, require('./routes/despesasFixas'));

// ─── Front ────────────────────────────────────────
router.use(express.static(path.join(__dirname, 'public')));

router.get('/', (req, res) => {
  if (!req.session.usuario) return res.redirect((BASE || '') + '/login.html');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(BASE || '/', router);

app.listen(PORT, () => {
  console.log(`Igreja financeiro na porta ${PORT}${BASE ? ' (base ' + BASE + ')' : ''}`);
});
