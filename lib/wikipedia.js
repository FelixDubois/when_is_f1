// Wikipedia REST summary (key-less, CORS:*). Used to enrich circuit cards
// with a short description + thumbnail. Falls back silently on any error.
const CACHE_PREFIX = 'wif:wiki:';

// Pull the article title out of a Wikipedia URL like
// "http://en.wikipedia.org/wiki/Silverstone_Circuit".
function titleFromUrl(url) {
  const m = /\/wiki\/([^?#]+)/.exec(url || '');
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * @param {string} wikiUrl  a *.wikipedia.org/wiki/<Title> URL
 * @returns {Promise<{title, extract, thumb, url}|null>}
 */
export async function fetchWikiSummary(wikiUrl) {
  const title = titleFromUrl(wikiUrl);
  if (!title) return null;
  const cacheKey = `${CACHE_PREFIX}${title}`;
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (raw) return JSON.parse(raw);
  } catch {}

  // Use the same Wikipedia host as the source URL (en for Jolpica circuit URLs).
  let host = 'en.wikipedia.org';
  try { host = new URL(wikiUrl).host; } catch {}
  const api = `https://${host}/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

  let json;
  try {
    const res = await fetch(api, { mode: 'cors' });
    if (!res.ok) return null;
    json = await res.json();
  } catch { return null; }
  if (!json || !json.extract) return null;

  const out = {
    title: json.title || title.replace(/_/g, ' '),
    extract: json.extract,
    thumb: json.thumbnail?.source || null,
    url: json.content_urls?.desktop?.page || wikiUrl,
  };
  try { sessionStorage.setItem(cacheKey, JSON.stringify(out)); } catch {}
  return out;
}
