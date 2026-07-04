// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import preact from '@astrojs/preact';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.meridian-courtage.be',
  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [preact(), sitemap()],

  adapter: node({
    mode: 'standalone'
  })
});