import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2 } from 'lucide-react'
import { db, type Transaction, type TxType } from '../db'
import { todayStr } from '../lib/format'
import { seriesColor } from '../lib/palette'
import { useTheme } from '../lib/theme'
import { Button, Field, Input, Modal, Segmented, cx } from './ui'

export function TransactionForm({ open, onClose, tx, defaultType = 'expense' }: { open: boolean; onClose: () => void; tx?: Transaction | null; defaultType?: TxType }) {
  const t = useTheme()
  const cats = useLiveQuery(() => db.categories.orderBy('order').toArray(), []) ?? []
  const [type, setType] = useState<TxType>(defaultType)
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [date, setDate] = useState(todayStr())
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    if (tx) {
      setType(tx.type)
      setAmount(String(tx.amount))
      setCategoryId(tx.categoryId)
      setDate(tx.date)
      setNote(tx.note ?? '')
    } else {
      setType(defaultType)
      setAmount('')
      setCategoryId(null)
      setDate(todayStr())
      setNote('')
    }
  }, [open, tx, defaultType])

  const list = cats.filter((c) => c.type === type)
  useEffect(() => {
    if (categoryId && list.some((c) => c.id === categoryId)) return
    if (list.length) setCategoryId(list[0].id)
  }, [type, list, categoryId])

  const value = Number(amount.replace(/\s/g, '').replace(',', '.'))
  const valid = value > 0 && categoryId !== null && !!date

  async function save() {
    if (!valid || categoryId === null) return
    if (tx) await db.transactions.update(tx.id, { type, amount: value, categoryId, date, note: note.trim() })
    else await db.transactions.add({ type, amount: value, categoryId, date, note: note.trim(), createdAt: Date.now() })
    onClose()
  }
  async function remove() {
    if (!tx) return
    if (!confirm('Удалить запись?')) return
    await db.transactions.delete(tx.id)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={tx ? 'Изменить запись' : 'Новая запись'}>
      <div className="space-y-4">
        <Segmented value={type} onChange={setType} options={[{ value: 'expense', label: 'Расход' }, { value: 'income', label: 'Доход' }]} />
        <Field label="Сумма">
          <Input inputMode="decimal" autoFocus placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-14 text-2xl font-semibold tabular" />
        </Field>
        <div>
          <div className="mb-1 text-xs font-medium text-ink-2">Категория</div>
          <div className="grid grid-cols-3 gap-2">
            {list.map((c) => (
              <button key={c.id} type="button" onClick={() => setCategoryId(c.id)} className={cx('flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-sm transition', categoryId === c.id ? 'border-accent bg-accent-soft' : 'border-border bg-surface-2/40')}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-base" style={{ background: seriesColor(c.color, t) + '33' }}>
                  {c.icon}
                </span>
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Дата">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Заметка">
            <Input placeholder="Например, обед" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <div className="flex gap-2 pt-1">
          {tx && (
            <Button variant="danger" onClick={remove}>
              <Trash2 size={16} />
            </Button>
          )}
          <Button className="flex-1" size="lg" disabled={!valid} onClick={save}>
            {tx ? 'Сохранить' : 'Добавить'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
