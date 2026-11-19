const { spawnSync } = require('node:child_process');
const { resolve, dirname } = require('node:path');
require('dotenv').config({ path: resolve(__dirname, '../../../.env') });
const cli = resolve(dirname(require.resolve('prisma/package.json')), 'build/index.js');
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
