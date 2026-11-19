import nodemailer from 'nodemailer';
import cron from 'node-cron';
import { db } from '../lib/db';
import { env } from '../config/env';
import { openMail } from '../lib/crypto';
import { photoBytes } from '../lib/storage';
import { monthStart, recordPoints, settings } from '../lib/gamification';
const smtp = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined, connectionTimeout: 15000, socketTimeout: 30000 });
let busy = false;
async function emailBatch() {
    const rows = await db.emailOutbox.findMany({ where: { status: { in: ['PENDING', 'PROCESSING'] }, nextAttemptAt: { lte: new Date() } }, take: 10, orderBy: { createdAt: 'asc' }, include: { occurrence: { include: { photos: true } } } });
    for (const r of rows) {
        const lease = new Date(Date.now() + 300000);
        const claim = await db.emailOutbox.updateMany({ where: { id: r.id, nextAttemptAt: { lte: new Date() }, status: { in: ['PENDING', 'PROCESSING'] } }, data: { status: 'PROCESSING', nextAttemptAt: lease, attempts: { increment: 1 } } });
        if (!claim.count)
            continue;
        try {
            const attachments = await Promise.all((r.occurrence?.photos ?? []).map(async (p, i) => ({ filename: `foto-${i + 1}`, content: await photoBytes(p.storageKey) })));
            await smtp.sendMail({ from: env.SMTP_FROM, to: r.recipient, subject: r.subject, text: openMail(r.body), attachments });
            await db.emailOutbox.update({ where: { id: r.id }, data: { status: 'SENT', sentAt: new Date(), error: null, body: r.body.startsWith('sealed:') ? '' : r.subject.startsWith('Conta excluída') ? '' : r.body, ...(r.subject.startsWith('Conta excluída') ? { recipient: 'removed@invalid.local' } : {}) } });
        }
        catch {
            const attempts = r.attempts + 1;
            await db.emailOutbox.update({ where: { id: r.id }, data: { status: attempts >= 5 ? 'FAILED' : 'PENDING', error: 'Falha de entrega SMTP ou armazenamento', nextAttemptAt: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** attempts)) } });
        }
    }
}
async function pushBatch() {
    const rows = await db.notification.findMany({ where: { pushStatus: { in: ['PENDING', 'PROCESSING'] }, pushNextAttemptAt: { lte: new Date() } }, take: 20, include: { user: { include: { deviceTokens: true } } } });
    for (const n of rows) {
        const claim = await db.notification.updateMany({ where: { id: n.id, pushNextAttemptAt: { lte: new Date() }, pushStatus: { in: ['PENDING', 'PROCESSING'] } }, data: { pushStatus: 'PROCESSING', pushAttempts: { increment: 1 }, pushNextAttemptAt: new Date(Date.now() + 300000) } });
        if (!claim.count)
            continue;
        try {
            if (n.user.pushEnabled && n.user.deviceTokens.length) {
                const response = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}) }, body: JSON.stringify(n.user.deviceTokens.slice(0, 100).map(d => ({ to: d.token, title: n.title, body: n.message, data: { occurrenceId: n.occurrenceId } }))), signal: AbortSignal.timeout(15000) });
                if (!response.ok)
                    throw new Error('push');
                const payload = await response.json() as {
                    data?: {
                        status: string;
                    }[];
                };
                if (!Array.isArray(payload.data) || payload.data.some(x => x.status !== 'ok'))
                    throw new Error('push');
            }
            await db.notification.update({ where: { id: n.id }, data: { pushStatus: 'SENT' } });
        }
        catch {
            await db.notification.update({ where: { id: n.id }, data: { pushStatus: n.pushAttempts >= 4 ? 'FAILED' : 'PENDING', pushNextAttemptAt: new Date(Date.now() + 120000) } });
        }
    }
}
async function maintenance() {
    const now = new Date();
    await db.sanction.updateMany({ where: { status: 'ATIVA', endsAt: { lte: now } }, data: { status: 'EXPIRADA' } });
    await db.refreshToken.deleteMany({ where: { expiresAt: { lte: now } } });
    await db.passwordResetToken.deleteMany({ where: { expiresAt: { lte: now } } });
    await db.accountDeletionToken.deleteMany({ where: { expiresAt: { lte: now } } });
    const month = monthStart(now);
    await db.$transaction(async (tx) => {
        await tx.$queryRaw `SELECT pg_advisory_xact_lock(621781)::text`;
        const cfg = await settings(tx);
        const users = await tx.occurrence.findMany({ where: { validationStatus: 'VALIDADA', duplicateOfId: null, validatedAt: { gte: month }, user: { status: 'ACTIVE' } }, distinct: ['userId'], select: { userId: true } });
        for (const u of users)
            await recordPoints(tx, u.userId, `monthly:${month.toISOString().slice(0, 7)}:${u.userId}`, 'MONTHLY', cfg.bonus, 'Bônus mensal');
    });
}
export function startJobs() {
    const delivery = cron.schedule('*/15 * * * * *', async () => {
        if (busy)
            return;
        busy = true;
        try {
            await emailBatch();
            await pushBatch();
        }
        catch {
            console.error('Falha no worker de notificações.');
        }
        finally {
            busy = false;
        }
    });
    const housekeeping = cron.schedule('*/5 * * * *', async () => {
        try {
            await maintenance();
        }
        catch {
            console.error('Falha na manutenção.');
        }
    });
    return () => { delivery.stop(); housekeeping.stop(); };
}

