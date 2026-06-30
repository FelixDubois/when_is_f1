// Render-only helpers for the standings panel, title math banner and last-race
// result. Data is fetched by the caller (lib/api.js) and passed in.
import { el, clear } from './dom.js';
import { t } from './i18n.js';

export function computeTitleMath(drivers, remaining, nextRoundHasSprint) {
  if (!drivers || drivers.length < 2) return null;
  const remainingMax = remaining.races * 25 + remaining.sprints * 8;
  const leader = drivers[0];
  const second = drivers[1];
  const gap = leader.points - second.points;
  const clinched = gap > remainingMax;

  const nextMax = 25 + (nextRoundHasSprint ? 8 : 0);
  const remainingAfterNext = remainingMax - nextMax;
  const canClinchNext = !clinched && remaining.races > 0 &&
    (leader.points + nextMax - second.points) > remainingAfterNext;

  const contenders = drivers.filter(d => d.points + remainingMax >= leader.points).length;
  return { remainingMax, clinched, canClinchNext, contenders, leader, gap };
}

export function renderTitleBanner(node, drivers, math) {
  clear(node);
  if (!math) { node.hidden = true; return; }
  node.hidden = false;
  let msg;
  if (math.clinched) msg = t('title.clinched', { name: math.leader.name });
  else if (math.canClinchNext) msg = t('title.canClinch', { name: math.leader.name });
  else msg = t('title.contenders', { n: math.contenders });

  node.append(
    el('span', { class: 'title-banner__icon', text: '🏆' }),
    el('span', { class: 'title-banner__msg', text: msg }),
    !math.clinched && math.gap > 0
      ? el('span', { class: 'title-banner__lead', text: t('title.leader', { name: math.leader.family || math.leader.name, gap: math.gap }) })
      : null,
  );
}

function driverRow(d, { followingDriver, followingTeam } = {}) {
  const hit = (followingDriver && followingDriver === d.code) ||
              (followingTeam && followingTeam === d.teamId);
  return el('tr', { class: hit ? 'standings__row is-followed' : 'standings__row' }, [
    el('td', { class: 'standings__pos', text: d.pos }),
    el('td', {}, [
      el('span', { class: 'standings__code', text: d.code }),
      ' ',
      el('span', { class: 'standings__name', text: d.name }),
      el('span', { class: 'standings__team', text: d.team }),
    ]),
    el('td', { class: 'standings__pts', text: d.points }),
    el('td', { class: 'standings__wins', text: d.wins }),
  ]);
}

function constructorRow(c, { followingTeam } = {}) {
  const hit = followingTeam && followingTeam === c.id;
  return el('tr', { class: hit ? 'standings__row is-followed' : 'standings__row' }, [
    el('td', { class: 'standings__pos', text: c.pos }),
    el('td', {}, [el('span', { class: 'standings__name', text: c.name })]),
    el('td', { class: 'standings__pts', text: c.points }),
    el('td', { class: 'standings__wins', text: c.wins }),
  ]);
}

export function renderStandingsTable(rows, type, follow = {}) {
  const head = el('thead', {}, [
    el('tr', {}, [
      el('th', { class: 'standings__pos', text: t('standings.pos') }),
      el('th', { text: t('standings.entrant') }),
      el('th', { class: 'standings__pts', text: t('standings.points') }),
      el('th', { class: 'standings__wins', text: t('standings.wins') }),
    ]),
  ]);
  const body = el('tbody', {},
    rows.map(r => type === 'drivers' ? driverRow(r, follow) : constructorRow(r, follow)));
  return el('table', { class: 'standings' }, [head, body]);
}

export function renderLastResult(container, last, { fastestCode } = {}) {
  clear(container);
  if (!last || !last.results.length) {
    container.append(el('p', { class: 'status', text: t('last.error') }));
    return;
  }
  const podium = last.results.slice(0, 3);
  const medals = ['🥇', '🥈', '🥉'];
  container.append(
    el('p', { class: 'last__title', text: `${last.name} — ${last.season}` }),
    el('ol', { class: 'last__podium' }, podium.map((r, i) => el('li', { class: 'last__podium-item' }, [
      el('span', { class: 'last__medal', text: medals[i] }),
      el('span', { class: 'last__driver', text: r.name }),
      el('span', { class: 'last__team', text: r.team }),
    ]))),
    el('p', { class: 'last__meta' }, [
      last.poleCode ? el('span', { class: 'last__chip' }, [el('b', { text: t('last.pole') + ': ' }), last.poleCode]) : null,
      last.fastestCode ? el('span', { class: 'last__chip' }, [el('b', { text: t('last.fastest') + ': ' }), `${last.fastestCode}${last.fastestTime ? ' ' + last.fastestTime : ''}`]) : null,
    ]),
    buildFullClassification(last),
  );
}

// Inline race result (podium + pole/fastest + full order). Used on past-season
// cards where the user has already expanded a "Results" section.
export function renderRaceResult(container, last) {
  clear(container);
  if (!last || !last.results.length) {
    container.append(el('p', { class: 'status', text: t('last.error') }));
    return;
  }
  const podium = last.results.slice(0, 3);
  const medals = ['🥇', '🥈', '🥉'];
  container.append(
    el('ol', { class: 'last__podium' }, podium.map((r, i) => el('li', { class: 'last__podium-item' }, [
      el('span', { class: 'last__medal', text: medals[i] }),
      el('span', { class: 'last__driver', text: r.name }),
      el('span', { class: 'last__team', text: r.team }),
    ]))),
    el('p', { class: 'last__meta' }, [
      last.poleCode ? el('span', { class: 'last__chip' }, [el('b', { text: t('last.pole') + ': ' }), last.poleCode]) : null,
      last.fastestCode ? el('span', { class: 'last__chip' }, [el('b', { text: t('last.fastest') + ': ' }), last.fastestCode]) : null,
    ]),
    el('table', { class: 'standings' }, [
      el('thead', {}, [el('tr', {}, [
        el('th', { class: 'standings__pos', text: '#' }),
        el('th', { text: t('standings.entrant') }),
        el('th', { class: 'standings__pts', text: t('standings.points') }),
      ])]),
      el('tbody', {}, last.results.map(r => el('tr', { class: 'standings__row' }, [
        el('td', { class: 'standings__pos', text: r.finished ? r.pos : '—' }),
        el('td', {}, [
          el('span', { class: 'standings__code', text: r.code }), ' ',
          el('span', { class: 'standings__team', text: r.team }),
          !r.finished ? el('span', { class: 'last__dnf', text: ' ' + t('last.dnf') }) : null,
        ]),
        el('td', { class: 'standings__pts', text: r.points }),
      ]))),
    ]),
  );
}

function buildFullClassification(last) {
  const details = el('details', { class: 'last__full' });
  details.append(el('summary', { text: t('standings.title') }));
  const table = el('table', { class: 'standings' }, [
    el('thead', {}, [el('tr', {}, [
      el('th', { class: 'standings__pos', text: '#' }),
      el('th', { text: t('standings.entrant') }),
      el('th', { class: 'standings__pts', text: t('standings.points') }),
    ])]),
    el('tbody', {}, last.results.map(r => el('tr', { class: 'standings__row' }, [
      el('td', { class: 'standings__pos', text: r.finished ? r.pos : '—' }),
      el('td', {}, [
        el('span', { class: 'standings__code', text: r.code }), ' ',
        el('span', { class: 'standings__team', text: r.team }),
        !r.finished ? el('span', { class: 'last__dnf', text: ' ' + t('last.dnf') }) : null,
      ]),
      el('td', { class: 'standings__pts', text: r.points }),
    ]))),
  ]);
  details.append(table);
  return details;
}
