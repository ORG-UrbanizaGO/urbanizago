import { S3Client, HeadBucketCommand, CreateBucketCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';
const options = { region: env.S3_REGION, forcePathStyle: true, credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY } };
const s3 = new S3Client({ ...options, endpoint: env.S3_ENDPOINT });
export async function ensureBucket() {
    try {
        await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    }
    catch {
        await s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
    }
}
export async function putPhoto(key: string, body: Buffer, type: string) { await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: type })); }
export async function deletePhoto(key: string) { await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key })); }
/** URL temporária assinada pela API; evita expor MinIO e funciona na LAN. */
const signature = (value: string) => createHmac('sha256', env.JWT_ACCESS_SECRET).update('media:' + value).digest('hex');
export async function photoUrl(key: string) { const value = Buffer.from(JSON.stringify({ key, exp: Date.now() + 900000 })).toString('base64url'); return `/api/v1/media/${value}.${signature(value)}`; }
export function verifiedPhotoKey(token: string): string | null { try {
    const [value, sig, ...rest] = token.split('.');
    if (!value || !sig || rest.length || !/^([a-f0-9]{64})$/.test(sig))
        return null;
    const expected = signature(value);
    if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex')))
        return null;
    const payload = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
        key?: unknown;
        exp?: unknown;
    };
    if (typeof payload.key !== 'string' || !/^(occurrences|appeals)\/[a-f0-9-]{36}$/.test(payload.key) || typeof payload.exp !== 'number' || payload.exp < Date.now())
        return null;
    return payload.key;
}
catch {
    return null;
} }
export async function readPhoto(key: string) { const r = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key })); if (!r.Body)
    throw Error('Objeto vazio'); return { body: Buffer.from(await r.Body.transformToByteArray()), type: r.ContentType ?? 'application/octet-stream' }; }
export async function photoBytes(key: string) {
    const r = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    if (!r.Body)
        throw new Error('Objeto vazio');
    return Buffer.from(await r.Body.transformToByteArray());
}
export function imageMime(b: Buffer) { if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return 'image/jpeg'; if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'image/png'; if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP')
    return 'image/webp'; return null; }

