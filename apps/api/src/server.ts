import { app, logger } from './app';
import { env } from './config/env';
import { db } from './lib/db';
import { startJobs } from './jobs/worker';
const server = app.listen(env.API_PORT, '0.0.0.0', () => logger.info({ port: env.API_PORT }, 'API disponível'));
const stop = startJobs();
for (const signal of ['SIGTERM', 'SIGINT'] as const)
    process.once(signal, () => { stop(); server.close(error => { void db.$disconnect().finally(() => process.exit(error ? 1 : 0)); }); });

