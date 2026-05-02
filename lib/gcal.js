function pad(n) { return String(n).padStart(2, '0'); }

function formatUTC(date) {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) + 'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) + 'Z'
  );
}

/**
 * Build a Google Calendar "Add Event" URL.
 * UTC dates with `Z` suffix — do NOT pass ctz.
 */
export function gcalUrl({ start, end, summary, location, description }) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: summary,
    dates: `${formatUTC(start)}/${formatUTC(end)}`,
  });
  if (description) params.set('details', description);
  if (location) params.set('location', location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
