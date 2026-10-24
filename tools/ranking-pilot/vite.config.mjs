import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { rankingPilotApi, PUBLIC, ROOT } from './server.mjs';

export default defineConfig({
  root: fileURLToPath(new URL('../../', import.meta.url)),
  publicDir: PUBLIC,
  plugins: [react(), rankingPilotApi()],
  server: { host: '127.0.0.1', port: 4182, strictPort: true,
    watch: { ignored: ['**/public/media/**', '**/public/fonts/**'] } },
  build: { outDir: `${ROOT}/dist`, emptyOutDir: false,
    rollupOptions: { input: fileURLToPath(new URL('./index.html', import.meta.url)) } },
});
