import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

const services = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/services' }),
  schema: z.object({
    title: z.string(),
    audience: z.enum(['particulier', 'professionnel', 'autres']),
    category: z.string(),
    summary: z.string(),
    heroImage: z.string().optional(),
    icon: z.string().optional(),
    featured: z.boolean().optional().default(false),
    order: z.number().optional().default(99)
  })
});

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    image: z.string().optional(),
    tags: z.array(z.string()).default([])
  })
});

const documents = defineCollection({
  loader: file('./src/content/documents/documents.json'),
  schema: z.object({
    title: z.string(),
    partner: z.string(),
    audience: z.enum(['particulier', 'professionnel', 'both']),
    category: z.string(),
    productType: z.string(),
    documentType: z.enum([
      'conditions-generales',
      'fiche-info',
      'commercial',
      'legal',
      'claim-form',
      'other'
    ]),
    language: z.enum(['fr', 'nl', 'en']),
    fileUrl: z.string(),
    externalUrl: z.string().optional(),
    source: z.enum(['local', 'external', 'portal', 'manual']),
    lastUpdated: z.coerce.date().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).default([])
  })
});

export const collections = { services, news, documents };
