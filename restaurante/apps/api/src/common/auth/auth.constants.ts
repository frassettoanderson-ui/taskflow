/** Nome do cookie que guarda o "crachá" (token JWT) do usuário logado. */
export const AUTH_COOKIE = 'restaurante_token';

/** Quanto tempo o crachá vale. */
export const TOKEN_EXPIRES_IN = '7d';
export const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Conteúdo do crachá. Repare que o tenant viaja dentro dele. */
export interface JwtPayload {
  sub: string; // id do usuário
  tid: string; // id do tenant
  role: string; // papel (OWNER / MANAGER / OPERATOR)
}
