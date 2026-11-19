import { createHash, createHmac, randomBytes } from 'node:crypto';
import { env } from '../config/env';
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const randomToken = () => randomBytes(32).toString('hex');
export const bannedHash = (email: string) => createHmac('sha256', env.BANNED_EMAIL_PEPPER).update(email.toLowerCase()).digest('hex');
import { createCipheriv, createDecipheriv } from 'node:crypto';
const mailKey = () => createHash('sha256').update('outbox:' + env.JWT_REFRESH_SECRET).digest();
export function sealMail(body: string) { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', mailKey(), iv); const data = Buffer.concat([cipher.update(body, 'utf8'), cipher.final()]); return 'sealed:' + Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64'); }
export function openMail(body: string) {
    if (!body.startsWith('sealed:'))
        return body;
    const raw = Buffer.from(body.slice(7), 'base64');
    const cipher = createDecipheriv('aes-256-gcm', mailKey(), raw.subarray(0, 12));
    cipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([cipher.update(raw.subarray(28)), cipher.final()]).toString('utf8');
}

