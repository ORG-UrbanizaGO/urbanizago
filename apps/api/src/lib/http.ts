import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
export class HttpError extends Error {
    constructor(public status: number, public code: string, message: string) { super(message); }
}
export function fail(status: number, code: string, message: string): never { throw new HttpError(status, code, message); }
export function ok(res: Response, data: unknown, status = 200) { res.status(status).json({ data }); }
export const id = z.string().uuid();
export const paging = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) });
export const text = (max: number) => z.string().trim().min(1).max(max);
export const email = z.string().trim().email().max(254).transform(v => v.toLowerCase());
export const password = z.string().min(8).max(72).refine(v => Buffer.byteLength(v, 'utf8') <= 72, 'Senha excede 72 bytes.');
export const publicUser = { id: true, name: true, email: true, role: true, status: true, phone: true, avatar: true, neighborhood: true, hideFromRanking: true, pushEnabled: true, createdAt: true } satisfies Prisma.UserSelect;
export const activeSanctions = { status: 'ATIVA', OR: [{ endsAt: null }, { endsAt: { gt: new Date(0) } }] } as const;
export const currentSanctions = (): Prisma.SanctionWhereInput => ({ status: 'ATIVA', startsAt: { lte: new Date() }, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] });

