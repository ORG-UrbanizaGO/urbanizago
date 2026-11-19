import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '../lib/db';
import { email, fail, id, ok, paging, password, publicUser, text } from '../lib/http';
import { admin, authenticate, normal, principal } from '../middlewares/auth';
import { bannedHash, hashToken, randomToken, sealMail } from '../lib/crypto';
export const management = Router();
management.use(authenticate, normal);
management.get('/categories', async (req, res) => { ok(res, await db.category.findMany({ where: principal(req).role === 'ADMIN' ? {} : { active: true }, orderBy: { name: 'asc' } })); });
const category = z.object({ code: z.string().regex(/^[A-Z_]{2,30}$/), name: text(100), icon: text(40), color: z.string().regex(/^#[0-9a-f]{6}$/i), active: z.boolean().default(true) });
management.post('/categories', admin, async (req, res) => { ok(res, await db.category.create({ data: category.parse(req.body) }), 201); });
management.patch('/categories/:id', admin, async (req, res) => { ok(res, await db.category.update({ where: { id: id.parse(req.params.id) }, data: category.partial().parse(req.body) })); });
management.delete('/categories/:id', admin, async (req, res) => { ok(res, await db.category.update({ where: { id: id.parse(req.params.id) }, data: { active: false } })); });
management.get('/secretariats', async (req, res) => { ok(res, await db.secretariat.findMany({ where: principal(req).role === 'ADMIN' ? {} : { active: true }, include: { categories: { include: { category: true } } }, orderBy: { name: 'asc' } })); });
const department = z.object({ name: text(100), description: z.string().max(500).nullable().optional(), active: z.boolean().default(true), categoryIds: z.array(id).max(100).default([]) });
management.post('/secretariats', admin, async (req, res) => { const { categoryIds, ...v } = department.parse(req.body); ok(res, await db.secretariat.create({ data: { ...v, categories: { create: [...new Set(categoryIds)].map(categoryId => ({ categoryId })) } } }), 201); });
management.patch('/secretariats/:id', admin, async (req, res) => { const { categoryIds, ...v } = department.partial().parse(req.body); ok(res, await db.secretariat.update({ where: { id: id.parse(req.params.id) }, data: { ...v, categories: categoryIds ? { deleteMany: {}, create: [...new Set(categoryIds)].map(categoryId => ({ categoryId })) } : undefined } })); });
management.delete('/secretariats/:id', admin, async (req, res) => { ok(res, await db.secretariat.update({ where: { id: id.parse(req.params.id) }, data: { active: false } })); });
management.get('/users/me', async (req, res) => { const userId = principal(req).id; const [user, points, registered, resolved, medals] = await Promise.all([db.user.findUniqueOrThrow({ where: { id: userId }, select: publicUser }), db.pointsLedger.aggregate({ where: { userId }, _sum: { points: true } }), db.occurrence.count({ where: { userId } }), db.occurrence.count({ where: { userId, status: 'RESOLVIDO' } }), db.userMedal.findMany({ where: { userId }, include: { medal: true } })]); ok(res, { ...user, points: points._sum.points ?? 0, registered, resolved, medals }); });
management.patch('/users/me', async (req, res) => {
    const p = principal(req);
    if (p.suspended)
        fail(403, 'SUSPENDED', 'Conta suspensa.');
    const v = z.object({ name: text(100).optional(), phone: z.string().max(30).nullable().optional(), neighborhood: text(100).nullable().optional(), hideFromRanking: z.boolean().optional(), pushEnabled: z.boolean().optional() }).strict().parse(req.body);
    ok(res, await db.user.update({ where: { id: p.id }, data: v, select: publicUser }));
});
management.post('/users/me/password', async (req, res) => {
    const p = principal(req);
    if (p.suspended)
        fail(403, 'SUSPENDED', 'Conta suspensa.');
    const v = z.object({ currentPassword: password, newPassword: password }).parse(req.body);
    const u = await db.user.findUniqueOrThrow({ where: { id: p.id } });
    if (!await bcrypt.compare(v.currentPassword, u.passwordHash))
        fail(403, 'INVALID_PASSWORD', 'Senha incorreta.');
    await db.$transaction([db.user.update({ where: { id: p.id }, data: { passwordHash: await bcrypt.hash(v.newPassword, 12) } }), db.refreshToken.updateMany({ where: { userId: p.id, revokedAt: null }, data: { revokedAt: new Date() } }), db.passwordResetToken.updateMany({ where: { userId: p.id, usedAt: null }, data: { usedAt: new Date() } })]);
    ok(res, { message: 'Senha alterada. Faça login novamente.' });
});
management.post('/users/me/device', async (req, res) => {
    const p = principal(req);
    if (p.suspended)
        fail(403, 'SUSPENDED', 'Conta suspensa.');
    const v = z.object({ token: z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/).max(250), platform: z.enum(['android', 'ios']) }).parse(req.body);
    await db.deviceToken.upsert({ where: { token: v.token }, create: { ...v, userId: p.id }, update: { userId: p.id, platform: v.platform } });
    ok(res, { registered: true });
});
management.get('/users', admin, async (req, res) => { const v = paging.extend({ q: text(100).optional() }).parse(req.query); const where = v.q ? { name: { contains: v.q, mode: 'insensitive' as const } } : {}; const [total, items] = await db.$transaction([db.user.count({ where }), db.user.findMany({ where, select: publicUser, skip: (v.page - 1) * v.limit, take: v.limit, orderBy: { createdAt: 'desc' } })]); ok(res, { items, total, page: v.page, limit: v.limit }); });
management.post('/users/admin', admin, async (req, res) => {
    const v = z.object({ name: text(100), email, password }).strict().parse(req.body);
    if (await db.bannedEmailHash.findUnique({ where: { hash: bannedHash(v.email) } }))
        fail(403, 'REGISTRATION_DENIED', 'Cadastro indisponível.');
    ok(res, await db.user.create({ data: { name: v.name, email: v.email, role: 'ADMIN', passwordHash: await bcrypt.hash(v.password, 12) }, select: publicUser }), 201);
});
management.patch('/users/:id/block', admin, async (req, res) => {
    const userId = id.parse(req.params.id), v = z.object({ blocked: z.boolean(), reason: text(500) }).parse(req.body);
    const p = principal(req);
    const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
    if (u.role === 'ADMIN' || u.status === 'DELETED')
        fail(403, 'FORBIDDEN', 'Conta não elegível.');
    await db.$transaction([db.user.update({ where: { id: userId }, data: { status: v.blocked ? 'BLOCKED' : 'ACTIVE' } }), db.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }), db.auditLog.create({ data: { authorId: p.id, action: v.blocked ? 'BLOCK' : 'UNBLOCK', entity: 'User', entityId: userId, details: { reason: v.reason } } })]);
    ok(res, { blocked: v.blocked });
});
management.get('/notifications', async (req, res) => { const v = paging.parse(req.query), userId = principal(req).id; const [total, items] = await db.$transaction([db.notification.count({ where: { userId } }), db.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip: (v.page - 1) * v.limit, take: v.limit })]); ok(res, { items, total, page: v.page, limit: v.limit }); });
management.patch('/notifications/read-all', async (req, res) => {
    if (principal(req).suspended)
        fail(403, 'SUSPENDED', 'Conta suspensa.');
    await db.notification.updateMany({ where: { userId: principal(req).id, readAt: null }, data: { readAt: new Date() } });
    ok(res, { read: true });
});
management.patch('/notifications/:id/read', async (req, res) => {
    if (principal(req).suspended)
        fail(403, 'SUSPENDED', 'Conta suspensa.');
    const found = await db.notification.updateMany({ where: { id: id.parse(req.params.id), userId: principal(req).id }, data: { readAt: new Date() } });
    if (!found.count)
        fail(404, 'NOT_FOUND', 'Notificação não encontrada.');
    ok(res, { read: true });
});
const recipient = z.object({ name: text(100), email, secretariatId: id.nullable().optional(), categoryIds: z.array(id).max(100).default([]) });
const recipientSelect = { id: true, name: true, email: true, active: true, confirmedAt: true, secretariatId: true, categories: true } as const;
management.get('/recipients', admin, async (_req, res) => { ok(res, await db.notificationRecipient.findMany({ select: recipientSelect })); });
management.post('/recipients', admin, async (req, res) => { const { categoryIds, ...v } = recipient.parse(req.body); const token = randomToken(); const row = await db.$transaction(async (tx) => { const r = await tx.notificationRecipient.create({ data: { ...v, confirmationHash: hashToken(token), confirmationExpiresAt: new Date(Date.now() + 86400000), categories: { create: [...new Set(categoryIds)].map(categoryId => ({ categoryId })) } }, select: recipientSelect }); await tx.emailOutbox.create({ data: { recipient: r.email, subject: 'Confirme o recebimento — UrbanizaGO', body: sealMail(`Código de confirmação: ${token}`) } }); return r; }); ok(res, row, 201); });
management.patch('/recipients/:id', admin, async (req, res) => {
    const { categoryIds, ...v } = recipient.partial().extend({ active: z.boolean().optional() }).parse(req.body);
    const recipientId = id.parse(req.params.id);
    const row = await db.$transaction(async (tx) => {
        const r = await tx.notificationRecipient.findUniqueOrThrow({ where: { id: recipientId } });
        const changed = v.email !== undefined && v.email !== r.email;
        if (v.active && !r.confirmedAt && !changed)
            fail(409, 'UNCONFIRMED', 'Confirme o e-mail antes de ativá-lo.');
        const token = changed ? randomToken() : null;
        const saved = await tx.notificationRecipient.update({ where: { id: recipientId }, data: { ...v, ...(token ? { active: false, confirmedAt: null, confirmationHash: hashToken(token), confirmationExpiresAt: new Date(Date.now() + 86400000) } : {}), categories: categoryIds ? { deleteMany: {}, create: [...new Set(categoryIds)].map(categoryId => ({ categoryId })) } : undefined }, select: recipientSelect });
        if (token)
            await tx.emailOutbox.create({ data: { recipient: saved.email, subject: 'Confirme o recebimento — UrbanizaGO', body: sealMail(`Código de confirmação: ${token}`) } });
        return saved;
    });
    ok(res, row);
});
management.post('/recipients/:id/confirm', admin, async (req, res) => {
    const v = z.object({ token: z.string().length(64) }).parse(req.body);
    const result = await db.notificationRecipient.updateMany({ where: { id: id.parse(req.params.id), confirmationHash: hashToken(v.token), confirmationExpiresAt: { gt: new Date() } }, data: { confirmedAt: new Date(), confirmationHash: null, confirmationExpiresAt: null, active: true } });
    if (!result.count)
        fail(400, 'INVALID_CODE', 'Código inválido ou expirado.');
    ok(res, { confirmed: true });
});
management.post('/recipients/:id/test', admin, async (req, res) => {
    const rid = id.parse(req.params.id);
    await db.$transaction(async (tx) => {
        const r = await tx.notificationRecipient.findUniqueOrThrow({ where: { id: rid } });
        const token = randomToken();
        if (!r.confirmedAt)
            await tx.notificationRecipient.update({ where: { id: rid }, data: { confirmationHash: hashToken(token), confirmationExpiresAt: new Date(Date.now() + 86400000) } });
        await tx.emailOutbox.create({ data: { recipient: r.email, subject: 'Teste — UrbanizaGO', body: r.confirmedAt ? 'Envio de teste.' : sealMail(`Código de confirmação: ${token}`) } });
    });
    ok(res, { queued: true });
});
management.delete('/recipients/:id', admin, async (req, res) => { await db.notificationRecipient.delete({ where: { id: id.parse(req.params.id) } }); ok(res, { deleted: true }); });
management.get('/email-logs', admin, async (req, res) => { const v = paging.parse(req.query); const [total, items] = await db.$transaction([db.emailOutbox.count(), db.emailOutbox.findMany({ select: { id: true, recipient: true, subject: true, status: true, attempts: true, error: true, createdAt: true, sentAt: true, occurrenceId: true }, orderBy: { createdAt: 'desc' }, skip: (v.page - 1) * v.limit, take: v.limit })]); ok(res, { items, total, page: v.page, limit: v.limit }); });
const announcement = z.object({ title: text(120), body: text(3000), active: z.boolean().default(true) }).strict();
management.get('/announcements', async (req, res) => { ok(res, await db.announcement.findMany({ where: principal(req).role === 'ADMIN' ? {} : { active: true }, orderBy: { createdAt: 'desc' }, take: 100 })); });
management.post('/announcements', admin, async (req, res) => { ok(res, await db.announcement.create({ data: announcement.parse(req.body) }), 201); });
management.patch('/announcements/:id', admin, async (req, res) => { ok(res, await db.announcement.update({ where: { id: id.parse(req.params.id) }, data: announcement.partial().parse(req.body) })); });
management.delete('/announcements/:id', admin, async (req, res) => { ok(res, await db.announcement.update({ where: { id: id.parse(req.params.id) }, data: { active: false } })); });

