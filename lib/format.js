import { t, getLocale } from './i18n.js';

const dateFmtCache = new Map();
const timeFmtCache = new Map();

function dateFmt(tz, locale) {
  const key = `${locale}|${tz}|d`;
  let f = dateFmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, {
      weekday: 'short', day: 'numeric', month: 'short', timeZone: tz,
    });
    dateFmtCache.set(key, f);
  }
  return f;
}

function timeFmt(tz, locale, hour12) {
  const key = `${locale}|${tz}|${hour12 ? '12' : '24'}`;
  let f = timeFmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, {
      hour: '2-digit', minute: '2-digit', hour12,
      timeZoneName: 'short', timeZone: tz,
    });
    timeFmtCache.set(key, f);
  }
  return f;
}

export function formatInZone(date, tz, { locale = getLocale(), hour12 = false } = {}) {
  const dateStr = dateFmt(tz, locale).format(date);
  const parts = timeFmt(tz, locale, hour12).formatToParts(date);
  let zone = '';
  let time = '';
  for (const p of parts) {
    if (p.type === 'timeZoneName') zone = p.value;
    else if (
      p.type === 'hour' || p.type === 'minute' ||
      p.type === 'dayPeriod' ||
      (p.type === 'literal' && (p.value === ':' || p.value === ' '))
    ) {
      time += p.value;
    }
  }
  return { date: dateStr, time: time.trim(), zone };
}

const RTF_CACHE = new Map();
export function relativeDays(date, now = new Date()) {
  const days = Math.round((date - now) / (1000 * 60 * 60 * 24));
  const locale = getLocale();
  let rtf = RTF_CACHE.get(locale);
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    RTF_CACHE.set(locale, rtf);
  }
  if (Math.abs(days) >= 14) return rtf.format(Math.round(days / 7), 'week');
  return rtf.format(days, 'day');
}

// Granular relative time (seconds → days) for "updated 2 h ago"-style labels.
export function relativeTime(date, now = new Date()) {
  const sec = Math.round((date - now) / 1000);
  const abs = Math.abs(sec);
  const locale = getLocale();
  let rtf = RTF_CACHE.get(locale);
  if (!rtf) { rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }); RTF_CACHE.set(locale, rtf); }
  if (abs < 60) return rtf.format(Math.round(sec), 'second');
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour');
  return rtf.format(Math.round(sec / 86400), 'day');
}

export function sessionLabel(kind) {
  return t(`session.${kind}`);
}

// Compact live countdown: "2d 14:32:07", "14:32:07", or "12:07".
export function formatCountdown(ms) {
  if (ms <= 0) return '00:00';
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n) => String(n).padStart(2, '0');
  if (d > 0) return `${d}d ${p(h)}:${p(m)}:${p(s)}`;
  if (h > 0) return `${p(h)}:${p(m)}:${p(s)}`;
  return `${p(m)}:${p(s)}`;
}

export function detectIOS() {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
}
