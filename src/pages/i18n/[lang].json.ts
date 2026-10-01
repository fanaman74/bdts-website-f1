import type { APIRoute, GetStaticPaths } from 'astro';
import { LOCALIZED_LANGUAGES, dictionaries, type LocalizedLanguage } from '../../i18n/dictionaries';

// Loaded by LanguageRuntime on /en and /nl pages to translate text that islands render in the browser.
export const getStaticPaths = (() => LOCALIZED_LANGUAGES.map((lang) => ({ params: { lang } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) => Response.json(dictionaries[params.lang as LocalizedLanguage]);
