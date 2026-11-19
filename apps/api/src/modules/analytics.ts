import { Router } from 'express';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import type { Prisma } from '@prisma/client';
import { db } from '../lib/db';
import { currentSanctions, id, ok, paging, text } from '../lib/http';
import { admin, authenticate, normal, principal } from '../middlewares/auth';
import { medalProgress, monthStart, settings } from '../lib/gamification';
export const analytics = Router();
analytics.use(authenticate, normal);
const reportFilters = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional(), categoryId: id.optional(), secretariatId: id.optional(), neighborhood: text(100).optional(), status: z.enum(['ABERTO', 'EM_ANALISE', 'EM_ATENDIMENTO', 'RESOLVIDO']).optional() });
async function report(v: z.infer<typeof reportFilters>) {
    const where: Prisma.OccurrenceWhereInput = { createdAt: { gte: v.from, lte: v.to }, categoryId: v.categoryId, secretariatId: v.secretariatId, neighborhood: v.neighborhood, status: v.status };
    const rows = await db.occurrence.findMany({ where, select: { id: true, protocol: true, status: true, createdAt: true, resolvedAt: true, latitude: true, longitude: true, neighborhood: true, category: { select: { name: true } }, secretariat: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
    const count = (key: (r: typeof rows[number]) => string) => {
        const m = new Map<string, number>();
        for (const r of rows) {
            const k = key(r);
            m.set(k, (m.get(k) ?? 0) + 1);
        }
        return [...m].map(([name, total]) => ({ name, total }));
    };
    const resolved = rows.filter(r => r.resolvedAt);
    return { rows, total: rows.length, open: rows.filter(r => r.status === 'ABERTO').length, analysis: rows.filter(r => r.status === 'EM_ANALISE').length, inProgress: rows.filter(r => r.status === 'EM_ATENDIMENTO').length, resolved: resolved.length, averageResolutionDays: resolved.length ? resolved.reduce((s, r) => s + (r.resolvedAt!.getTime() - r.createdAt.getTime()) / 86400000, 0) / resolved.length : 0, byCategory: count(r => r.category.name), byNeighborhood: count(r => r.neighborhood), bySecretariat: count(r => r.secretariat?.name ?? 'Não atribuída'), timeline: count(r => r.createdAt.toISOString().slice(0, 10)).sort((a, b) => a.name.localeCompare(b.name)), recent: rows.slice(0, 10), heatmap: rows.map(r => ({ latitude: r.latitude, longitude: r.longitude, weight: 1 })) };
}
analytics.get('/dashboard', admin, async (req, res) => { const { rows, ...data } = await report(reportFilters.parse(req.query)); void rows; ok(res, data); });
analytics.get('/reports', admin, async (req, res) => { const { rows, ...data } = await report(reportFilters.parse(req.query)); void rows; ok(res, data); });
const csvCell = (v: string) => '"' + (/^[=+\-@\t\r]/.test(v) ? "'" + v : v).replaceAll('"', '""') + '"';
analytics.get('/reports/export', admin, async (req, res) => {
    const v = reportFilters.extend({ format: z.enum(['csv', 'pdf']).default('csv') }).parse(req.query);
    const data = await report(v);
    if (v.format === 'csv') {
        const lines = ['protocolo;categoria;bairro;status;data', ...data.rows.map(r => [r.protocol, r.category.name, r.neighborhood, r.status, r.createdAt.toISOString()].map(csvCell).join(';'))];
        res.attachment('ocorrencias.csv').type('text/csv').send('\ufeff' + lines.join('\n'));
        return;
    }
    res.type('application/pdf').attachment('ocorrencias.pdf');
    const pdf = new PDFDocument({ margin: 45 });
    pdf.pipe(res);
    pdf.fontSize(19).text('UrbanizaGO — Relatório de ocorrências');
    pdf.moveDown().fontSize(12).text(`Total: ${data.total} | Resolvidas: ${data.resolved}`);
    for (const r of data.rows)
        pdf.text(`${r.protocol} | ${r.category.name} | ${r.neighborhood} | ${r.status}`);
    pdf.end();
});
analytics.get('/gamification/ranking', async (req, res) => { const v = paging.extend({ period: z.enum(['monthly', 'all']).default('all'), scope: z.enum(['general', 'neighborhood']).default('general'), neighborhood: text(100).optional() }).parse(req.query); const userId = principal(req).id; const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { neighborhood: true } }); const neighborhood = v.scope === 'neighborhood' ? (v.neighborhood ?? u.neighborhood ?? '') : undefined; const users = await db.user.findMany({ where: { role: 'CITIZEN', status: 'ACTIVE', neighborhood, sanctions: { none: { AND: [currentSanctions(), { type: { in: ['SUSPENSAO', 'BANIMENTO'] } }] } } }, select: { id: true, name: true, avatar: true, hideFromRanking: true, medals: { include: { medal: true } } } }); const sums = await db.pointsLedger.groupBy({ by: ['userId'], where: { userId: { in: users.map(u => u.id) }, createdAt: v.period === 'monthly' ? { gte: monthStart() } : undefined }, _sum: { points: true } }); const byId = new Map(sums.map(s => [s.userId, s._sum.points ?? 0])); const sorted = users.map(u => ({ ...u, points: byId.get(u.id) ?? 0 })).sort((a, b) => b.points - a.points || a.id.localeCompare(b.id)); const items = sorted.map((u, i) => { const parts = u.name.split(/\s+/); return { position: i + 1, isMe: u.id === userId, name: u.hideFromRanking ? 'Cidadão anônimo' : parts[0] + (parts.length > 1 ? ' ' + parts.at(-1)![0] + '.' : ''), avatar: u.hideFromRanking ? null : u.avatar, medals: u.medals.map(m => ({ name: m.medal.name, level: m.level })), points: u.points }; }); ok(res, { items: items.slice((v.page - 1) * v.limit, v.page * v.limit), me: items.find(x => x.isMe) ?? null, total: items.length, page: v.page, limit: v.limit }); });
analytics.get('/gamification/medals', async (req, res) => { ok(res, await medalProgress(db, principal(req).id)); });
analytics.get('/gamification/points', async (req, res) => { const v = paging.parse(req.query); const userId = principal(req).id; ok(res, await db.pointsLedger.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip: (v.page - 1) * v.limit, take: v.limit })); });
analytics.get('/gamification/users/:id/points', admin, async (req, res) => { const v = paging.parse(req.query); ok(res, await db.pointsLedger.findMany({ where: { userId: id.parse(req.params.id) }, orderBy: { createdAt: 'desc' }, skip: (v.page - 1) * v.limit, take: v.limit })); });
analytics.get('/gamification/settings', admin, async (_req, res) => { ok(res, { ...(await settings(db)), medals: await db.medalDefinition.findMany() }); });
analytics.patch('/gamification/settings', admin, async (req, res) => {
    const v = z.object({ duplicateRadius: z.number().int().min(1).max(500).optional(), duplicateHours: z.number().int().min(1).max(720).optional(), monthlyBonus: z.number().int().min(0).max(1000).optional() }).strict().parse(req.body);
    for (const [key, value] of Object.entries(v))
        if (value !== undefined)
            await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    ok(res, await settings(db));
});
analytics.patch('/gamification/medals/:id', admin, async (req, res) => { const v = z.object({ bronze: z.number().int().positive(), silver: z.number().int().positive(), gold: z.number().int().positive() }).refine(v => v.bronze < v.silver && v.silver < v.gold).parse(req.body); ok(res, await db.medalDefinition.update({ where: { id: id.parse(req.params.id) }, data: v })); });

