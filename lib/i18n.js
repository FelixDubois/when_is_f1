// Vanilla ES-module i18n. No deps. Strings keyed by language; t() looks up
// with an English fallback; applyTranslations() walks data-i18n attributes.
const STORAGE_KEY = 'wif:lang';
export const SUPPORTED = ['en', 'fr'];

const STRINGS = {
  en: {
    'app.tagline': 'Every F1 session, in your time.',
    'nav.settings': 'Settings',
    'nav.language': 'Language',
    'a11y.skip': 'Skip to schedule',
    'theme.toDark': 'Switch to dark theme',
    'theme.toLight': 'Switch to light theme',

    'picker.country': 'Country',
    'picker.timeFormat': 'Time format',
    'picker.timezone': 'Timezone',
    'picker.season': 'Season',
    'picker.search': 'Search',
    'picker.searchPlaceholder': 'Search a Grand Prix, circuit or country…',
    'picker.countrySearch': 'Search countries…',
    'picker.noMatches': 'No matches.',
    'picker.hint': 'Times shown in your timezone: {zone}',

    'format.24h': '24h',
    'format.12h': '12h',

    'view.label': 'Show',
    'view.all': 'All sessions',
    'view.race': 'Race only',
    'favorites.only': 'Favorites only',
    'favorites.add': 'Add to favorites',
    'favorites.remove': 'Remove from favorites',

    'hero.next': 'Next session',
    'hero.none': 'No upcoming sessions — the season is over.',
    'hero.liveNow': 'LIVE NOW',
    'hero.starts': 'starts in',
    'hero.live': 'LIVE',

    'round.label': 'Round {n}',
    'round.of': 'Round {n} of {total}',
    'progress.season': 'Season progress',

    'session.fp1': 'Practice 1',
    'session.fp2': 'Practice 2',
    'session.fp3': 'Practice 3',
    'session.sprintQ': 'Sprint Qualifying',
    'session.sprint': 'Sprint',
    'session.qualifying': 'Qualifying',
    'session.race': 'Race',

    'table.session': 'Session',
    'table.circuit': 'Local at circuit',
    'table.you': 'Your time',
    'card.circuit': 'Circuit',
    'card.you': 'You',

    'map.soon': 'Map coming soon',

    'standings.title': 'Championship standings',
    'standings.drivers': 'Drivers',
    'standings.constructors': 'Constructors',
    'standings.pos': '#',
    'standings.entrant': 'Driver / Team',
    'standings.points': 'Pts',
    'standings.wins': 'Wins',
    'standings.show': 'Show standings',
    'standings.hide': 'Hide standings',
    'standings.error': 'Could not load standings.',

    'title.clinched': '{name} has clinched the title.',
    'title.canClinch': '{name} can clinch the title this round.',
    'title.contenders': '{n} drivers still in title contention.',
    'title.leader': '{name} leads by {gap} pts',

    'last.title': 'Last race result',
    'last.show': 'Show last result',
    'last.hide': 'Hide last result',
    'last.pole': 'Pole',
    'last.fastest': 'Fastest lap',
    'last.dnf': 'DNF',
    'last.error': 'Could not load last result.',

    'circuit.length': 'Length',
    'circuit.laps': 'Laps',
    'circuit.record': 'Lap record',
    'circuit.first': 'First GP',
    'circuit.winners': 'Recent winners here',
    'circuit.loadWinners': 'Show recent winners',
    'circuit.winnersError': 'Could not load winners.',

    'weather.label': 'Weather',
    'weather.rain': '{p}% rain',
    'weather.loading': 'Loading forecast…',
    'weather.unavailable': 'Forecast unavailable',

    'cal.addRace': 'Add race to calendar',
    'cal.addWeekend': 'Add full weekend',
    'cal.gcal': 'Add to Google Calendar',
    'cal.ics': 'Download .ics',
    'cal.copyTimes': 'Copy times',
    'cal.copied': 'Copied to clipboard',
    'cal.shareLink': 'Copy link to this round',
    'cal.linkCopied': 'Link copied',

    'reminder.label': 'Default reminder',
    'reminder.none': 'None',
    'reminder.atStart': 'At start',
    'reminder.10m': '10 min before',
    'reminder.1h': '1 h before',
    'reminder.1d': '1 day before',
    'reminder.remindRace': 'Remind me (race)',
    'reminder.scheduled': 'Reminder set for {when}',
    'reminder.denied': 'Notifications are blocked in your browser.',
    'reminder.tabNote': 'Reminder works while this tab stays open.',

    'live.title': 'Live timing',
    'live.leaderboard': 'Leaderboard',
    'live.unavailable': 'Live timing unavailable right now.',
    'live.flag': 'Track status',
    'live.weather': 'Track weather',
    'live.radio': 'Team radio',
    'live.air': 'Air',
    'live.track': 'Track',

    'settings.title': 'Settings',
    'settings.close': 'Close',
    'settings.theme': 'Theme',
    'settings.themeLight': 'Light',
    'settings.themeDark': 'Dark',
    'settings.defaultView': 'Default view',

    'status.loading': 'Loading season schedule…',
    'status.error': 'Could not load schedule: {msg}',
    'status.empty': 'No upcoming F1 events. The season is over!',
    'status.noFilter': 'No rounds match your search.',
    'status.offline': 'Offline — showing cached data',
    'status.updated': 'Updated {when}',

    'update.available': 'A new version is available.',
    'update.reload': 'Reload',

    'ios.note': 'iOS users: tap Add to Google Calendar. .ics downloads are not reliable on iOS Safari.',
  },

  fr: {
    'app.tagline': 'Chaque séance de F1, à votre heure.',
    'nav.settings': 'Réglages',
    'nav.language': 'Langue',
    'a11y.skip': 'Aller au calendrier',
    'theme.toDark': 'Passer au thème sombre',
    'theme.toLight': 'Passer au thème clair',

    'picker.country': 'Pays',
    'picker.timeFormat': 'Format horaire',
    'picker.timezone': 'Fuseau horaire',
    'picker.season': 'Saison',
    'picker.search': 'Rechercher',
    'picker.searchPlaceholder': 'Rechercher un Grand Prix, circuit ou pays…',
    'picker.countrySearch': 'Rechercher un pays…',
    'picker.noMatches': 'Aucun résultat.',
    'picker.hint': 'Heures affichées dans votre fuseau : {zone}',

    'format.24h': '24 h',
    'format.12h': '12 h',

    'view.label': 'Afficher',
    'view.all': 'Toutes les séances',
    'view.race': 'Course seule',
    'favorites.only': 'Favoris uniquement',
    'favorites.add': 'Ajouter aux favoris',
    'favorites.remove': 'Retirer des favoris',

    'hero.next': 'Prochaine séance',
    'hero.none': 'Aucune séance à venir — la saison est terminée.',
    'hero.liveNow': 'EN DIRECT',
    'hero.starts': 'commence dans',
    'hero.live': 'DIRECT',

    'round.label': 'Manche {n}',
    'round.of': 'Manche {n} sur {total}',
    'progress.season': 'Progression de la saison',

    'session.fp1': 'Essais libres 1',
    'session.fp2': 'Essais libres 2',
    'session.fp3': 'Essais libres 3',
    'session.sprintQ': 'Qualifs Sprint',
    'session.sprint': 'Sprint',
    'session.qualifying': 'Qualifications',
    'session.race': 'Course',

    'table.session': 'Séance',
    'table.circuit': 'Heure du circuit',
    'table.you': 'Votre heure',
    'card.circuit': 'Circuit',
    'card.you': 'Vous',

    'map.soon': 'Plan bientôt disponible',

    'standings.title': 'Classement du championnat',
    'standings.drivers': 'Pilotes',
    'standings.constructors': 'Constructeurs',
    'standings.pos': '#',
    'standings.entrant': 'Pilote / Écurie',
    'standings.points': 'Pts',
    'standings.wins': 'Victoires',
    'standings.show': 'Afficher le classement',
    'standings.hide': 'Masquer le classement',
    'standings.error': 'Impossible de charger le classement.',

    'title.clinched': '{name} est sacré champion.',
    'title.canClinch': '{name} peut être sacré dès cette manche.',
    'title.contenders': '{n} pilotes encore en lice pour le titre.',
    'title.leader': '{name} mène de {gap} pts',

    'last.title': 'Résultat de la dernière course',
    'last.show': 'Afficher le dernier résultat',
    'last.hide': 'Masquer le dernier résultat',
    'last.pole': 'Pole',
    'last.fastest': 'Meilleur tour',
    'last.dnf': 'Abandon',
    'last.error': 'Impossible de charger le dernier résultat.',

    'circuit.length': 'Longueur',
    'circuit.laps': 'Tours',
    'circuit.record': 'Record du tour',
    'circuit.first': '1er GP',
    'circuit.winners': 'Vainqueurs récents ici',
    'circuit.loadWinners': 'Voir les vainqueurs récents',
    'circuit.winnersError': 'Impossible de charger les vainqueurs.',

    'weather.label': 'Météo',
    'weather.rain': '{p} % pluie',
    'weather.loading': 'Chargement des prévisions…',
    'weather.unavailable': 'Prévisions indisponibles',

    'cal.addRace': 'Ajouter la course au calendrier',
    'cal.addWeekend': 'Ajouter tout le week-end',
    'cal.gcal': 'Ajouter à Google Agenda',
    'cal.ics': 'Télécharger le .ics',
    'cal.copyTimes': 'Copier les horaires',
    'cal.copied': 'Copié dans le presse-papiers',
    'cal.shareLink': 'Copier le lien de cette manche',
    'cal.linkCopied': 'Lien copié',

    'reminder.label': 'Rappel par défaut',
    'reminder.none': 'Aucun',
    'reminder.atStart': 'Au début',
    'reminder.10m': '10 min avant',
    'reminder.1h': '1 h avant',
    'reminder.1d': '1 jour avant',
    'reminder.remindRace': 'Me rappeler (course)',
    'reminder.scheduled': 'Rappel programmé pour {when}',
    'reminder.denied': 'Les notifications sont bloquées dans votre navigateur.',
    'reminder.tabNote': 'Le rappel fonctionne tant que cet onglet reste ouvert.',

    'live.title': 'Chronométrage en direct',
    'live.leaderboard': 'Classement',
    'live.unavailable': 'Chronométrage en direct indisponible pour le moment.',
    'live.flag': 'État de la piste',
    'live.weather': 'Météo de piste',
    'live.radio': 'Radio équipe',
    'live.air': 'Air',
    'live.track': 'Piste',

    'settings.title': 'Réglages',
    'settings.close': 'Fermer',
    'settings.theme': 'Thème',
    'settings.themeLight': 'Clair',
    'settings.themeDark': 'Sombre',
    'settings.defaultView': 'Vue par défaut',

    'status.loading': 'Chargement du calendrier de la saison…',
    'status.error': 'Impossible de charger le calendrier : {msg}',
    'status.empty': 'Aucun événement F1 à venir. La saison est terminée !',
    'status.noFilter': 'Aucune manche ne correspond à votre recherche.',
    'status.offline': 'Hors ligne — données en cache',
    'status.updated': 'Mis à jour {when}',

    'update.available': 'Une nouvelle version est disponible.',
    'update.reload': 'Recharger',

    'ios.note': 'Sur iOS : utilisez « Ajouter à Google Agenda ». Les téléchargements .ics ne sont pas fiables sur Safari iOS.',
  },
};

function detectLang() {
  let stored = null;
  try { stored = localStorage.getItem(STORAGE_KEY); } catch {}
  if (stored && SUPPORTED.includes(stored)) return stored;
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return SUPPORTED.includes(nav) ? nav : 'en';
}

let lang = detectLang();
const listeners = new Set();

export function getLang() { return lang; }

// Some environments report locale tags Intl rejects (e.g. "en-US@posix").
// Sanitise (drop @modifiers, normalise separators) and validate before use.
function safeLocale(tag) {
  if (!tag) return null;
  const cleaned = String(tag).replace(/@.*$/, '').replace(/_/g, '-').trim();
  if (!cleaned) return null;
  try { new Intl.DateTimeFormat(cleaned); return cleaned; } catch { return null; }
}

export function getLocale() {
  if (lang === 'fr') return 'fr-FR';
  return safeLocale(navigator.language) || 'en-GB';
}

export function setLang(next) {
  if (!SUPPORTED.includes(next) || next === lang) return;
  lang = next;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
  document.documentElement.setAttribute('lang', lang);
  applyTranslations();
  for (const fn of listeners) fn(lang);
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function t(key, vars) {
  const table = STRINGS[lang] || STRINGS.en;
  let s = table[key] != null ? table[key] : (STRINGS.en[key] != null ? STRINGS.en[key] : key);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

// Localise default 12h/24h from the active locale's hour cycle.
export function prefers12h() {
  try {
    const parts = new Intl.DateTimeFormat(getLocale(), { hour: 'numeric' }).formatToParts(new Date());
    return parts.some(p => p.type === 'dayPeriod');
  } catch { return false; }
}

export function applyTranslations(root = document) {
  document.documentElement.setAttribute('lang', lang);
  root.querySelectorAll('[data-i18n]').forEach(elm => {
    elm.textContent = t(elm.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-attr]').forEach(elm => {
    for (const pair of elm.getAttribute('data-i18n-attr').split(';')) {
      const [attr, key] = pair.split(':').map(s => s.trim());
      if (attr && key) elm.setAttribute(attr, t(key));
    }
  });
}
