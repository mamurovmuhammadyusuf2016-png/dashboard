import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Download, Star, Trash2, Upload } from 'lucide-react'
import { db, type Photo } from '../db'
import { exifDate, downloadBlob, preparePhoto, useObjectUrl } from '../lib/images'
import { fmtDate, todayStr } from '../lib/format'
import { storageInfo } from '../lib/backup'
import { Button, Card, Chip, Empty, Field, IconButton, Input, PageHeader, cx } from '../components/ui'

function Thumb({ p, onClick }: { p: Photo; onClick: () => void }) {
  const url = useObjectUrl(p.thumb)
  return (
    <button type="button" onClick={onClick} className="relative aspect-square overflow-hidden rounded-xl bg-surface-2">
      {url && <img src={url} alt={p.name} loading="lazy" className="h-full w-full object-cover transition hover:scale-[1.03]" />}
      {p.favorite ? <Star size={14} className="absolute right-1.5 top-1.5 fill-warn text-warn drop-shadow" /> : null}
    </button>
  )
}

export default function Photos() {
  const [album, setAlbum] = useState<string | null>(null)
  const [favOnly, setFavOnly] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const photos = useLiveQuery(() => db.photos.orderBy('takenAt').reverse().toArray(), []) ?? []
  useEffect(() => {
    void storageInfo().then(setStorage)
  }, [photos.length])

  const albums = useMemo(() => [...new Set(photos.map((p) => p.album).filter((a): a is string => !!a))].sort(), [photos])
  const visible = useMemo(() => photos.filter((p) => (!album || p.album === album) && (!favOnly || p.favorite)), [photos, album, favOnly])
  const groups = useMemo(() => {
    const g: { key: string; label: string; items: Photo[] }[] = []
    for (const p of visible) {
      const key = p.takenAt.slice(0, 7)
      let last = g[g.length - 1]
      if (!last || last.key !== key) {
        last = { key, label: format(parseISO(key + '-01'), 'LLLL yyyy', { locale: ru }), items: [] }
        g.push(last)
      }
      last.items.push(p)
    }
    return g
  }, [visible])

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    const arr = [...files].filter((f) => f.type.startsWith('image/'))
    setProgress({ done: 0, total: arr.length })
    for (let i = 0; i < arr.length; i++) {
      const f = arr[i]
      try {
        const takenAt = (await exifDate(f)) ?? (f.lastModified ? format(new Date(f.lastModified), 'yyyy-MM-dd') : todayStr())
        const { blob, thumb, w, h } = await preparePhoto(f)
        await db.photos.add({ blob, thumb, name: f.name, takenAt, favorite: 0, createdAt: Date.now(), w, h, size: blob.size, album: album ?? undefined })
      } catch (e) {
        console.error('photo failed', f.name, e)
      }
      setProgress({ done: i + 1, total: arr.length })
    }
    setTimeout(() => setProgress(null), 800)
    if (fileRef.current) fileRef.current.value = ''
  }

  const openIdx = openId === null ? -1 : visible.findIndex((p) => p.id === openId)
  const current = openIdx >= 0 ? visible[openIdx] : null

  return (
    <div className="space-y-4" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void onFiles(e.dataTransfer.files) }}>
      <PageHeader
        title="Фото"
        subtitle={storage && storage.quota ? `${photos.length} фото · занято ${(storage.usage / 1048576).toFixed(0)} МБ из ${(storage.quota / 1073741824).toFixed(1)} ГБ` : `${photos.length} фото`}
        actions={
          <>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
            <Button onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Загрузить
            </Button>
          </>
        }
      />
      {progress && (
        <Card className="text-sm">
          Загружаю {progress.done} из {progress.total}…
        </Card>
      )}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        <Chip active={!album && !favOnly} onClick={() => { setAlbum(null); setFavOnly(false) }}>Все</Chip>
        <Chip active={favOnly} onClick={() => setFavOnly((v) => !v)}>★ Избранное</Chip>
        {albums.map((a) => (
          <Chip key={a} active={album === a} onClick={() => setAlbum(album === a ? null : a)}>
            {a}
          </Chip>
        ))}
      </div>

      {groups.length === 0 ? (
        <Empty icon="📷" title="Пока нет фото" text="Загрузи фотографии с телефона или перетащи их сюда. Они хранятся только на этом устройстве." action={<Button onClick={() => fileRef.current?.click()}>Выбрать фото</Button>} />
      ) : (
        groups.map((g) => (
          <div key={g.key}>
            <div className="mb-2 text-sm font-semibold capitalize text-ink-2">{g.label}</div>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {g.items.map((p) => (
                <Thumb key={p.id} p={p} onClick={() => setOpenId(p.id)} />
              ))}
            </div>
          </div>
        ))
      )}

      <Lightbox photo={current} albums={albums} onClose={() => setOpenId(null)} onPrev={openIdx > 0 ? () => setOpenId(visible[openIdx - 1].id) : undefined} onNext={openIdx >= 0 && openIdx < visible.length - 1 ? () => setOpenId(visible[openIdx + 1].id) : undefined} />
    </div>
  )
}

function Lightbox({ photo, albums, onClose, onPrev, onNext }: { photo: Photo | null; albums: string[]; onClose: () => void; onPrev?: () => void; onNext?: () => void }) {
  const url = useObjectUrl(photo?.blob)
  const [albumEdit, setAlbumEdit] = useState('')
  useEffect(() => setAlbumEdit(photo?.album ?? ''), [photo?.id, photo?.album])
  useEffect(() => {
    if (!photo) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev?.()
      if (e.key === 'ArrowRight') onNext?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [photo, onClose, onPrev, onNext])
  if (!photo) return null

  async function remove() {
    if (!photo) return
    if (!confirm('Удалить фото?')) return
    const next = onNext ?? onPrev
    await db.photos.delete(photo.id)
    if (next) next()
    else onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white" onClick={onClose}>
      <div className="flex items-center justify-between p-3 safe-top" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{photo.name}</div>
          <div className="text-xs opacity-70">{fmtDate(photo.takenAt)}{photo.album ? ` · ${photo.album}` : ''}</div>
        </div>
        <div className="flex items-center gap-1">
          <IconButton label="Избранное" className="text-white hover:bg-white/10" onClick={() => db.photos.update(photo.id, { favorite: photo.favorite ? 0 : 1 })}>
            <Star size={18} className={cx(!!photo.favorite && 'fill-warn text-warn')} />
          </IconButton>
          <IconButton label="Скачать" className="text-white hover:bg-white/10" onClick={() => downloadBlob(photo.blob, photo.name)}>
            <Download size={18} />
          </IconButton>
          <IconButton label="Удалить" className="text-white hover:bg-white/10" onClick={remove}>
            <Trash2 size={18} />
          </IconButton>
          <Button variant="ghost" className="text-white hover:bg-white/10" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {url && <img src={url} alt={photo.name} className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />}
        {onPrev && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onPrev() }} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 hover:bg-black/60">
            <ChevronLeft />
          </button>
        )}
        {onNext && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onNext() }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 hover:bg-black/60">
            <ChevronRight />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 p-3 safe-bottom" onClick={(e) => e.stopPropagation()}>
        <Field label="Дата">
          <Input type="date" value={photo.takenAt} onChange={(e) => e.target.value && db.photos.update(photo.id, { takenAt: e.target.value })} className="bg-white/10 border-white/20 text-white" />
        </Field>
        <Field label="Альбом">
          <Input list="albums" placeholder="Например, Поездки" value={albumEdit} onChange={(e) => setAlbumEdit(e.target.value)} onBlur={() => db.photos.update(photo.id, { album: albumEdit.trim() || undefined })} className="bg-white/10 border-white/20 text-white placeholder:text-white/50" />
          <datalist id="albums">
            {albums.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </Field>
      </div>
    </div>
  )
}
