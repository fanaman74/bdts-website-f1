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

## Revision 2026-07-05 — Steamhaus reskin

User requested the UI replicate https://www.steamhaus.co.uk/. Tokens extracted from their live Webflow CSS:
deep green-black `#001b12`/`#00160e`, nightly-woods `#002f1e`, peach accent `#e7a38b`, yellow `#f8d47a`,
blue `#0073e6`, neutrals white/`#f7f7f7`/`#dfddd6`; Manrope (700 headings, -0.03em, lh 1–1.1) +
Space Mono for eyebrows (tracking .1em) and pill buttons (radius 5rem, mono 0.875rem); card radius 0.75rem;
dot-grid `#334941` section decor; logo marquee. Applied by remapping the existing `ink/pulse/coral` Tailwind
scales (ink→green-black neutrals, pulse→forest interactive, coral→peach) so all components restyled without
markup churn; hero rewritten text-focused with animated green aurora + dot grid; PartnerMarquee added.
