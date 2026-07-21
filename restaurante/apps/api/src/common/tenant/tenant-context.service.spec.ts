import { Role } from '@prisma/client';
import { TenantContextService } from './tenant-context.service';

describe('TenantContextService', () => {
  const service = new TenantContextService();

  it('fora de uma requisição, não existe tenant', () => {
    expect(service.getTenantId()).toBeNull();
  });

  it('dentro do contexto, enxerga o tenant', () => {
    service.run({ tenantId: 't1', userId: 'u1', role: Role.OWNER }, () => {
      expect(service.getTenantId()).toBe('t1');
    });
  });

  it('um contexto não vaza para o outro', () => {
    service.run({ tenantId: 't1', userId: 'u1', role: Role.OWNER }, () => {
      service.run({ tenantId: 't2', userId: 'u2', role: Role.MANAGER }, () => {
        expect(service.getTenantId()).toBe('t2');
      });
      // ao sair do de dentro, volta a valer o de fora
      expect(service.getTenantId()).toBe('t1');
    });
    expect(service.getTenantId()).toBeNull();
  });

  it('o contexto sobrevive a operações assíncronas', async () => {
    await service.run({ tenantId: 't9', userId: 'u9', role: Role.OPERATOR }, async () => {
      await new Promise((r) => setTimeout(r, 5));
      expect(service.getTenantId()).toBe('t9');
    });
  });
});
