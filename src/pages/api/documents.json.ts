import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const prerender = true;

/**
 * GET /api/documents.json
 * Normalised document metadata from the content collection.
 */
export const GET: APIRoute = async () => {
  const entries = await getCollection('documents');

  const documents = entries.map((e) => ({
    id: e.id,
    title: e.data.title,
    partner: e.data.partner,
    audience: e.data.audience,
    category: e.data.category,
    productType: e.data.productType,
    documentType: e.data.documentType,
    language: e.data.language,
    fileUrl: e.data.fileUrl,
    externalUrl: e.data.externalUrl ?? null,
    source: e.data.source,
    lastUpdated: e.data.lastUpdated?.toISOString().slice(0, 10) ?? null,
    description: e.data.description ?? null,
    tags: e.data.tags
  }));

  return new Response(JSON.stringify({ count: documents.length, documents }, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
};
