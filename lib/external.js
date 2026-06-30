// Deep-link builders for external services. All key-less, all just URLs —
// nothing is fetched here, so there is no CORS or privacy surface.

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// --- Maps ---
export function osmMapUrl(lat, lon) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=14/${lat}/${lon}`;
}
export function directionsUrl(lat, lon) {
  // Universal Google Maps directions link (opens the native app where available).
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

// --- Media / community ---
export function youtubeSearchUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}
export function redditSearchUrl(query) {
  return `https://www.reddit.com/r/formula1/search/?q=${encodeURIComponent(query)}&restrict_sr=1&sort=new`;
}

// --- Travel (race-weekend trip planning) ---
export function flightsUrl(city) {
  return `https://www.google.com/travel/flights?q=${encodeURIComponent('Flights to ' + city)}`;
}
export function bookingUrl(city, checkin, checkout) {
  let u = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(city)}`;
  if (checkin) u += `&checkin=${ymd(checkin)}`;
  if (checkout) u += `&checkout=${ymd(checkout)}`;
  return u;
}
export function airbnbUrl(city, checkin, checkout) {
  let u = `https://www.airbnb.com/s/${encodeURIComponent(city)}/homes`;
  if (checkin) u += `?checkin=${ymd(checkin)}`;
  if (checkout) u += `${checkin ? '&' : '?'}checkout=${ymd(checkout)}`;
  return u;
}

// --- Calendar (in addition to Google + .ics) ---
export function outlookUrl({ start, end, summary, location, description }) {
  const p = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: summary,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
  });
  if (location) p.set('location', location);
  if (description) p.set('body', description);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p.toString()}`;
}

// Subscribable feed URLs for the CI-generated season.ics, derived from the
// page's own location so they work wherever the site is hosted.
function feedBase() {
  const dir = location.href.replace(/[^/]*([?#].*)?$/, '');
  return dir + 'season.ics';
}
export function webcalUrl() {
  return feedBase().replace(/^https?:/, 'webcal:');
}
export function icsFeedUrl() {
  return feedBase();
}
