import type { ExtEvent } from '../db'

function unfold(text: string) {
  return text.replace(/\r?\n[ \t]/g, '')
}

function parseIcsDate(v: string, params: string): { t: number; allDay: boolean } | null {
  const s = v.trim()
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(s)
  if (m || /VALUE=DATE(?!-TIME)/.test(params)) {
    m = m ?? /^(\d{4})(\d{2})(\d{2})/.exec(s)
    if (!m) return null
    return { t: new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime(), allDay: true }
  }
  m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(s)
  if (!m) return null
  const [, y, mo, d, h, mi, se, z] = m
  const t = z ? Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se ?? 0)) : new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se ?? 0)).getTime()
  return { t, allDay: false }
}

/** Minimal .ics parser: VEVENT with SUMMARY/DTSTART/DTEND/UID/LOCATION. Yearly RRULEs are expanded for ±5 years. */
export function parseIcs(text: string): Omit<ExtEvent, 'id'>[] {
  const lines = unfold(text).split(/\r?\n/)
  const out: Omit<ExtEvent, 'id'>[] = []
  let cur: Record<string, { v: string; p: string }> | null = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {}
    else if (line === 'END:VEVENT' && cur) {
      const start = cur.DTSTART ? parseIcsDate(cur.DTSTART.v, cur.DTSTART.p) : null
      if (start && cur.SUMMARY) {
        const end = cur.DTEND ? parseIcsDate(cur.DTEND.v, cur.DTEND.p) : null
        const dur = end ? Math.max(0, end.t - start.t) : start.allDay ? 86400000 : 3600000
        const uid = cur.UID?.v ?? `${cur.SUMMARY.v}-${start.t}`
        const base = { title: cur.SUMMARY.v.replace(/\\,/g, ',').replace(/\\n/g, ' '), allDay: (start.allDay ? 1 : 0) as 0 | 1, location: cur.LOCATION?.v, calendar: 'ICS', source: 'ics' as const }
        const yearly = /FREQ=YEARLY/.test(cur.RRULE?.v ?? '')
        if (yearly) {
          const d = new Date(start.t)
          const y0 = new Date().getFullYear()
          for (let y = y0 - 1; y <= y0 + 5; y++) {
            const s = new Date(d)
            s.setFullYear(y)
            out.push({ ...base, externalId: `${uid}@${y}`, start: s.getTime(), end: s.getTime() + dur })
          }
        } else out.push({ ...base, externalId: uid, start: start.t, end: start.t + dur })
      }
      cur = null
    } else if (cur) {
      const i = line.indexOf(':')
      if (i < 0) continue
      const head = line.slice(0, i)
      const [name, ...params] = head.split(';')
      cur[name] = { v: line.slice(i + 1), p: params.join(';') }
    }
  }
  return out
}
