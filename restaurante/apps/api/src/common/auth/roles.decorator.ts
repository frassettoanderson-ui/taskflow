import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Diz quais papéis podem usar uma rota.
 * Ex.: @Roles(Role.OWNER, Role.MANAGER)  -> só dono e gerente.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
