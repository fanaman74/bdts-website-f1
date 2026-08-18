import type { APIRoute } from 'astro';
import { sectorCatalogDocuments } from '../../data/sectorCatalog';

export const prerender = true;

/**
 * GET /api/documents.json
 * Normalised document metadata from the content collection.
 */
export const GET: APIRoute = async () => {
  const documents = sectorCatalogDocuments;

  return new Response(JSON.stringify({ count: documents.length, documents }, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
};
