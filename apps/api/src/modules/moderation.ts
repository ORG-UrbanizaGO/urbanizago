import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import type { Prisma } from '@prisma/client';
import { db } from '../lib/db';
import { currentSanctions, fail, id, ok, paging, password, publicUser, text } from '../lib/http';
import { admin, authenticate, principal } from '../middlewares/auth';
import { bannedHash, randomToken, hashToken, sealMail } from '../lib/crypto';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { env } from '../config/env';
import { deletePhoto, imageMime, photoUrl, putPhoto } from '../lib/storage';
import { notify, recordPoints, updateMedals } from '../lib/gamification';
export const moderation = Router();
moderation.use(authenticate);
const appealUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 3, fields: 3, fieldSize: 4096 } });
async function appealView<T extends {
    attachments: string[];
}>(a: T) { return { ...a, attachments: await Promise.all(a.attachments.map(async (key, index) => ({ id: String(index), url: await photoUrl(key) }))) }; }
async function sanctionView<T extends {
    appeal: {
        attachments: string[];
    } | null;
}>(s: T) { return { ...s, appeal: s.appeal ? await appealView(s.appeal) : null }; }
async function reverse(tx: Prisma.TransactionClient, sanctionId: string, reason: string) {
    const s = await tx.sanction.findUniqueOrThrow({ where: { id: sanctionId }, include: { user: true } });
    if (s.status === 'REVERTIDA')
        return;
    await tx.sanction.update({ where: { id: s.id }, data: { status: 'REVERTIDA', reversalReason: reason } });
    const debit = await tx.pointsLedger.findUnique({ where: { eventKey: `sanction:${s.id}` } });
    if (debit)
        await recordPoints(tx, s.userId, `reverse-sanction:${s.id}`, 'SANCTION_REVERSED', -debit.points, reason);
    if (s.type === 'BANIMENTO' && !await tx.sanction.findFirst({ where: { userId: s.userId, type: 'BANIMENTO', ...currentSanctions() } }) && s.user.status !== 'DELETED')
        await tx.bannedEmailHash.deleteMany({ where: { hash: bannedHash(s.user.email) } });
    await notify(tx, s.userId, 'SANCTION', 'Penalidade revertida', reason);
}
moderation.get('/moderation/me', async (req, res) => { ok(res, await Promise.all((await db.sanction.findMany({ where: { userId: principal(req).id }, include: { appeal: true }, orderBy: { startsAt: 'desc' } })).map(sanctionView))); });
moderation.get('/moderation/users/:id', admin, async (req, res) => { const userId = id.parse(req.params.id); const [user, sanctions, occurrences, points] = await Promise.all([db.user.findUniqueOrThrow({ where: { id: userId }, select: publicUser }), db.sanction.findMany({ where: { userId }, include: { appeal: true } }), db.occurrence.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 }), db.pointsLedger.aggregate({ where: { userId }, _sum: { points: true } })]); ok(res, { user, sanctions: await Promise.all(sanctions.map(sanctionView)), occurrences, points: points._sum.points ?? 0 }); });
moderation.post('/moderation/users/:id/sanctions', admin, async (req, res) => {
    const userId = id.parse(req.params.id), authorId = principal(req).id;
    const v = z.object({ type: z.enum(['ADVERTENCIA', 'SUSPENSAO', 'BANIMENTO']), reason: text(1000), days: z.number().int().min(1).max(365).optional() }).refine(x => x.type !== 'SUSPENSAO' || !!x.days).parse(req.body);
    const s = await db.$transaction(async (tx) => {
        await tx.$queryRaw `SELECT pg_advisory_xact_lock(621781)::text`;
        const u = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        if (u.role !== 'CITIZEN' || u.status === 'DELETED')
            fail(403, 'FORBIDDEN', 'Conta não elegível.');
        const row = await tx.sanction.create({ data: { userId, authorId, type: v.type, reason: v.reason, endsAt: v.type === 'SUSPENSAO' ? new Date(Date.now() + v.days! * 86400000) : null } });
        const balance = await tx.pointsLedger.aggregate({ where: { userId }, _sum: { points: true } });
        const points = Math.max(0, balance._sum.points ?? 0);
        if (points)
            await recordPoints(tx, userId, `sanction:${row.id}`, 'SANCTION', -points, v.reason);
        if (v.type === 'BANIMENTO')
            await tx.bannedEmailHash.upsert({ where: { hash: bannedHash(u.email) }, create: { hash: bannedHash(u.email) }, update: {} });
        await notify(tx, userId, 'SANCTION', 'Penalidade aplicada', v.reason + ' — Você pode contestar no aplicativo.');
        await tx.emailOutbox.create({ data: { recipient: u.email, subject: 'Penalidade — UrbanizaGO', body: v.reason + '\nConteste pelo aplicativo.' } });
        await tx.auditLog.create({ data: { authorId, action: 'SANCTION', entity: 'User', entityId: userId, details: { sanctionId: row.id } } });
        return row;
    });
    ok(res, s, 201);
});
moderation.post('/moderation/sanctions/:id/reverse', admin, async (req, res) => { const v = z.object({ reason: text(1000) }).parse(req.body); const sid = id.parse(req.params.id); await db.$transaction(async (tx) => { await tx.$queryRaw `SELECT pg_advisory_xact_lock(621781)::text`; await reverse(tx, sid, v.reason); await tx.auditLog.create({ data: { authorId: principal(req).id, action: 'REVERSE_SANCTION', entity: 'Sanction', entityId: sid } }); }); ok(res, { reversed: true }); });
moderation.post('/appeals', rateLimit({ windowMs: 3600000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { code: 'RATE_LIMIT', message: 'Tente novamente mais tarde.' } }), appealUpload.array('attachments', 3), async (req, res) => {
    const v = z.object({ sanctionId: id, text: text(2000) }).strict().parse(req.body);
    const userId = principal(req).id;
    const files = Array.isArray(req.files) ? req.files : [];
    const prepared = files.map(f => { const type = imageMime(f.buffer); if (!type || type !== f.mimetype)
        fail(400, 'INVALID_PHOTO', 'Envie JPEG, PNG ou WebP.'); return { f, type, key: `appeals/${randomUUID()}` }; });
    const keys: string[] = [];
    let row: Awaited<ReturnType<typeof db.sanctionAppeal.create>>;
    try {
        const target = await db.sanction.findFirst({ where: { id: v.sanctionId, userId, status: { not: 'REVERTIDA' } }, include: { appeal: true } });
        if (!target)
            fail(404, 'NOT_FOUND', 'Penalidade não encontrada.');
        if (target.appeal)
            fail(409, 'APPEAL_EXISTS', 'Já existe uma contestação.');
        for (const p of prepared) {
            await putPhoto(p.key, p.f.buffer, p.type);
            keys.push(p.key);
        }
        row = await db.$transaction(async (tx) => { const sanction = await tx.sanction.findFirst({ where: { id: v.sanctionId, userId, status: { not: 'REVERTIDA' } } }); if (!sanction)
            fail(404, 'NOT_FOUND', 'Penalidade não encontrada.'); const a = await tx.sanctionAppeal.create({ data: { ...v, userId, attachments: keys } }); const admins = await tx.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } }); await tx.notification.createMany({ data: admins.map(x => ({ userId: x.id, type: 'APPEAL', title: 'Novo recurso', message: 'Há uma contestação pendente.' })) }); return a; });
    }
    catch (e) {
        await Promise.allSettled(keys.map(deletePhoto));
        throw e;
    }
    ok(res, await appealView(row), 201);
});
moderation.get('/appeals', admin, async (req, res) => { const v = paging.extend({ status: z.enum(['PENDENTE', 'ACEITO', 'NEGADO']).optional() }).parse(req.query); const items = await db.sanctionAppeal.findMany({ where: { status: v.status }, include: { sanction: true }, orderBy: { createdAt: 'desc' }, skip: (v.page - 1) * v.limit, take: v.limit }); ok(res, await Promise.all(items.map(appealView))); });
moderation.patch('/appeals/:id', admin, async (req, res) => {
    const v = z.object({ status: z.enum(['ACEITO', 'NEGADO']), response: text(1000) }).parse(req.body);
    const aid = id.parse(req.params.id);
    await db.$transaction(async (tx) => {
        await tx.$queryRaw `SELECT pg_advisory_xact_lock(621781)::text`;
        const a = await tx.sanctionAppeal.findUniqueOrThrow({ where: { id: aid } });
        if (a.status !== 'PENDENTE')
            fail(409, 'ALREADY_REVIEWED', 'Recurso já analisado.');
        await tx.sanctionAppeal.update({ where: { id: aid }, data: { ...v, reviewerId: principal(req).id, reviewedAt: new Date() } });
        if (v.status === 'ACEITO')
            await reverse(tx, a.sanctionId, v.response);
        await notify(tx, a.userId, 'APPEAL', 'Contestação analisada', `${v.status}: ${v.response}`);
    });
    ok(res, { reviewed: true });
});
moderation.patch('/moderation/occurrences/:id', admin, async (req, res) => {
    const v = z.discriminatedUnion('action', [z.object({ action: z.literal('reject'), reason: text(500) }), z.object({ action: z.literal('duplicate'), originalId: id, reason: text(500) })]).parse(req.body);
    const oid = id.parse(req.params.id);
    await db.$transaction(async (tx) => {
        await tx.$queryRaw `SELECT pg_advisory_xact_lock(621781)::text`;
        const o = await tx.occurrence.findUniqueOrThrow({ where: { id: oid } });
        if (v.action === 'duplicate') {
            const original = await tx.occurrence.findUniqueOrThrow({ where: { id: v.originalId } });
            if (original.id === oid || original.duplicateOfId || original.categoryId !== o.categoryId || original.sequence >= o.sequence || original.validationStatus === 'REJEITADA')
                fail(400, 'INVALID_DUPLICATE', 'Selecione uma ocorrência original anterior da mesma categoria.');
            await tx.occurrence.update({ where: { id: oid }, data: { duplicateOfId: original.id } });
        }
        else
            await tx.occurrence.update({ where: { id: oid }, data: { validationStatus: 'REJEITADA', rejectionReason: v.reason } });
        for (const event of ['validated', 'resolved']) {
            const row = await tx.pointsLedger.findUnique({ where: { eventKey: `${event}:${oid}` } });
            if (row)
                await recordPoints(tx, o.userId, `reversal:${event}:${oid}`, 'REVERSAL', -row.points, v.reason, oid);
        }
        await updateMedals(tx, o.userId);
        await notify(tx, o.userId, 'VALIDATION', 'Validação da ocorrência', v.reason, oid);
        await tx.auditLog.create({ data: { authorId: principal(req).id, action: v.action, entity: 'Occurrence', entityId: oid, details: { reason: v.reason } } });
    });
    ok(res, { updated: true });
});
export async function anonymize(tx: Prisma.TransactionClient, userId: string, authorId: string, reason: string) {
    const u = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (u.status === 'DELETED')
        return;
    await tx.user.update({ where: { id: userId }, data: { name: 'Usuário removido', email: `deleted-${randomToken()}@invalid.local`, passwordHash: await bcrypt.hash(randomToken(), 12), status: 'DELETED', phone: null, avatar: null, neighborhood: null, hideFromRanking: true, pushEnabled: false, anonymizedAt: new Date(), deletedAt: new Date(), failedAttempts: 0, lockedUntil: null } });
    await tx.refreshToken.deleteMany({ where: { userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId } });
    await tx.accountDeletionToken.deleteMany({ where: { userId } });
    await tx.deviceToken.deleteMany({ where: { userId } });
    const balance = await tx.pointsLedger.aggregate({ where: { userId }, _sum: { points: true } });
    if (balance._sum.points)
        await recordPoints(tx, userId, `delete:${userId}`, 'ACCOUNT_DELETION', -balance._sum.points, 'Anonimização');
    await tx.userMedal.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.emailOutbox.updateMany({ where: { recipient: u.email }, data: { recipient: 'removed@invalid.local', body: '', status: 'FAILED', error: 'Conta removida' } });
    await tx.accountDeletionRequest.create({ data: { userId, requestedById: authorId, effectiveAt: new Date(), status: 'CONCLUIDA' } });
    await tx.auditLog.create({ data: { authorId, action: 'ANONYMIZE', entity: 'User', entityId: userId, details: { reason } } });
}
const deletionLimit = rateLimit({ windowMs: 15 * 60000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { code: 'RATE_LIMIT', message: 'Tente novamente mais tarde.' } });
moderation.post('/account/delete/request', deletionLimit, async (req, res) => { const p = principal(req); if (p.restricted || p.suspended || p.role !== 'CITIZEN')
    fail(403, 'FORBIDDEN', 'Solicite atendimento para exclusão desta conta.'); const v = z.object({ password }).parse(req.body); const u = await db.user.findUniqueOrThrow({ where: { id: p.id } }); if (!await bcrypt.compare(v.password, u.passwordHash))
    fail(403, 'INVALID_PASSWORD', 'Senha incorreta.'); const token = randomToken(); await db.$transaction(async (tx) => { await tx.accountDeletionToken.upsert({ where: { userId: p.id }, create: { userId: p.id, hash: hashToken(token), expiresAt: new Date(Date.now() + 1800000) }, update: { hash: hashToken(token), expiresAt: new Date(Date.now() + 1800000) } }); await tx.emailOutbox.create({ data: { recipient: u.email, subject: 'Confirme a exclusão — UrbanizaGO', body: sealMail(`Código de uso único: ${token}\nVálido por 30 minutos. Se não solicitou, ignore esta mensagem.`) } }); }); ok(res, { message: 'Confira seu e-mail para confirmar a exclusão.' }); });
moderation.post('/account/delete', deletionLimit, async (req, res) => { const p = principal(req); if (p.restricted || p.suspended || p.role !== 'CITIZEN')
    fail(403, 'FORBIDDEN', 'Solicite atendimento para exclusão desta conta.'); const v = z.object({ password, token: z.string().length(64) }).parse(req.body); const u = await db.user.findUniqueOrThrow({ where: { id: p.id } }); if (!await bcrypt.compare(v.password, u.passwordHash))
    fail(403, 'INVALID_PASSWORD', 'Senha incorreta.'); await db.$transaction(async (tx) => { const claim = await tx.accountDeletionToken.deleteMany({ where: { userId: p.id, hash: hashToken(v.token), expiresAt: { gt: new Date() } } }); if (!claim.count)
    fail(400, 'INVALID_CODE', 'Código inválido ou expirado.'); await anonymize(tx, u.id, u.id, 'Solicitação do titular'); await tx.emailOutbox.create({ data: { recipient: u.email, subject: 'Conta excluída — UrbanizaGO', body: 'Sua conta foi anonimizada. Este endereço será removido do log após o envio.' } }); }); ok(res, { deleted: true }); });
moderation.delete('/account/users/:id', admin, async (req, res) => {
    const userId = id.parse(req.params.id), v = z.object({ reason: text(500) }).parse(req.body);
    const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
    if (u.role === 'ADMIN')
        fail(403, 'FORBIDDEN', 'Exclusão de administrador requer procedimento operacional.');
    await db.$transaction(tx => anonymize(tx, userId, principal(req).id, v.reason));
    ok(res, { deleted: true });
});

