import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';
dotenv.config({ path: resolve(__dirname, '../../../../.env') });
const bool = z.enum(['true', 'false']).transform(v => v === 'true');
export const env = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3000), CORS_ORIGINS: z.string().default('http://localhost:5173'),
    DATABASE_URL: z.string().min(1), JWT_ACCESS_SECRET: z.string().min(32), JWT_REFRESH_SECRET: z.string().min(32),
    JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30), JWT_ACCESS_TTL: z.string().regex(/^\d+[smhd]$/).default('15m'),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30), COOKIE_SECURE: bool.default('false'),
    ADMIN_EMAIL: z.string().email(), ADMIN_PASSWORD: z.string().min(12), BANNED_EMAIL_PEPPER: z.string().min(32), SEED_DEMO: bool.default('false'),
    S3_ENDPOINT: z.string().url(), S3_PUBLIC_ENDPOINT: z.string().url(), S3_REGION: z.string().default('us-east-1'), S3_BUCKET: z.string(), S3_ACCESS_KEY: z.string(), S3_SECRET_KEY: z.string(),
    SMTP_HOST: z.string(), SMTP_PORT: z.coerce.number().int().positive(), SMTP_SECURE: bool.default('false'), SMTP_USER: z.string().optional(), SMTP_PASSWORD: z.string().optional(), SMTP_FROM: z.string(), EXPO_ACCESS_TOKEN: z.string().optional(),
    DUPLICATE_RADIUS_METERS: z.coerce.number().positive().default(50), DUPLICATE_WINDOW_HOURS: z.coerce.number().positive().default(72), MONTHLY_BONUS_POINTS: z.coerce.number().int().nonnegative().default(15), MAX_UPLOAD_MB: z.coerce.number().positive().max(20).default(10), ACCOUNT_DELETION_GRACE_DAYS: z.coerce.number().int().nonnegative().default(0),
}).parse(process.env);

