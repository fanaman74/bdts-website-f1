# Meridian Courtage — Design Decisions

Date: 2026-07-04. Source spec: `instruct(1).md` (BDTS-inspired Astro insurance broker site).
User pre-authorized autonomous execution; decisions below were made without further consultation.

## Decisions

- **Brand**: "Meridian Courtage" — original Brussels insurance broker brand. No BDTS assets, logo, or copy reused; structure and content model only.
- **Stack**: Astro 7 (static-first, Node adapter for form/API routes), TypeScript strict, Tailwind CSS v4, Preact island for the documents filter, Fuse.js search, Zod via content collections.
- **Visual direction**: user's explicit request ("modern but vibrant, animated hero, not AI slop") overrides the spec's "restrained accent colour". Palette: deep ink-navy base, vivid gradient accents (electric indigo → violet → coral), warm off-white surfaces. Typography: Space Grotesk (display) + Inter (body), self-hosted via Fontsource. Hero: animated CSS mesh-gradient blobs + subtle grid, `prefers-reduced-motion` respected.
- **Documents data**: single JSON catalogue at `src/content/documents/documents.json` loaded via the `file()` loader — one admin-friendly file, easy CSV import target. Portal-only entries use `source: "portal"`.
- **Forms**: contact `/contact`, quote `/devis`, claim `/declaration` — one on-demand API endpoint `/api/contact` with server-side validation + honeypot. Email dispatch is a stub logging point (no provider credentials available); clearly marked for wiring later.
- **i18n**: French only, all UI strings in `src/i18n/fr.ts` dictionary, routes ready for future `/fr-be` style prefixing.
- **Tests**: `astro check` (types) + build + `scripts/validate-content.ts` (schema/link sanity) per spec's "tests or at least validation scripts".
- **Discovery script**: `scripts/discover-bdts-documents.ts` — fetches public BDTS pages, respects robots.txt, extracts file/partner links to `data/discovered-documents.json`. Never touches authenticated portals.
