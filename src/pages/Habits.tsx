import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Archive, Plus, Trash2 } from 'lucide-react'
import { db, type Habit } from '../db'
import { todayStr } from '../lib/format'
import { bestStreak, streak } from '../lib/habits'
import { seriesColor } from '../lib/palette'
import { useTheme } from '../lib/theme'
import { Button, Card, Empty, Field, Input, Modal, PageHeader, Stat, cx } from '../components/ui'
import { YearHeatmap } from '../components/Heatmap'

const EMOJIS = ['🏋️', '📚', '💧', '🍬', '🧘', '🏃', '🛌', '🥗', '🚭', '💊', '🧹', '🎯', '🎨', '🎸', '🙏', '📵']

export default function Habits() {
  const t = useTheme()
  const today = todayStr()
  const [edit, setEdit] = useState<Partial<Habit> | null>(null)
  const habits = useLiveQuery(() => db.habits.where('archived').equals(0).toArray(), []) ?? []
  const since = format(subDays(new Date(), 370), 'yyyy-MM-dd')
  const logs = useLiveQuery(() => db.habitLogs.where('date').aboveOrEqual(since).toArray(), [since]) ?? []
  const byHabit = useMemo(() => {
    const m = new Map<number, Set<string>>()
    for (const l of logs) {
      if (!m.has(l.habitId)) m.set(l.habitId, new Set())
      m.get(l.habitId)!.add(l.date)
    }
    return m
  }, [logs])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')), [])
  const heat = useMemo(() => {
    const m = new Map<string, number>()
    if (!habits.length) return m
    const perDay = new Map<string, number>()
    for (const l of logs) if (habits.some((h) => h.id === l.habitId)) perDay.set(l.date, (perDay.get(l.date) ?? 0) + 1)
    for (const [d, n] of perDay) m.set(d, n / habits.length)
    return m
  }, [logs, habits])
  const doneToday = habits.filter((h) => byHabit.get(h.id)?.has(today)).length
  const best = Math.max(0, ...habits.map((h) => bestStreak(byHabit.get(h.id) ?? new Set())))

  async function toggle(id: number, date: string) {
    const ex = await db.habitLogs.where('[habitId+date]').equals([id, date]).first()
    if (ex) await db.habitLogs.delete(ex.id)
    else await db.habitLogs.add({ habitId: id, date })
  }
  async function save() {
    if (!edit?.name?.trim()) return
    if (edit.id) await db.habits.update(edit.id, { name: edit.name.trim(), emoji: edit.emoji ?? '✅', color: edit.color ?? 0 })
    else await db.habits.add({ name: edit.name.trim(), emoji: edit.emoji ?? '✅', color: edit.color ?? 0, createdAt: Date.now(), archived: 0 })
    setEdit(null)
  }
  async function archive() {
    if (!edit?.id) return
    await db.habits.update(edit.id, { archived: 1 })
    setEdit(null)
  }
  async function remove() {
    if (!edit?.id || !confirm('Удалить привычку и всю её историю?')) return
    await db.habitLogs.where('habitId').equals(edit.id).delete()
    await db.habits.delete(edit.id)
    setEdit(null)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Привычки"
        actions={
          <Button onClick={() => setEdit({ emoji: '✅', color: habits.length % 8 })}>
            <Plus size={16} /> Привычка
          </Button>
        }
      />
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Сегодня" value={`${doneToday}/${habits.length}`} />
        <Stat label="Лучшая серия" value={`${best} дн.`} />
        <Stat label="За 7 дней" value={`${habits.length ? Math.round((days.reduce((a, d) => a + habits.filter((h) => byHabit.get(h.id)?.has(d)).length, 0) / (habits.length * 7)) * 100) : 0}%`} />
      </div>
      {habits.length === 0 ? (
        <Empty icon="✅" title="Привычек нет" text="Спорт, чтение, вода, ранний подъём — отмечай каждый день и следи за серией." action={<Button onClick={() => setEdit({ emoji: '✅', color: 0 })}>Добавить</Button>} />
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="px-4 py-2 text-left font-medium">Привычка</th>
                  {days.map((d) => (
                    <th key={d} className={cx('px-1 py-2 text-center font-medium', d === today && 'text-accent')}>
                      {format(new Date(d), 'EEEEEE', { locale: ru })}
                      <div className="text-[10px]">{d.slice(8)}</div>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">Серия</th>
                </tr>
              </thead>
              <tbody>
                {habits.map((h) => {
                  const set = byHabit.get(h.id) ?? new Set<string>()
                  const col = seriesColor(h.color, t)
                  return (
                    <tr key={h.id} className="border-t border-line">
                      <td className="px-4 py-2">
                        <button type="button" onClick={() => setEdit(h)} className="flex items-center gap-2 text-left">
                          <span className="text-lg">{h.emoji}</span>
                          <span className="font-medium">{h.name}</span>
                        </button>
                      </td>
                      {days.map((d) => {
                        const on = set.has(d)
                        return (
                          <td key={d} className="px-1 py-2 text-center">
                            <button type="button" aria-label={`${h.name} ${d}`} onClick={() => toggle(h.id, d)} className={cx('h-8 w-8 rounded-lg border transition', on ? 'border-transparent text-white' : 'border-border bg-surface-2/40')} style={on ? { background: col } : undefined}>
                              {on ? '✓' : ''}
                            </button>
                          </td>
                        )
                      })}
                      <td className="px-3 py-2 text-right tabular">🔥 {streak(set, today)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {habits.length > 0 && (
        <Card title="Год" action={<span className="text-xs text-muted">доля выполненных привычек в день</span>}>
          <YearHeatmap values={heat} />
        </Card>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Привычка' : 'Новая привычка'}>
        {edit && (
          <div className="space-y-3">
            <Field label="Название">
              <Input autoFocus placeholder="Например, Спорт" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button key={e} type="button" onClick={() => setEdit({ ...edit, emoji: e })} className={cx('h-9 w-9 rounded-lg text-xl', edit.emoji === e ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface-2/60')}>
                  {e}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((slot) => (
                <button key={slot} type="button" onClick={() => setEdit({ ...edit, color: slot })} className={cx('h-7 w-7 rounded-full', edit.color === slot && 'ring-2 ring-offset-2 ring-offset-surface ring-ink')} style={{ background: seriesColor(slot, t) }} />
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              {edit.id && (
                <>
                  <Button variant="ghost" onClick={archive} title="В архив">
                    <Archive size={16} />
                  </Button>
                  <Button variant="danger" onClick={remove}>
                    <Trash2 size={16} />
                  </Button>
                </>
              )}
              <Button className="flex-1" onClick={save}>
                Сохранить
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
