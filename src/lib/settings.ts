import { getDbClient } from './db';

/**
 * Runtime settings, editable from the admin area.
 *
 * Only non-secret values live here. Provider API keys stay in environment
 * variables so that a database leak can never yield provider credentials.
 */
export const SETTING_KEYS = {
  provider: 'assistant_provider',
  model: 'assistant_model'
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export const SETTING_DEFAULTS: Record<SettingKey, string> = {
  [SETTING_KEYS.provider]: 'deepseek',
  [SETTING_KEYS.model]: 'deepseek-flash'
};

/** Reads every setting, falling back to defaults when the database is absent. */
export async function getSettings(): Promise<Record<SettingKey, string>> {
  const settings = { ...SETTING_DEFAULTS };
  const db = getDbClient();
  if (!db) return settings;

  try {
    const rows = await db.query('select key, value from public.settings');
    for (const row of rows) {
      const key = String(row.key) as SettingKey;
      const value = String(row.value ?? '').trim();
      if (value && key in settings) settings[key] = value;
    }
  } catch (error) {
    // A settings read failure must not take the site down: keep the defaults.
    console.error('[settings] Read failed:', error instanceof Error ? error.message : error);
  }

  return settings;
}

/** Writes one setting. Returns false when the database is unavailable. */
export async function setSetting(key: SettingKey, value: string): Promise<boolean> {
  const db = getDbClient();
  if (!db) return false;

  await db.query(
    `insert into public.settings (key, value, updated_at) values ($1, $2, now())
     on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`,
    [key, value]
  );
  return true;
}
