import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronRight, Footprints, Plus, Sparkles } from 'lucide-react'
import { db } from '../db'
import { useSettings } from '../lib/settings'
import { daysWord, fmtMoney, fmtNum, greeting, pluralRu, todayStr } from '../lib/format'
import { seedDemo } from '../lib/demo'
import { nextOccurrence } from '../lib/events'
import { useObjectUrl } from '../lib/images'
import { seriesColor } from '../lib/palette'
import { useTheme } from '../lib/theme'
import { Button, Card, Progress, Stat, cx } from '../components/ui'
import { TransactionForm } from '../components/TransactionForm'

const MOODS = ['😞', '😕', '😐', '🙂', '😄']

export default function Today() {
  const s = useSettings()
  const t = useTheme()
  const cur = s.currency
  const today = todayStr()
  const now = new Date()
  const mStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const mEnd = format(endOfMonth(now), 'yyyy-MM-dd')
  const [add, setAdd] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const txs = useLiveQuery(() => db.transactions.where('date').between(mStart, mEnd, true, true).toArray(), [mStart, mEnd]) ?? []
  const cats = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const habits = useLiveQuery(() => db.habits.where('archived').equals(0).toArray(), []) ?? []
  const logsToday = useLiveQuery(() => db.habitLogs.where('date').equals(today).toArray(), [today]) ?? []
  const mood = useLiveQuery(() => db.moods.get(today), [today])
  const metric = useLiveQuery(() => db.metrics.get(today), [today])
  const lastWeight = useLiveQuery(() => db.metrics.orderBy('date').reverse().filter((m) => m.weight !== undefined).first(), [])
  const goals = useLiveQuery(() => db.goals.where('done').equals(0).limit(3).toArray(), []) ?? []
  const events = useLiveQuery(() => db.events.toArray(), []) ?? []
  const notes = useLiveQuery(() => db.notes.where('pinned').equals(1).limit(3).toArray(), []) ?? []
  const txCount = useLiveQuery(() => db.transactions.count(), [])
  const memory = useLiveQuery(async () => {
    const md = today.slice(5)
    const y = Number(today.slice(0, 4))
    const keys: string[] = []
    for (let i = 1; i <= 30; i++) keys.push(`${y - i}-${md}`)
    const same = await db.photos.where('takenAt').anyOf(keys).toArray()
    if (same.length) return { photo: same[0], years: y - Number(same[0].takenAt.slice(0, 4)) }
    const n = await db.photos.count()
    if (!n) return null
    const idx = (Number(today.replace(/-/g, '')) * 7) % n
    const p = await db.photos.orderBy('takenAt').offset(idx).first()
    return p ? { photo: p, years: null } : null
  }, [today])
  const memUrl = useObjectUrl(memory?.photo.thumb)

  const sums = useMemo(() => {
    let spentToday = 0
    let spentMonth = 0
    let incomeMonth = 0
    for (const tx of txs) {
      if (tx.type === 'expense') {
        spentMonth += tx.amount
        if (tx.date === today) spentToday += tx.amount
      } else incomeMonth += tx.amount
    }
    return { spentToday, spentMonth, incomeMonth }
  }, [txs, today])
  const budgetTotal = cats.reduce((a, c) => a + (c.type === 'expense' ? c.budget ?? 0 : 0), 0)
  const budgetedIds = new Set(cats.filter((c) => c.type === 'expense' && c.budget).map((c) => c.id))
  const spentBudgeted = txs.reduce((a, x) => a + (x.type === 'expense' && budgetedIds.has(x.categoryId) ? x.amount : 0), 0)
  const doneIds = new Set(logsToday.map((l) => l.habitId))
  const upcoming = events
    .map((e) => ({ e, n: nextOccurrence(e, today) }))
    .filter((x) => x.n.days >= 0)
    .sort((a, b) => a.n.days - b.n.days)
    .slice(0, 3)

  async function toggleHabit(id: number) {
    const ex = await db.habitLogs.where('[habitId+date]').equals([id, today]).first()
    if (ex) await db.habitLogs.delete(ex.id)
    else await db.habitLogs.add({ habitId: id, date: today })
  }
  async function setMood(score: number) {
    await db.moods.put({ date: today, score, note: mood?.note ?? '' })
  }
  async function loadDemo() {
    setSeeding(true)
    try {
      await seedDemo()
    } finally {
      setSeeding(false)
    }
  }

  const fresh = txCount === 0 && !s.demoLoaded

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm text-muted">{format(now, 'EEEE, d MMMM', { locale: ru })}</div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting()}
            {s.name ? `, ${s.name}` : ''}
          </h1>
        </div>
        <Button onClick={() => setAdd(true)}>
          <Plus size={16} /> Запись
        </Button>
      </div>

      {fresh && (
        <Card className="border-accent/40 bg-accent-soft/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold">Начнём?</div>
              <div className="text-sm text-ink-2">Загрузи демо-данные, чтобы увидеть, как всё выглядит. Потом их можно стереть в настройках.</div>
            </div>
            <div className="flex gap-2">
              <Button variant="soft" disabled={seeding} onClick={loadDemo}>
                <Sparkles size={16} /> {seeding ? 'Загружаю…' : 'Демо-данные'}
              </Button>
              <Button onClick={() => setAdd(true)}>Первая запись</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Сегодня потрачено" value={fmtMoney(sums.spentToday, cur)} />
        <Stat label="Расходы за месяц" value={fmtMoney(sums.spentMonth, cur)} sub={budgetTotal ? `по бюджетам ${fmtMoney(spentBudgeted, cur)} из ${fmtMoney(budgetTotal, cur)}` : undefined} tone={budgetTotal && spentBudgeted > budgetTotal ? 'bad' : undefined} />
        <Stat label="Доходы за месяц" value={fmtMoney(sums.incomeMonth, cur)} tone="good" />
        <Stat label="Остаток месяца" value={fmtMoney(sums.incomeMonth - sums.spentMonth, cur, { sign: true })} tone={sums.incomeMonth - sums.spentMonth >= 0 ? 'good' : 'bad'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card title="Привычки" action={<Link to="/habits" className="text-xs text-accent">все</Link>}>
              {habits.length === 0 ? (
                <div className="text-sm text-muted">Добавь привычки в разделе «Привычки».</div>
              ) : (
                <div className="space-y-1.5">
                  {habits.map((h) => {
                    const done = doneIds.has(h.id)
                    return (
                      <button key={h.id} type="button" onClick={() => toggleHabit(h.id)} className={cx('flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition', done ? 'border-transparent' : 'border-border bg-surface-2/40')} style={done ? { background: seriesColor(h.color, t) + '33' } : undefined}>
                        <span className="text-lg">{h.emoji}</span>
                        <span className={cx('flex-1', done && 'line-through opacity-70')}>{h.name}</span>
                        <span className={cx('flex h-5 w-5 items-center justify-center rounded-full border text-[11px]', done ? 'border-transparent bg-accent text-white' : 'border-border')}>{done ? '✓' : ''}</span>
                      </button>
                    )
                  })}
                  <div className="pt-1 text-xs text-muted">
                    Выполнено {doneIds.size} из {habits.length}
                  </div>
                </div>
              )}
            </Card>
            <Card title="Настроение" action={<Link to="/mood" className="text-xs text-accent">год</Link>}>
              <div className="flex justify-between">
                {MOODS.map((m, i) => (
                  <button key={i} type="button" onClick={() => setMood(i + 1)} className={cx('flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition', mood?.score === i + 1 ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface-2/60 hover:bg-surface-2')}>
                    {m}
                  </button>
                ))}
              </div>
              <div className="mt-3 text-xs text-muted">{mood ? 'Отмечено. Можно поменять.' : 'Как прошёл день?'}</div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-surface-2/50 px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <Footprints size={16} className="text-muted" />
                  <span className="font-medium tabular">{metric?.steps ? fmtNum(metric.steps) : '—'}</span>
                  <span className="text-xs text-muted">/ {fmtNum(s.stepGoal)} шагов</span>
                </div>
                {lastWeight?.weight && <div className="text-xs text-muted">{lastWeight.weight} кг</div>}
              </div>
              {metric?.steps ? <Progress value={(metric.steps / s.stepGoal) * 100} className="mt-2" /> : null}
            </Card>
          </div>

          <Card title="Цели" action={<Link to="/goals" className="text-xs text-accent">все</Link>}>
            {goals.length === 0 ? (
              <div className="text-sm text-muted">Пока нет целей. Например, «накопить на машину».</div>
            ) : (
              <div className="space-y-3">
                {goals.map((g) => {
                  const p = g.target ? (g.saved / g.target) * 100 : 0
                  return (
                    <div key={g.id}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {g.emoji} {g.name}
                        </span>
                        <span className="text-xs text-muted tabular">
                          {fmtMoney(g.saved, cur)} / {fmtMoney(g.target, cur)} · {Math.round(p)}%
                        </span>
                      </div>
                      <Progress value={p} />
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card padding={false} className="overflow-hidden">
            <Link to="/photos" className="block">
              {memUrl ? (
                <img src={memUrl} alt="" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-surface-2/60 text-sm text-muted">Загрузи фото, и тут появятся воспоминания</div>
              )}
            </Link>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-sm font-medium">{memory?.years ? `В этот день ${memory.years} ${pluralRu(memory.years, 'год', 'года', 'лет')} назад` : 'Фото дня'}</div>
                {memory?.photo && <div className="text-xs text-muted">{memory.photo.album ?? memory.photo.takenAt}</div>}
              </div>
              <ChevronRight size={16} className="text-muted" />
            </div>
          </Card>

          <Card title="Скоро" action={<Link to="/events" className="text-xs text-accent">все</Link>}>
            {upcoming.length === 0 ? (
              <div className="text-sm text-muted">Добавь дни рождения и события.</div>
            ) : (
              <div className="space-y-2">
                {upcoming.map(({ e, n }) => (
                  <div key={e.id} className="flex items-center gap-3 text-sm">
                    <span className="text-xl">{e.emoji}</span>
                    <span className="flex-1 truncate">{e.name}</span>
                    <span className="text-xs text-muted tabular">{n.days === 0 ? 'сегодня' : `через ${n.days} ${daysWord(n.days)}`}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Закреплённые заметки" action={<Link to="/notes" className="text-xs text-accent">все</Link>}>
            {notes.length === 0 ? (
              <div className="text-sm text-muted">Закрепи важные заметки, и они будут здесь.</div>
            ) : (
              <div className="space-y-2">
                {notes.map((n) => (
                  <Link key={n.id} to="/notes" className="block rounded-xl bg-surface-2/50 px-3 py-2">
                    <div className="truncate text-sm font-medium">{n.title || 'Без названия'}</div>
                    <div className="line-clamp-2 whitespace-pre-line text-xs text-muted">{n.body}</div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <TransactionForm open={add} onClose={() => setAdd(false)} />
    </div>
  )
}
