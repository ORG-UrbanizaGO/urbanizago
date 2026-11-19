import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { db } from '../lib/db';
import { bannedHash, hashToken, randomToken, sealMail } from '../lib/crypto';
import { currentSanctions, email, fail, ok, password, publicUser, text } from '../lib/http';
import { env } from '../config/env';
import { authenticate, principal } from '../middlewares/auth';
import type { Prisma } from '@prisma/client';
export const auth = Router();
const limited = rateLimit({ windowMs: 15 * 60000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { code: 'RATE_LIMIT', message: 'Tente novamente mais tarde.' } });
const loginSchema = z.object({ email, password, client: z.enum(['web', 'mobile']).default('mobile') });
const cookieOptions = { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'strict' as const, path: '/api/v1/auth' };
/** Sessão persistida e refresh opaco com hash. O access token aponta para a sessão revogável. */
async function createSession(tx: Prisma.TransactionClient, userId: string, device?: string) { const token = randomToken(); const session = await tx.refreshToken.create({ data: { userId, hash: hashToken(token + env.JWT_REFRESH_SECRET), expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 86400000), device } }); return { session, token }; }
function reply(res: Response, user: unknown, session: {
    id: string;
    userId: string;
}, token: string, client: 'web' | 'mobile', restricted = false) {
    const accessToken = jwt.sign({ sid: session.id }, env.JWT_ACCESS_SECRET, { subject: session.userId, expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'], algorithm: 'HS256', issuer: 'urbanizago', audience: 'api' });
    if (client === 'web')
        res.cookie('urbaniza_refresh', token, { ...cookieOptions, maxAge: env.JWT_REFRESH_TTL_DAYS * 86400000 });
    ok(res, { user, accessToken, ...(client === 'mobile' ? { refreshToken: token } : {}), restricted });
}
function refreshInput(req: Request) { return z.object({ refreshToken: z.string().length(64).optional(), client: z.enum(['web', 'mobile']).default('mobile') }).parse(req.body ?? {}); }
auth.post('/register', limited, async (req, res) => {
    const v = z.object({ name: text(100), email, password, neighborhood: text(100).optional() }).strict().parse(req.body);
    if (await db.bannedEmailHash.findUnique({ where: { hash: bannedHash(v.email) } }))
        fail(403, 'REGISTRATION_DENIED', 'Cadastro indisponível.');
    const user = await db.user.create({ data: { name: v.name, email: v.email, passwordHash: await bcrypt.hash(v.password, 12), neighborhood: v.neighborhood }, select: publicUser });
    ok(res, user, 201);
});
auth.post('/login', limited, async (req, res) => {
    const v = loginSchema.parse(req.body);
    const u = await db.user.findUnique({ where: { email: v.email }, include: { sanctions: { where: currentSanctions() } } });
    if (!u || u.status !== 'ACTIVE')
        fail(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
    if (v.client === 'web' && u.role !== 'ADMIN')
        fail(403, 'FORBIDDEN', 'Painel exclusivo de administradores.');
    if (u.lockedUntil && u.lockedUntil > new Date())
        fail(429, 'LOCKED', 'Tente novamente em 15 minutos.');
    if (!await bcrypt.compare(v.password, u.passwordHash)) {
        const attempts = await db.user.update({ where: { id: u.id }, data: { failedAttempts: { increment: 1 } }, select: { failedAttempts: true } });
        if (attempts.failedAttempts >= 5)
            await db.user.update({ where: { id: u.id }, data: { lockedUntil: new Date(Date.now() + 900000), failedAttempts: 0 } });
        fail(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
    }
    const { session, token } = await db.$transaction(async (tx) => { await tx.user.update({ where: { id: u.id }, data: { failedAttempts: 0, lockedUntil: null } }); return createSession(tx, u.id, v.client); });
    const user = await db.user.findUniqueOrThrow({ where: { id: u.id }, select: publicUser });
    reply(res, user, session, token, v.client, u.sanctions.some(s => s.type === 'BANIMENTO'));
});
auth.post('/refresh', limited, async (req, res) => {
    const v = refreshInput(req);
    const token = v.client === 'web' ? req.cookies?.urbaniza_refresh : v.refreshToken;
    if (typeof token !== 'string' || token.length !== 64)
        fail(401, 'INVALID_REFRESH', 'Sessão inválida.');
    const result = await db.$transaction(async (tx) => {
        const old = await tx.refreshToken.findUnique({ where: { hash: hashToken(token + env.JWT_REFRESH_SECRET) }, include: { user: { include: { sanctions: { where: currentSanctions() } } } } });
        if (!old || old.revokedAt || old.expiresAt <= new Date() || old.user.status !== 'ACTIVE')
            fail(401, 'INVALID_REFRESH', 'Sessão inválida.');
        if (v.client === 'web' && old.user.role !== 'ADMIN')
            fail(403, 'FORBIDDEN', 'Painel exclusivo de administradores.');
        const claim = await tx.refreshToken.updateMany({ where: { id: old.id, revokedAt: null }, data: { revokedAt: new Date() } });
        if (!claim.count)
            fail(401, 'INVALID_REFRESH', 'Sessão já renovada.');
        const fresh = await createSession(tx, old.userId, v.client);
        const user = await tx.user.findUniqueOrThrow({ where: { id: old.userId }, select: publicUser });
        return { ...fresh, user, restricted: old.user.sanctions.some(s => s.type === 'BANIMENTO') };
    });
    reply(res, result.user, result.session, result.token, v.client, result.restricted);
});
auth.post('/logout', authenticate, async (req, res) => {
    const v = refreshInput(req);
    const token = v.client === 'web' ? req.cookies?.urbaniza_refresh : v.refreshToken;
    const p = principal(req);
    await db.refreshToken.updateMany({ where: { id: p.sessionId, userId: p.id }, data: { revokedAt: new Date() } });
    if (typeof token === 'string')
        await db.refreshToken.updateMany({ where: { userId: p.id, hash: hashToken(token + env.JWT_REFRESH_SECRET) }, data: { revokedAt: new Date() } });
    else
        await db.refreshToken.updateMany({ where: { userId: p.id, revokedAt: null }, data: { revokedAt: new Date() } });
    res.clearCookie('urbaniza_refresh', cookieOptions);
    ok(res, { message: 'Sessão encerrada.' });
});
auth.post('/forgot-password', limited, async (req, res) => {
    const v = z.object({ email }).parse(req.body);
    const u = await db.user.findUnique({ where: { email: v.email }, select: { id: true, status: true } });
    if (u?.status === 'ACTIVE') {
        const token = randomToken();
        await db.$transaction(async (tx) => { await tx.passwordResetToken.updateMany({ where: { userId: u.id, usedAt: null }, data: { usedAt: new Date() } }); await tx.passwordResetToken.create({ data: { hash: hashToken(token), userId: u.id, expiresAt: new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60000) } }); await tx.emailOutbox.create({ data: { recipient: v.email, subject: 'Redefinição de senha — UrbanizaGO', body: sealMail(`Código de uso único: ${token}\nValidade: ${env.PASSWORD_RESET_TTL_MINUTES} minutos.`) } }); });
    }
    ok(res, { message: 'Se o e-mail existir, enviaremos instruções.' });
});
auth.post('/verify-reset', limited, async (req, res) => {
    const v = z.object({ token: z.string().length(64) }).parse(req.body);
    const row = await db.passwordResetToken.findUnique({ where: { hash: hashToken(v.token) } });
    if (!row || row.usedAt || row.expiresAt <= new Date())
        fail(400, 'INVALID_RESET', 'Código inválido ou expirado.');
    ok(res, { valid: true });
});
auth.post('/reset-password', limited, async (req, res) => {
    const v = z.object({ token: z.string().length(64), password }).parse(req.body);
    const hash = await bcrypt.hash(v.password, 12);
    await db.$transaction(async (tx) => {
        const row = await tx.passwordResetToken.findUnique({ where: { hash: hashToken(v.token) }, include: { user: true } });
        if (!row || row.usedAt || row.expiresAt <= new Date() || row.user.status !== 'ACTIVE')
            fail(400, 'INVALID_RESET', 'Código inválido ou expirado.');
        const claim = await tx.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
        if (!claim.count)
            fail(400, 'INVALID_RESET', 'Código já usado.');
        await tx.user.update({ where: { id: row.userId }, data: { passwordHash: hash, failedAttempts: 0, lockedUntil: null } });
        await tx.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } });
    });
    ok(res, { message: 'Senha redefinida.' });
});

