import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { dentroDoHorario } from '../src/lib/horario.js';
import { durationToMs } from '../src/lib/jwt.js';
import { parsePagination, paginated } from '../src/lib/http.js';
import { sanitizePermissions, allPermissions } from '../src/lib/permissions.js';

describe('Modulo 0 - fundacao (smoke)', () => {
  it('GET /api/v1/health responde up', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe('up');
  });

  it('rota inexistente retorna 404 padronizado', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/nao-existe');
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('ROTA_NAO_ENCONTRADA');
  });

  it('rota protegida sem token retorna 401', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NAO_AUTENTICADO');
  });

  it('refresh sem cookie retorna 401 (nao trava)', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('NAO_AUTENTICADO');
  });

  it('login com credenciais invalidas nao trava (erro async tratado)', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'inexistente@x.com', senha: 'qualquer' });
    // 401 (credenciais) ou 500 se sem DB - o importante e' nao pendurar
    expect([401, 500]).toContain(res.status);
    expect(res.body.ok).toBe(false);
  });

  it('registrar com payload invalido retorna 422', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/auth/registrar').send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDACAO');
  });
});

describe('Modulo 1 - empresas (smoke)', () => {
  it('listar empresas sem token retorna 401', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/empresas');
    expect(res.status).toBe(401);
  });

  it('departamentos sem token retorna 401', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/departamentos');
    expect(res.status).toBe(401);
  });

  it('importar CSV sem token retorna 401', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/empresas/importar').send({ linhas: [] });
    expect(res.status).toBe(401);
  });
});

describe('identificadores (validacao)', () => {
  it('valida CNPJ e CPF corretamente', async () => {
    const { cnpjValido, cpfValido, soDigitos } = await import('../src/lib/identificadores.js');
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11.222.333/0001-82')).toBe(false);
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(soDigitos('12.345/678')).toBe('12345678');
  });
});

describe('Modulo 2 - obrigacoes (smoke)', () => {
  it('catalogo sem token retorna 401', async () => {
    const res = await request(createApp()).get('/api/v1/obrigacoes');
    expect(res.status).toBe(401);
  });
  it('regimes sem token retorna 401', async () => {
    const res = await request(createApp()).get('/api/v1/regimes');
    expect(res.status).toBe(401);
  });
});

describe('engine de prazos', () => {
  it('ehDiaUtil considera fim de semana e feriado', async () => {
    const { ehDiaUtil, montarFeriados } = await import('../src/lib/prazos.js');
    const feriados = montarFeriados([new Date(2026, 0, 1)]);
    expect(ehDiaUtil(new Date(2026, 0, 4), feriados, false)).toBe(false); // domingo
    expect(ehDiaUtil(new Date(2026, 0, 1), feriados, false)).toBe(false); // feriado
    expect(ehDiaUtil(new Date(2026, 0, 5), feriados, false)).toBe(true); // segunda
  });

  it('calcularPrazos aplica dia fixo e antecedencia tecnica', async () => {
    const { calcularPrazos, montarFeriados } = await import('../src/lib/prazos.js');
    const feriados = montarFeriados([]);
    // DAS dia 20, competencia jan/2026 -> vence fev/2026
    const p = calcularPrazos(
      { tipoDia: 'DIA_FIXO', dia: 20, regraNaoUtil: 'ANTECIPA', diasAntesTecnico: 2, tipoDiasAntes: 'UTEIS' },
      2026, 0, feriados, false,
    );
    expect(p.prazoLegal.getMonth()).toBe(1); // fevereiro
    expect(p.prazoTecnico.getTime()).toBeLessThanOrEqual(p.prazoLegal.getTime());
  });

  it('nthDiaUtil retorna dia util valido', async () => {
    const { nthDiaUtil, ehDiaUtil, montarFeriados } = await import('../src/lib/prazos.js');
    const feriados = montarFeriados([]);
    const d = nthDiaUtil(2026, 0, 5, feriados, false); // 5o dia util de jan/2026
    expect(ehDiaUtil(d, feriados, false)).toBe(true);
  });
});

describe('Modulo 3 - entregas (smoke)', () => {
  it('lista de entregas sem token retorna 401', async () => {
    const res = await request(createApp()).get('/api/v1/entregas');
    expect(res.status).toBe(401);
  });
  it('gerar competencia sem token retorna 401', async () => {
    const res = await request(createApp()).post('/api/v1/entregas/gerar').send({ ano: 2026, mes: 6 });
    expect(res.status).toBe(401);
  });
});

describe('status de entrega', () => {
  it('classifica pendentes por data', async () => {
    const { computarStatusPendente } = await import('../src/modules/entrega/entrega.status.js');
    const hoje = new Date(2026, 5, 1); // 01/06/2026
    // tecnico daqui a 20 dias -> antecipado
    expect(computarStatusPendente(new Date(2026, 5, 21), new Date(2026, 5, 23), hoje, 7)).toBe('PENDENTE_ANTECIPADO');
    // tecnico daqui a 3 dias -> pendente no prazo
    expect(computarStatusPendente(new Date(2026, 5, 4), new Date(2026, 5, 6), hoje, 7)).toBe('PENDENTE');
    // passou o tecnico, nao o legal -> atraso tecnico
    expect(computarStatusPendente(new Date(2026, 4, 30), new Date(2026, 5, 5), hoje, 7)).toBe('EM_ATRASO_TECNICO');
    // passou o legal -> atraso legal
    expect(computarStatusPendente(new Date(2026, 4, 20), new Date(2026, 4, 25), hoje, 7)).toBe('EM_ATRASO_LEGAL');
  });
});

describe('Modulo 4 - usuarios/auditoria (smoke)', () => {
  it('criar usuario sem token retorna 401', async () => {
    const res = await request(createApp()).post('/api/v1/usuarios').send({});
    expect(res.status).toBe(401);
  });
  it('auditoria sem token retorna 401', async () => {
    const res = await request(createApp()).get('/api/v1/auditoria');
    expect(res.status).toBe(401);
  });
});

describe('Modulo 7 - GED/protocolo (smoke)', () => {
  it('GED sem token retorna 401', async () => {
    const res = await request(createApp()).get('/api/v1/ged/armazenamento');
    expect(res.status).toBe(401);
  });
  it('protocolos fisicos sem token retorna 401', async () => {
    const res = await request(createApp()).get('/api/v1/protocolos-fisicos');
    expect(res.status).toBe(401);
  });
  it('rota publica /p/:token responde (404 sem DB tambem aceito)', async () => {
    const res = await request(createApp()).get('/p/inexistente');
    // com DB: 404 (token inexistente); sem DB: 500. O importante e' a rota existir.
    expect([404, 500]).toContain(res.status);
  });
});

describe('Modulo 5 - robo (smoke)', () => {
  it('painel do robo sem token retorna 401', async () => {
    const res = await request(createApp()).get('/api/v1/robo/painel');
    expect(res.status).toBe(401);
  });
  it('ingest sem api-key retorna 401', async () => {
    const res = await request(createApp()).post('/api/v1/robo/ingest');
    expect(res.status).toBe(401);
  });
  it('assinaturas sem token retorna 401', async () => {
    const res = await request(createApp()).get('/api/v1/assinaturas');
    expect(res.status).toBe(401);
  });
});

describe('Modulo 6 - processos (smoke)', () => {
  it('processos sem token retorna 401', async () => {
    const res = await request(createApp()).get('/api/v1/processos');
    expect(res.status).toBe(401);
  });
  it('matrizes sem token retorna 401', async () => {
    const res = await request(createApp()).get('/api/v1/matrizes');
    expect(res.status).toBe(401);
  });
});

describe('horario de acesso', () => {
  it('lista vazia = sempre permitido', () => {
    expect(dentroDoHorario([])).toBe(true);
    expect(dentroDoHorario(null)).toBe(true);
  });

  it('bloqueia fora da janela', () => {
    // quarta-feira 10:00 BRT
    const quarta10h = new Date('2026-06-17T13:00:00Z'); // 10:00 BRT
    const janelaManha = [{ diaSemana: 3, inicio: '08:00', fim: '09:00' }];
    expect(dentroDoHorario(janelaManha, quarta10h)).toBe(false);
    const janelaOk = [{ diaSemana: 3, inicio: '09:00', fim: '12:00' }];
    expect(dentroDoHorario(janelaOk, quarta10h)).toBe(true);
  });
});

describe('utilitarios', () => {
  it('durationToMs converte unidades', () => {
    expect(durationToMs('15m')).toBe(900_000);
    expect(durationToMs('7d')).toBe(604_800_000);
    expect(durationToMs('1h')).toBe(3_600_000);
  });

  it('parsePagination respeita o limite maximo', () => {
    const p = parsePagination({ page: '2', limit: '500' });
    expect(p.page).toBe(2);
    expect(p.limit).toBe(100);
    expect(p.skip).toBe(100);
  });

  it('paginated calcula totalPages', () => {
    const r = paginated([1, 2], 25, parsePagination({ limit: '10' }));
    expect(r.totalPages).toBe(3);
    expect(r.total).toBe(25);
  });

  it('sanitizePermissions ignora flags desconhecidas', () => {
    const p = sanitizePermissions({ empresas_ver: true, flag_falsa: true } as never);
    expect(p.empresas_ver).toBe(true);
    expect((p as Record<string, boolean>).flag_falsa).toBeUndefined();
    expect(allPermissions(true).admin_escritorio).toBe(true);
  });
});
