import type { FixtureSummary } from './types';

const sheffieldTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  month: '2-digit',
  timeZone: 'Europe/London',
  year: 'numeric',
});
const textEncoder = new TextEncoder();

function escapeCalendarText(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

function foldCalendarLine(value: string): string {
  let folded = '';
  let lineLength = 0;

  for (const character of value) {
    const characterLength = textEncoder.encode(character).length;
    if (lineLength + characterLength > 75) {
      folded += '\r\n ';
      lineLength = 1;
    }
    folded += character;
    lineLength += characterLength;
  }

  return folded;
}

function formatUtcDateTime(value: Date): string {
  return value
    .toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function sheffieldTimeToUtc(date: string, time: string): Date {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const hour = Number(time.slice(0, 2));
  const minute = Number(time.slice(3, 5));
  const assumedUtc = Date.UTC(year, month - 1, day, hour, minute);
  const parts = Object.fromEntries(
    sheffieldTimeFormatter
      .formatToParts(new Date(assumedUtc))
      .map((part) => [part.type, part.value]),
  );
  const formattedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  );

  return new Date(assumedUtc - (formattedAsUtc - assumedUtc));
}

export function buildFixtureCalendarEvent(
  fixture: FixtureSummary,
  generatedAt = new Date(),
): string {
  const date = fixture.scheduledDate.slice(0, 10);
  const calendarDate = date.replaceAll('-', '');
  const competition = fixture.competition === 'LEAGUE' ? 'League' : 'Cup';
  const description = `${competition} fixture · ${fixture.season.name}${fixture.scheduledTime ? '' : '\nKick-off time to be confirmed'}`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//24 Hour Party People//Fixtures//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:fixture-${fixture.id}@24-hour-party-people.vercel.app`,
    `DTSTAMP:${formatUtcDateTime(generatedAt)}`,
  ];

  if (fixture.scheduledTime) {
    const time = fixture.scheduledTime.slice(11, 16);
    const start = sheffieldTimeToUtc(date, time);
    lines.push(`DTSTART:${formatUtcDateTime(start)}`);
    lines.push(
      `DTEND:${formatUtcDateTime(new Date(start.getTime() + 60 * 60 * 1000))}`,
    );
  } else {
    const nextDate = new Date(`${date}T00:00:00.000Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    lines.push(`DTSTART;VALUE=DATE:${calendarDate}`);
    lines.push(
      `DTEND;VALUE=DATE:${nextDate.toISOString().slice(0, 10).replaceAll('-', '')}`,
    );
  }

  lines.push(
    `SUMMARY:${escapeCalendarText(`24 Hour Party People v ${fixture.opponentClub.name}`)}`,
    `DESCRIPTION:${escapeCalendarText(description)}`,
  );
  if (fixture.venue) {
    lines.push(`LOCATION:${escapeCalendarText(fixture.venue)}`);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');

  return `${lines.map(foldCalendarLine).join('\r\n')}\r\n`;
}

export function downloadFixtureCalendarEvent(fixture: FixtureSummary): void {
  const calendar = buildFixtureCalendarEvent(fixture);
  const blob = new Blob([calendar], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `24-hour-party-people-${fixture.scheduledDate.slice(0, 10)}-${fixture.id}.ics`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
