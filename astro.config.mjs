// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import preact from '@astrojs/preact';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import localizedPages from './src/integrations/localizedPages.ts';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.bdts.be',
  vite: {
    plugins: [tailwindcss()]
  },

  // localizedPages must follow sitemap so it can add the /en and /nl URLs.
  integrations: [preact(), sitemap(), localizedPages()],

  adapter: node({
    mode: 'standalone'
  })
});