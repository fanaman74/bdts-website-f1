import { getDbClient } from './db';

/**
 * The insurers BDTS places claims with, and the office's contact address at
 * each one.
 *
 * The ids match the partner logos (src/components/PartnerMarquee.astro). The
 * contact addresses are entered by staff on /admin/insurers and stored in the
 * settings table: nothing here guesses where an insurer wants claims sent.
 */

export interface Insurer {
  id: string;
  name: string;
  /** How a customer might name this insurer in free text. */
  patterns: RegExp[];
}

export const INSURERS: Insurer[] = [
  // "AG" alone is only trusted in capitals, so "ag" inside a sentence never matches.
  { id: 'ag-insurance', name: 'AG Insurance', patterns: [/\bAG\b/, /\bag\s+(insurance|employee\s+benefits)\b/i, /\bfortis\s+ag\b/i] },
  { id: 'axa', name: 'AXA', patterns: [/\baxa\b/i] },
  { id: 'baloise', name: 'Baloise', patterns: [/\bb[aâ]loise\b/i, /\bmercator\b/i] },
  { id: 'allianz', name: 'Allianz', patterns: [/\ballianz\b/i] },
  { id: 'dkv', name: 'DKV', patterns: [/\bdkv\b/i] },
  { id: 'nn', name: 'NN', patterns: [/\bNN\b/, /\bnn\s+insurance\b/i, /\bdelta\s+lloyd\b/i] },
  { id: 'vivium', name: 'Vivium', patterns: [/\bvivium\b/i] },
  { id: 'ethias', name: 'Ethias', patterns: [/\bethias\b/i] },
  { id: 'arag', name: 'ARAG', patterns: [/\barag\b/i] },
  { id: 'europ-assistance', name: 'Europ Assistance', patterns: [/\beurop\s*assistance\b/i] }
];

const BY_ID = new Map(INSURERS.map((insurer) => [insurer.id, insurer]));

export function getInsurer(id: string | null | undefined): Insurer | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}

export function insurerName(id: string | null | undefined): string {
  return getInsurer(id)?.name ?? '';
}

export function isInsurerId(value: string): boolean {
  return BY_ID.has(value);
}

/** The insurers named in a piece of text, in list order, without duplicates. */
export function insurersMentionedIn(text: string): string[] {
  return INSURERS.filter((insurer) => insurer.patterns.some((pattern) => pattern.test(text))).map((insurer) => insurer.id);
}

const CONTACT_PREFIX = 'insurer_contact:';
const FORWARD_CC_KEY = 'claims_forward_cc';
const FORWARD_REPLY_TO_KEY = 'claims_forward_reply_to';

export interface ForwardSettings {
  /** Insurer id → the address(es) claims are sent to, as typed by staff. */
  contacts: Record<string, string>;
  /** Copied on every forward, typically the office's own claims mailbox. */
  cc: string;
  /** Where the insurer's reply goes, since EMAIL_FROM is often a no-reply address. */
  replyTo: string;
}

export async function getForwardSettings(): Promise<ForwardSettings> {
  const settings: ForwardSettings = { contacts: {}, cc: '', replyTo: '' };
  const db = getDbClient();
  if (!db) return settings;

  try {
    const rows = await db.query(
      `select key, value from public.settings
        where key like $1 or key = $2 or key = $3`,
      [`${CONTACT_PREFIX}%`, FORWARD_CC_KEY, FORWARD_REPLY_TO_KEY]
    );
    for (const row of rows) {
      const key = String(row.key);
      const value = String(row.value ?? '').trim();
      if (key === FORWARD_CC_KEY) settings.cc = value;
      else if (key === FORWARD_REPLY_TO_KEY) settings.replyTo = value;
      else if (key.startsWith(CONTACT_PREFIX)) {
        const id = key.slice(CONTACT_PREFIX.length);
        if (isInsurerId(id) && value) settings.contacts[id] = value;
      }
    }
  } catch (error) {
    console.error('[insurers] Settings read failed:', error instanceof Error ? error.message : error);
  }
  return settings;
}

/** Saves every contact at once; a blank address removes that insurer's entry. */
export async function saveForwardSettings(settings: ForwardSettings): Promise<boolean> {
  const db = getDbClient();
  if (!db) return false;

  const entries: Array<[string, string]> = [
    ...INSURERS.map((insurer): [string, string] => [`${CONTACT_PREFIX}${insurer.id}`, settings.contacts[insurer.id] ?? '']),
    [FORWARD_CC_KEY, settings.cc],
    [FORWARD_REPLY_TO_KEY, settings.replyTo]
  ];

  await db.transaction(
    entries.map(([key, value]) =>
      value
        ? db.query(
            `insert into public.settings (key, value, updated_at) values ($1, $2, now())
             on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`,
            [key, value]
          )
        : db.query('delete from public.settings where key = $1', [key])
    )
  );
  return true;
}

const EMAIL_PATTERN = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

/**
 * Splits "a@x.be, b@y.be" into addresses. Returns null when any piece is not an
 * address, so a typo is reported rather than silently dropped.
 */
export function parseEmailList(value: string, max = 5): string[] | null {
  const parts = value
    .split(/[,;\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > max) return null;
  return parts.every((part) => EMAIL_PATTERN.test(part) && part.length <= 200) ? parts : null;
}
