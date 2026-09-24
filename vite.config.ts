import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Note: dev/probe.html (the responsive overflow probe, AC-77) is served by the
// dev server straight from the project root at /dev/probe.html. It deliberately
// does NOT live in public/ — everything in public/ is copied verbatim into
// dist/, and a dev tool that ships to production is the kind of thing nobody
// notices until it is already public.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
});
