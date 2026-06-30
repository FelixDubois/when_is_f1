// Static-friendly reminders. Best path: Notification Triggers (TimestampTrigger,
// Chromium) fire even with the tab closed, no server. Fallback: setTimeout while
// the tab is open, re-armed from localStorage on load. True push (closed browser)
// would need a server and is intentionally out of scope.
const STORE = 'wif:reminders';
const MAX_DELAY = 2 ** 31 - 1; // setTimeout ceiling (~24.8 days)

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function permissionState() {
  return notificationsSupported() ? Notification.permission : 'denied';
}

export async function ensurePermission() {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const res = await Notification.requestPermission();
    return res === 'granted';
  } catch { return false; }
}

function supportsTriggers() {
  try { return 'showTrigger' in Notification.prototype; } catch { return false; }
}

function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch { return []; }
}
function saveStore(list) {
  try { localStorage.setItem(STORE, JSON.stringify(list)); } catch {}
}

const timers = new Map();

function fireNow(rec) {
  if (permissionState() !== 'granted') return;
  try { new Notification(rec.title, { body: rec.body, tag: rec.tag, icon: 'assets/icons/icon-192.png' }); } catch {}
}

function armTimeout(rec) {
  const delay = rec.when - Date.now();
  if (delay <= 0 || delay > MAX_DELAY) return;
  if (timers.has(rec.tag)) clearTimeout(timers.get(rec.tag));
  timers.set(rec.tag, setTimeout(() => { fireNow(rec); removeRecord(rec.tag); }, delay));
}

function removeRecord(tag) {
  saveStore(loadStore().filter(r => r.tag !== tag));
  if (timers.has(tag)) { clearTimeout(timers.get(tag)); timers.delete(tag); }
}

/**
 * @returns {Promise<{ok:boolean, mode?:'trigger'|'timeout', reason?:string}>}
 */
export async function scheduleReminder({ when, title, body, tag }) {
  if (!notificationsSupported()) return { ok: false, reason: 'unsupported' };
  if (permissionState() !== 'granted') return { ok: false, reason: 'denied' };
  const ts = when instanceof Date ? when.getTime() : Number(when);
  if (ts <= Date.now()) return { ok: false, reason: 'past' };

  // Persist record (so timeout-mode reminders survive a reload).
  const list = loadStore().filter(r => r.tag !== tag);
  list.push({ when: ts, title, body, tag });
  saveStore(list);

  if (supportsTriggers() && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      // eslint-disable-next-line no-undef
      await reg.showNotification(title, {
        body, tag, icon: 'assets/icons/icon-192.png',
        showTrigger: new TimestampTrigger(ts),
      });
      return { ok: true, mode: 'trigger' };
    } catch { /* fall through to timeout */ }
  }

  armTimeout({ when: ts, title, body, tag });
  return { ok: true, mode: 'timeout' };
}

// Re-arm tab-open timeouts and prune expired records. Call once on load.
export function rearmReminders() {
  const now = Date.now();
  const list = loadStore().filter(r => r.when > now);
  saveStore(list);
  if (!supportsTriggers()) for (const rec of list) armTimeout(rec);
}
