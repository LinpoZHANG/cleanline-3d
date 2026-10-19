import { defineConfig } from 'vite';
export default defineConfig({ base:'./', build:{chunkSizeWarningLimit:900}, server:{port:5174,strictPort:false} });
