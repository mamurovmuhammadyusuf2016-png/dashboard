import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { fmtDate, todayStr } from '../lib/format'
import { MOOD } from '../lib/palette'
import { useTheme } from '../lib/theme'
import { Button, Card, Modal, PageHeader, Stat, Textarea, cx } from '../components/ui'
import { YearPixels } from '../components/Heatmap'

const MOODS = ['😞', '😕', '😐', '🙂', '😄']
const LABELS = ['Плохо', 'Так себе', 'Нормально', 'Хорошо', 'Отлично']

export default function Mood() {
  const t = useTheme()
  const today = todayStr()
  const year = Number(today.slice(0, 4))
  const [pick, setPick] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const moods = useLiveQuery(() => db.moods.where('date').between(`${year}-01-01`, `${year}-12-31`, true, true).toArray(), [year]) ?? []
  const scores = useMemo(() => new Map(moods.map((m) => [m.date, m.score])), [moods])
  const todayMood = scores.get(today)
  const month = today.slice(0, 7)
  const monthMoods = moods.filter((m) => m.date.startsWith(month))
  const avg = monthMoods.length ? monthMoods.reduce((a, m) => a + m.score, 0) / monthMoods.length : 0
  const dist = [1, 2, 3, 4, 5].map((s) => moods.filter((m) => m.score === s).length)
  const maxDist = Math.max(1, ...dist)
  const picked = pick ? moods.find((m) => m.date === pick) : undefined

  async function set(date: string, score: number, n?: string) {
    const ex = await db.moods.get(date)
    await db.moods.put({ date, score, note: n ?? ex?.note ?? '' })
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Настроение" subtitle="Оценка дня и «год в пикселях»" />
      <Card title="Сегодня">
        <div className="flex justify-between">
          {MOODS.map((m, i) => (
            <button key={i} type="button" onClick={() => set(today, i + 1)} className={cx('flex h-14 w-14 flex-col items-center justify-center rounded-2xl text-2xl transition sm:h-16 sm:w-16', todayMood === i + 1 ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface-2/60 hover:bg-surface-2')}>
              {m}
            </button>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted">
          {LABELS.map((l) => (
            <span key={l} className="w-14 text-center sm:w-16">{l}</span>
          ))}
        </div>
        <Textarea rows={2} placeholder="Пара слов о дне (необязательно)" className="mt-3" defaultValue={moods.find((m) => m.date === today)?.note ?? ''} onBlur={(e) => todayMood && set(today, todayMood, e.target.value)} />
      </Card>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Среднее за месяц" value={avg ? avg.toFixed(1) : '—'} sub={monthMoods.length ? `${monthMoods.length} дн.` : undefined} />
        <Stat label="Отмечено в году" value={moods.length} />
        <Stat label="Хороших дней" value={dist[3] + dist[4]} sub="4 и 5 из 5" />
      </div>
      <Card title={`${year}: год в пикселях`} action={<span className="text-xs text-muted">нажми на день, чтобы отметить</span>}>
        <YearPixels year={year} scores={scores} onPick={(d) => { setPick(d); setNote(moods.find((m) => m.date === d)?.note ?? '') }} />
      </Card>
      <Card title="Распределение">
        <div className="flex items-end gap-3">
          {dist.map((n, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs text-muted tabular">{n}</span>
              <div className="w-full rounded-t-md" style={{ height: 8 + (n / maxDist) * 80, background: MOOD[t][i] }} />
              <span className="text-lg">{MOODS[i]}</span>
            </div>
          ))}
        </div>
      </Card>
      <Modal open={!!pick} onClose={() => setPick(null)} title={pick ? fmtDate(pick) : ''}>
        <div className="flex justify-between">
          {MOODS.map((m, i) => (
            <button key={i} type="button" onClick={() => pick && set(pick, i + 1, note)} className={cx('flex h-12 w-12 items-center justify-center rounded-2xl text-2xl', picked?.score === i + 1 ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface-2/60')}>
              {m}
            </button>
          ))}
        </div>
        <Textarea rows={3} className="mt-3" placeholder="Заметка" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="mt-3 flex gap-2">
          {picked && (
            <Button variant="danger" onClick={() => pick && db.moods.delete(pick).then(() => setPick(null))}>
              Удалить
            </Button>
          )}
          <Button className="flex-1" onClick={() => { if (pick && picked) void set(pick, picked.score, note); setPick(null) }}>
            Готово
          </Button>
        </div>
      </Modal>
    </div>
  )
}
