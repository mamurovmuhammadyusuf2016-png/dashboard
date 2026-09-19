import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addMonths, differenceInCalendarDays, differenceInCalendarMonths, format, parseISO } from 'date-fns'
import { Plus, Trash2 } from 'lucide-react'
import { db, type Goal } from '../db'
import { useSettings } from '../lib/settings'
import { daysWord, fmtDate, fmtMoney, todayStr } from '../lib/format'
import { Button, Card, Empty, Field, Input, Modal, PageHeader, Progress, cx } from '../components/ui'

const EMOJIS = ['🎯', '🚗', '🏠', '✈️', '💻', '📱', '💍', '🎓', '🏝️', '🛡️', '💰', '🎁']

export default function Goals() {
  const s = useSettings()
  const cur = s.currency
  const today = todayStr()
  const [edit, setEdit] = useState<Partial<Goal> | null>(null)
  const [dep, setDep] = useState<{ goal: Goal; amount: string } | null>(null)
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? []
  const deposits = useLiveQuery(() => db.goalDeposits.toArray(), []) ?? []
  const active = goals.filter((g) => !g.done).sort((a, b) => b.createdAt - a.createdAt)
  const done = goals.filter((g) => g.done)

  function forecast(g: Goal) {
    const ds = deposits.filter((d) => d.goalId === g.id).sort((a, b) => a.date.localeCompare(b.date))
    const remaining = Math.max(0, g.target - g.saved)
    let perMonth = 0
    if (ds.length) {
      const months = Math.max(1, differenceInCalendarMonths(parseISO(today), parseISO(ds[0].date)) + 1)
      perMonth = ds.reduce((a, d) => a + d.amount, 0) / months
    }
    const monthsLeft = perMonth > 0 ? remaining / perMonth : null
    const eta = monthsLeft !== null ? addMonths(new Date(), Math.ceil(monthsLeft)) : null
    let need: number | null = null
    if (g.deadline) {
      const m = Math.max(1, differenceInCalendarMonths(parseISO(g.deadline), parseISO(today)))
      need = remaining / m
    }
    return { perMonth, eta, need, remaining }
  }

  async function save() {
    if (!edit?.name?.trim() || !edit.target) return
    const data = { name: edit.name.trim(), emoji: edit.emoji ?? '🎯', target: Number(edit.target), deadline: edit.deadline || undefined }
    if (edit.id) await db.goals.update(edit.id, data)
    else await db.goals.add({ ...data, saved: Number(edit.saved) || 0, createdAt: Date.now(), done: 0 })
    setEdit(null)
  }
  async function remove() {
    if (!edit?.id || !confirm('Удалить цель?')) return
    await db.goalDeposits.where('goalId').equals(edit.id).delete()
    await db.goals.delete(edit.id)
    setEdit(null)
  }
  async function deposit() {
    if (!dep) return
    const amount = Number(dep.amount.replace(/\s/g, ''))
    if (!amount) return
    const saved = dep.goal.saved + amount
    await db.goalDeposits.add({ goalId: dep.goal.id, date: today, amount })
    await db.goals.update(dep.goal.id, { saved, done: saved >= dep.goal.target ? 1 : 0 })
    setDep(null)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Цели и копилки"
        actions={
          <Button onClick={() => setEdit({ emoji: '🎯' })}>
            <Plus size={16} /> Цель
          </Button>
        }
      />
      {active.length === 0 && done.length === 0 ? (
        <Empty icon="🎯" title="Целей пока нет" text="Например, «накопить на машину» или «поездка летом». Пополняй копилку, и дашборд посчитает, когда цель будет достигнута." action={<Button onClick={() => setEdit({ emoji: '🎯' })}>Создать цель</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {active.map((g) => {
            const p = g.target ? Math.min(100, (g.saved / g.target) * 100) : 0
            const f = forecast(g)
            const daysLeft = g.deadline ? differenceInCalendarDays(parseISO(g.deadline), parseISO(today)) : null
            return (
              <Card key={g.id}>
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => setEdit(g)} className="text-left">
                    <div className="text-lg font-semibold">
                      {g.emoji} {g.name}
                    </div>
                    {g.deadline && (
                      <div className={cx('text-xs', daysLeft !== null && daysLeft < 0 ? 'text-bad' : 'text-muted')}>
                        до {fmtDate(g.deadline)}{daysLeft !== null && daysLeft >= 0 ? ` · ${daysLeft} ${daysWord(daysLeft)}` : ''}
                      </div>
                    )}
                  </button>
                  <div className="text-right">
                    <div className="text-2xl font-bold tabular">{Math.round(p)}%</div>
                  </div>
                </div>
                <Progress value={p} className="mt-3 h-3" />
                <div className="mt-2 flex justify-between text-sm">
                  <span className="font-medium tabular">{fmtMoney(g.saved, cur)}</span>
                  <span className="text-muted tabular">из {fmtMoney(g.target, cur)}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-surface-2/50 p-2">
                    <div className="text-muted">Темп</div>
                    <div className="font-medium tabular">{f.perMonth ? `${fmtMoney(f.perMonth, cur)} / мес` : '—'}</div>
                    <div className="text-muted">{f.eta ? `цель к ${format(f.eta, 'MM.yyyy')}` : 'пополни, чтобы увидеть прогноз'}</div>
                  </div>
                  <div className="rounded-xl bg-surface-2/50 p-2">
                    <div className="text-muted">Осталось</div>
                    <div className="font-medium tabular">{fmtMoney(f.remaining, cur)}</div>
                    {f.need !== null && <div className="text-muted tabular">нужно {fmtMoney(f.need, cur)} / мес</div>}
                  </div>
                </div>
                <Button className="mt-3 w-full" variant="soft" onClick={() => setDep({ goal: g, amount: '' })}>
                  Пополнить
                </Button>
              </Card>
            )
          })}
        </div>
      )}
      {done.length > 0 && (
        <Card title="Достигнуто 🎉">
          <div className="space-y-2">
            {done.map((g) => (
              <button key={g.id} type="button" onClick={() => setEdit(g)} className="flex w-full items-center justify-between text-left text-sm">
                <span>
                  {g.emoji} {g.name}
                </span>
                <span className="text-muted tabular">{fmtMoney(g.target, cur)}</span>
              </button>
            ))}
          </div>
        </Card>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Цель' : 'Новая цель'}>
        {edit && (
          <div className="space-y-3">
            <Field label="Название">
              <Input autoFocus placeholder="Например, Машина" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button key={e} type="button" onClick={() => setEdit({ ...edit, emoji: e })} className={cx('h-9 w-9 rounded-lg text-xl', edit.emoji === e ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface-2/60')}>
                  {e}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Сумма цели (${cur})`}>
                <Input inputMode="numeric" value={edit.target ?? ''} onChange={(e) => setEdit({ ...edit, target: Number(e.target.value.replace(/\D/g, '')) })} />
              </Field>
              {!edit.id && (
                <Field label="Уже накоплено">
                  <Input inputMode="numeric" value={edit.saved ?? ''} onChange={(e) => setEdit({ ...edit, saved: Number(e.target.value.replace(/\D/g, '')) })} />
                </Field>
              )}
              <Field label="Дедлайн (необязательно)">
                <Input type="date" value={edit.deadline ?? ''} onChange={(e) => setEdit({ ...edit, deadline: e.target.value })} />
              </Field>
            </div>
            <div className="flex gap-2 pt-1">
              {edit.id && (
                <Button variant="danger" onClick={remove}>
                  <Trash2 size={16} />
                </Button>
              )}
              <Button className="flex-1" onClick={save}>
                Сохранить
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal open={!!dep} onClose={() => setDep(null)} title={dep ? `Пополнить «${dep.goal.name}»` : ''}>
        {dep && (
          <div className="space-y-3">
            <Input autoFocus inputMode="numeric" placeholder="Сумма" value={dep.amount} onChange={(e) => setDep({ ...dep, amount: e.target.value })} className="h-14 text-2xl font-semibold tabular" />
            <Button className="w-full" size="lg" onClick={deposit}>
              Добавить
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
