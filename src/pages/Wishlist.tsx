import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ExternalLink, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { db, type Wish } from '../db'
import { useSettings } from '../lib/settings'
import { fmtMoney, todayStr } from '../lib/format'
import { Button, Card, Empty, Field, Input, Modal, PageHeader, Segmented, Select, Stat, cx } from '../components/ui'

const PRIO: Record<number, { label: string; cls: string }> = {
  1: { label: 'Очень хочу', cls: 'bg-bad/10 text-bad' },
  2: { label: 'Хочу', cls: 'bg-warn/15 text-warn' },
  3: { label: 'Когда-нибудь', cls: 'bg-surface-2 text-muted' },
}

export default function Wishlist() {
  const s = useSettings()
  const cur = s.currency
  const [edit, setEdit] = useState<Partial<Wish> | null>(null)
  const [buy, setBuy] = useState<{ wish: Wish; categoryId: number; date: string } | null>(null)
  const [showBought, setShowBought] = useState(false)
  const wishes = useLiveQuery(() => db.wishes.toArray(), []) ?? []
  const cats = useLiveQuery(() => db.categories.where('type').equals('expense').toArray(), []) ?? []
  const open = wishes.filter((w) => !w.bought).sort((a, b) => a.priority - b.priority || b.createdAt - a.createdAt)
  const bought = wishes.filter((w) => w.bought).sort((a, b) => (b.boughtAt ?? '').localeCompare(a.boughtAt ?? ''))
  const total = open.reduce((a, w) => a + (w.price ?? 0), 0)

  async function save() {
    if (!edit?.name?.trim()) return
    const data = { name: edit.name.trim(), price: edit.price || undefined, priority: (edit.priority ?? 2) as 1 | 2 | 3, link: edit.link?.trim() || undefined, note: edit.note?.trim() || undefined }
    if (edit.id) await db.wishes.update(edit.id, data)
    else await db.wishes.add({ ...data, bought: 0, createdAt: Date.now() })
    setEdit(null)
  }
  async function remove() {
    if (!edit?.id || !confirm('Удалить из вишлиста?')) return
    await db.wishes.delete(edit.id)
    setEdit(null)
  }
  async function confirmBuy() {
    if (!buy) return
    if (buy.wish.price && buy.categoryId) {
      await db.transactions.add({ type: 'expense', amount: buy.wish.price, categoryId: buy.categoryId, date: buy.date, note: buy.wish.name, createdAt: Date.now() })
    }
    await db.wishes.update(buy.wish.id, { bought: 1, boughtAt: buy.date })
    setBuy(null)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Вишлист"
        actions={
          <Button onClick={() => setEdit({ priority: 2 })}>
            <Plus size={16} /> Хочу
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3">
        <Stat label="В списке" value={open.length} />
        <Stat label="На сумму" value={fmtMoney(total, cur)} />
      </div>
      {open.length === 0 ? (
        <Empty icon="🎁" title="Список пуст" text="Вещи, книги, курсы, поездки. Когда купишь, расход попадёт в финансы автоматически." action={<Button onClick={() => setEdit({ priority: 2 })}>Добавить</Button>} />
      ) : (
        <Card padding={false}>
          <div className="divide-y divide-line">
            {open.map((w) => (
              <div key={w.id} className="flex items-center gap-3 px-4 py-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEdit(w)}>
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{w.name}</span>
                    <span className={cx('shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium', PRIO[w.priority].cls)}>{PRIO[w.priority].label}</span>
                  </div>
                  <div className="text-xs text-muted">
                    {w.price ? fmtMoney(w.price, cur) : 'цена не указана'}
                    {w.note ? ` · ${w.note}` : ''}
                  </div>
                </button>
                {w.link && (
                  <a href={w.link} target="_blank" rel="noreferrer" className="text-muted hover:text-accent" aria-label="Открыть ссылку">
                    <ExternalLink size={16} />
                  </a>
                )}
                <Button size="sm" variant="soft" onClick={() => setBuy({ wish: w, categoryId: cats[0]?.id ?? 0, date: todayStr() })}>
                  <ShoppingBag size={14} /> Купил
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
      {bought.length > 0 && (
        <Card title={`Куплено (${bought.length})`} action={<button className="text-xs text-accent" onClick={() => setShowBought((v) => !v)}>{showBought ? 'скрыть' : 'показать'}</button>}>
          {showBought && (
            <div className="space-y-1.5 text-sm">
              {bought.map((w) => (
                <div key={w.id} className="flex items-center justify-between">
                  <span className="line-through opacity-70">{w.name}</span>
                  <span className="text-xs text-muted">{w.boughtAt}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Желание' : 'Новое желание'}>
        {edit && (
          <div className="space-y-3">
            <Field label="Что">
              <Input autoFocus placeholder="Например, наушники" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label={`Цена (${cur})`}>
              <Input inputMode="numeric" value={edit.price ?? ''} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value.replace(/\D/g, '')) || undefined })} />
            </Field>
            <Segmented value={String(edit.priority ?? 2)} onChange={(v) => setEdit({ ...edit, priority: Number(v) as 1 | 2 | 3 })} options={[{ value: '1', label: 'Очень хочу' }, { value: '2', label: 'Хочу' }, { value: '3', label: 'Потом' }]} />
            <Field label="Ссылка">
              <Input placeholder="https://" value={edit.link ?? ''} onChange={(e) => setEdit({ ...edit, link: e.target.value })} />
            </Field>
            <Field label="Заметка">
              <Input value={edit.note ?? ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
            </Field>
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
      <Modal open={!!buy} onClose={() => setBuy(null)} title="Отметить покупку">
        {buy && (
          <div className="space-y-3">
            <div className="text-sm">
              <span className="font-medium">{buy.wish.name}</span>
              {buy.wish.price ? <span className="text-muted"> · {fmtMoney(buy.wish.price, cur)} попадёт в расходы</span> : <span className="text-muted"> · цена не указана, расход не создастся</span>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Категория">
                <Select value={buy.categoryId} onChange={(e) => setBuy({ ...buy, categoryId: Number(e.target.value) })}>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Дата">
                <Input type="date" value={buy.date} onChange={(e) => setBuy({ ...buy, date: e.target.value })} />
              </Field>
            </div>
            <Button className="w-full" size="lg" onClick={confirmBuy}>
              Готово
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
