import { initTheme } from './lib/theme.js';
import {
  fetchSchedule, fetchStandings, fetchLastResult, fetchCircuitWinners, remainingCounts,
} from './lib/api.js';
import { formatInZone, relativeDays, relativeTime, sessionLabel, detectIOS, formatCountdown } from './lib/format.js';
import { downloadIcs } from './lib/ics.js';
import { gcalUrl } from './lib/gcal.js';
import { createCountryCombobox } from './lib/combobox.js';
import { COUNTRIES } from './data/countries.js';
import { COUNTRY_TIMEZONES, TZ_PRIMARY_COUNTRY } from './data/country-timezones.js';
import { CIRCUIT_FACTS } from './data/circuit-facts.js';
import { el, clear, toast } from './lib/dom.js';
import {
  t, getLang, setLang, onLangChange, applyTranslations, SUPPORTED, prefers12h, LANGUAGES,
} from './lib/i18n.js';
import { sessionState, sessionEnd, nextSession, SESSION_DURATIONS_MIN } from './lib/sessions.js';
import {
  computeTitleMath, renderTitleBanner, renderStandingsTable, renderLastResult,
} from './lib/panels.js';
import { fetchWeather, weatherEmoji, withinForecastHorizon } from './lib/weather.js';
import { refreshLivePanel } from './lib/live-ui.js';
import {
  ensurePermission, scheduleReminder, rearmReminders, permissionState, notificationsSupported,
} from './lib/reminders.js';
import { fetchWikiSummary } from './lib/wikipedia.js';
import { detectCountryByIp } from './lib/geo.js';
import { getWebhook, setWebhook, isValidWebhook, postToDiscord } from './lib/discord.js';
import { youtubeSearchUrl, redditSearchUrl, outlookUrl, webcalUrl } from './lib/external.js';

const STORAGE_COUNTRY = 'wif:country';
const STORAGE_ZONE = 'wif:tz';
const STORAGE_FORMAT = 'wif:format';
const STORAGE_VIEW = 'wif:view';
const STORAGE_FAVS = 'wif:favs';
const STORAGE_FOLLOW = 'wif:follow';
const STORAGE_REMINDER = 'wif:reminder';
const IS_IOS = detectIOS();
const CURRENT_YEAR = new Date().getFullYear();
const REMINDER_OPTIONS = ['', '0', '10', '60', '1440'];

const state = {
  schedule: [],      // upcoming
  allRaces: [],
  total: 0,
  season: CURRENT_YEAR,
  selectedYear: CURRENT_YEAR,
  fetchedAt: null,
  fromCache: false,
  countryCode: null,
  zone: null,
  hour12: false,
  view: 'all',
  favsOnly: false,
  favorites: new Set(),
  following: { driver: null, team: null },
  reminderDefault: '',
  search: '',
  standings: null,
  lastResult: null,
  lastResultLoaded: false,
};

const els = {};
function cache(id) { return document.getElementById(id); }

let countryCombobox = null;
let tickTimer = null;
let liveTimer = null;
let lastTransitionKey = '';
const flagSrc = (cc) => `assets/flags/${cc.toLowerCase()}.svg`;

// ---------- Persistence ----------
function loadPrefs() {
  try {
    state.view = localStorage.getItem(STORAGE_VIEW) || 'all';
    state.reminderDefault = localStorage.getItem(STORAGE_REMINDER) || '';
    state.favorites = new Set(JSON.parse(localStorage.getItem(STORAGE_FAVS) || '[]'));
    state.following = JSON.parse(localStorage.getItem(STORAGE_FOLLOW) || '{"driver":null,"team":null}');
    state.hour12 = localStorage.getItem(STORAGE_FORMAT) === '12';
  } catch {}
  if (localStorage.getItem(STORAGE_FORMAT) == null) state.hour12 = prefers12h();
}

function persist() {
  try {
    localStorage.setItem(STORAGE_COUNTRY, state.countryCode);
    localStorage.setItem(STORAGE_ZONE, state.zone);
    localStorage.setItem(STORAGE_FORMAT, state.hour12 ? '12' : '24');
    localStorage.setItem(STORAGE_VIEW, state.view);
    localStorage.setItem(STORAGE_REMINDER, state.reminderDefault);
    localStorage.setItem(STORAGE_FAVS, JSON.stringify([...state.favorites]));
    localStorage.setItem(STORAGE_FOLLOW, JSON.stringify(state.following));
  } catch {}
}

// ---------- URL state ----------
function readUrl() {
  const p = new URLSearchParams(location.search);
  if (p.get('embed') === '1') document.body.classList.add('embed');
  const fmt = p.get('fmt');
  if (fmt === '12') state.hour12 = true; else if (fmt === '24') state.hour12 = false;
  const lang = p.get('lang');
  if (lang && SUPPORTED.includes(lang)) setLang(lang);
  const year = Number(p.get('season'));
  if (year >= 2023 && year <= CURRENT_YEAR) state.selectedYear = year;
  return { tz: p.get('tz'), round: Number(p.get('round')) || null };
}

function syncUrl() {
  const p = new URLSearchParams(location.search);
  p.set('season', String(state.selectedYear));
  p.set('tz', state.zone);
  p.set('fmt', state.hour12 ? '12' : '24');
  p.set('lang', getLang());
  if (document.body.classList.contains('embed')) p.set('embed', '1');
  p.delete('round');
  history.replaceState(null, '', `${location.pathname}?${p.toString()}`);
}

function shareUrl(round) {
  const p = new URLSearchParams();
  p.set('season', String(state.selectedYear));
  p.set('tz', state.zone);
  p.set('fmt', state.hour12 ? '12' : '24');
  p.set('lang', getLang());
  p.set('round', String(round));
  return `${location.origin}${location.pathname}?${p.toString()}`;
}

// ---------- Detection ----------
function detectInitial(urlTz) {
  let storedCountry = null, storedZone = null;
  try {
    storedCountry = localStorage.getItem(STORAGE_COUNTRY);
    storedZone = localStorage.getItem(STORAGE_ZONE);
  } catch {}
  if (urlTz && TZ_PRIMARY_COUNTRY[urlTz]) {
    const cc = TZ_PRIMARY_COUNTRY[urlTz];
    return { countryCode: cc, zone: urlTz };
  }
  if (storedCountry && COUNTRY_TIMEZONES[storedCountry]) {
    const zones = COUNTRY_TIMEZONES[storedCountry];
    const zone = storedZone && zones.includes(storedZone) ? storedZone : zones[0];
    return { countryCode: storedCountry, zone };
  }
  const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const cc = TZ_PRIMARY_COUNTRY[detectedTz];
  if (cc && COUNTRY_TIMEZONES[cc]) return { countryCode: cc, zone: detectedTz };
  return { countryCode: 'GB', zone: 'Europe/London' };
}

// ---------- Picker ----------
function buildCountryCombobox(initialValue) {
  const options = Object.entries(COUNTRIES)
    .map(([cc, name]) => ({ value: cc, label: name, flagSrc: flagSrc(cc) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  countryCombobox = createCountryCombobox({
    rootEl: els.countryRoot, toggleEl: els.countryToggle, flagEl: els.countryFlag,
    currentEl: els.countryCurrent, popoverEl: els.countryPopover, searchEl: els.countrySearch,
    listEl: els.countryList, emptyEl: els.countryEmpty, options, initialValue,
    onChange: (cc) => {
      state.countryCode = cc;
      const zones = COUNTRY_TIMEZONES[cc] || [];
      state.zone = zones[0] || 'UTC';
      syncZonePicker(); updateHint(); persist(); syncUrl(); renderAllDynamic();
    },
  });
}

function zoneCityLabel(z) { return (z.split('/').pop() || z).replace(/_/g, ' '); }

function syncZonePicker() {
  const zones = COUNTRY_TIMEZONES[state.countryCode] || [];
  if (zones.length <= 1) {
    els.zoneField.hidden = true;
    state.zone = zones[0] || state.zone || 'UTC';
    return;
  }
  els.zoneField.hidden = false;
  clear(els.zone);
  for (const z of zones) els.zone.appendChild(el('option', { value: z, text: zoneCityLabel(z) }));
  if (!zones.includes(state.zone)) state.zone = zones[0];
  els.zone.value = state.zone;
}

function buildSeasonSelect() {
  clear(els.season);
  for (let y = CURRENT_YEAR; y >= 2023; y--) {
    els.season.appendChild(el('option', { value: String(y), text: String(y) }));
  }
  els.season.value = String(state.selectedYear);
}

function buildLangDropdown() {
  const toggle = cache('lang-toggle-btn');
  const flagEl = cache('lang-flag');
  const codeEl = cache('lang-code');
  const list = cache('lang-list');

  clear(list);
  const optionEls = LANGUAGES.map((L) => {
    const li = el('li', {
      class: 'lang-dropdown__option', attrs: { role: 'option', tabindex: '-1' }, dataset: { value: L.code },
    }, [
      el('img', { class: 'lang-dropdown__flag', src: `assets/flags/${L.flag}.svg`, alt: '', width: 22, height: 16, loading: 'lazy' }),
      el('span', { class: 'lang-dropdown__name', text: L.name }),
    ]);
    li.addEventListener('click', () => choose(L.code));
    list.appendChild(li);
    return li;
  });

  function syncCurrent() {
    const code = getLang();
    const L = LANGUAGES.find(x => x.code === code) || LANGUAGES[0];
    flagEl.src = `assets/flags/${L.flag}.svg`;
    codeEl.textContent = L.code.toUpperCase();
    for (const li of optionEls) li.setAttribute('aria-selected', li.dataset.value === code ? 'true' : 'false');
  }
  function open() {
    list.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    (optionEls.find(li => li.dataset.value === getLang()) || optionEls[0])?.focus();
  }
  function close(focusToggle = false) {
    list.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (focusToggle) toggle.focus();
  }
  function choose(code) { setLang(code); syncUrl(); close(true); }
  function moveFocus(dir) {
    const idx = optionEls.findIndex(li => li === document.activeElement);
    optionEls[(idx + dir + optionEls.length) % optionEls.length]?.focus();
  }

  toggle.addEventListener('click', (e) => { e.stopPropagation(); if (list.hidden) open(); else close(); });
  toggle.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });
  list.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-1); }
    else if (e.key === 'Home') { e.preventDefault(); optionEls[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); optionEls[optionEls.length - 1]?.focus(); }
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const li = optionEls.find(x => x === document.activeElement);
      if (li) choose(li.dataset.value);
    } else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') { close(); }
  });
  list.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => { if (!list.hidden) close(); });

  syncCurrent();
  onLangChange(syncCurrent);
}

function updateHint() {
  els.hint.textContent = t('picker.hint', { zone: state.zone });
}

function syncSegmented(group, value) {
  if (!group) return;
  for (const btn of group.querySelectorAll('.segmented__option')) {
    btn.setAttribute('aria-pressed', btn.dataset.value === value ? 'true' : 'false');
  }
}

// ---------- Status / meta ----------
function showStatus(msg, isError = false) {
  clear(els.events);
  els.events.classList.remove('events');
  els.events.appendChild(el('p', { class: 'status' + (isError ? ' status--error' : ''), text: msg }));
}

function renderMeta() {
  const bits = [];
  if (!navigator.onLine) bits.push(t('status.offline'));
  else if (state.fetchedAt) bits.push(t('status.updated', { when: relativeTime(state.fetchedAt) }));
  if (state.following.driver || state.following.team) {
    const row = followedStanding();
    if (row) bits.push(`★ ${row}`);
  }
  if (!bits.length) { els.metaBar.hidden = true; return; }
  els.metaBar.hidden = false;
  els.metaBar.textContent = bits.join('  ·  ');
}

function followedStanding() {
  if (!state.standings) return null;
  if (state.following.driver) {
    const d = state.standings.drivers.find(x => x.code === state.following.driver);
    if (d) return `${d.name} — P${d.pos}, ${d.points} pts`;
  }
  if (state.following.team) {
    const c = state.standings.constructors.find(x => x.id === state.following.team);
    if (c) return `${c.name} — P${c.pos}, ${c.points} pts`;
  }
  return null;
}

// ---------- Hero ----------
function renderHero() {
  const next = nextSession(state.schedule);
  els.hero.hidden = false;
  clear(els.hero);
  if (!next) {
    els.hero.appendChild(el('p', { class: 'hero__none', text: t('hero.none') }));
    stopLive();
    return;
  }
  const { race, session, state: st } = next;
  const isLive = st === 'live';
  const opts = { hour12: state.hour12 };
  const you = formatInZone(session.start, state.zone, opts);

  const card = el('div', { class: 'hero__card' + (isLive ? ' is-live' : '') }, [
    el('div', { class: 'hero__top' }, [
      el('span', { class: 'hero__label', text: t('hero.next') }),
      isLive ? el('span', { class: 'badge badge--live', text: t('hero.liveNow') }) : null,
    ]),
    el('h2', { class: 'hero__name' }, [
      `${race.name} — ${sessionLabel(session.kind)}`,
    ]),
    el('div', { class: 'hero__when' }, [
      isLive
        ? el('span', { class: 'hero__countdown is-live', text: t('hero.liveNow') })
        : el('span', { class: 'hero__countdown', id: 'hero-countdown', text: formatCountdown(session.start - new Date()) }),
      el('span', { class: 'hero__time', text: `${you.date}, ${you.time} ${you.zone}` }),
    ]),
  ]);
  els.hero.appendChild(card);

  if (isLive) {
    const liveBox = el('div', { class: 'live', id: 'live-panel' });
    els.hero.appendChild(liveBox);
    startLive(liveBox);
  } else {
    stopLive();
  }
}

// ---------- Live polling ----------
function startLive(container) {
  refreshLivePanel(container);
  if (liveTimer) return;
  liveTimer = setInterval(() => {
    const box = cache('live-panel');
    if (box) refreshLivePanel(box); else stopLive();
  }, 12000);
}
function stopLive() {
  if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
}

// ---------- Ticking countdown + transitions ----------
function startTick() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    const next = nextSession(state.schedule);
    const key = next ? `${next.session.start.getTime()}-${next.state}` : 'none';
    if (key !== lastTransitionKey) {
      lastTransitionKey = key;
      renderHero();
      renderEvents();
      return;
    }
    const cd = cache('hero-countdown');
    if (cd && next && next.state !== 'live') {
      cd.textContent = formatCountdown(next.session.start - new Date());
    }
  }, 1000);
}

// ---------- Events ----------
function filteredRaces() {
  let races = state.schedule.slice();
  const q = state.search.trim().toLowerCase();
  if (q) {
    races = races.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.circuit.name.toLowerCase().includes(q) ||
      (r.circuit.country || '').toLowerCase().includes(q) ||
      (r.circuit.locality || '').toLowerCase().includes(q));
  }
  if (state.favsOnly) races = races.filter(r => state.favorites.has(r.id));
  // Favorites pinned to top, otherwise keep round order.
  races.sort((a, b) => {
    const fa = state.favorites.has(a.id) ? 0 : 1;
    const fb = state.favorites.has(b.id) ? 0 : 1;
    return fa - fb || a.round - b.round;
  });
  return races;
}

function renderProgress() {
  const { completed } = remainingCounts(state.allRaces);
  if (!state.total) return null;
  const pct = Math.round((completed / state.total) * 100);
  return el('div', { class: 'progress', attrs: { 'aria-label': t('progress.season') } }, [
    el('div', { class: 'progress__bar' }, [el('span', { class: 'progress__fill', attrs: { style: `width:${pct}%` } })]),
    el('span', { class: 'progress__label', text: t('round.of', { n: completed, total: state.total }) + ` · ${pct}%` }),
  ]);
}

function renderEvents() {
  if (!state.schedule.length) { showStatus(t('status.empty')); return; }
  const races = filteredRaces();
  clear(els.events);
  els.events.classList.add('events');
  const prog = renderProgress();
  if (prog && state.selectedYear === state.season) els.events.appendChild(prog);
  if (!races.length) {
    els.events.appendChild(el('p', { class: 'status', text: t('status.noFilter') }));
    return;
  }
  for (const race of races) els.events.appendChild(renderRace(race));
}

function renderRace(race) {
  const card = el('article', { class: 'event', id: `round-${race.round}` });
  const raceSession = race.sessions.find(s => s.kind === 'race');
  const liveSession = race.sessions.find(s => sessionState(s) === 'live');

  // Head
  const star = el('button', {
    class: 'fav-star' + (state.favorites.has(race.id) ? ' is-on' : ''),
    type: 'button', text: '★',
    attrs: { 'aria-pressed': state.favorites.has(race.id) ? 'true' : 'false',
             'aria-label': t(state.favorites.has(race.id) ? 'favorites.remove' : 'favorites.add') },
    onClick: () => toggleFav(race.id),
  });
  const roundRow = el('div', { class: 'event__round-row' }, [
    el('span', { class: 'event__round', text: t('round.label', { n: race.round }) }),
    liveSession ? el('span', { class: 'badge badge--live', text: t('hero.live') }) : null,
    el('span', { class: 'event__when', text: raceSession ? relativeDays(raceSession.start) : '' }),
    star,
  ]);
  const head = el('header', { class: 'event__head' }, [
    roundRow,
    el('h2', { class: 'event__name', text: race.name }),
    el('p', { class: 'event__circuit', text: `${race.circuit.name} — ${race.circuit.locality}, ${race.circuit.country}` }),
    buildFactsRow(race),
  ]);
  card.appendChild(head);

  // Map
  card.appendChild(buildMap(race));

  // Sessions
  card.appendChild(buildSessions(race));

  // External services (maps, video, discussion, travel, wikipedia)
  card.appendChild(buildExtras(race));

  // Actions
  attachActions(card, race);
  return card;
}

function linkChip(icon, label, href) {
  return el('a', {
    class: 'chip-link', href, target: '_blank', rel: 'noopener',
  }, [el('span', { class: 'chip-link__icon', attrs: { 'aria-hidden': 'true' }, text: icon }), label]);
}

function buildExtras(race) {
  const c = race.circuit;
  const box = el('div', { class: 'extras' });

  const row = el('div', { class: 'extras__links' }, [
    linkChip('📺', t('links.video'), youtubeSearchUrl(`Formula 1 ${race.season} ${race.name} highlights`)),
    linkChip('💬', t('links.discuss'), redditSearchUrl(race.name)),
  ]);
  box.appendChild(row);

  if (c.url) box.appendChild(buildWiki(c));
  return box;
}

function buildWiki(circuit) {
  const details = el('details', { class: 'extras__details extras__wiki' });
  details.appendChild(el('summary', { text: `📖 ${t('wiki.about')}` }));
  let loaded = false;
  details.addEventListener('toggle', async () => {
    if (!details.open || loaded) return;
    loaded = true;
    const body = el('div', { class: 'wiki__body', text: '…' });
    details.appendChild(body);
    const data = await fetchWikiSummary(circuit.url);
    clear(body);
    if (!data) { body.textContent = t('wiki.error'); return; }
    if (data.thumb) body.appendChild(el('img', { class: 'wiki__thumb', src: data.thumb, alt: '', loading: 'lazy' }));
    body.appendChild(el('p', { class: 'wiki__extract', text: data.extract }));
    body.appendChild(el('a', { class: 'chip-link', href: data.url, target: '_blank', rel: 'noopener', text: t('wiki.readMore') }));
  });
  return details;
}

function buildFactsRow(race) {
  const f = CIRCUIT_FACTS[race.circuit.id];
  const row = el('div', { class: 'event__facts' });
  if (f) {
    if (f.lengthKm) row.appendChild(factChip(t('circuit.length'), `${f.lengthKm} km`));
    if (f.laps) row.appendChild(factChip(t('circuit.laps'), f.laps));
    if (f.lapRecord) row.appendChild(factChip(t('circuit.record'), `${f.lapRecord.time} (${f.lapRecord.driver})`));
  }
  const wx = el('span', { class: 'event__wx', id: `wx-${race.round}` });
  row.appendChild(wx);
  maybeLoadWeather(race, wx);
  return row;
}

function factChip(label, value) {
  return el('span', { class: 'fact-chip' }, [el('b', { text: label + ': ' }), String(value)]);
}

async function maybeLoadWeather(race, node) {
  const raceSession = race.sessions.find(s => s.kind === 'race');
  if (!raceSession || race.circuit.lat == null) return;
  if (!withinForecastHorizon(raceSession.start)) return;
  const w = await fetchWeather(race.circuit.lat, race.circuit.lon, raceSession.start);
  if (!w) return;
  clear(node);
  node.appendChild(el('span', { class: 'wx-chip' }, [
    `${w.emoji} ${w.tempC}°C`,
    w.precip != null ? el('span', { class: 'wx-rain', text: ` · ${t('weather.rain', { p: w.precip })}` }) : null,
  ]));
}

function buildMap(race) {
  const mapBox = el('div', { class: 'event__map' });
  const img = el('img', { src: `assets/circuits/${race.circuit.id}.svg`, alt: `${race.circuit.name} layout`, loading: 'lazy' });
  img.onerror = () => {
    img.remove();
    mapBox.appendChild(el('div', { class: 'event__map-empty', html: `
      <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
        <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          d="M8 24c0-8 6-14 14-14 4 0 8 2 10 6 2 4 6 6 10 4 4-2 4 6-2 8-4 1-6 4-6 8-1 6-8 8-14 6-8-2-12-10-12-18z"/>
      </svg>` }, [el('span', { text: t('map.soon') })]));
  };
  mapBox.appendChild(img);
  return mapBox;
}

function visibleSessions(race) {
  return state.view === 'race' ? race.sessions.filter(s => s.kind === 'race') : race.sessions;
}

function buildSessions(race) {
  const wrap = el('div', { class: 'event__sessions-wrap' });
  const sessions = visibleSessions(race);

  const table = el('table', { class: 'sessions' }, [
    el('thead', {}, [el('tr', {}, [
      el('th', { attrs: { scope: 'col' }, text: t('table.session') }),
      el('th', { attrs: { scope: 'col' }, text: t('table.circuit') }),
      el('th', { attrs: { scope: 'col' }, text: t('table.you') }),
      el('th', { attrs: { scope: 'col' }, text: '' }),
    ])]),
    el('tbody', {}, sessions.map(s => sessionRow(s, race))),
  ]);
  wrap.appendChild(table);

  const mobile = el('div', { class: 'sessions-mobile' }, sessions.map(s => sessionCardMobile(s, race)));
  wrap.appendChild(mobile);

  // Recent winners (lazy)
  wrap.appendChild(buildWinners(race));
  return wrap;
}

function sessionTimes(session, race) {
  const opts = { hour12: state.hour12 };
  return {
    local: formatInZone(session.start, race.circuit.tz, opts),
    user: formatInZone(session.start, state.zone, opts),
  };
}

function sessionRow(session, race) {
  const { local, user } = sessionTimes(session, race);
  const live = sessionState(session) === 'live';
  return el('tr', { class: (session.kind === 'race' ? 'is-race' : '') + (live ? ' is-live-row' : '') }, [
    el('td', { class: 'sessions__kind' }, [
      sessionLabel(session.kind),
      live ? el('span', { class: 'badge badge--live badge--sm', text: t('hero.live') }) : null,
    ]),
    el('td', {}, [`${local.date}, ${local.time} `, el('span', { class: 'sessions__zone', text: local.zone })]),
    el('td', {}, [`${user.date}, ${user.time} `, el('span', { class: 'sessions__zone', text: user.zone })]),
    el('td', { class: 'sessions__act' }, [sessionMenu(session, race)]),
  ]);
}

function sessionCardMobile(session, race) {
  const { local, user } = sessionTimes(session, race);
  const live = sessionState(session) === 'live';
  return el('div', { class: 'session-card' + (session.kind === 'race' ? ' is-race' : '') }, [
    el('div', { class: 'session-card__kind' }, [
      sessionLabel(session.kind),
      live ? el('span', { class: 'badge badge--live badge--sm', text: t('hero.live') }) : null,
    ]),
    el('div', { class: 'session-card__row' }, [
      el('span', { class: 'session-card__label', text: t('card.circuit') }),
      el('span', { text: `${local.date}, ${local.time} ${local.zone}` }),
    ]),
    el('div', { class: 'session-card__row' }, [
      el('span', { class: 'session-card__label', text: t('card.you') }),
      el('span', { text: `${user.date}, ${user.time} ${user.zone}` }),
    ]),
    el('div', { class: 'session-card__act' }, [sessionMenu(session, race)]),
  ]);
}

function sessionMenu(session, race) {
  return el('button', {
    class: 'link-btn', type: 'button', text: t('cal.copyTimes'),
    attrs: { title: t('cal.copyTimes') },
    onClick: () => {
      const { local, user } = sessionTimes(session, race);
      const txt = `${race.name} — ${sessionLabel(session.kind)}\n${t('table.circuit')}: ${local.date}, ${local.time} ${local.zone}\n${t('table.you')}: ${user.date}, ${user.time} ${user.zone}`;
      copyText(txt, t('cal.copied'));
    },
  });
}

function buildWinners(race) {
  const details = el('details', { class: 'winners' });
  details.appendChild(el('summary', { text: t('circuit.loadWinners') }));
  let loaded = false;
  details.addEventListener('toggle', async () => {
    if (!details.open || loaded) return;
    loaded = true;
    const body = el('div', { class: 'winners__body', text: '…' });
    details.appendChild(body);
    try {
      const winners = await fetchCircuitWinners(race.circuit.id);
      clear(body);
      if (!winners.length) { body.textContent = t('circuit.winnersError'); return; }
      details.querySelector('summary').textContent = t('circuit.winners');
      body.appendChild(el('ul', { class: 'winners__list' }, winners.map(w =>
        el('li', {}, [el('b', { text: w.year + ' ' }), `${w.driver}${w.team ? ' (' + w.team + ')' : ''}`]))));
    } catch {
      body.textContent = t('circuit.winnersError');
    }
  });
  return details;
}

// ---------- Calendar / reminders ----------
function buildCalendarEvent(race, session, alarmMinutes) {
  const durationMin = SESSION_DURATIONS_MIN[session.kind] || 90;
  const end = new Date(session.start.getTime() + durationMin * 60 * 1000);
  const evt = {
    uid: `${race.id}-${session.kind}@when-is-f1`,
    start: session.start, end,
    summary: `F1 ${sessionLabel(session.kind)} — ${race.name}`,
    location: `${race.circuit.name}, ${race.circuit.locality}, ${race.circuit.country}`,
    description: `${race.name} ${sessionLabel(session.kind)} @ ${race.circuit.name}.\n${race.wikiUrl}`,
  };
  if (alarmMinutes != null && alarmMinutes !== '') evt.alarmMinutes = Number(alarmMinutes);
  return evt;
}

function attachActions(card, race) {
  const raceSession = race.sessions.find(s => s.kind === 'race');
  if (!raceSession) return;
  const actions = el('div', { class: 'event__actions' });
  const alarm = state.reminderDefault;

  // Primary: add race (popover)
  const primary = el('button', { class: 'btn btn--primary', type: 'button', text: t('cal.addRace') });
  const popover = el('div', { class: 'popover', attrs: { role: 'menu' } });
  popover.hidden = true;

  if (!IS_IOS) {
    popover.appendChild(el('button', {
      class: 'popover__item', type: 'button', text: t('cal.ics'), attrs: { role: 'menuitem' },
      onClick: () => { downloadIcs([buildCalendarEvent(race, raceSession, alarm)], `f1-${race.id}-race.ics`); popover.hidden = true; },
    }));
  }
  popover.appendChild(el('a', {
    class: 'popover__item', href: gcalUrl(buildCalendarEvent(race, raceSession)), target: '_blank', rel: 'noopener',
    text: t('cal.gcal'), attrs: { role: 'menuitem' },
    onClick: () => { popover.hidden = true; },
  }));
  popover.appendChild(el('a', {
    class: 'popover__item', href: outlookUrl(buildCalendarEvent(race, raceSession)), target: '_blank', rel: 'noopener',
    text: t('cal.outlook'), attrs: { role: 'menuitem' },
    onClick: () => { popover.hidden = true; },
  }));
  popover.appendChild(el('button', {
    class: 'popover__item', type: 'button', text: t('discord.send'), attrs: { role: 'menuitem' },
    onClick: () => { popover.hidden = true; sendRaceToDiscord(race, raceSession); },
  }));
  if (notificationsSupported() && permissionState() !== 'denied') {
    popover.appendChild(el('button', {
      class: 'popover__item', type: 'button', text: t('reminder.remindRace'), attrs: { role: 'menuitem' },
      onClick: () => { popover.hidden = true; remindRace(race, raceSession); },
    }));
  }

  primary.addEventListener('click', (e) => { e.stopPropagation(); popover.hidden = !popover.hidden; });
  document.addEventListener('click', () => { popover.hidden = true; });
  popover.addEventListener('click', (e) => e.stopPropagation());

  actions.append(primary, popover);

  // Secondary: full weekend
  if (!IS_IOS && race.sessions.length > 1) {
    actions.appendChild(el('button', {
      class: 'btn', type: 'button', text: t('cal.addWeekend'),
      onClick: () => downloadIcs(race.sessions.map(s => buildCalendarEvent(race, s, alarm)), `f1-${race.id}-weekend.ics`),
    }));
  }

  // Share link
  actions.appendChild(el('button', {
    class: 'btn', type: 'button', attrs: { title: t('cal.shareLink'), 'aria-label': t('cal.shareLink') },
    onClick: () => shareRound(race.round),
  }, ['🔗']));

  card.appendChild(actions);
}

async function remindRace(race, raceSession) {
  const ok = await ensurePermission();
  if (!ok) { toast(t('reminder.denied'), { type: 'error' }); return; }
  const minutes = state.reminderDefault === '' ? 60 : Number(state.reminderDefault);
  const when = new Date(raceSession.start.getTime() - minutes * 60000);
  if (when <= new Date()) { toast(t('reminder.scheduled', { when: '—' }), { type: 'info' }); }
  const res = await scheduleReminder({
    when, tag: `${race.id}-race`,
    title: `F1 ${t('session.race')} — ${race.name}`,
    body: `${race.circuit.name}`,
  });
  if (res.ok) {
    const u = formatInZone(when, state.zone, { hour12: state.hour12 });
    toast(t('reminder.scheduled', { when: `${u.date}, ${u.time}` }), { type: 'success' });
    if (res.mode === 'timeout') toast(t('reminder.tabNote'), { type: 'info', timeout: 6000 });
  } else if (res.reason === 'denied') {
    toast(t('reminder.denied'), { type: 'error' });
  }
}

async function sendRaceToDiscord(race, raceSession) {
  if (!isValidWebhook(getWebhook())) { toast(t('discord.invalid'), { type: 'error', timeout: 6000 }); return; }
  const u = formatInZone(raceSession.start, state.zone, { hour12: state.hour12 });
  const msg = `🏁 **${race.name}** — ${t('session.race')}\n${u.date}, ${u.time} ${u.zone}\n${race.wikiUrl}`;
  const res = await postToDiscord(msg);
  toast(res.ok ? t('discord.sent') : t('discord.error'), { type: res.ok ? 'success' : 'error' });
}

async function maybeRefineCountryByIp() {
  let stored = null;
  try { stored = localStorage.getItem(STORAGE_COUNTRY); } catch {}
  if (stored) return; // an explicit/stored choice always wins
  if (new URLSearchParams(location.search).get('tz')) return;
  const cc = await detectCountryByIp();
  if (!cc || !COUNTRY_TIMEZONES[cc] || cc === state.countryCode) return;
  state.countryCode = cc;
  state.zone = COUNTRY_TIMEZONES[cc][0] || state.zone;
  countryCombobox?.setValue(cc);
  syncZonePicker();
  updateHint();
  syncUrl();
  renderAllDynamic();
}

async function shareRound(round) {
  const url = shareUrl(round);
  if (navigator.share) {
    try { await navigator.share({ title: 'When Is F1', url }); return; } catch {}
  }
  copyText(url, t('cal.linkCopied'));
}

function copyText(text, okMsg) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => toast(okMsg, { type: 'success' })).catch(() => fallbackCopy(text, okMsg));
  } else fallbackCopy(text, okMsg);
}
function fallbackCopy(text, okMsg) {
  const ta = el('textarea', { value: text, attrs: { style: 'position:fixed;opacity:0' } });
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast(okMsg, { type: 'success' }); } catch {}
  ta.remove();
}

function toggleFav(id) {
  if (state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
  persist(); renderEvents();
}

// ---------- Standings + last result ----------
async function loadStandings() {
  try {
    state.standings = await fetchStandings(state.selectedYear);
    els.standingsPanel.hidden = false;
    renderStandingsContent();
    renderTitleInfo();
    renderMeta();
  } catch (err) {
    console.warn('standings load failed:', err);
    els.standingsPanel.hidden = true;
    els.titleBanner.hidden = true;
  }
}

function renderTitleInfo() {
  if (!state.standings) { els.titleBanner.hidden = true; return; }
  const remaining = remainingCounts(state.allRaces);
  const next = nextSession(state.schedule);
  const nextHasSprint = next ? next.race.sessions.some(s => s.kind === 'sprint') : false;
  const math = computeTitleMath(state.standings.drivers, remaining, nextHasSprint);
  renderTitleBanner(els.titleBanner, state.standings.drivers, math);
}

let standingsTab = 'drivers';
function renderStandingsContent() {
  if (!state.standings) return;
  clear(els.standingsContent);
  const follow = { followingDriver: state.following.driver, followingTeam: state.following.team };
  const table = standingsTab === 'drivers'
    ? renderStandingsTable(state.standings.drivers, 'drivers', follow)
    : renderStandingsTable(state.standings.constructors, 'constructors', follow);
  // clickable rows -> follow
  table.querySelectorAll('tbody tr').forEach((tr, i) => {
    tr.classList.add('is-clickable');
    tr.addEventListener('click', () => {
      if (standingsTab === 'drivers') {
        const d = state.standings.drivers[i];
        state.following = state.following.driver === d.code ? { driver: null, team: null } : { driver: d.code, team: null };
      } else {
        const c = state.standings.constructors[i];
        state.following = state.following.team === c.id ? { driver: null, team: null } : { driver: null, team: c.id };
      }
      persist(); renderStandingsContent(); renderMeta();
    });
  });
  els.standingsContent.appendChild(table);
}

async function loadLastResult() {
  if (state.lastResultLoaded || state.selectedYear !== CURRENT_YEAR) return;
  state.lastResultLoaded = true;
  try {
    state.lastResult = await fetchLastResult();
    if (state.lastResult) {
      els.lastPanel.hidden = false;
      renderLastResult(els.lastBody, state.lastResult);
    }
  } catch {
    els.lastPanel.hidden = true;
  }
}

// ---------- Re-render orchestration ----------
function renderAllDynamic() {
  renderHero();
  renderEvents();
  renderTitleInfo();
  renderStandingsContent();
  if (state.lastResult) renderLastResult(els.lastBody, state.lastResult);
  renderMeta();
  updateHint();
}

// ---------- Season reload ----------
async function reloadSeason() {
  state.lastResult = null; state.lastResultLoaded = false; state.standings = null;
  els.standingsPanel.hidden = true; els.lastPanel.hidden = true; els.titleBanner.hidden = true;
  showStatus(t('status.loading'));
  try {
    const year = state.selectedYear;
    const data = await fetchSchedule({ year });
    applyScheduleData(data);
    renderAllDynamic();
    loadStandings();
    loadLastResult();
  } catch (err) {
    showStatus(t('status.error', { msg: err.message }), true);
  }
}

function applyScheduleData(data) {
  state.schedule = data.upcoming;
  state.allRaces = data.all;
  state.total = data.total;
  state.season = data.season || state.selectedYear;
  state.fetchedAt = data.fetchedAt || null;
  state.fromCache = data.fromCache || false;
  lastTransitionKey = '';
}

// ---------- Settings dialog ----------
function wireSettings() {
  els.settingsBtn.addEventListener('click', () => {
    syncSegmented(els.settingsTheme, document.documentElement.getAttribute('data-theme'));
    syncSegmented(els.settingsView, state.view);
    els.settingsReminder.value = state.reminderDefault;
    if (els.settingsDiscord) els.settingsDiscord.value = getWebhook();
    els.settingsDialog.showModal();
  });
  if (els.settingsDiscord) {
    els.settingsDiscord.addEventListener('change', () => {
      const v = els.settingsDiscord.value.trim();
      if (v && !isValidWebhook(v)) { toast(t('discord.invalid'), { type: 'error', timeout: 6000 }); return; }
      setWebhook(v);
    });
  }
  els.settingsTheme.addEventListener('click', (e) => {
    const btn = e.target.closest('.segmented__option'); if (!btn) return;
    document.documentElement.setAttribute('data-theme', btn.dataset.value);
    try { localStorage.setItem('wif:theme', btn.dataset.value); } catch {}
    syncSegmented(els.settingsTheme, btn.dataset.value);
    initTheme();
  });
  els.settingsView.addEventListener('click', (e) => {
    const btn = e.target.closest('.segmented__option'); if (!btn) return;
    setView(btn.dataset.value);
    syncSegmented(els.settingsView, state.view);
  });
  els.settingsReminder.addEventListener('change', () => {
    state.reminderDefault = els.settingsReminder.value; persist();
  });
}

function setView(view) {
  state.view = view;
  syncSegmented(els.viewToggle, view);
  persist(); renderEvents();
}

// ---------- Service worker update toast ----------
function wireSwUpdate() {
  if (!('serviceWorker' in navigator)) return;
  let userTriggeredUpdate = false;
  navigator.serviceWorker.ready.then(reg => {
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          toast(t('update.available'), {
            type: 'info', timeout: 0,
            action: { label: t('update.reload'), onClick: () => { userTriggeredUpdate = true; sw.postMessage({ type: 'SKIP_WAITING' }); } },
          });
        }
      });
    });
  });
  // Only reload when the user opted into an update. The first-install
  // controllerchange (from clients.claim) must NOT reload the page.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (userTriggeredUpdate) location.reload();
  });
}

// ---------- Init ----------
async function init() {
  els.countryRoot = cache('country-picker');
  els.countryToggle = document.querySelector('#country-picker .combobox__toggle');
  els.countryFlag = cache('country-flag');
  els.countryCurrent = cache('country-current');
  els.countryPopover = cache('country-popover');
  els.countrySearch = cache('country-search');
  els.countryList = cache('country-listbox');
  els.countryEmpty = cache('country-empty');
  els.zone = cache('zone');
  els.zoneField = cache('zone-field');
  els.season = cache('season');
  els.formatToggle = cache('format-toggle');
  els.viewToggle = cache('view-toggle');
  els.favFilter = cache('fav-filter');
  els.search = cache('search');
  els.hint = cache('picker-hint');
  els.events = cache('events');
  els.status = cache('status');
  els.hero = cache('hero');
  els.metaBar = cache('meta-bar');
  els.titleBanner = cache('title-banner');
  els.standingsPanel = cache('standings-panel');
  els.standingsToggle = cache('standings-toggle');
  els.standingsBody = cache('standings-body');
  els.standingsTabs = cache('standings-tabs');
  els.standingsContent = cache('standings-content');
  els.lastPanel = cache('last-panel');
  els.lastToggle = cache('last-toggle');
  els.lastBody = cache('last-body');
  els.iosNote = cache('ios-note');
  els.settingsBtn = cache('settings-btn');
  els.settingsDialog = cache('settings-dialog');
  els.settingsTheme = cache('settings-theme');
  els.settingsView = cache('settings-view');
  els.settingsReminder = cache('settings-reminder');
  els.settingsDiscord = cache('settings-discord');
  els.subscribeLink = cache('subscribe-link');

  initTheme();
  loadPrefs();
  const { tz: urlTz, round: urlRound } = readUrl();
  if (IS_IOS) els.iosNote.hidden = false;
  applyTranslations();
  rearmReminders();

  const initial = detectInitial(urlTz);
  state.countryCode = initial.countryCode;
  state.zone = initial.zone;

  buildCountryCombobox(state.countryCode);
  buildSeasonSelect();
  buildLangDropdown();
  syncZonePicker();
  syncSegmented(els.formatToggle, state.hour12 ? '12' : '24');
  syncSegmented(els.viewToggle, state.view);
  els.favFilter.setAttribute('aria-pressed', state.favsOnly ? 'true' : 'false');
  updateHint();
  wireSettings();
  wireSwUpdate();
  if (els.subscribeLink) els.subscribeLink.href = webcalUrl();
  maybeRefineCountryByIp();

  // Events
  els.formatToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.segmented__option'); if (!btn) return;
    const next = btn.dataset.value === '12';
    if (next === state.hour12) return;
    state.hour12 = next; syncSegmented(els.formatToggle, btn.dataset.value);
    persist(); syncUrl(); renderAllDynamic();
  });
  els.viewToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.segmented__option'); if (!btn) return;
    setView(btn.dataset.value);
  });
  els.favFilter.addEventListener('click', () => {
    state.favsOnly = !state.favsOnly;
    els.favFilter.setAttribute('aria-pressed', state.favsOnly ? 'true' : 'false');
    renderEvents();
  });
  els.search.addEventListener('input', () => { state.search = els.search.value; renderEvents(); });
  els.zone.addEventListener('change', () => { state.zone = els.zone.value; updateHint(); persist(); syncUrl(); renderAllDynamic(); });
  els.season.addEventListener('change', () => { state.selectedYear = Number(els.season.value); syncUrl(); reloadSeason(); });

  els.standingsToggle.addEventListener('click', () => {
    const open = els.standingsBody.hidden;
    els.standingsBody.hidden = !open;
    els.standingsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    els.standingsToggle.querySelector('span').textContent = t(open ? 'standings.hide' : 'standings.show');
  });
  els.standingsTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.segmented__option'); if (!btn) return;
    standingsTab = btn.dataset.value; syncSegmented(els.standingsTabs, standingsTab); renderStandingsContent();
  });
  els.lastToggle.addEventListener('click', () => {
    const open = els.lastBody.hidden;
    els.lastBody.hidden = !open;
    els.lastToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    els.lastToggle.querySelector('span').textContent = t(open ? 'last.hide' : 'last.show');
  });

  window.addEventListener('online', renderMeta);
  window.addEventListener('offline', renderMeta);

  onLangChange(() => {
    applyTranslations();
    // refresh toggle-dependent labels
    els.standingsToggle.querySelector('span').textContent = t(els.standingsBody.hidden ? 'standings.show' : 'standings.hide');
    els.lastToggle.querySelector('span').textContent = t(els.lastBody.hidden ? 'last.show' : 'last.hide');
    buildSeasonSelect();
    renderAllDynamic();
  });

  // Load schedule
  try {
    const data = await fetchSchedule({ year: state.selectedYear });
    applyScheduleData(data);
    renderAllDynamic();
    startTick();
    loadStandings();
    loadLastResult();
    if (urlRound) scrollToRound(urlRound);
  } catch (err) {
    console.error(err);
    showStatus(t('status.error', { msg: err.message }), true);
  }
}

function scrollToRound(round) {
  requestAnimationFrame(() => {
    const node = cache(`round-${round}`);
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
      node.classList.add('is-flash');
      setTimeout(() => node.classList.remove('is-flash'), 1600);
    }
  });
}

init();
