import { addMonths, subMonths } from 'date-fns'
import { db, type ExtEvent } from '../db'
import { setSetting } from './settings'
import { isNative } from './native'
import { parseIcs } from './ics'

async function plugin() {
  return import('@ebarooni/capacitor-calendar')
}

/** Is read access to the phone calendar already granted? (Android app only) */
export async function calendarCheck(): Promise<boolean> {
  if (!isNative) return false
  try {
    const { CapacitorCalendar, CalendarPermissionScope } = await plugin()
    const r = await CapacitorCalendar.checkPermission({ scope: CalendarPermissionScope.READ_CALENDAR })
    return r.result === 'granted'
  } catch {
    return false
  }
}

export async function calendarRequest(): Promise<boolean> {
  const { CapacitorCalendar } = await plugin()
  const r = await CapacitorCalendar.requestReadOnlyCalendarAccess()
  const ok = r.result === 'granted'
  await setSetting('calendarConnected', ok)
  return ok
}

/** Pull events from the phone calendar (Samsung Calendar, Google Calendar, ...) for -6..+12 months. */
export async function syncDeviceCalendar(): Promise<number> {
  const { CapacitorCalendar } = await plugin()
  const from = subMonths(new Date(), 6).getTime()
  const to = addMonths(new Date(), 12).getTime()
  const { result } = await CapacitorCalendar.listEventsInRange({ from, to })
  const names = new Map<string, string>()
  try {
    const { result: cals } = await CapacitorCalendar.listCalendars()
    for (const c of cals) if (c.title) names.set(c.id, c.title)
  } catch {
    /* names are optional */
  }
  const rows = result.map((e) => ({
    externalId: e.id,
    title: e.title || 'Без названия',
    start: e.startDate,
    end: e.endDate,
    allDay: (e.isAllDay ? 1 : 0) as 0 | 1,
    calendar: e.calendarId ? names.get(e.calendarId) : undefined,
    location: e.location ?? undefined,
    source: 'device' as const,
  }))
  await db.transaction('rw', db.calendarEvents, async () => {
    await db.calendarEvents.where('source').equals('device').delete()
    await db.calendarEvents.bulkAdd(rows as ExtEvent[])
  })
  await setSetting('calendarLastSync', Date.now())
  return rows.length
}

/** Import an .ics export (Google Calendar, Samsung Calendar share, Outlook). Existing UIDs are updated. */
export async function importIcsFile(file: File): Promise<number> {
  const rows = parseIcs(await file.text())
  await db.transaction('rw', db.calendarEvents, async () => {
    for (const r of rows) {
      const ex = await db.calendarEvents.where('externalId').equals(r.externalId).first()
      if (ex) await db.calendarEvents.update(ex.id, r)
      else await db.calendarEvents.add(r as ExtEvent)
    }
  })
  return rows.length
}

export async function clearImportedIcs() {
  await db.calendarEvents.where('source').equals('ics').delete()
}
