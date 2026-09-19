import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { LifeEvent } from '../db'
import { todayStr } from './format'

export function nextOccurrence(ev: LifeEvent, today = todayStr()) {
  if (!ev.yearly) {
    return { date: ev.date, days: differenceInCalendarDays(parseISO(ev.date), parseISO(today)), years: null as number | null }
  }
  const [y, m, d] = ev.date.split('-').map(Number)
  const ty = Number(today.slice(0, 4))
  let next = format(new Date(ty, m - 1, d), 'yyyy-MM-dd')
  if (next < today) next = format(new Date(ty + 1, m - 1, d), 'yyyy-MM-dd')
  return { date: next, days: differenceInCalendarDays(parseISO(next), parseISO(today)), years: Number(next.slice(0, 4)) - y }
}
