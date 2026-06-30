// Live timing panel UI. Pulls from lib/live.js (OpenF1) and renders into a
// container. Everything degrades to a single "unavailable" line.
import { el, clear } from './dom.js';
import { t } from './i18n.js';
import { fetchLeaderboard, fetchTrackWeather, fetchTrackStatus, fetchTeamRadio } from './live.js';

export async function refreshLivePanel(container) {
  const [board, weather, status, radio] = await Promise.all([
    fetchLeaderboard(), fetchTrackWeather(), fetchTrackStatus(), fetchTeamRadio(),
  ]);

  clear(container);
  const header = el('div', { class: 'live__header' }, [
    el('span', { class: 'live__dot' }),
    el('h3', { class: 'live__title', text: t('live.title') }),
  ]);
  if (status) {
    header.append(el('span', {
      class: 'live__flag', text: status.flag,
      attrs: { style: `--flag:${status.colour}` },
    }));
  }
  container.append(header);

  if (!board || !board.length) {
    container.append(el('p', { class: 'live__empty', text: t('live.unavailable') }));
    // weather may still be useful even without a board
    if (weather) container.append(weatherStrip(weather));
    return;
  }

  if (weather) container.append(weatherStrip(weather));

  const table = el('table', { class: 'live__board' }, [
    el('tbody', {}, board.slice(0, 20).map(r => el('tr', {}, [
      el('td', { class: 'live__pos', text: r.pos }),
      el('td', {}, [
        el('span', { class: 'live__bar', attrs: { style: `--team:${r.colour || 'var(--fg-muted)'}` } }),
        el('span', { class: 'live__code', text: r.acronym }),
      ]),
      el('td', { class: 'live__gap', text: r.pos === 1 ? '—' : (r.interval != null ? `+${r.interval}` : (r.gap != null ? `+${r.gap}` : '')) }),
    ]))),
  ]);
  container.append(table);

  if (radio && radio.length) {
    const wrap = el('div', { class: 'live__radio' }, [
      el('h4', { class: 'live__subtitle', text: t('live.radio') }),
    ]);
    for (const r of radio) {
      if (!r.url) continue;
      wrap.append(el('div', { class: 'live__radio-row' }, [
        el('span', { class: 'live__code', text: r.acronym, attrs: { style: r.colour ? `color:${r.colour}` : '' } }),
        el('audio', { controls: true, preload: 'none', src: r.url }),
      ]));
    }
    container.append(wrap);
  }
}

function weatherStrip(w) {
  const bits = [];
  if (w.airC != null) bits.push(`${t('live.air')} ${w.airC}°`);
  if (w.trackC != null) bits.push(`${t('live.track')} ${w.trackC}°`);
  if (w.windKmh != null) bits.push(`${w.windKmh} km/h`);
  if (w.rainfall) bits.push('🌧️');
  return el('p', { class: 'live__weather', text: `${t('live.weather')}: ${bits.join(' · ')}` });
}
