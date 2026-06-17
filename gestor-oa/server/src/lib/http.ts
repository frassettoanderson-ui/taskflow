import type { Response } from 'express';
import type { Paginated } from '@gestoroa/shared';
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT } from '@gestoroa/shared';

export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ ok: true, data });
}

export function fail(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  return res.status(status).json({ ok: false, error: { code, message, details } });
}

export interface ParsedPagination {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export function parsePagination(query: {
  page?: unknown;
  limit?: unknown;
}): ParsedPagination {
  let page = Number(query.page ?? 1);
  let limit = Number(query.limit ?? PAGINATION_DEFAULT_LIMIT);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = PAGINATION_DEFAULT_LIMIT;
  if (limit > PAGINATION_MAX_LIMIT) limit = PAGINATION_MAX_LIMIT;
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function paginated<T>(
  items: T[],
  total: number,
  p: ParsedPagination,
): Paginated<T> {
  return {
    items,
    page: p.page,
    limit: p.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / p.limit)),
  };
}
