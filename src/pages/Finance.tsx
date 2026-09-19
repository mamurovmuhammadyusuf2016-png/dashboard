import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addMonths, endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Search, Settings2, Trash2 } from 'lucide-react'
import { db, type Category, type Transaction, type TxType } from '../db'
import { useSettings } from '../lib/settings'
import { fmtDay, fmtMoney, monthKey, todayStr } from '../lib/format'
import { seriesColor } from '../lib/palette'
import { useTheme } from '../lib/theme'
import { Button, Card, Empty, Field, IconButton, Input, Modal, PageHeader, Progress, Segmented, Stat, cx } from '../components/ui'
import { DailyLine, Donut, MonthlyBars } from '../components/charts'
import { TransactionForm } from '../components/TransactionForm'

export default function Finance() {
  const s = useSettings()
  const t = useTheme()
  const cur = s.currency
  const [month, setMonth] = useState(monthKey())
  const [form, setForm] = useState<{ open: boolean; tx?: Transaction | null }>({ open: false })
  const [catMgr, setCatMgr] = useState(false)
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | TxType>('all')

  const mDate = parseISO(month + '-01')
  const mStart = format(startOfMonth(mDate), 'yyyy-MM-dd')
  const mEnd = format(endOfMonth(mDate), 'yyyy-MM-dd')
  const rangeStart = format(startOfMonth(subMonths(mDate, 5)), 'yyyy-MM-dd')

  const cats = useLiveQuery(() => db.categories.orderBy('order').toArray(), []) ?? []
  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats])
  const range = useLiveQuery(() => db.transactions.where('date').between(rangeStart, mEnd, true, true).toArray(), [rangeStart, mEnd]) ?? []
  const txs = useMemo(() => range.filter((x) => x.date >= mStart).sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date))), [range, mStart])

  const stats = useMemo(() => {
    let income = 0
    let expense = 0
    for (const x of txs) x.type === 'income' ? (income += x.amount) : (expense += x.amount)
    const today = todayStr()
    const daysElapsed = month === monthKey() ? Number(today.slice(8)) : endOfMonth(mDate).getDate()
    return { income, expense, avg: expense / Math.max(1, daysElapsed) }
  }, [txs, month, mDate])

  const monthly = useMemo(() => {
    const out: { key: string; label: string; income: number; expense: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(mDate, i)
      out.push({ key: format(d, 'yyyy-MM'), label: format(d, 'LLL', { locale: ru }), income: 0, expense: 0 })
    }
    const idx = new Map(out.map((o, i) => [o.key, i]))
    for (const x of range) {
      const i = idx.get(x.date.slice(0, 7))
      if (i === undefined) continue
      if (x.type === 'income') out[i].income += x.amount
      else out[i].expense += x.amount
    }
    return out
  }, [range, mDate])

  const byCat = useMemo(() => {
    const m = new Map<number, number>()
    for (const x of txs) if (x.type === 'expense') m.set(x.categoryId, (m.get(x.categoryId) ?? 0) + x.amount)
    const arr = [...m.entries()].map(([id, value]) => ({ id, value, cat: catMap.get(id) })).sort((a, b) => b.value - a.value)
    const top = arr.slice(0, 6).map((a) => ({ name: a.cat ? `${a.cat.icon} ${a.cat.name}` : 'Удалённая', value: a.value, slot: a.cat?.color ?? -1 }))
    const rest = arr.slice(6).reduce((acc, a) => acc + a.value, 0)
    if (rest > 0) top.push({ name: 'Остальное', value: rest, slot: -1 })
    return top
  }, [txs, catMap])

  const daily = useMemo(() => {
    const days = endOfMonth(mDate).getDate()
    const arr = Array.from({ length: days }, (_, i) => ({ label: String(i + 1), value: 0 }))
    for (const x of txs) if (x.type === 'expense') arr[Number(x.date.slice(8)) - 1].value += x.amount
    return arr
  }, [txs, mDate])

  const budgets = useMemo(() => {
    const spent = new Map<number, number>()
    for (const x of txs) if (x.type === 'expense') spent.set(x.categoryId, (spent.get(x.categoryId) ?? 0) + x.amount)
    return cats.filter((c) => c.type === 'expense' && c.budget).map((c) => ({ c, spent: spent.get(c.id) ?? 0 }))
  }, [txs, cats])

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return txs.filter((x) => (typeFilter === 'all' || x.type === typeFilter) && (!qq || (x.note ?? '').toLowerCase().includes(qq) || (catMap.get(x.categoryId)?.name ?? '').toLowerCase().includes(qq)))
  }, [txs, q, typeFilter, catMap])
  const grouped = useMemo(() => {
    const g: { date: string; items: Transaction[]; total: number }[] = []
    for (const x of filtered) {
      let last = g[g.length - 1]
      if (!last || last.date !== x.date) {
        last = { date: x.date, items: [], total: 0 }
        g.push(last)
      }
      last.items.push(x)
      last.total += x.type === 'expense' ? -x.amount : x.amount
    }
    return g
  }, [filtered])

  const isCurrent = month === monthKey()

  return (
    <div className="space-y-4">
      <PageHeader
        title="Финансы"
        actions={
          <>
            <Button variant="ghost" onClick={() => setCatMgr(true)}>
              <Settings2 size={16} /> Категории
            </Button>
            <Button onClick={() => setForm({ open: true })}>
              <Plus size={16} /> Запись
            </Button>
          </>
        }
      />

      <div className="flex items-center gap-2">
        <IconButton label="Предыдущий месяц" onClick={() => setMonth(format(subMonths(mDate, 1), 'yyyy-MM'))}>
          <ChevronLeft size={18} />
        </IconButton>
        <div className="min-w-40 text-center text-base font-semibold capitalize">{format(mDate, 'LLLL yyyy', { locale: ru })}</div>
        <IconButton label="Следующий месяц" disabled={isCurrent} onClick={() => setMonth(format(addMonths(mDate, 1), 'yyyy-MM'))}>
          <ChevronRight size={18} />
        </IconButton>
        {!isCurrent && (
          <Button variant="ghost" size="sm" onClick={() => setMonth(monthKey())}>
            Сейчас
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Доходы" value={fmtMoney(stats.income, cur)} tone="good" />
        <Stat label="Расходы" value={fmtMoney(stats.expense, cur)} />
        <Stat label="Остаток" value={fmtMoney(stats.income - stats.expense, cur, { sign: true })} tone={stats.income - stats.expense >= 0 ? 'good' : 'bad'} />
        <Stat label="В среднем в день" value={fmtMoney(stats.avg, cur)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Доходы и расходы, 6 месяцев">
          <MonthlyBars data={monthly} currency={cur} />
        </Card>
        <Card title="Расходы по категориям">
          {byCat.length ? <Donut data={byCat} currency={cur} total={stats.expense} /> : <div className="py-10 text-center text-sm text-muted">В этом месяце расходов нет</div>}
        </Card>
        <Card title="Расходы по дням">
          <DailyLine data={daily} currency={cur} />
        </Card>
        <Card title="Бюджеты" action={<button className="text-xs text-accent" onClick={() => setCatMgr(true)}>настроить</button>}>
          {budgets.length === 0 ? (
            <div className="text-sm text-muted">Задай месячный бюджет категориям в настройках категорий, и здесь появится прогресс.</div>
          ) : (
            <div className="space-y-3">
              {budgets.map(({ c, spent }) => {
                const p = (spent / (c.budget ?? 1)) * 100
                const color = p >= 100 ? 'var(--bad)' : p >= 80 ? 'var(--warn)' : seriesColor(c.color, t)
                return (
                  <div key={c.id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>
                        {c.icon} {c.name}
                      </span>
                      <span className={cx('text-xs tabular', p >= 100 ? 'text-bad font-medium' : 'text-muted')}>
                        {fmtMoney(spent, cur)} / {fmtMoney(c.budget ?? 0, cur)}
                      </span>
                    </div>
                    <Progress value={p} color={color} />
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      <Card title="Операции" padding={false}>
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <div className="relative flex-1 min-w-40">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input placeholder="Поиск по заметке или категории" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 pl-9" />
          </div>
          <Segmented value={typeFilter} onChange={setTypeFilter} options={[{ value: 'all', label: 'Все' }, { value: 'expense', label: 'Расходы' }, { value: 'income', label: 'Доходы' }]} />
        </div>
        {grouped.length === 0 ? (
          <div className="px-4 pb-4">
            <Empty icon="🧾" title="Записей нет" text="Добавь первую трату или доход." action={<Button onClick={() => setForm({ open: true })}>Добавить</Button>} />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {grouped.map((g) => (
              <div key={g.date} className="px-4 py-2">
                <div className="flex items-center justify-between py-1 text-xs text-muted">
                  <span className="capitalize">{fmtDay(g.date)}</span>
                  <span className="tabular">{fmtMoney(g.total, cur, { sign: true })}</span>
                </div>
                {g.items.map((x) => {
                  const c = catMap.get(x.categoryId)
                  return (
                    <button key={x.id} type="button" onClick={() => setForm({ open: true, tx: x })} className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2/60">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg" style={{ background: seriesColor(c?.color ?? -1, t) + '33' }}>
                        {c?.icon ?? '❔'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{c?.name ?? 'Без категории'}</span>
                        {x.note && <span className="block truncate text-xs text-muted">{x.note}</span>}
                      </span>
                      <span className={cx('text-sm font-semibold tabular', x.type === 'income' ? 'text-good' : '')}>{x.type === 'income' ? '+' : '−'}{fmtMoney(x.amount, cur)}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </Card>

      <TransactionForm open={form.open} tx={form.tx} onClose={() => setForm({ open: false })} />
      <CategoryManager open={catMgr} onClose={() => setCatMgr(false)} cats={cats} currency={cur} />
    </div>
  )
}

const EMOJIS = ['🍔', '🚕', '🏠', '👕', '💊', '🎮', '📱', '🎁', '📦', '☕', '🛒', '✈️', '🎓', '🐾', '💇', '⛽', '🏋️', '🎬', '💼', '💻', '💰', '🏦', '🧾', '❤️']

function CategoryManager({ open, onClose, cats, currency }: { open: boolean; onClose: () => void; cats: Category[]; currency: string }) {
  const t = useTheme()
  const [type, setType] = useState<TxType>('expense')
  const [edit, setEdit] = useState<Partial<Category> | null>(null)
  const list = cats.filter((c) => c.type === type)

  async function save() {
    if (!edit?.name?.trim()) return
    const data = { name: edit.name.trim(), icon: edit.icon ?? '📦', color: edit.color ?? 0, budget: edit.budget || undefined, type }
    if (edit.id) await db.categories.update(edit.id, data)
    else await db.categories.add({ ...data, order: list.length })
    setEdit(null)
  }
  async function remove(c: Category) {
    const n = await db.transactions.where('categoryId').equals(c.id).count()
    if (n > 0) {
      alert(`В этой категории ${n} записей. Сначала перенеси их в другую категорию.`)
      return
    }
    if (confirm(`Удалить категорию «${c.name}»?`)) await db.categories.delete(c.id)
  }

  return (
    <Modal open={open} onClose={onClose} title="Категории" wide>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Segmented value={type} onChange={(v) => { setType(v); setEdit(null) }} options={[{ value: 'expense', label: 'Расходы' }, { value: 'income', label: 'Доходы' }]} />
        <Button size="sm" variant="soft" onClick={() => setEdit({ icon: '📦', color: list.length % 8 })}>
          <Plus size={14} /> Новая
        </Button>
      </div>
      {edit && (
        <div className="mb-3 space-y-3 rounded-2xl border border-border bg-surface-2/40 p-3">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Field label="Название">
              <Input value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Например, Кафе" />
            </Field>
            <Field label="Иконка">
              <Input value={edit.icon ?? ''} onChange={(e) => setEdit({ ...edit, icon: e.target.value.slice(0, 4) })} className="w-16 text-center text-xl" />
            </Field>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button key={e} type="button" onClick={() => setEdit({ ...edit, icon: e })} className={cx('h-8 w-8 rounded-lg text-lg', edit.icon === e ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface')}>
                {e}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-2">Цвет</span>
            {[0, 1, 2, 3, 4, 5, 6, 7, -1].map((slot) => (
              <button key={slot} type="button" onClick={() => setEdit({ ...edit, color: slot })} className={cx('h-7 w-7 rounded-full transition', edit.color === slot && 'ring-2 ring-offset-2 ring-offset-surface ring-ink')} style={{ background: seriesColor(slot, t) }} />
            ))}
          </div>
          {type === 'expense' && (
            <Field label={`Месячный бюджет (${currency}), необязательно`}>
              <Input inputMode="numeric" value={edit.budget ?? ''} onChange={(e) => setEdit({ ...edit, budget: Number(e.target.value.replace(/\D/g, '')) || undefined })} placeholder="0" />
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEdit(null)}>
              Отмена
            </Button>
            <Button size="sm" onClick={save}>
              Сохранить
            </Button>
          </div>
        </div>
      )}
      <div className="divide-y divide-line">
        {list.map((c) => (
          <div key={c.id} className="flex items-center gap-3 py-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl text-lg" style={{ background: seriesColor(c.color, t) + '33' }}>
              {c.icon}
            </span>
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEdit(c)}>
              <div className="truncate text-sm font-medium">{c.name}</div>
              {c.budget ? <div className="text-xs text-muted">бюджет {fmtMoney(c.budget, currency)}</div> : null}
            </button>
            <IconButton label="Удалить" onClick={() => remove(c)}>
              <Trash2 size={16} />
            </IconButton>
          </div>
        ))}
      </div>
    </Modal>
  )
}
