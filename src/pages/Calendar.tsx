import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, addMonths, endOfMonth, endOfWeek, format, parseISO, startOfWeek, subMonths } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, FileUp, Plus, RefreshCw, Smartphone, Trash2 } from 'lucide-react'
import { db, type ExtEvent, type LifeEvent, type Photo } from '../db'
import { useSettings } from '../lib/settings'
import { fmtDate, fmtMoney, fmtShort, monthKey, todayStr } from '../lib/format'
import { calendarRequest, clearImportedIcs, importIcsFile, syncDeviceCalendar } from '../lib/calendar'
import { isNative } from '../lib/native'
import { useObjectUrl } from '../lib/images'
import { MOOD, SERIES } from '../lib/palette'
import { useTheme } from '../lib/theme'
import { Button, Card, Field, IconButton, Input, Modal, PageHeader, cx } from '../components/ui'

const MOODS = ['😞', '😕', '😐', '🙂', '😄']

function Thumb({ p }: { p: Photo }) {
  const url = useObjectUrl(p.thumb)
  return <Link to="/photos" className="block h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-2">{url && <img src={url} alt="" className="h-full w-full object-cover" />}</Link>
}

type OwnOcc = { e: LifeEvent; date: string }

export default function CalendarPage() {
  const s = useSettings()
  const t = useTheme()
  const cur = s.currency
  const today = todayStr()
  const [month, setMonth] = useState(monthKey())
  const [sel, setSel] = useState(today)
  const [add, setAdd] = useState<{ name: string; emoji: string; yearly: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const icsRef = useRef<HTMLInputElement>(null)

  const first = parseISO(month + '-01')
  const gridStart = startOfWeek(first, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(first), { weekStartsOn: 1 })
  const rs = format(gridStart, 'yyyy-MM-dd')
  const re = format(gridEnd, 'yyyy-MM-dd')
  const days = useMemo(() => {
    const out: string[] = []
    for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) out.push(format(d, 'yyyy-MM-dd'))
    return out
  }, [rs, re]) // eslint-disable-line react-hooks/exhaustive-deps

  const txs = useLiveQuery(() => db.transactions.where('date').between(rs, re, true, true).toArray(), [rs, re]) ?? []
  const moods = useLiveQuery(() => db.moods.where('date').between(rs, re, true, true).toArray(), [rs, re]) ?? []
  const photos = useLiveQuery(() => db.photos.where('takenAt').between(rs, re, true, true).toArray(), [rs, re]) ?? []
  const logs = useLiveQuery(() => db.habitLogs.where('date').between(rs, re, true, true).toArray(), [rs, re]) ?? []
  const habitCount = useLiveQuery(() => db.habits.where('archived').equals(0).count(), []) ?? 0
  const own = useLiveQuery(() => db.events.toArray(), []) ?? []
  const ext = useLiveQuery(() => db.calendarEvents.where('end').above(gridStart.getTime()).and((e) => e.start < gridEnd.getTime() + 86400000).toArray(), [rs, re]) ?? []
  const extCount = useLiveQuery(() => db.calendarEvents.count(), []) ?? 0
  const cats = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats])

  const ownOcc = useMemo(() => {
    const out: OwnOcc[] = []
    const years = new Set(days.map((d) => Number(d.slice(0, 4))))
    for (const e of own) {
      if (e.yearly) {
        const [, m, d] = e.date.split('-').map(Number)
        for (const y of years) {
          const date = format(new Date(y, m - 1, d), 'yyyy-MM-dd')
          if (date >= rs && date <= re) out.push({ e, date })
        }
      } else if (e.date >= rs && e.date <= re) out.push({ e, date: e.date })
    }
    return out
  }, [own, days, rs, re])

  const byDay = useMemo(() => {
    const m = new Map<string, { own: LifeEvent[]; ext: ExtEvent[]; spent: number; income: number; mood?: number; photos: Photo[]; habits: number }>()
    const get = (d: string) => {
      let v = m.get(d)
      if (!v) {
        v = { own: [], ext: [], spent: 0, income: 0, photos: [], habits: 0 }
        m.set(d, v)
      }
      return v
    }
    for (const o of ownOcc) get(o.date).own.push(o.e)
    for (const e of ext) {
      // spread multi-day events over each day they cover
      const start = new Date(e.start)
      const endMs = e.allDay ? e.end - 1 : Math.max(e.start, e.end - 1)
      for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate()); d.getTime() <= endMs; d = addDays(d, 1)) {
        const key = format(d, 'yyyy-MM-dd')
        if (key >= rs && key <= re) get(key).ext.push(e)
      }
    }
    for (const x of txs) x.type === 'expense' ? (get(x.date).spent += x.amount) : (get(x.date).income += x.amount)
    for (const mo of moods) get(mo.date).mood = mo.score
    for (const p of photos) get(p.takenAt).photos.push(p)
    for (const l of logs) get(l.date).habits++
    return m
  }, [ownOcc, ext, txs, moods, photos, logs, rs, re])

  const day = byDay.get(sel)
  const dayTxs = txs.filter((x) => x.date === sel)
  const selMood = moods.find((m) => m.date === sel)

  useEffect(() => {
    if (!sel.startsWith(month)) setSel(month === monthKey() ? today : month + '-01')
  }, [month]) // eslint-disable-line react-hooks/exhaustive-deps

  async function connect() {
    setBusy(true)
    setMsg('')
    try {
      const ok = await calendarRequest()
      if (!ok) {
        setMsg('Доступ к календарю не выдан. Разреши его в настройках приложения.')
        return
      }
      const n = await syncDeviceCalendar()
      setMsg(`Загружено событий из календаря телефона: ${n}`)
    } catch (e) {
      setMsg('Ошибка: ' + String(e))
    } finally {
      setBusy(false)
    }
  }
  async function refresh() {
    setBusy(true)
    try {
      const n = await syncDeviceCalendar()
      setMsg(`Обновлено: ${n} событий`)
    } catch (e) {
      setMsg('Ошибка: ' + String(e))
    } finally {
      setBusy(false)
    }
  }
  async function onIcs(f: File | undefined) {
    if (!f) return
    setBusy(true)
    try {
      const n = await importIcsFile(f)
      setMsg(`Импортировано событий: ${n}`)
    } catch (e) {
      setMsg('Не удалось прочитать файл: ' + String(e))
    } finally {
      setBusy(false)
      if (icsRef.current) icsRef.current.value = ''
    }
  }
  async function saveOwn() {
    if (!add?.name.trim()) return
    await db.events.add({ name: add.name.trim(), emoji: add.emoji || '📅', date: sel, yearly: add.yearly ? 1 : 0 })
    setAdd(null)
  }

  const extColor = SERIES[t][1]
  const isCurrent = month === monthKey()

  return (
    <div className="space-y-4">
      <PageHeader
        title="Календарь"
        subtitle="События, траты, настроение и фото по дням"
        actions={
          <>
            <input ref={icsRef} type="file" accept=".ics,text/calendar" hidden onChange={(e) => onIcs(e.target.files?.[0])} />
            <Button variant="ghost" disabled={busy} onClick={() => icsRef.current?.click()} title="Импорт файла .ics">
              <FileUp size={16} /> .ics
            </Button>
            <Button onClick={() => setAdd({ name: '', emoji: '📅', yearly: false })}>
              <Plus size={16} /> Событие
            </Button>
          </>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 text-sm">
            <Smartphone className="mt-0.5 shrink-0 text-accent" size={20} />
            <div>
              {isNative ? (
                <>
                  <div className="font-medium">Календарь телефона (Samsung Calendar, Google Calendar)</div>
                  <div className="text-muted">{s.calendarConnected ? `Подключено${s.calendarLastSync ? ` · обновлено ${format(s.calendarLastSync, 'd MMM HH:mm', { locale: ru })}` : ''} · событий в базе: ${extCount}` : 'Разреши доступ, и события из календаря телефона появятся здесь.'}</div>
                </>
              ) : (
                <>
                  <div className="font-medium">Календарь телефона подключается в Android-приложении</div>
                  <div className="text-muted">В браузере можно импортировать файл .ics: в Samsung Calendar или Google Calendar выбери «Экспорт» или «Поделиться» и открой файл здесь.{extCount ? ` Сейчас импортировано: ${extCount}.` : ''}</div>
                </>
              )}
              {msg && <div className="mt-1 text-accent">{msg}</div>}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {isNative && (s.calendarConnected ? (
              <Button variant="soft" disabled={busy} onClick={refresh}>
                <RefreshCw size={16} className={busy ? 'animate-spin' : ''} /> Обновить
              </Button>
            ) : (
              <Button disabled={busy} onClick={connect}>
                Подключить
              </Button>
            ))}
            {extCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => confirm('Удалить импортированные из .ics события?') && clearImportedIcs().then(() => setMsg('Импорт очищен'))}>
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" padding={false}>
          <div className="flex items-center gap-2 px-3 pt-3">
            <IconButton label="Предыдущий месяц" onClick={() => setMonth(format(subMonths(first, 1), 'yyyy-MM'))}>
              <ChevronLeft size={18} />
            </IconButton>
            <div className="min-w-36 text-center text-base font-semibold capitalize">{format(first, 'LLLL yyyy', { locale: ru })}</div>
            <IconButton label="Следующий месяц" onClick={() => setMonth(format(addMonths(first, 1), 'yyyy-MM'))}>
              <ChevronRight size={18} />
            </IconButton>
            {!isCurrent && (
              <Button variant="ghost" size="sm" onClick={() => { setMonth(monthKey()); setSel(today) }}>
                Сегодня
              </Button>
            )}
          </div>
          <div className="grid grid-cols-7 px-2 pt-2 text-center text-[11px] font-medium text-muted">
            {['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-line p-px m-2 mt-0 rounded-xl overflow-hidden">
            {days.map((d) => {
              const v = byDay.get(d)
              const inMonth = d.startsWith(month)
              const isSel = d === sel
              const isToday = d === today
              const items = [...(v?.own ?? []).map((e) => ({ key: 'o' + e.id, label: `${e.emoji} ${e.name}`, color: 'var(--accent)' })), ...(v?.ext ?? []).map((e) => ({ key: 'x' + e.id, label: e.title, color: extColor }))]
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSel(d)}
                  className={cx('flex min-h-16 flex-col items-start gap-0.5 bg-surface p-1 text-left transition sm:min-h-24 sm:p-1.5', !inMonth && 'opacity-40', isSel && 'bg-accent-soft/60')}
                >
                  <span className="flex w-full items-center justify-between">
                    <span className={cx('flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium tabular', isToday && 'bg-accent text-white')}>{Number(d.slice(8))}</span>
                    {v?.mood && <span className="h-2 w-2 rounded-full" title={`Настроение ${v.mood}/5`} style={{ background: MOOD[t][v.mood - 1] }} />}
                  </span>
                  <span className="hidden w-full space-y-0.5 sm:block">
                    {items.slice(0, 2).map((i) => (
                      <span key={i.key} className="block truncate rounded px-1 text-[10px] leading-4 text-ink" style={{ background: i.color + '33' }}>
                        {i.label}
                      </span>
                    ))}
                    {items.length > 2 && <span className="block px-1 text-[10px] text-muted">+{items.length - 2}</span>}
                  </span>
                  <span className="flex w-full flex-wrap items-center gap-0.5 sm:hidden">
                    {items.slice(0, 4).map((i) => (
                      <span key={i.key} className="h-1.5 w-1.5 rounded-full" style={{ background: i.color }} />
                    ))}
                  </span>
                  <span className="mt-auto flex w-full items-center justify-between text-[10px] text-muted tabular">
                    <span>{v?.spent ? '−' + fmtShort(v.spent) : ''}</span>
                    <span>{v?.photos.length ? `📷${v.photos.length > 1 ? v.photos.length : ''}` : ''}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-3 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent" /> мои события</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: extColor }} /> календарь телефона / .ics</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: MOOD[t][4] }} /> настроение</span>
          </div>
        </Card>

        <Card title={fmtDate(sel, 'd MMMM, EEEE')} action={<Button size="sm" variant="soft" onClick={() => setAdd({ name: '', emoji: '📅', yearly: false })}><Plus size={14} /> событие</Button>}>
          <div className="space-y-4 text-sm">
            <div>
              <div className="mb-1 text-xs font-medium text-muted">События</div>
              {!day?.own.length && !day?.ext.length ? (
                <div className="text-muted">Ничего не запланировано</div>
              ) : (
                <div className="space-y-1.5">
                  {day?.own.map((e) => (
                    <Link key={'o' + e.id} to="/events" className="flex items-center gap-2 rounded-lg bg-accent-soft/50 px-2 py-1.5">
                      <span>{e.emoji}</span>
                      <span className="flex-1 truncate">{e.name}</span>
                      {e.yearly ? <span className="text-[10px] text-muted">ежегодно</span> : null}
                    </Link>
                  ))}
                  {day?.ext.map((e) => (
                    <div key={'x' + e.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: extColor + '22' }}>
                      <span className="w-12 shrink-0 text-xs text-muted tabular">{e.allDay ? 'весь день' : format(e.start, 'HH:mm')}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{e.title}</span>
                        {(e.location || e.calendar) && <span className="block truncate text-[11px] text-muted">{[e.calendar, e.location].filter(Boolean).join(' · ')}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-medium text-muted">
                <span>Деньги</span>
                {day && (day.spent || day.income) ? <span className="tabular">{day.spent ? '−' + fmtMoney(day.spent, cur) : ''}{day.income ? ` +${fmtMoney(day.income, cur)}` : ''}</span> : null}
              </div>
              {dayTxs.length === 0 ? (
                <div className="text-muted">Операций нет</div>
              ) : (
                <div className="space-y-1">
                  {dayTxs.map((x) => (
                    <div key={x.id} className="flex items-center gap-2">
                      <span>{catMap.get(x.categoryId)?.icon ?? '❔'}</span>
                      <span className="flex-1 truncate">{catMap.get(x.categoryId)?.name}{x.note ? ` · ${x.note}` : ''}</span>
                      <span className={cx('tabular', x.type === 'income' && 'text-good')}>{x.type === 'income' ? '+' : '−'}{fmtMoney(x.amount, cur)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-surface-2/50 p-2">
                <div className="text-xs text-muted">Настроение</div>
                <div className="text-lg">{selMood ? `${MOODS[selMood.score - 1]} ${selMood.score}/5` : '—'}</div>
                {selMood?.note && <div className="text-xs text-muted">{selMood.note}</div>}
              </div>
              <div className="rounded-xl bg-surface-2/50 p-2">
                <div className="text-xs text-muted">Привычки</div>
                <div className="text-lg tabular">{habitCount ? `${day?.habits ?? 0} / ${habitCount}` : '—'}</div>
              </div>
            </div>
            {day?.photos.length ? (
              <div>
                <div className="mb-1 text-xs font-medium text-muted">Фото ({day.photos.length})</div>
                <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                  {day.photos.map((p) => (
                    <Thumb key={p.id} p={p} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <Modal open={!!add} onClose={() => setAdd(null)} title={`Событие ${fmtDate(sel, 'd MMMM')}`}>
        {add && (
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Field label="Название">
                <Input autoFocus placeholder="Например, Стоматолог" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
              </Field>
              <Field label="Иконка">
                <Input value={add.emoji} onChange={(e) => setAdd({ ...add, emoji: e.target.value.slice(0, 4) })} className="w-16 text-center text-xl" />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={add.yearly} onChange={(e) => setAdd({ ...add, yearly: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
              Повторяется каждый год
            </label>
            <Button className="w-full" onClick={saveOwn}>
              Добавить
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
