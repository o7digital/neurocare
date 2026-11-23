// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://neurodiversa.mx',
  integrations: [react()],
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
    server: process.env.NEURODIVERSA_DEV_BACKEND_URL ? {
      proxy: { '/api': { target: process.env.NEURODIVERSA_DEV_BACKEND_URL, headers: { 'x-neurodiversa-key': process.env.NEURODIVERSA_DEV_GATEWAY_KEY || '' } } }
    } : undefined
  }
});
