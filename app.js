import { initTheme } from './lib/theme.js';
import { fetchSchedule } from './lib/api.js';
import { formatInZone, relativeDays, sessionLabel, detectIOS } from './lib/format.js';
import { downloadIcs } from './lib/ics.js';
import { gcalUrl } from './lib/gcal.js';
import { createCountryCombobox } from './lib/combobox.js';
import { COUNTRIES } from './data/countries.js';
import { COUNTRY_TIMEZONES, TZ_PRIMARY_COUNTRY } from './data/country-timezones.js';

const STORAGE_COUNTRY = 'wif:country';
const STORAGE_ZONE = 'wif:tz';
const IS_IOS = detectIOS();

const SESSION_DURATIONS_MIN = {
  fp1: 90, fp2: 90, fp3: 60,
  sprintQ: 60, sprint: 60,
  qualifying: 60, race: 120,
};

const state = {
  schedule: null,
  countryCode: null,
  zone: null,
};

const els = {
  countryRoot: document.getElementById('country-picker'),
  countryToggle: document.querySelector('#country-picker .combobox__toggle'),
  countryFlag: document.getElementById('country-flag'),
  countryCurrent: document.getElementById('country-current'),
  countryPopover: document.getElementById('country-popover'),
  countrySearch: document.getElementById('country-search'),
  countryList: document.getElementById('country-listbox'),
  countryEmpty: document.getElementById('country-empty'),
  zone: document.getElementById('zone'),
  zoneField: document.getElementById('zone-field'),
  hint: document.getElementById('picker-hint'),
  events: document.getElementById('events'),
  status: document.getElementById('status'),
  iosNote: document.getElementById('ios-note'),
};

let countryCombobox = null;
const flagSrc = (cc) => `assets/flags/${cc.toLowerCase()}.svg`;

function detectInitial() {
  let storedCountry = null, storedZone = null;
  try {
    storedCountry = localStorage.getItem(STORAGE_COUNTRY);
    storedZone = localStorage.getItem(STORAGE_ZONE);
  } catch {}

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

// ---------- Picker UI ----------
function buildCountryCombobox(initialValue) {
  const options = Object.entries(COUNTRIES)
    .map(([cc, name]) => ({ value: cc, label: name, flagSrc: flagSrc(cc) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  countryCombobox = createCountryCombobox({
    rootEl: els.countryRoot,
    toggleEl: els.countryToggle,
    flagEl: els.countryFlag,
    currentEl: els.countryCurrent,
    popoverEl: els.countryPopover,
    searchEl: els.countrySearch,
    listEl: els.countryList,
    emptyEl: els.countryEmpty,
    options,
    initialValue,
    onChange: (cc) => {
      state.countryCode = cc;
      const zones = COUNTRY_TIMEZONES[cc] || [];
      state.zone = zones[0] || 'UTC';
      syncZonePicker();
      updateHint();
      persist();
      renderEvents();
    },
  });
}

function zoneCityLabel(z) {
  const last = z.split('/').pop() || z;
  return last.replace(/_/g, ' ');
}

function syncZonePicker() {
  const zones = COUNTRY_TIMEZONES[state.countryCode] || [];
  if (zones.length <= 1) {
    els.zoneField.hidden = true;
    state.zone = zones[0] || 'UTC';
    return;
  }
  els.zoneField.hidden = false;
  els.zone.innerHTML = '';
  for (const z of zones) {
    const opt = document.createElement('option');
    opt.value = z;
    opt.textContent = zoneCityLabel(z);
    els.zone.appendChild(opt);
  }
  if (!zones.includes(state.zone)) state.zone = zones[0];
  els.zone.value = state.zone;
}

function updateHint() {
  els.hint.textContent = `Times shown in your timezone: ${state.zone}`;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_COUNTRY, state.countryCode);
    localStorage.setItem(STORAGE_ZONE, state.zone);
  } catch {}
}

// ---------- Rendering ----------
function showStatus(msg, isError = false) {
  els.events.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'status' + (isError ? ' status--error' : '');
  p.textContent = msg;
  els.events.appendChild(p);
}

function renderSessionRow(table, session, race) {
  const local = formatInZone(session.start, race.circuit.tz);
  const user = formatInZone(session.start, state.zone);

  const tr = document.createElement('tr');
  if (session.kind === 'race') tr.className = 'is-race';

  const tdKind = document.createElement('td');
  tdKind.className = 'sessions__kind';
  tdKind.textContent = sessionLabel(session.kind);
  tr.appendChild(tdKind);

  const tdLocal = document.createElement('td');
  tdLocal.append(`${local.date}, ${local.time} `);
  const localZone = document.createElement('span');
  localZone.className = 'sessions__zone';
  localZone.textContent = local.zone;
  tdLocal.appendChild(localZone);
  tr.appendChild(tdLocal);

  const tdUser = document.createElement('td');
  tdUser.append(`${user.date}, ${user.time} `);
  const userZone = document.createElement('span');
  userZone.className = 'sessions__zone';
  userZone.textContent = user.zone;
  tdUser.appendChild(userZone);
  tr.appendChild(tdUser);

  table.appendChild(tr);
}

function renderSessionMobile(container, session, race) {
  const local = formatInZone(session.start, race.circuit.tz);
  const user = formatInZone(session.start, state.zone);

  const card = document.createElement('div');
  card.className = 'session-card' + (session.kind === 'race' ? ' is-race' : '');

  const head = document.createElement('div');
  head.className = 'session-card__kind';
  head.textContent = sessionLabel(session.kind);
  card.appendChild(head);

  for (const [label, val] of [
    ['Circuit', `${local.date}, ${local.time} ${local.zone}`],
    ['You',     `${user.date}, ${user.time} ${user.zone}`],
  ]) {
    const row = document.createElement('div');
    row.className = 'session-card__row';
    const l = document.createElement('span');
    l.className = 'session-card__label';
    l.textContent = label;
    const v = document.createElement('span');
    v.textContent = val;
    row.append(l, v);
    card.appendChild(row);
  }

  container.appendChild(card);
}

function buildCalendarEvent(race, session) {
  const durationMin = SESSION_DURATIONS_MIN[session.kind] || 90;
  const end = new Date(session.start.getTime() + durationMin * 60 * 1000);
  return {
    uid: `${race.id}-${session.kind}@when-is-f1`,
    start: session.start,
    end,
    summary: `F1 ${sessionLabel(session.kind)} — ${race.name}`,
    location: `${race.circuit.name}, ${race.circuit.locality}, ${race.circuit.country}`,
    description: `${race.name} ${sessionLabel(session.kind)} at ${race.circuit.name}.\nMore: ${race.wikiUrl}`,
  };
}

function attachActions(card, race) {
  const actions = document.createElement('div');
  actions.className = 'event__actions';

  const raceSession = race.sessions.find(s => s.kind === 'race');
  if (!raceSession) return;
  const raceEvent = buildCalendarEvent(race, raceSession);

  // Primary: Add Race
  const primary = document.createElement('button');
  primary.type = 'button';
  primary.className = 'btn btn--primary';
  primary.textContent = 'Add race to calendar';
  actions.appendChild(primary);

  const popover = document.createElement('div');
  popover.className = 'popover';
  popover.hidden = true;
  popover.setAttribute('role', 'menu');

  if (!IS_IOS) {
    const ics = document.createElement('button');
    ics.type = 'button';
    ics.className = 'popover__item';
    ics.setAttribute('role', 'menuitem');
    ics.textContent = 'Download .ics';
    ics.addEventListener('click', () => {
      downloadIcs([raceEvent], `f1-${race.id}-race.ics`);
      popover.hidden = true;
    });
    popover.appendChild(ics);
  }

  const gcal = document.createElement('a');
  gcal.className = 'popover__item';
  gcal.setAttribute('role', 'menuitem');
  gcal.href = gcalUrl(raceEvent);
  gcal.target = '_blank';
  gcal.rel = 'noopener';
  gcal.textContent = 'Add to Google Calendar';
  gcal.addEventListener('click', () => { popover.hidden = true; });
  popover.appendChild(gcal);

  primary.addEventListener('click', (e) => {
    e.stopPropagation();
    popover.hidden = !popover.hidden;
  });
  document.addEventListener('click', () => { popover.hidden = true; });
  popover.addEventListener('click', (e) => e.stopPropagation());

  actions.appendChild(popover);

  // Secondary: full weekend (.ics only — hidden on iOS)
  if (!IS_IOS && race.sessions.length > 1) {
    const weekend = document.createElement('button');
    weekend.type = 'button';
    weekend.className = 'btn';
    weekend.textContent = 'Add full weekend';
    weekend.addEventListener('click', () => {
      const evts = race.sessions.map(s => buildCalendarEvent(race, s));
      downloadIcs(evts, `f1-${race.id}-weekend.ics`);
    });
    actions.appendChild(weekend);
  }

  card.appendChild(actions);
}

function renderRace(race) {
  const card = document.createElement('article');
  card.className = 'event';

  // Head
  const head = document.createElement('header');
  head.className = 'event__head';
  const roundRow = document.createElement('div');
  roundRow.className = 'event__round-row';
  const round = document.createElement('span');
  round.className = 'event__round';
  round.textContent = `Round ${race.round}`;
  const when = document.createElement('span');
  when.className = 'event__when';
  const raceSession = race.sessions.find(s => s.kind === 'race');
  if (raceSession) when.textContent = relativeDays(raceSession.start);
  roundRow.append(round, when);
  head.appendChild(roundRow);

  const name = document.createElement('h2');
  name.className = 'event__name';
  name.textContent = race.name;
  head.appendChild(name);

  const loc = document.createElement('p');
  loc.className = 'event__circuit';
  loc.textContent = `${race.circuit.name} — ${race.circuit.locality}, ${race.circuit.country}`;
  head.appendChild(loc);

  card.appendChild(head);

  // Map
  const mapBox = document.createElement('div');
  mapBox.className = 'event__map';
  const img = document.createElement('img');
  img.src = `assets/circuits/${race.circuit.id}.svg`;
  img.alt = `${race.circuit.name} layout`;
  img.loading = 'lazy';
  img.onerror = () => {
    img.remove();
    const placeholder = document.createElement('div');
    placeholder.className = 'event__map-empty';
    placeholder.innerHTML = `
      <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
        <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          d="M8 24c0-8 6-14 14-14 4 0 8 2 10 6 2 4 6 6 10 4 4-2 4 6-2 8-4 1-6 4-6 8-1 6-8 8-14 6-8-2-12-10-12-18z"/>
      </svg>
      <span>Map coming soon</span>
    `;
    mapBox.appendChild(placeholder);
  };
  mapBox.appendChild(img);
  card.appendChild(mapBox);

  // Sessions: desktop table + mobile cards
  const sessionsWrap = document.createElement('div');
  sessionsWrap.className = 'event__sessions-wrap';

  const table = document.createElement('table');
  table.className = 'sessions';
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th scope="col">Session</th>
      <th scope="col">Local at circuit</th>
      <th scope="col">Your time</th>
    </tr>`;
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  for (const s of race.sessions) renderSessionRow(tbody, s, race);
  table.appendChild(tbody);
  sessionsWrap.appendChild(table);

  const mobile = document.createElement('div');
  mobile.className = 'sessions-mobile';
  for (const s of race.sessions) renderSessionMobile(mobile, s, race);
  sessionsWrap.appendChild(mobile);

  card.appendChild(sessionsWrap);

  attachActions(card, race);
  return card;
}

function renderEvents() {
  if (!state.schedule) return;
  if (state.schedule.length === 0) {
    showStatus('No upcoming F1 events. The season is over!');
    return;
  }
  els.events.innerHTML = '';
  els.events.classList.add('events');
  for (const race of state.schedule) {
    els.events.appendChild(renderRace(race));
  }
}

// ---------- Init ----------
async function init() {
  initTheme();
  if (IS_IOS) els.iosNote.hidden = false;

  const initial = detectInitial();
  state.countryCode = initial.countryCode;
  state.zone = initial.zone;
  buildCountryCombobox(state.countryCode);
  syncZonePicker();
  updateHint();

  els.zone.addEventListener('change', () => {
    state.zone = els.zone.value;
    updateHint();
    persist();
    renderEvents();
  });

  try {
    state.schedule = await fetchSchedule();
    renderEvents();
  } catch (err) {
    console.error(err);
    showStatus(`Could not load schedule: ${err.message}`, true);
  }
}

init();
