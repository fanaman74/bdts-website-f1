// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import preact from '@astrojs/preact';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // The production domain this site is built for. Overridable so that a preview
  // or testing deployment does not advertise bdts.be as its canonical home:
  // while bdts.be still points elsewhere, hardcoding it makes every page served
  // from Railway claim the real version lives on another host.
  site: process.env.SITE_URL?.trim() || 'https://www.bdts.be',
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