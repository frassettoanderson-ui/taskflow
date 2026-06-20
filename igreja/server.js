require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3002;
const BASE = process.env.BASE_PATH || ''; // ex.: '/igreja' em producao

const router = express.Router();

app.set('trust proxy', 1); // atras do nginx (https + IP real p/ rate limit)

// Headers de segurança. CSP desligado por ora (app usa CDN do Chart.js + scripts inline);
// os demais headers (HSTS, X-Frame-Options, noSniff, referrer) ficam ativos.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    name: 'cf.sid',
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: 'auto',   // cookie só por HTTPS quando atrás do proxy seguro
      sameSite: 'lax',  // mitiga CSRF
      maxAge: 1000 * 60 * 60 * 8,
    },
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
router.use('/api/formas-pagamento', requireLogin, require('./routes/formasPagamento'));
router.use('/api/fornecedores', requireLogin, require('./routes/fornecedores'));
router.use('/api/membros', requireLogin, require('./routes/membros'));
router.use('/api/lancamentos', requireLogin, require('./routes/lancamentos'));
router.use('/api/despesas-fixas', requireLogin, require('./routes/despesasFixas'));
router.use('/api/dashboard', requireLogin, require('./routes/dashboard'));
router.use('/api/exportar', requireLogin, require('./routes/exportar'));

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
