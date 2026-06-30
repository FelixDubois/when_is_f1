// Shared session timing knowledge, used by both the schedule normaliser
// (to decide what's still "live") and the calendar exporters.
export const SESSION_DURATIONS_MIN = {
  fp1: 90, fp2: 90, fp3: 60,
  sprintQ: 60, sprint: 60,
  qualifying: 60, race: 120,
};

export function sessionDurationMin(kind) {
  return SESSION_DURATIONS_MIN[kind] || 90;
}

export function sessionEnd(session) {
  return new Date(session.start.getTime() + sessionDurationMin(session.kind) * 60000);
}

// 'upcoming' | 'live' | 'done' for a single session at a given instant.
export function sessionState(session, now = new Date()) {
  const start = session.start.getTime();
  const end = sessionEnd(session).getTime();
  const t = now.getTime();
  if (t < start) return 'upcoming';
  if (t <= end) return 'live';
  return 'done';
}

// The next session (across all sessions of all races) that hasn't ended yet,
// preferring one that is currently live.
export function nextSession(races, now = new Date()) {
  let best = null;
  for (const race of races) {
    for (const s of race.sessions) {
      const st = sessionState(s, now);
      if (st === 'done') continue;
      const cand = { race, session: s, state: st };
      if (st === 'live') return cand; // live always wins
      if (!best || s.start < best.session.start) best = cand;
    }
  }
  return best;
}
