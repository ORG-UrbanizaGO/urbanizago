import type { Prisma, MedalLevel } from '@prisma/client';
import { env } from '../config/env';
export const monthStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
export async function settings(tx: Prisma.TransactionClient) { const rows = await tx.setting.findMany(); const values = Object.fromEntries(rows.map(r => [r.key, r.value])); return { radius: values.duplicateRadius ?? env.DUPLICATE_RADIUS_METERS, hours: values.duplicateHours ?? env.DUPLICATE_WINDOW_HOURS, bonus: values.monthlyBonus ?? env.MONTHLY_BONUS_POINTS }; }
export async function recordPoints(tx: Prisma.TransactionClient, userId: string, eventKey: string, event: string, points: number, reason: string, occurrenceId?: string) { await tx.pointsLedger.createMany({ data: [{ userId, eventKey, event, points, reason, occurrenceId }], skipDuplicates: true }); }
export async function notify(tx: Prisma.TransactionClient, userId: string, type: string, title: string, message: string, occurrenceId?: string) { await tx.notification.create({ data: { userId, type, title, message, occurrenceId } }); }
export function distance(a: {
    latitude: number;
    longitude: number;
}, b: {
    latitude: number;
    longitude: number;
}) { const rad = (n: number) => n * Math.PI / 180; const dlat = rad(b.latitude - a.latitude), dlon = rad(b.longitude - a.longitude); const h = Math.sin(dlat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dlon / 2) ** 2; return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h))); }
export async function medalProgress(tx: Prisma.TransactionClient, userId: string) {
    const definitions = await tx.medalDefinition.findMany();
    const items = await tx.occurrence.findMany({ where: { userId, validationStatus: 'VALIDADA', duplicateOfId: null }, select: { neighborhood: true, category: { select: { code: true } } } });
    const counts = new Map<string, number>();
    for (const row of items)
        counts.set(row.neighborhood, (counts.get(row.neighborhood) ?? 0) + 1);
    return definitions.map(d => { const count = d.code === 'NEIGHBORHOOD' ? Math.max(0, ...counts.values()) : d.categoryCodes.length ? items.filter(o => d.categoryCodes.includes(o.category.code)).length : items.length; const level: MedalLevel | null = count >= d.gold ? 'OURO' : count >= d.silver ? 'PRATA' : count >= d.bronze ? 'BRONZE' : null; return { ...d, count, level, nextGoal: count < d.bronze ? d.bronze : count < d.silver ? d.silver : count < d.gold ? d.gold : null }; });
}
export async function updateMedals(tx: Prisma.TransactionClient, userId: string) {
    for (const m of await medalProgress(tx, userId)) {
        const old = await tx.userMedal.findUnique({ where: { userId_medalId: { userId, medalId: m.id } } });
        if (!m.level) {
            if (old)
                await tx.userMedal.delete({ where: { id: old.id } });
            continue;
        }
        if (old?.level === m.level)
            continue;
        await tx.userMedal.upsert({ where: { userId_medalId: { userId, medalId: m.id } }, create: { userId, medalId: m.id, level: m.level }, update: { level: m.level, achievedAt: new Date() } });
        const rank = { BRONZE: 1, PRATA: 2, OURO: 3 };
        if (!old || rank[m.level] > rank[old.level])
            await notify(tx, userId, 'MEDAL', 'Nova conquista!', `${m.name} — ${m.level}.`);
    }
}

