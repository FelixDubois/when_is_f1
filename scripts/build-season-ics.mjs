#!/usr/bin/env node
// Generates season.ics — the full current F1 season as a single calendar file —
// from the Jolpica API. Run in CI (see .github/workflows/season-ics.yml) so the
// hosted feed stays current without any runtime backend. Pure Node (>=18): uses
// global fetch and only imports the dependency-free helpers.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildIcs } from '../lib/ics.js';
import { SESSION_DURATIONS_MIN } from '../lib/sessions.js';

const SESSION_LABELS = {
  fp1: 'Practice 1', fp2: 'Practice 2', fp3: 'Practice 3',
  sprintQ: 'Sprint Qualifying', sprint: 'Sprint', qualifying: 'Qualifying', race: 'Race',
};
const SESSION_ORDER = [
  ['FirstPractice', 'fp1'], ['SecondPractice', 'fp2'], ['ThirdPractice', 'fp3'],
  ['SprintQualifying', 'sprintQ'], ['Sprint', 'sprint'], ['Qualifying', 'qualifying'],
];

function combine(obj) {
  if (!obj || !obj.date || !obj.time) return null;
  const d = new Date(`${obj.date}T${obj.time}`);
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  const res = await fetch('https://api.jolpi.ca/ergast/f1/current.json?limit=100');
  if (!res.ok) throw new Error(`Jolpica responded with ${res.status}`);
  const json = await res.json();
  const races = json?.MRData?.RaceTable?.Races;
  if (!Array.isArray(races)) throw new Error('Unexpected Jolpica response shape.');

  const events = [];
  for (const race of races) {
    const sessions = [];
    for (const [key, kind] of SESSION_ORDER) {
      const start = combine(race[key]);
      if (start) sessions.push({ kind, start });
    }
    const raceStart = combine({ date: race.date, time: race.time });
    if (raceStart) sessions.push({ kind: 'race', start: raceStart });

    const c = race.Circuit;
    const loc = `${c.circuitName}, ${c.Location?.locality || ''}, ${c.Location?.country || ''}`;
    for (const s of sessions) {
      const end = new Date(s.start.getTime() + (SESSION_DURATIONS_MIN[s.kind] || 90) * 60000);
      events.push({
        uid: `${race.season}-${race.round}-${s.kind}@when-is-f1`,
        start: s.start, end,
        summary: `F1 ${SESSION_LABELS[s.kind]} — ${race.raceName}`,
        location: loc,
        description: `${race.raceName} ${SESSION_LABELS[s.kind]} @ ${c.circuitName}.\n${race.url}`,
        alarmMinutes: s.kind === 'race' ? 60 : null,
      });
    }
  }

  const ics = buildIcs(events);
  const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'season.ics');
  writeFileSync(out, ics, 'utf8');
  console.log(`Wrote ${events.length} events for ${races.length} rounds -> season.ics`);
}

main().catch((err) => { console.error(err); process.exit(1); });
