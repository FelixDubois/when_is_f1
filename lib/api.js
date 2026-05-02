import { CIRCUIT_TZ } from '../data/circuit-timezones.js';

const URL = 'https://api.jolpi.ca/ergast/f1/current.json';
const CACHE_KEY = 'wif:schedule';

const SESSION_ORDER = [
  ['FirstPractice',    'fp1'],
  ['SecondPractice',   'fp2'],
  ['ThirdPractice',    'fp3'],
  ['SprintQualifying', 'sprintQ'],
  ['Sprint',           'sprint'],
  ['Qualifying',       'qualifying'],
];

function combine(obj) {
  if (!obj || !obj.date || !obj.time) return null;
  const d = new Date(`${obj.date}T${obj.time}`);
  return isNaN(d.getTime()) ? null : d;
}

function normalize(race) {
  const sessions = [];
  for (const [apiKey, kind] of SESSION_ORDER) {
    const start = combine(race[apiKey]);
    if (start) sessions.push({ kind, start });
  }
  const raceStart = combine({ date: race.date, time: race.time });
  if (raceStart) sessions.push({ kind: 'race', start: raceStart });

  const circuitId = race.Circuit.circuitId;
  const tz = CIRCUIT_TZ[circuitId];
  if (!tz) console.warn(`No timezone mapping for circuit "${circuitId}", falling back to UTC.`);

  return {
    id: `${race.season}-${race.round}`,
    season: Number(race.season),
    round: Number(race.round),
    name: race.raceName,
    wikiUrl: race.url,
    circuit: {
      id: circuitId,
      name: race.Circuit.circuitName,
      locality: race.Circuit.Location.locality,
      country: race.Circuit.Location.country,
      tz: tz || 'UTC',
    },
    sessions,
  };
}

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { day, data } = JSON.parse(raw);
    if (day !== new Date().toISOString().slice(0, 10)) return null;
    // Revive Date objects on sessions
    for (const race of data) {
      for (const s of race.sessions) s.start = new Date(s.start);
    }
    return data;
  } catch { return null; }
}

function writeCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      day: new Date().toISOString().slice(0, 10),
      data,
    }));
  } catch {}
}

export async function fetchSchedule({ now = new Date() } = {}) {
  const cached = readCache();
  if (cached) return filterFuture(cached, now);

  const res = await fetch(URL, { mode: 'cors' });
  if (!res.ok) throw new Error(`Jolpica responded with ${res.status}`);
  const json = await res.json();
  const races = json?.MRData?.RaceTable?.Races;
  if (!Array.isArray(races)) throw new Error('Unexpected response shape from Jolpica.');

  const normalized = races.map(normalize);
  writeCache(normalized);
  return filterFuture(normalized, now);
}

function filterFuture(races, now) {
  return races.filter(r => {
    const last = r.sessions[r.sessions.length - 1];
    return last && last.start > now;
  });
}
