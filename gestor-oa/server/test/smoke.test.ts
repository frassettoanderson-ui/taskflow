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

  it('registrar com payload invalido retorna 422', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/auth/registrar').send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDACAO');
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
