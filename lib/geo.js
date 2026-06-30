// Best-effort country detection by IP (key-less, CORS). Used only to refine
// the initial country pick when nothing is stored; the timezone-based guess
// stays the instant default and the fallback if this fails.
let cached;

export async function detectCountryByIp() {
  if (cached !== undefined) return cached;
  try {
    const res = await fetch('https://ipwho.is/?fields=country_code,success', { mode: 'cors' });
    if (!res.ok) { cached = null; return null; }
    const json = await res.json();
    cached = (json && json.success !== false && json.country_code) ? json.country_code : null;
  } catch { cached = null; }
  return cached;
}
