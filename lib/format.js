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

function timeFmt(tz, locale) {
  const key = `${locale}|${tz}|t`;
  let f = timeFmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, {
      hour: '2-digit', minute: '2-digit', hour12: false,
      timeZoneName: 'short', timeZone: tz,
    });
    timeFmtCache.set(key, f);
  }
  return f;
}

export function formatInZone(date, tz, locale = navigator.language || 'en-GB') {
  const dateStr = dateFmt(tz, locale).format(date);
  const parts = timeFmt(tz, locale).formatToParts(date);
  let zone = '';
  let time = '';
  for (const p of parts) {
    if (p.type === 'timeZoneName') zone = p.value;
    else if (p.type === 'hour' || p.type === 'minute' || (p.type === 'literal' && p.value === ':')) {
      time += p.value;
    }
  }
  return { date: dateStr, time, zone };
}

const RTF_CACHE = new Map();
export function relativeDays(date, now = new Date()) {
  const days = Math.round((date - now) / (1000 * 60 * 60 * 24));
  const locale = navigator.language || 'en-GB';
  let rtf = RTF_CACHE.get(locale);
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    RTF_CACHE.set(locale, rtf);
  }
  if (Math.abs(days) >= 14) return rtf.format(Math.round(days / 7), 'week');
  return rtf.format(days, 'day');
}

const SESSION_LABELS = {
  fp1: 'Practice 1',
  fp2: 'Practice 2',
  fp3: 'Practice 3',
  sprintQ: 'Sprint Qualifying',
  sprint: 'Sprint',
  qualifying: 'Qualifying',
  race: 'Race',
};

export function sessionLabel(kind) {
  return SESSION_LABELS[kind] || kind;
}

export function detectIOS() {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
}
