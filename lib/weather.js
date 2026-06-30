// Race-weekend weather via Open-Meteo (key-less, CORS:*). Forecast horizon is
// ~16 days, so callers should only request rounds within that window.
const BASE = 'https://api.open-meteo.com/v1/forecast';
const CACHE_PREFIX = 'wif:wx:';
export const FORECAST_HORIZON_DAYS = 16;

// WMO weather codes -> { emoji, key }. key feeds a localized label if wanted.
const WMO = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  56: '🌧️', 57: '🌧️',
  61: '🌦️', 63: '🌧️', 65: '🌧️',
  66: '🌧️', 67: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '❄️', 77: '🌨️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  85: '🌨️', 86: '❄️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

export function weatherEmoji(code) {
  return WMO[code] || '🌡️';
}

function utcHourString(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${p(date.getUTCMonth() + 1)}-${p(date.getUTCDate())}T${p(date.getUTCHours())}:00`;
}
function utcDateString(date) {
  return utcHourString(date).slice(0, 10);
}

export function withinForecastHorizon(date, now = new Date()) {
  const days = (date - now) / 86400000;
  return days >= -1 && days <= FORECAST_HORIZON_DAYS;
}

/**
 * Forecast at a circuit for a target instant.
 * @returns {Promise<{tempC:number, precip:number, code:number, emoji:string}|null>}
 */
export async function fetchWeather(lat, lon, targetDate) {
  if (lat == null || lon == null) return null;
  const cacheKey = `${CACHE_PREFIX}${lat.toFixed(2)},${lon.toFixed(2)},${utcHourString(targetDate)}`;
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (raw) return JSON.parse(raw);
  } catch {}

  const day = utcDateString(targetDate);
  const url = `${BASE}?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,precipitation_probability,weather_code` +
    `&start_date=${day}&end_date=${day}&timezone=GMT`;

  let json;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    json = await res.json();
  } catch { return null; }

  const times = json?.hourly?.time;
  if (!Array.isArray(times)) return null;
  const target = utcHourString(targetDate);
  let i = times.indexOf(target);
  if (i < 0) i = Math.min(12, times.length - 1); // fall back to midday-ish
  const temp = json.hourly.temperature_2m?.[i];
  const precip = json.hourly.precipitation_probability?.[i];
  const code = json.hourly.weather_code?.[i];
  if (temp == null) return null;

  const out = {
    tempC: Math.round(temp),
    precip: precip != null ? Math.round(precip) : null,
    code: code != null ? code : 0,
    emoji: weatherEmoji(code),
  };
  try { sessionStorage.setItem(cacheKey, JSON.stringify(out)); } catch {}
  return out;
}
