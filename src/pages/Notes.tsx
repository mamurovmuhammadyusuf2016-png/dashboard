import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pin, Plus, Search, Trash2 } from 'lucide-react'
import { db, type Note } from '../db'
import { fmtDate } from '../lib/format'
import { format } from 'date-fns'
import { Button, Card, Chip, Empty, Field, Input, Modal, PageHeader, Textarea, cx } from '../components/ui'

export default function Notes() {
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [edit, setEdit] = useState<Partial<Note> | null>(null)
  const notes = useLiveQuery(() => db.notes.orderBy('updatedAt').reverse().toArray(), []) ?? []
  const tags = useMemo(() => [...new Set(notes.flatMap((n) => n.tags))].sort(), [notes])
  const list = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return notes
      .filter((n) => (!tag || n.tags.includes(tag)) && (!qq || n.title.toLowerCase().includes(qq) || n.body.toLowerCase().includes(qq) || n.tags.some((t) => t.includes(qq))))
      .sort((a, b) => b.pinned - a.pinned || b.updatedAt - a.updatedAt)
  }, [notes, q, tag])

  async function save() {
    if (!edit) return
    const title = (edit.title ?? '').trim()
    const body = (edit.body ?? '').trim()
    if (!title && !body) return setEdit(null)
    const tagsArr = [...new Set((edit.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))]
    const now = Date.now()
    if (edit.id) await db.notes.update(edit.id, { title, body, tags: tagsArr, pinned: edit.pinned ?? 0, updatedAt: now })
    else await db.notes.add({ title, body, tags: tagsArr, pinned: edit.pinned ?? 0, createdAt: now, updatedAt: now })
    setEdit(null)
  }
  async function remove() {
    if (!edit?.id) return setEdit(null)
    if (!confirm('Удалить заметку?')) return
    await db.notes.delete(edit.id)
    setEdit(null)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Заметки"
        subtitle={`${notes.length} заметок`}
        actions={
          <Button onClick={() => setEdit({ title: '', body: '', tags: [], pinned: 0 })}>
            <Plus size={16} /> Заметка
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 pl-9" />
        </div>
        {tags.length > 0 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {tags.map((t) => (
              <Chip key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
                #{t}
              </Chip>
            ))}
          </div>
        )}
      </div>
      {list.length === 0 ? (
        <Empty icon="📝" title="Заметок нет" text="Идеи, списки, мысли — всё сюда." action={<Button onClick={() => setEdit({ title: '', body: '', tags: [], pinned: 0 })}>Написать</Button>} />
      ) : (
        <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 [&>*]:mb-3 [&>*]:break-inside-avoid">
          {list.map((n) => (
            <Card key={n.id} className={cx('cursor-pointer hover:border-accent/40', !!n.pinned && 'border-accent/40')}>
              <button type="button" className="block w-full text-left" onClick={() => setEdit(n)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold">{n.title || 'Без названия'}</div>
                  {n.pinned ? <Pin size={14} className="mt-1 shrink-0 text-accent" /> : null}
                </div>
                {n.body && <div className="mt-1 line-clamp-6 whitespace-pre-line text-sm text-ink-2">{n.body}</div>}
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  {n.tags.map((t) => (
                    <span key={t} className="rounded-md bg-surface-2 px-1.5 py-0.5">#{t}</span>
                  ))}
                  <span className="ml-auto">{fmtDate(format(n.updatedAt, 'yyyy-MM-dd'), 'd MMM')}</span>
                </div>
              </button>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!edit} onClose={save} title={edit?.id ? 'Заметка' : 'Новая заметка'} wide>
        {edit && (
          <div className="space-y-3">
            <Input placeholder="Заголовок" value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className="text-lg font-semibold" autoFocus />
            <Textarea rows={10} placeholder="Текст заметки…" value={edit.body ?? ''} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
            <Field label="Теги через запятую">
              <Input placeholder="идеи, дела" value={(edit.tags ?? []).join(', ')} onChange={(e) => setEdit({ ...edit, tags: e.target.value.split(',') })} />
            </Field>
            <div className="flex items-center gap-2">
              <Button variant={edit.pinned ? 'soft' : 'ghost'} size="sm" onClick={() => setEdit({ ...edit, pinned: edit.pinned ? 0 : 1 })}>
                <Pin size={14} /> {edit.pinned ? 'Закреплена' : 'Закрепить'}
              </Button>
              {edit.id && (
                <Button variant="danger" size="sm" onClick={remove}>
                  <Trash2 size={14} /> Удалить
                </Button>
              )}
              <Button className="ml-auto" onClick={save}>
                Готово
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
