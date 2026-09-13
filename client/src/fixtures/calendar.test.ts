import { describe, expect, it, vi } from 'vitest';

import {
  buildFixtureCalendarEvent,
  downloadFixtureCalendarEvent,
} from './calendar';
import type { FixtureSummary } from './types';

const fixture: FixtureSummary = {
  competition: 'LEAGUE',
  id: 'fixture-id',
  opponentClub: { id: 'opponent-id', name: 'Norton Rivals' },
  result: null,
  scheduledDate: '2026-09-15T00:00:00.000Z',
  scheduledTime: '1970-01-01T20:15:00.000Z',
  season: { id: 'season-id', name: 'Summer 2026' },
  source: 'MANUAL',
  status: 'SCHEDULED',
  venue: 'Norton Playing Fields 3G',
};

describe('fixture calendar events', () => {
  it('exports a timed fixture in UTC using British Summer Time', () => {
    const calendar = buildFixtureCalendarEvent(
      fixture,
      new Date('2026-09-13T12:00:00.000Z'),
    );

    expect(calendar).toContain('BEGIN:VCALENDAR\r\n');
    expect(calendar).toContain(
      'UID:fixture-fixture-id@24-hour-party-people.vercel.app\r\n',
    );
    expect(calendar).toContain('DTSTAMP:20260913T120000Z\r\n');
    expect(calendar).toContain('DTSTART:20260915T191500Z\r\n');
    expect(calendar).toContain('DTEND:20260915T201500Z\r\n');
    expect(calendar).toContain(
      'SUMMARY:24 Hour Party People v Norton Rivals\r\n',
    );
    expect(calendar).toContain('DESCRIPTION:League fixture · Summer 2026\r\n');
    expect(calendar).toContain('LOCATION:Norton Playing Fields 3G\r\n');
    expect(calendar).toMatch(/END:VEVENT\r\nEND:VCALENDAR\r\n$/);
  });

  it('uses Greenwich Mean Time for winter fixtures', () => {
    const calendar = buildFixtureCalendarEvent({
      ...fixture,
      scheduledDate: '2027-01-12T00:00:00.000Z',
      scheduledTime: '1970-01-01T20:15:00.000Z',
    });

    expect(calendar).toContain('DTSTART:20270112T201500Z\r\n');
    expect(calendar).toContain('DTEND:20270112T211500Z\r\n');
  });

  it('respects the British Summer Time change on fixture dates', () => {
    const afterSpringChange = buildFixtureCalendarEvent({
      ...fixture,
      scheduledDate: '2026-03-29T00:00:00.000Z',
    });
    const afterAutumnChange = buildFixtureCalendarEvent({
      ...fixture,
      scheduledDate: '2026-10-25T00:00:00.000Z',
    });

    expect(afterSpringChange).toContain('DTSTART:20260329T191500Z\r\n');
    expect(afterAutumnChange).toContain('DTSTART:20261025T201500Z\r\n');
  });

  it('exports unknown kick-off times as all-day events with exclusive end dates', () => {
    const calendar = buildFixtureCalendarEvent({
      ...fixture,
      scheduledDate: '2026-12-31T00:00:00.000Z',
      scheduledTime: null,
      venue: null,
    });

    expect(calendar).toContain('DTSTART;VALUE=DATE:20261231\r\n');
    expect(calendar).toContain('DTEND;VALUE=DATE:20270101\r\n');
    expect(calendar).toContain('Kick-off time to be confirmed\r\n');
    expect(calendar).not.toContain('LOCATION:');
  });

  it('escapes user-entered text and folds long UTF-8 lines', () => {
    const calendar = buildFixtureCalendarEvent({
      ...fixture,
      opponentClub: {
        id: 'opponent-id',
        name: `Rivals, United; East\\West\n${'é'.repeat(50)}`,
      },
      venue: 'Pitch 1, Norton; Sheffield',
    });

    expect(calendar).toContain('Rivals\\, United\\; East\\\\West\\n');
    expect(calendar).toContain('LOCATION:Pitch 1\\, Norton\\; Sheffield');
    expect(
      calendar
        .split('\r\n')
        .every((line) => new TextEncoder().encode(line).length <= 75),
    ).toBe(true);
  });

  it('downloads an .ics file and releases its object URL', () => {
    const createObjectURL = vi.fn(() => 'blob:fixture-calendar');
    const revokeObjectURL = vi.fn();
    const clickedLink = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clickedLink(this.href, this.download);
    });
    vi.useFakeTimers();

    try {
      downloadFixtureCalendarEvent(fixture);

      expect(createObjectURL).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'text/calendar;charset=utf-8' }),
      );
      expect(clickedLink).toHaveBeenCalledWith(
        'blob:fixture-calendar',
        '24-hour-party-people-2026-09-15-fixture-id.ics',
      );
      expect(document.querySelector('a[download]')).toBeNull();
      expect(revokeObjectURL).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:fixture-calendar');
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });
});
