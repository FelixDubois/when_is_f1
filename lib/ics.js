// RFC 5545-compliant .ics builder. Lines join with CRLF.

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

function escapeText(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

const enc = new TextEncoder();

function fold(line) {
  // RFC 5545 §3.1: lines SHOULD NOT exceed 75 octets (not characters).
  // Fold without splitting a UTF-8 codepoint or surrogate pair.
  if (enc.encode(line).length <= 75) return line;
  const segments = [];
  let buf = '';
  let bufBytes = 0;
  for (const ch of line) {                 // iterates by codepoint
    const chBytes = enc.encode(ch).length;
    const limit = segments.length === 0 ? 75 : 74; // continuations have a leading space
    if (bufBytes + chBytes > limit) {
      segments.push(buf);
      buf = ch;
      bufBytes = chBytes;
    } else {
      buf += ch;
      bufBytes += chBytes;
    }
  }
  if (buf) segments.push(buf);
  return segments.map((s, i) => (i === 0 ? s : ' ' + s)).join('\r\n');
}

// Minutes-before -> RFC 5545 TRIGGER duration. 1440 -> -P1D, else -PT{m}M.
function alarmTrigger(min) {
  if (min <= 0) return '-PT0M';
  if (min % 1440 === 0) return `-P${min / 1440}D`;
  if (min % 60 === 0) return `-PT${min / 60}H`;
  return `-PT${min}M`;
}

/**
 * @param {Array<{uid, start, end, summary, location, description, alarmMinutes?}>} events
 * @returns {string} .ics body
 */
export function buildIcs(events) {
  const dtstamp = formatUTC(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//when-is-f1//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  for (const evt of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${evt.uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART:${formatUTC(evt.start)}`);
    lines.push(`DTEND:${formatUTC(evt.end)}`);
    lines.push(fold(`SUMMARY:${escapeText(evt.summary)}`));
    if (evt.location) lines.push(fold(`LOCATION:${escapeText(evt.location)}`));
    if (evt.description) lines.push(fold(`DESCRIPTION:${escapeText(evt.description)}`));
    if (evt.alarmMinutes != null && evt.alarmMinutes >= 0) {
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push(fold(`DESCRIPTION:${escapeText(evt.summary)}`));
      lines.push(`TRIGGER:${alarmTrigger(evt.alarmMinutes)}`);
      lines.push('END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export function downloadIcs(events, filename = 'event.ics') {
  const body = buildIcs(events);
  const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
