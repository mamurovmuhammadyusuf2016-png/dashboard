import { format, parseISO, subDays } from 'date-fns'

const prev = (d: string) => format(subDays(parseISO(d), 1), 'yyyy-MM-dd')

/** Consecutive days (ending today or yesterday) present in `dates`. */
export function streak(dates: Set<string>, today: string): number {
  let d = today
  if (!dates.has(d)) d = prev(d)
  if (!dates.has(d)) return 0
  let n = 0
  while (dates.has(d)) {
    n++
    d = prev(d)
  }
  return n
}

export function bestStreak(dates: Set<string>): number {
  let best = 0
  for (const d of dates) {
    if (dates.has(prev(d))) continue
    let n = 0
    let cur = d
    while (dates.has(cur)) {
      n++
      cur = format(new Date(parseISO(cur).getTime() + 86400000), 'yyyy-MM-dd')
    }
    best = Math.max(best, n)
  }
  return best
}
