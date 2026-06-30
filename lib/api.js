import { CIRCUIT_TZ } from '../data/circuit-timezones.js';
import { sessionEnd } from './sessions.js';

const BASE = 'https://api.jolpi.ca/ergast/f1';
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

  const loc = race.Circuit.Location || {};
  return {
    id: `${race.season}-${race.round}`,
    season: Number(race.season),
    round: Number(race.round),
    name: race.raceName,
    wikiUrl: race.url,
    circuit: {
      id: circuitId,
      name: race.Circuit.circuitName,
      locality: loc.locality,
      country: loc.country,
      lat: loc.lat != null ? Number(loc.lat) : null,
      lon: loc.long != null ? Number(loc.long) : null,
      tz: tz || 'UTC',
    },
    sessions,
  };
}

function cacheKeyFor(season) {
  return `${CACHE_KEY}:${season}`;
}

function readCache(season) {
  try {
    const raw = sessionStorage.getItem(cacheKeyFor(season));
    if (!raw) return null;
    const { day, data, fetchedAt } = JSON.parse(raw);
    if (day !== new Date().toISOString().slice(0, 10)) return null;
    for (const race of data.all) {
      for (const s of race.sessions) s.start = new Date(s.start);
    }
    return { ...data, fetchedAt: fetchedAt ? new Date(fetchedAt) : null };
  } catch { return null; }
}

function writeCache(season, data) {
  try {
    sessionStorage.setItem(cacheKeyFor(season), JSON.stringify({
      day: new Date().toISOString().slice(0, 10),
      fetchedAt: new Date().toISOString(),
      data,
    }));
  } catch {}
}

/**
 * @param {{ now?: Date, year?: number|'current', forceFresh?: boolean }} opts
 * @returns {Promise<{season, total, all, upcoming, fetchedAt, fromCache}>}
 */
export async function fetchSchedule({ now = new Date(), year = 'current', forceFresh = false } = {}) {
  const seasonKey = String(year);

  if (!forceFresh) {
    const cached = readCache(seasonKey);
    if (cached) return { ...cached, upcoming: filterFuture(cached.all, now), fromCache: true };
  }

  const res = await fetch(`${BASE}/${year}.json?limit=100`, { mode: 'cors' });
  if (!res.ok) throw new Error(`Jolpica responded with ${res.status}`);
  const json = await res.json();
  const races = json?.MRData?.RaceTable?.Races;
  if (!Array.isArray(races)) throw new Error('Unexpected response shape from Jolpica.');

  const all = races.map(normalize);
  const total = Number(json?.MRData?.total) || all.length;
  const season = all.length ? all[0].season : (json?.MRData?.RaceTable?.season ? Number(json.MRData.RaceTable.season) : null);
  const data = { season, total, all };
  writeCache(seasonKey, data);
  return { ...data, upcoming: filterFuture(all, now), fetchedAt: new Date(), fromCache: false };
}

// Keep a race while any of its sessions has not yet ENDED (so it stays
// visible during its live window, not dropped the moment the race starts).
function filterFuture(races, now) {
  return races.filter(r => {
    const last = r.sessions[r.sessions.length - 1];
    return last && sessionEnd(last) > now;
  });
}

// How many rounds (and sprints) are still to come, for title math / progress.
export function remainingCounts(allRaces, now = new Date()) {
  let races = 0, sprints = 0, completed = 0;
  for (const r of allRaces) {
    const raceSession = r.sessions.find(s => s.kind === 'race');
    const done = raceSession && sessionEnd(raceSession) <= now;
    if (done) { completed++; continue; }
    races++;
    if (r.sessions.some(s => s.kind === 'sprint')) sprints++;
  }
  return { races, sprints, completed };
}

// ---------- Secondary data (standings, results, history) ----------
async function getJson(url) {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`Jolpica responded with ${res.status}`);
  return res.json();
}

export async function fetchStandings(year = 'current') {
  const [dRes, cRes] = await Promise.all([
    getJson(`${BASE}/${year}/driverStandings.json`),
    getJson(`${BASE}/${year}/constructorStandings.json`),
  ]);
  const dList = dRes?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
  const cList = cRes?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [];
  const drivers = dList.map(d => ({
    pos: Number(d.position),
    points: Number(d.points),
    wins: Number(d.wins),
    code: d.Driver.code || d.Driver.familyName.slice(0, 3).toUpperCase(),
    name: `${d.Driver.givenName} ${d.Driver.familyName}`,
    given: d.Driver.givenName,
    family: d.Driver.familyName,
    team: d.Constructors?.[d.Constructors.length - 1]?.name || '',
    teamId: d.Constructors?.[d.Constructors.length - 1]?.constructorId || '',
  }));
  const constructors = cList.map(c => ({
    pos: Number(c.position),
    points: Number(c.points),
    wins: Number(c.wins),
    name: c.Constructor.name,
    id: c.Constructor.constructorId,
  }));
  return { drivers, constructors };
}

export async function fetchLastResult() {
  const json = await getJson(`${BASE}/current/last/results.json`);
  const race = json?.MRData?.RaceTable?.Races?.[0];
  if (!race) return null;
  const results = (race.Results || []).map(r => ({
    pos: Number(r.position),
    points: Number(r.points),
    grid: Number(r.grid),
    code: r.Driver.code || r.Driver.familyName.slice(0, 3).toUpperCase(),
    name: `${r.Driver.givenName} ${r.Driver.familyName}`,
    team: r.Constructor.name,
    status: r.status,
    finished: /^(Finished|\+\d+ Lap)/.test(r.status),
    time: r.Time?.time || null,
    fastestRank: r.FastestLap?.rank ? Number(r.FastestLap.rank) : null,
    fastestTime: r.FastestLap?.Time?.time || null,
  }));
  const pole = results.find(r => r.grid === 1);
  const fastest = results.find(r => r.fastestRank === 1);
  return {
    season: Number(race.season),
    round: Number(race.round),
    name: race.raceName,
    circuit: race.Circuit?.circuitName,
    results,
    poleCode: pole?.code || null,
    fastestCode: fastest?.code || null,
    fastestTime: fastest?.fastestTime || null,
  };
}

// Last N winners at a given circuit. Reads MRData.total then offsets.
export async function fetchCircuitWinners(circuitId, n = 8) {
  const first = await getJson(`${BASE}/circuits/${circuitId}/results/1.json?limit=1`);
  const total = Number(first?.MRData?.total) || 0;
  if (!total) return [];
  const offset = Math.max(0, total - n);
  const json = await getJson(`${BASE}/circuits/${circuitId}/results/1.json?limit=${n}&offset=${offset}`);
  const races = json?.MRData?.RaceTable?.Races || [];
  return races.map(r => ({
    year: Number(r.season),
    driver: r.Results?.[0] ? `${r.Results[0].Driver.givenName} ${r.Results[0].Driver.familyName}` : '—',
    team: r.Results?.[0]?.Constructor?.name || '',
  })).reverse();
}
