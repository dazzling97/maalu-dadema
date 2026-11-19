import { defineConfig, type Plugin } from 'vite';
import { scanVoices, writeIndex } from './scripts/voices.mjs';

/** Lists the Sinhala voice recordings that exist: live in dev, written into the build. */
function voiceIndex(): Plugin {
  return {
    name: 'voice-index',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.split('?')[0].endsWith('/voice/index.json')) return next();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify(scanVoices()));
      });
    },
    buildStart() { writeIndex(); },
  };
}

export default defineConfig({
  base: './',
  plugins: [voiceIndex()],
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 },
});
