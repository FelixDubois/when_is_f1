// Live timing via OpenF1 (api.openf1.org, key-less). Everything here is
// best-effort: every call resolves to null/[] on failure so the static
// schedule card never breaks. Not cached by the SW (cross-origin, network-only).
const BASE = 'https://api.openf1.org/v1';

function withTimeout(promise, ms = 6000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function getJson(path) {
  try {
    const res = await withTimeout(fetch(`${BASE}${path}`, { mode: 'cors' }));
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// Keep only the most recent row per key field.
function latestPer(rows, keyField) {
  const map = new Map();
  for (const row of rows || []) {
    const k = row[keyField];
    const prev = map.get(k);
    if (!prev || new Date(row.date) > new Date(prev.date)) map.set(k, row);
  }
  return map;
}

/**
 * Current leaderboard for the latest session.
 * @returns {Promise<Array<{pos, number, acronym, name, team, colour, gap, interval}>|null>}
 */
export async function fetchLeaderboard() {
  const [positions, drivers, intervals] = await Promise.all([
    getJson('/position?session_key=latest'),
    getJson('/drivers?session_key=latest'),
    getJson('/intervals?session_key=latest'),
  ]);
  if (!positions || !drivers) return null;

  const posMap = latestPer(positions, 'driver_number');
  const intMap = latestPer(intervals || [], 'driver_number');
  const drvMap = new Map((drivers || []).map(d => [d.driver_number, d]));
  if (posMap.size === 0) return null;

  const rows = [];
  for (const [num, p] of posMap) {
    const d = drvMap.get(num) || {};
    const iv = intMap.get(num) || {};
    rows.push({
      pos: p.position,
      number: num,
      acronym: d.name_acronym || String(num),
      name: d.full_name || '',
      team: d.team_name || '',
      colour: d.team_colour ? `#${d.team_colour}` : null,
      gap: iv.gap_to_leader != null ? iv.gap_to_leader : null,
      interval: iv.interval != null ? iv.interval : null,
    });
  }
  rows.sort((a, b) => (a.pos || 99) - (b.pos || 99));
  return rows;
}

export async function fetchTrackWeather() {
  const rows = await getJson('/weather?session_key=latest');
  if (!rows || !rows.length) return null;
  const w = rows[rows.length - 1];
  return {
    airC: w.air_temperature != null ? Math.round(w.air_temperature) : null,
    trackC: w.track_temperature != null ? Math.round(w.track_temperature) : null,
    rainfall: w.rainfall,
    windKmh: w.wind_speed != null ? Math.round(w.wind_speed * 3.6) : null,
    humidity: w.humidity != null ? Math.round(w.humidity) : null,
  };
}

const FLAG_COLOURS = {
  GREEN: '#21c45d', YELLOW: '#facc15', 'DOUBLE YELLOW': '#facc15',
  RED: '#ef4444', CHEQUERED: '#111111', BLUE: '#3b82f6', CLEAR: '#21c45d',
};

export async function fetchTrackStatus() {
  const rows = await getJson('/race_control?session_key=latest');
  if (!rows || !rows.length) return null;
  const flags = rows.filter(r => r.flag || r.category === 'Flag');
  const last = (flags.length ? flags : rows)[ (flags.length ? flags : rows).length - 1 ];
  const flag = (last.flag || 'CLEAR').toUpperCase();
  return {
    flag,
    message: last.message || '',
    colour: FLAG_COLOURS[flag] || '#21c45d',
  };
}

export async function fetchTeamRadio(limit = 5) {
  const rows = await getJson('/team_radio?session_key=latest');
  if (!rows || !rows.length) return [];
  const drivers = await getJson('/drivers?session_key=latest');
  const drvMap = new Map((drivers || []).map(d => [d.driver_number, d]));
  return rows.slice(-limit).reverse().map(r => ({
    number: r.driver_number,
    acronym: drvMap.get(r.driver_number)?.name_acronym || String(r.driver_number),
    colour: drvMap.get(r.driver_number)?.team_colour ? `#${drvMap.get(r.driver_number).team_colour}` : null,
    url: r.recording_url,
  }));
}
