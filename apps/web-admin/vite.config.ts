import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, resolve(process.cwd(), '../..'), '');
    const target = process.env.API_PROXY_TARGET || env.API_PROXY_TARGET || `http://localhost:${env.API_PORT || 3000}`;
    return {
        plugins: [react()], resolve: { alias: { 'react-native': 'react-native-web' } }, envDir: resolve(process.cwd(), '../..'),
        server: { port: Number(process.env.WEB_PORT || env.WEB_PORT || 5173), strictPort: true, proxy: { '/health': target, '/api': target, '/docs': target, '/openapi.json': target } },
    };
});

