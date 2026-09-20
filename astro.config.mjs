// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import preact from '@astrojs/preact';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // The canonical home of this deployment. Now that this app serves the site
  // itself, the Railway URL is authoritative — bdts.be still resolves to the old
  // host, so advertising it here would point search engines and social previews
  // at the wrong place. `SITE_URL` can override it if the domain ever moves.
  site: process.env.SITE_URL?.trim() || 'https://bdts-website-f1-production.up.railway.app',
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