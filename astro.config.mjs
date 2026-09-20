// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import preact from '@astrojs/preact';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.bdts.be',
  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [preact(), sitemap()],

  security: {
    // The Node adapter does not read `x-forwarded-proto`, so behind Railway's
    // TLS termination Astro sees the request as http and rejects every
    // form-encoded POST as "cross-site" — including the admin login.
    // Cross-site protection is re-implemented against the forwarded headers in
    // src/middleware.ts, so this is a replacement, not a removal.
    checkOrigin: false
  },

  adapter: node({
    mode: 'standalone'
  })
});