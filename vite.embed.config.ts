import { defineConfig } from 'vite';
// Single-file IIFE build (window.MaluDadayama.mount) for embedding in a host page.
export default defineConfig({
  build: {
    target: 'es2020', outDir: 'dist-embed', emptyOutDir: true,
    lib: { entry: 'src/embed.ts', name: 'MaluDadayama', formats: ['iife'], fileName: () => 'malu-dadayama.js' },
  },
  define: { 'process.env.NODE_ENV': '"production"' },
});
