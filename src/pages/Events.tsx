import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2 } from 'lucide-react'
import { db, type LifeEvent } from '../db'
import { daysWord, fmtDate, pluralRu, todayStr } from '../lib/format'
import { nextOccurrence } from '../lib/events'
import { Button, Card, Empty, Field, Input, Modal, PageHeader, cx } from '../components/ui'

const EMOJIS = ['🎂', '🎄', '✈️', '🏖️', '💍', '🎓', '🏠', '📅', '⏰', '🎉', '💼', '❤️']

export default function Events() {
  const today = todayStr()
  const [edit, setEdit] = useState<Partial<LifeEvent> | null>(null)
  const events = useLiveQuery(() => db.events.toArray(), []) ?? []
  const items = events.map((e) => ({ e, n: nextOccurrence(e, today) })).sort((a, b) => a.n.days - b.n.days)
  const upcoming = items.filter((x) => x.n.days >= 0)
  const past = items.filter((x) => x.n.days < 0)
  const hero = upcoming[0]

  async function save() {
    if (!edit?.name?.trim() || !edit.date) return
    const data = { name: edit.name.trim(), date: edit.date, emoji: edit.emoji ?? '📅', yearly: (edit.yearly ?? 0) as 0 | 1 }
    if (edit.id) await db.events.update(edit.id, data)
    else await db.events.add(data)
    setEdit(null)
  }
  async function remove() {
    if (!edit?.id || !confirm('Удалить событие?')) return
    await db.events.delete(edit.id)
    setEdit(null)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="События и отсчёты"
        actions={
          <Button onClick={() => setEdit({ emoji: '📅', yearly: 0, date: today })}>
            <Plus size={16} /> Событие
          </Button>
        }
      />
      {hero && (
        <Card className="bg-accent-soft/40 border-accent/30">
          <div className="flex items-center gap-4">
            <span className="text-5xl">{hero.e.emoji}</span>
            <div>
              <div className="text-sm text-ink-2">{hero.n.days === 0 ? 'Сегодня!' : 'Ближайшее'}</div>
              <div className="text-xl font-semibold">{hero.e.name}</div>
              <div className="text-sm text-muted">{fmtDate(hero.n.date, 'd MMMM yyyy, EEEE')}</div>
            </div>
            {hero.n.days > 0 && (
              <div className="ml-auto text-right">
                <div className="text-4xl font-bold tabular">{hero.n.days}</div>
                <div className="text-xs text-muted">{daysWord(hero.n.days)}</div>
              </div>
            )}
          </div>
        </Card>
      )}
      {items.length === 0 ? (
        <Empty icon="📅" title="Событий нет" text="Дни рождения, отпуск, дедлайны, Новый год. Ежегодные события повторяются сами." action={<Button onClick={() => setEdit({ emoji: '📅', yearly: 0, date: today })}>Добавить</Button>} />
      ) : (
        <Card padding={false}>
          <div className="divide-y divide-line">
            {[...upcoming, ...past].map(({ e, n }) => (
              <button key={e.id} type="button" onClick={() => setEdit(e)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/50">
                <span className="text-2xl">{e.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{e.name}</span>
                  <span className="block text-xs text-muted">
                    {fmtDate(n.date)}
                    {e.yearly && n.years ? ` · ${n.years} ${pluralRu(n.years, 'год', 'года', 'лет')}` : ''}
                    {e.yearly ? ' · ежегодно' : ''}
                  </span>
                </span>
                <span className={cx('text-sm tabular', n.days < 0 ? 'text-muted' : n.days <= 7 ? 'font-semibold text-accent' : '')}>{n.days === 0 ? 'сегодня' : n.days < 0 ? `${-n.days} ${daysWord(-n.days)} назад` : `через ${n.days} ${daysWord(n.days)}`}</span>
              </button>
            ))}
          </div>
        </Card>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Событие' : 'Новое событие'}>
        {edit && (
          <div className="space-y-3">
            <Field label="Название">
              <Input autoFocus placeholder="Например, День рождения мамы" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((em) => (
                <button key={em} type="button" onClick={() => setEdit({ ...edit, emoji: em })} className={cx('h-9 w-9 rounded-lg text-xl', edit.emoji === em ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface-2/60')}>
                  {em}
                </button>
              ))}
            </div>
            <Field label="Дата" hint={edit.yearly ? 'Для дня рождения укажи настоящий год рождения, чтобы считался возраст.' : undefined}>
              <Input type="date" value={edit.date ?? ''} onChange={(e) => setEdit({ ...edit, date: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!edit.yearly} onChange={(e) => setEdit({ ...edit, yearly: e.target.checked ? 1 : 0 })} className="h-4 w-4 accent-[var(--accent)]" />
              Повторяется каждый год
            </label>
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
    </div>
  )
}
