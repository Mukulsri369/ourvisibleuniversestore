import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { nitro } from 'nitro/vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import paths from 'vite-tsconfig-paths';

// Separate from the original provider build until all runtime replacements pass.
// Keep the existing route tree, SSR error wrapper, styling and scene chunks.
export default defineConfig({
  plugins: [
    tanstackStart({ server: { entry: 'server' } }),
    nitro({ preset: 'node-server' }),
    react(), tailwind(), paths(),
  ],
  server: { host: '127.0.0.1', port: 3000 },
  resolve: { dedupe: ['react','react-dom','@tanstack/react-router','@tanstack/react-start'] },
});
