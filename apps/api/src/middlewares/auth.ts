import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { db } from '../lib/db';
import { currentSanctions, fail } from '../lib/http';
export interface Principal {
    id: string;
    sessionId: string;
    role: 'CITIZEN' | 'ADMIN';
    restricted: boolean;
    suspended: boolean;
}
export function principal(req: Request): Principal { return req.res!.locals.principal as Principal; }
export const authenticate: RequestHandler = async (req, res, next) => {
    const input = req.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];
    if (!input)
        fail(401, 'UNAUTHORIZED', 'Autenticação necessária.');
    let decoded: unknown;
    try {
        decoded = jwt.verify(input, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'], issuer: 'urbanizago', audience: 'api' });
    }
    catch {
        fail(401, 'INVALID_TOKEN', 'Sessão inválida ou expirada.');
    }
    const parsed = z.object({ sub: z.string().uuid(), sid: z.string().uuid() }).safeParse(decoded);
    if (!parsed.success)
        fail(401, 'INVALID_TOKEN', 'Sessão inválida.');
    const session = await db.refreshToken.findUnique({ where: { id: parsed.data.sid }, include: { user: { include: { sanctions: { where: currentSanctions() } } } } });
    if (!session || session.userId !== parsed.data.sub || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE')
        fail(401, 'UNAUTHORIZED', 'Sessão indisponível.');
    res.locals.principal = { id: session.userId, sessionId: session.id, role: session.user.role, restricted: session.user.sanctions.some(s => s.type === 'BANIMENTO'), suspended: session.user.sanctions.some(s => s.type === 'SUSPENSAO') };
    next();
};
export const normal: RequestHandler = (req, _res, next) => {
    if (principal(req).restricted)
        fail(403, 'BANNED', 'Conta banida. Acesse a contestação.');
    next();
};
export const citizenWrite: RequestHandler = (req, _res, next) => {
    const p = principal(req);
    if (p.role !== 'CITIZEN' || p.restricted || p.suspended)
        fail(403, 'FORBIDDEN', 'Operação não permitida.');
    next();
};
export const admin: RequestHandler = (req, _res, next) => {
    const p = principal(req);
    if (p.role !== 'ADMIN' || p.restricted || p.suspended)
        fail(403, 'FORBIDDEN', 'Acesso administrativo necessário.');
    next();
};

