import { Router } from 'express';
import { env } from '../../env.js';
import { ok } from '../../lib/http.js';
import { Errors } from '../../lib/errors.js';
import { sincronizarDoNauta } from '../../lib/nautaBridge.js';

// Rotas internas server-to-server (a Nauta chama após salvar cadastro / concluir onboarding).
// Autenticação: header x-internal-secret == SSO_SHARED_SECRET (mesmo segredo do SSO).
const router = Router();

router.use((req, _res, next) => {
  const secret = env.sso.secret;
  if (!secret || req.header('x-internal-secret') !== secret) throw Errors.naoAutenticado();
  next();
});

// Sobe o cadastro do ERP (link público / tela antiga / conclusão de onboarding) para a Empresa do Obrigô.
router.post('/sync-from-nauta', async (req, res) => {
  const nautaClienteId = String(req.body?.nautaClienteId ?? '').trim();
  if (!nautaClienteId) throw Errors.validacao('nautaClienteId ausente.');
  const empresaId = await sincronizarDoNauta(nautaClienteId);
  return ok(res, { sincronizado: !!empresaId, empresaId });
});

export default router;
