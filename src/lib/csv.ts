import { format } from 'date-fns'

export interface StepRow {
  date: string
  steps: number
}

function parseDate(raw: string): string | null {
  const s = raw.trim().replace(/^"|"$/g, '')
  if (!s) return null
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = /^(\d{2})[./](\d{2})[./](\d{4})/.exec(s)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s)
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  if (/^\d{13}$/.test(s)) return format(new Date(Number(s)), 'yyyy-MM-dd')
  if (/^\d{10}$/.test(s)) return format(new Date(Number(s) * 1000), 'yyyy-MM-dd')
  const d = new Date(s)
  if (!Number.isNaN(d.getTime()) && /\d{4}/.test(s)) return format(d, 'yyyy-MM-dd')
  return null
}

function splitLine(line: string, delim: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (const ch of line) {
    if (ch === '"') q = !q
    else if (ch === delim && !q) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((x) => x.trim())
}

/**
 * Parse a steps export (Google Fit "Daily activity metrics", Samsung Health
 * step_daily_trend, Mi Fitness, or any CSV with a date column and a steps column).
 */
export function parseStepsCsv(text: string): StepRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length)
  if (!lines.length) return []
  const delim = [',', ';', '\t'].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0]
  // find header row (contains "step")
  let hi = lines.findIndex((l) => /step|шаг|qadam/i.test(l))
  if (hi < 0) hi = 0
  const header = splitLine(lines[hi], delim).map((h) => h.toLowerCase())
  let stepCol = header.findIndex((h) => /^(step count|steps?|шаги|count)$/i.test(h))
  if (stepCol < 0) stepCol = header.findIndex((h) => /step_daily_trend\.count|step.*count|steps|шаг/i.test(h))
  let dateCol = header.findIndex((h) => /^(date|дата|day|день|day_time|start_time|time)$/i.test(h))
  if (dateCol < 0) dateCol = header.findIndex((h) => /date|дата|day_time|start_time|time|день/i.test(h))
  if (stepCol < 0) return []
  const byDate = new Map<string, number>()
  for (let i = hi + 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delim)
    const stepsRaw = cells[stepCol]
    const steps = Number(String(stepsRaw ?? '').replace(/[^\d.]/g, ''))
    if (!Number.isFinite(steps) || steps <= 0) continue
    let date: string | null = null
    if (dateCol >= 0) date = parseDate(cells[dateCol] ?? '')
    if (!date) {
      for (const c of cells) {
        date = parseDate(c)
        if (date) break
      }
    }
    if (!date) continue
    // several sources per day (Samsung): keep the max, not the sum
    byDate.set(date, Math.max(byDate.get(date) ?? 0, Math.round(steps)))
  }
  return [...byDate.entries()].map(([date, steps]) => ({ date, steps })).sort((a, b) => a.date.localeCompare(b.date))
}
