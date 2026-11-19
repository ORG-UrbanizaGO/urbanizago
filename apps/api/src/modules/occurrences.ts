import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { env } from '../config/env';
import { db } from '../lib/db';
import { fail, id, ok, paging, text } from '../lib/http';
import { admin, authenticate, citizenWrite, normal, principal } from '../middlewares/auth';
import { deletePhoto, photoUrl, putPhoto } from '../lib/storage';
import { distance, notify, recordPoints, settings, updateMedals } from '../lib/gamification';
export const occurrences = Router();
occurrences.use(authenticate, normal);
const status = z.enum(['ABERTO', 'EM_ANALISE', 'EM_ATENDIMENTO', 'RESOLVIDO']);
const priority = z.enum(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']);
const filters = paging.extend({ status: status.optional(), categoryId: id.optional(), secretariatId: id.optional(), neighborhood: text(100).optional(), q: text(200).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional(), mine: z.enum(['true', 'false']).optional(), group: z.enum(['open', 'resolved']).optional() });
function whereOf(v: z.infer<typeof filters>): Prisma.OccurrenceWhereInput { return { status: v.status ?? (v.group === 'open' ? { not: 'RESOLVIDO' } : v.group === 'resolved' ? 'RESOLVIDO' : undefined), categoryId: v.categoryId, secretariatId: v.secretariatId, neighborhood: v.neighborhood ? { equals: v.neighborhood, mode: 'insensitive' } : undefined, createdAt: { gte: v.from, lte: v.to }, ...(v.q ? { OR: [{ address: { contains: v.q, mode: 'insensitive' } }, { neighborhood: { contains: v.q, mode: 'insensitive' } }, { protocol: { contains: v.q, mode: 'insensitive' } }] } : {}) }; }
const include = { category: true, secretariat: true, photos: { orderBy: { sortOrder: 'asc' as const } } } satisfies Prisma.OccurrenceInclude;
async function present<T extends {
    photos: {
        storageKey: string;
        id: string;
        sortOrder: number;
    }[];
}>(o: T) { return { ...o, photos: await Promise.all(o.photos.map(async (p) => ({ id: p.id, sortOrder: p.sortOrder, url: await photoUrl(p.storageKey) }))) }; }
function visible(p: ReturnType<typeof principal>): Prisma.OccurrenceWhereInput { return p.role === 'ADMIN' ? {} : { OR: [{ userId: p.id }, { validationStatus: { not: 'REJEITADA' } }] }; }
occurrences.get('/', async (req, res) => { const v = filters.parse(req.query), p = principal(req); const where: Prisma.OccurrenceWhereInput = { AND: [whereOf(v), visible(p), ...(v.mine === 'true' ? [{ userId: p.id }] : [])] }; const [total, items] = await db.$transaction([db.occurrence.count({ where }), db.occurrence.findMany({ where, include, orderBy: { createdAt: 'desc' }, skip: (v.page - 1) * v.limit, take: v.limit })]); ok(res, { items: await Promise.all(items.map(present)), total, page: v.page, limit: v.limit }); });
occurrences.get('/map', async (req, res) => { const v = filters.parse(req.query); const items = await db.occurrence.findMany({ where: { AND: [whereOf(v), visible(principal(req))] }, select: { id: true, protocol: true, latitude: true, longitude: true, status: true, category: { select: { code: true, color: true, name: true } } }, take: 5000 }); ok(res, { items, heatmap: items.map(o => ({ latitude: o.latitude, longitude: o.longitude, weight: 1 })), limit: 5000 }); });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 3, fields: 12, fieldSize: 4096 } });
function imageType(b: Buffer) {
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
        return 'image/jpeg';
    if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
        return 'image/png';
    if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP')
        return 'image/webp';
    return null;
}
const create = z.object({ categoryId: id, description: text(500), latitude: z.coerce.number().min(-90).max(90), longitude: z.coerce.number().min(-180).max(180), address: text(250), neighborhood: text(100), city: text(100) }).strict();
occurrences.post('/', citizenWrite, upload.array('photos', 3), async (req, res) => {
    const v = create.parse(req.body);
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length)
        fail(400, 'PHOTO_REQUIRED', 'Envie ao menos uma foto.');
    const prepared = files.map(f => {
        const type = imageType(f.buffer);
        if (!type || type !== f.mimetype)
            fail(400, 'INVALID_PHOTO', 'Envie JPEG, PNG ou WebP.');
        return { f, type, key: `occurrences/${randomUUID()}` };
    });
    const userId = principal(req).id;
    const keys: string[] = [];
    let result: Awaited<ReturnType<typeof db.occurrence.create>>;
    try {
        for (const p of prepared) {
            await putPhoto(p.key, p.f.buffer, p.type);
            keys.push(p.key);
        }
        result = await db.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT pg_advisory_xact_lock(621781)::text`;
            const c = await tx.category.findFirst({ where: { id: v.categoryId, active: true }, include: { secretariats: { where: { secretariat: { active: true } }, orderBy: { secretariatId: 'asc' } } } });
            if (!c)
                fail(400, 'CATEGORY_INVALID', 'Categoria indisponível.');
            const cfg = await settings(tx);
            const nearby = await tx.occurrence.findMany({ where: { categoryId: v.categoryId, createdAt: { gte: new Date(Date.now() - cfg.hours * 3600000) }, validationStatus: { not: 'REJEITADA' }, duplicateOfId: null }, orderBy: { createdAt: 'asc' }, select: { id: true, latitude: true, longitude: true } });
            const duplicate = nearby.find(o => distance(v, o) <= cfg.radius);
            const row = await tx.occurrence.create({ data: { ...v, userId, protocol: `pending-${randomUUID()}`, secretariatId: c.secretariats[0]?.secretariatId, duplicateOfId: duplicate?.id, photos: { create: keys.map((storageKey, sortOrder) => ({ storageKey, sortOrder })) }, history: { create: { authorId: userId, newStatus: 'ABERTO' } } } });
            const protocol = `#OG${row.createdAt.getUTCFullYear()}-${String(row.sequence).padStart(6, '0')}`;
            const saved = await tx.occurrence.update({ where: { id: row.id }, data: { protocol } });
            const recipients = await tx.notificationRecipient.findMany({ where: { active: true, confirmedAt: { not: null }, AND: [{ OR: [{ categories: { none: {} } }, { categories: { some: { categoryId: v.categoryId } } }] }, { OR: [{ secretariatId: null }, { secretariatId: saved.secretariatId }] }] }, select: { email: true } });
            const body = `${protocol}\n${c.name}\n${v.description}\n${v.address} — ${v.neighborhood}, ${v.city}\nhttps://www.google.com/maps/search/?api=1&query=${v.latitude},${v.longitude}`;
            if (recipients.length)
                await tx.emailOutbox.createMany({ data: recipients.map(r => ({ recipient: r.email, subject: `Nova ocorrência ${protocol}`, body, occurrenceId: row.id })) });
            const admins = await tx.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
            if (admins.length)
                await tx.notification.createMany({ data: admins.map(a => ({ userId: a.id, type: 'NEW_OCCURRENCE', title: 'Nova ocorrência', message: protocol, occurrenceId: row.id })) });
            return saved;
        });
    }
    catch (e) {
        await Promise.allSettled(keys.map(deletePhoto));
        throw e;
    }
    ok(res, result, 201);
});
occurrences.get('/:id', async (req, res) => {
    const p = principal(req);
    const row = await db.occurrence.findFirst({ where: { id: id.parse(req.params.id), AND: [visible(p)] }, include: { ...include, history: { orderBy: { createdAt: 'asc' } }, rating: true, ...(p.role === 'ADMIN' ? { comments: true } : {}) } });
    if (!row)
        fail(404, 'NOT_FOUND', 'Ocorrência não encontrada.');
    ok(res, await present(row));
});
occurrences.patch('/:id/status', admin, async (req, res) => {
    const occurrenceId = id.parse(req.params.id), v = z.object({ status, observation: text(500).optional() }).parse(req.body);
    const authorId = principal(req).id;
    const result = await db.$transaction(async (tx) => {
        await tx.$queryRaw `SELECT pg_advisory_xact_lock(621781)::text`;
        const o = await tx.occurrence.findUnique({ where: { id: occurrenceId } });
        if (!o)
            fail(404, 'NOT_FOUND', 'Ocorrência não encontrada.');
        if (o.validationStatus === 'REJEITADA')
            fail(409, 'REJECTED', 'Ocorrência rejeitada.');
        const order = ['ABERTO', 'EM_ANALISE', 'EM_ATENDIMENTO', 'RESOLVIDO'];
        if (o.status === v.status)
            return o;
        if (order.indexOf(v.status) <= order.indexOf(o.status))
            fail(409, 'INVALID_TRANSITION', 'Não é permitido retroceder o status.');
        const first = o.validationStatus === 'PENDENTE';
        const updated = await tx.occurrence.update({ where: { id: o.id }, data: { status: v.status, validationStatus: 'VALIDADA', validatedAt: o.validatedAt ?? new Date(), resolvedAt: v.status === 'RESOLVIDO' ? new Date() : undefined, history: { create: { authorId, previousStatus: o.status, newStatus: v.status, observation: v.observation } } } });
        if (!o.duplicateOfId) {
            if (first)
                await recordPoints(tx, o.userId, `validated:${o.id}`, 'VALIDATED', 10, 'Registro validado', o.id);
            if (v.status === 'RESOLVIDO')
                await recordPoints(tx, o.userId, `resolved:${o.id}`, 'RESOLVED', 20, 'Ocorrência resolvida', o.id);
            await updateMedals(tx, o.userId);
        }
        await notify(tx, o.userId, 'STATUS', 'Ocorrência atualizada', `${o.protocol}: ${v.status.replaceAll('_', ' ')}`, o.id);
        return updated;
    });
    ok(res, result);
});
occurrences.patch('/:id/assignment', admin, async (req, res) => {
    const v = z.object({ priority: priority.optional(), secretariatId: id.nullable().optional() }).refine(x => Object.keys(x).length > 0).parse(req.body);
    if (v.secretariatId && !await db.secretariat.findFirst({ where: { id: v.secretariatId, active: true } }))
        fail(400, 'INVALID_SECRETARIAT', 'Secretaria indisponível.');
    const o = await db.occurrence.update({ where: { id: id.parse(req.params.id) }, data: v });
    if (v.priority === 'URGENTE') {
        const rows = await db.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
        await db.notification.createMany({ data: rows.map(a => ({ userId: a.id, type: 'URGENT', title: 'Ocorrência urgente', message: o.protocol, occurrenceId: o.id })) });
    }
    ok(res, o);
});
occurrences.post('/:id/comments', admin, async (req, res) => { const v = z.object({ body: text(2000) }).parse(req.body); ok(res, await db.occurrenceComment.create({ data: { occurrenceId: id.parse(req.params.id), authorId: principal(req).id, body: v.body } }), 201); });
occurrences.post('/:id/rating', citizenWrite, async (req, res) => {
    const v = z.object({ score: z.number().int().min(1).max(5), comment: z.string().trim().max(500).optional() }).parse(req.body);
    const o = await db.occurrence.findFirst({ where: { id: id.parse(req.params.id), userId: principal(req).id, status: 'RESOLVIDO', validationStatus: 'VALIDADA' } });
    if (!o)
        fail(404, 'NOT_FOUND', 'Ocorrência resolvida não encontrada.');
    ok(res, await db.occurrenceRating.create({ data: { ...v, occurrenceId: o.id, userId: o.userId } }), 201);
});

