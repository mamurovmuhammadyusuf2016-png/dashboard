import { useEffect, useRef, useState } from 'react'
import { Download, Smartphone, Sparkles, Trash2, Upload } from 'lucide-react'
import { CURRENCIES } from '../lib/format'
import { setSetting, useSettings, type ThemePref } from '../lib/settings'
import { clearAll, exportBackup, importBackup, requestPersist, storageInfo } from '../lib/backup'
import { seedDemo } from '../lib/demo'
import { downloadBlob } from '../lib/images'
import { isNative } from '../lib/native'
import { Button, Card, Field, Input, PageHeader, Segmented, Select } from '../components/ui'

export const REPO_URL = 'https://github.com/mamurovmuhammadyusuf2016-png/dashboard'
export const APK_URL = `${REPO_URL}/releases/latest/download/dashboard.apk`
export const WEB_URL = 'https://mamurovmuhammadyusuf2016-png.github.io/dashboard/'

export default function SettingsPage() {
  const s = useSettings()
  const [name, setName] = useState(s.name)
  const [stepGoal, setStepGoal] = useState(String(s.stepGoal))
  const [storage, setStorage] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')

  useEffect(() => setName(s.name), [s.name])
  useEffect(() => setStepGoal(String(s.stepGoal)), [s.stepGoal])
  useEffect(() => {
    void storageInfo().then(setStorage)
  }, [msg])

  async function doExport(withPhotos: boolean) {
    setBusy(true)
    try {
      const blob = await exportBackup(withPhotos)
      downloadBlob(blob, `dashboard-backup-${new Date().toISOString().slice(0, 10)}${withPhotos ? '-with-photos' : ''}.json`)
      setMsg('Резервная копия скачана')
    } finally {
      setBusy(false)
    }
  }
  async function doImport(f: File | undefined) {
    if (!f) return
    if (importMode === 'replace' && !confirm('Все текущие данные будут заменены данными из файла. Продолжить?')) return
    setBusy(true)
    try {
      const counts = await importBackup(f, importMode)
      setMsg('Импортировано: ' + Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', '))
    } catch (e) {
      setMsg('Ошибка импорта: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
      if (importRef.current) importRef.current.value = ''
    }
  }
  async function doClear() {
    if (!confirm('Удалить ВСЕ данные: финансы, фото, заметки, всё? Это нельзя отменить.')) return
    if (!confirm('Точно? Сначала лучше сделать резервную копию.')) return
    await clearAll()
    setMsg('Все данные удалены')
  }
  async function doDemo() {
    setBusy(true)
    try {
      await seedDemo()
      setMsg('Демо-данные загружены')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Настройки" />
      {msg && <Card className="text-sm text-accent">{msg}</Card>}
      <Card title="Профиль">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Как тебя зовут">
            <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setSetting('name', name.trim())} placeholder="Имя" />
          </Field>
          <Field label="Валюта">
            <Select value={s.currency} onChange={(e) => setSetting('currency', e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Цель по шагам в день">
            <Input inputMode="numeric" value={stepGoal} onChange={(e) => setStepGoal(e.target.value)} onBlur={() => setSetting('stepGoal', Number(stepGoal.replace(/\D/g, '')) || 8000)} />
          </Field>
          <Field label="Целевой вес, кг (необязательно)">
            <Input inputMode="decimal" defaultValue={s.weightGoal ?? ''} onBlur={(e) => setSetting('weightGoal', Number(e.target.value.replace(',', '.')) || undefined)} />
          </Field>
        </div>
        <div className="mt-3">
          <div className="mb-1 text-xs font-medium text-ink-2">Тема</div>
          <Segmented value={s.theme} onChange={(v: ThemePref) => setSetting('theme', v)} options={[{ value: 'system', label: 'Как в системе' }, { value: 'light', label: 'Светлая' }, { value: 'dark', label: 'Тёмная' }]} />
        </div>
      </Card>

      <Card title="Данные">
        <p className="mb-3 text-sm text-muted">
          Всё хранится только на этом устройстве, в браузере. Чтобы перенести данные на телефон или не потерять их, делай резервную копию.
          {storage && storage.quota ? ` Занято ${(storage.usage / 1048576).toFixed(1)} МБ из ${(storage.quota / 1073741824).toFixed(1)} ГБ.` : ''}
          {storage && !storage.persisted ? ' Хранилище пока не закреплено — браузер теоретически может его очистить.' : ''}
        </p>
        {storage && !storage.persisted && (
          <Button variant="ghost" size="sm" className="mb-3" onClick={() => requestPersist().then(() => storageInfo().then(setStorage))}>
            Закрепить хранилище
          </Button>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="soft" disabled={busy} onClick={() => doExport(false)}>
            <Download size={16} /> Копия без фото
          </Button>
          <Button variant="soft" disabled={busy} onClick={() => doExport(true)}>
            <Download size={16} /> Копия с фото
          </Button>
          <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(e) => doImport(e.target.files?.[0])} />
          <Button variant="ghost" disabled={busy} onClick={() => importRef.current?.click()}>
            <Upload size={16} /> Восстановить из файла
          </Button>
          <Segmented value={importMode} onChange={setImportMode} options={[{ value: 'merge', label: 'Добавить' }, { value: 'replace', label: 'Заменить' }]} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="ghost" disabled={busy} onClick={doDemo}>
            <Sparkles size={16} /> Загрузить демо-данные
          </Button>
          <Button variant="danger" disabled={busy} onClick={doClear}>
            <Trash2 size={16} /> Удалить все данные
          </Button>
        </div>
      </Card>

      <Card title="Приложение">
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <Smartphone size={18} className="mt-0.5 shrink-0 text-accent" />
            <div>
              <div className="font-medium">Android-приложение (APK)</div>
              <div className="text-muted">Считает шаги из телефона через Health Connect. Скачай и установи, разрешив установку из неизвестных источников.</div>
              <a href={APK_URL} className="mt-1 inline-block break-all text-accent underline" target="_blank" rel="noreferrer">
                {APK_URL}
              </a>
            </div>
          </div>
          {!isNative && (
            <div className="rounded-xl bg-surface-2/50 p-3 text-muted">
              На планшете или в браузере телефона: открой меню браузера и выбери «Добавить на главный экран» — дашборд станет как приложение и будет работать без интернета.
            </div>
          )}
          <div className="text-xs text-muted">
            Веб-версия: <a href={WEB_URL} className="text-accent underline">{WEB_URL}</a> · Код: <a href={REPO_URL} className="text-accent underline">GitHub</a>
          </div>
        </div>
      </Card>
    </div>
  )
}
