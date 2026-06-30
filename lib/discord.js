// Optional Discord reminders: the user pastes an incoming-webhook URL in
// Settings and the app POSTs session details to it. Discord webhooks send
// permissive CORS headers, so this works from a static page with no backend.
const STORE = 'wif:discord';

export function getWebhook() {
  try { return localStorage.getItem(STORE) || ''; } catch { return ''; }
}
export function setWebhook(url) {
  try {
    if (url) localStorage.setItem(STORE, url); else localStorage.removeItem(STORE);
  } catch {}
}
export function isValidWebhook(url) {
  return /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(url || '');
}

/**
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function postToDiscord(content) {
  const url = getWebhook();
  if (!isValidWebhook(url)) return { ok: false, reason: 'no-webhook' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
    return res.ok ? { ok: true } : { ok: false, reason: `http-${res.status}` };
  } catch (e) {
    return { ok: false, reason: 'network' };
  }
}
