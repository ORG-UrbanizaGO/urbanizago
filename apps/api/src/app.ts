import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pino from 'pino';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { env } from './config/env';
import { db } from './lib/db';
import { HttpError, fail } from './lib/http';
import { verifiedPhotoKey, readPhoto } from './lib/storage';
import { auth } from './modules/auth';
import { occurrences } from './modules/occurrences';
import { management } from './modules/management';
import { analytics } from './modules/analytics';
import { moderation } from './modules/moderation';
export const logger = pino();
export const app = express();
app.disable('x-powered-by');
app.use(helmet());
const origins = env.CORS_ORIGINS.split(',').map(x => x.trim()).filter(Boolean);
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use((req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && !origins.includes(req.headers.origin)) {
        res.status(403).json({ code: 'ORIGIN_DENIED', message: 'Origem não autorizada.' });
        return;
    }
    next();
});
app.get('/health', async (_req, res) => { await db.$queryRaw `SELECT 1`; res.json({ status: 'ok', service: 'urbanizago-api' }); });
const spec = parse(readFileSync(resolve(__dirname, '../../../docs/api/openapi.yaml'), 'utf8'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
app.get('/openapi.json', (_req, res) => res.json(spec));
app.get('/api/v1/media/:token', async (req, res) => { const key = verifiedPhotoKey(req.params.token ?? ''); if (!key)
    fail(403, 'MEDIA_DENIED', 'Link expirado ou inválido.'); try {
    const file = await readPhoto(key);
    res.set('Cache-Control', 'private, no-store');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.type(file.type).send(file.body);
}
catch {
    fail(404, 'MEDIA_NOT_FOUND', 'Imagem indisponível.');
} });
app.use('/api/v1/auth', auth);
app.use('/api/v1/occurrences', occurrences);
// Match route paths before authentication to preserve the restricted appeal flow.
app.use('/api/v1', moderation, management, analytics);
app.use((_req, res) => { res.status(404).json({ code: 'NOT_FOUND', message: 'Rota não encontrada.' }); });
const handleError: ErrorRequestHandler = (e: unknown, _req, res, _next) => {
    if (res.headersSent) {
        _next(e);
        return;
    }
    if (e instanceof HttpError) {
        res.status(e.status).json({ code: e.code, message: e.message });
        return;
    }
    if (e instanceof ZodError) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: e.issues.map(i => ({ path: i.path, message: i.message })) });
        return;
    }
    if (e instanceof multer.MulterError) {
        res.status(400).json({ code: 'UPLOAD_ERROR', message: 'Arquivo ou formulário excede os limites.' });
        return;
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002' || e.code === 'P2003') {
            res.status(409).json({ code: 'CONFLICT', message: 'Registro duplicado ou vínculo inválido.' });
            return;
        }
        if (e.code === 'P2025') {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Registro não encontrado.' });
            return;
        }
    }
    if (e instanceof SyntaxError && 'status' in e && e.status === 400) {
        res.status(400).json({ code: 'INVALID_JSON', message: 'JSON inválido.' });
        return;
    }
    logger.error({ kind: 'unexpected_error' }, 'Erro interno');
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Erro interno.' });
};
app.use(handleError);

