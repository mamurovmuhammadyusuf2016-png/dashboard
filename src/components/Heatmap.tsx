import { useEffect, useRef } from 'react'
import { addDays, format, getDay, parseISO, startOfWeek, subWeeks } from 'date-fns'
import { ru } from 'date-fns/locale'
import { MOOD, SEQ } from '../lib/palette'
import { useTheme } from '../lib/theme'

/** GitHub-style heatmap. `values` maps YYYY-MM-DD -> 0..1 */
export function YearHeatmap({ values, weeks = 53, endDate = new Date(), title }: { values: Map<string, number>; weeks?: number; endDate?: Date; title?: (date: string, v: number | undefined) => string }) {
  const t = useTheme()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth
  }, [values])
  const start = startOfWeek(subWeeks(endDate, weeks - 1), { weekStartsOn: 1 })
  const cols: string[][] = []
  for (let w = 0; w < weeks; w++) {
    const col: string[] = []
    for (let d = 0; d < 7; d++) col.push(format(addDays(start, w * 7 + d), 'yyyy-MM-dd'))
    cols.push(col)
  }
  const ramp = SEQ[t]
  const end = format(endDate, 'yyyy-MM-dd')
  const monthLabels: { idx: number; label: string }[] = []
  cols.forEach((col, i) => {
    const d = parseISO(col[0])
    if (d.getDate() <= 7) monthLabels.push({ idx: i, label: format(d, 'LLL', { locale: ru }) })
  })
  return (
    <div ref={ref} className="no-scrollbar overflow-x-auto">
      <div className="inline-block">
        <div className="relative mb-1 h-4 text-[10px] text-muted">
          {monthLabels.map((m) => (
            <span key={m.idx} className="absolute" style={{ left: m.idx * 13 }}>
              {m.label}
            </span>
          ))}
        </div>
        <div className="flex gap-[3px]">
          {cols.map((col, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {col.map((date) => {
                const v = values.get(date)
                const future = date > end
                let bg = 'var(--surface-2)'
                if (!future && v !== undefined && v > 0) bg = ramp[Math.min(ramp.length - 1, Math.max(0, Math.ceil(v * (ramp.length - 1))))]
                return <div key={date} title={title ? title(date, v) : `${date}: ${v === undefined ? '—' : Math.round(v * 100) + '%'}`} className="h-[10px] w-[10px] rounded-[2px]" style={{ background: bg, opacity: future ? 0.3 : 1 }} />
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** "Year in pixels": 12 rows x 31 columns colored by mood 1..5 */
export function YearPixels({ year, scores, onPick }: { year: number; scores: Map<string, number>; onPick?: (date: string) => void }) {
  const t = useTheme()
  const ramp = MOOD[t]
  const today = format(new Date(), 'yyyy-MM-dd')
  return (
    <div className="no-scrollbar overflow-x-auto">
      <div className="inline-block">
        <div className="mb-1 flex gap-[3px] pl-8 text-[9px] text-muted">
          {Array.from({ length: 31 }, (_, i) => (
            <span key={i} className="w-[11px] text-center">
              {(i + 1) % 5 === 0 ? i + 1 : ''}
            </span>
          ))}
        </div>
        {Array.from({ length: 12 }, (_, m) => (
          <div key={m} className="flex items-center gap-[3px]">
            <span className="w-8 shrink-0 text-[10px] text-muted">{format(new Date(year, m, 1), 'LLL', { locale: ru })}</span>
            {Array.from({ length: 31 }, (_, d) => {
              const dt = new Date(year, m, d + 1)
              const valid = dt.getMonth() === m
              const key = format(dt, 'yyyy-MM-dd')
              const s = valid ? scores.get(key) : undefined
              const future = key > today
              return (
                <button
                  key={d}
                  type="button"
                  disabled={!valid || future}
                  onClick={() => onPick?.(key)}
                  title={valid ? `${key}${s ? ': ' + s + '/5' : ''}` : ''}
                  className="h-[11px] w-[11px] rounded-[2px] disabled:cursor-default"
                  style={{ background: !valid ? 'transparent' : s ? ramp[s - 1] : 'var(--surface-2)', opacity: future ? 0.3 : 1 }}
                />
              )
            })}
          </div>
        ))}
        <div className="mt-2 flex items-center gap-2 pl-8 text-[10px] text-muted">
          <span>Плохо</span>
          {ramp.map((c) => (
            <span key={c} className="h-[10px] w-[10px] rounded-[2px]" style={{ background: c }} />
          ))}
          <span>Отлично</span>
        </div>
      </div>
    </div>
  )
}

export function weekdayIndex(date: string) {
  return (getDay(parseISO(date)) + 6) % 7
}
