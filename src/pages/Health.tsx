import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { FileUp, Footprints, Moon, Plus, RefreshCw, Scale, Smartphone } from 'lucide-react'
import { db } from '../db'
import { setSetting, useSettings } from '../lib/settings'
import { fmtNum, todayStr } from '../lib/format'
import { parseStepsCsv } from '../lib/csv'
import { healthAvailable, healthRequest, isNative, openHealthSettings, syncHealth } from '../lib/native'
import { Button, Card, Field, Input, Modal, PageHeader, Progress, Stat } from '../components/ui'
import { SimpleBars, ValueLine } from '../components/charts'

export default function Health() {
  const s = useSettings()
  const today = todayStr()
  const since90 = format(subDays(new Date(), 89), 'yyyy-MM-dd')
  const metrics = useLiveQuery(() => db.metrics.where('date').between(since90, today, true, true).toArray(), [since90, today]) ?? []
  const byDate = useMemo(() => new Map(metrics.map((m) => [m.date, m])), [metrics])
  const [entry, setEntry] = useState<{ date: string; steps: string; weight: string; sleep: string } | null>(null)
  const [csv, setCsv] = useState<{ rows: { date: string; steps: number }[]; name: string } | null>(null)
  const [hc, setHc] = useState<{ available: boolean; reason?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isNative) void healthAvailable().then(setHc)
  }, [])

  const last14 = useMemo(() => Array.from({ length: 14 }, (_, i) => format(subDays(new Date(), 13 - i), 'yyyy-MM-dd')), [])
  const stepsData = last14.map((d) => ({ label: format(new Date(d), 'd', { locale: ru }), value: byDate.get(d)?.steps ?? 0, muted: d === today }))
  const sleepData = last14.map((d) => ({ label: format(new Date(d), 'd', { locale: ru }), value: byDate.get(d)?.sleep ?? 0 }))
  const weightData = metrics.filter((m) => m.weight).map((m) => ({ label: format(new Date(m.date), 'd MMM', { locale: ru }), value: m.weight as number }))
  const todaySteps = byDate.get(today)?.steps ?? 0
  const week = last14.slice(7)
  const weekAvg = Math.round(week.reduce((a, d) => a + (byDate.get(d)?.steps ?? 0), 0) / 7)
  const lastWeight = [...metrics].reverse().find((m) => m.weight)
  const weight30 = metrics.find((m) => m.weight && m.date >= format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const lastSleep = [...metrics].reverse().find((m) => m.sleep)
  const sleepAvg = week.reduce((a, d) => a + (byDate.get(d)?.sleep ?? 0), 0) / Math.max(1, week.filter((d) => byDate.get(d)?.sleep).length)

  async function saveEntry() {
    if (!entry) return
    const cur = (await db.metrics.get(entry.date)) ?? { date: entry.date }
    const next = { ...cur }
    if (entry.steps) {
      next.steps = Number(entry.steps.replace(/\D/g, ''))
      next.stepsSource = 'manual'
    }
    if (entry.weight) next.weight = Number(entry.weight.replace(',', '.'))
    if (entry.sleep) next.sleep = Number(entry.sleep.replace(',', '.'))
    await db.metrics.put(next)
    setEntry(null)
  }
  async function onCsv(f: File | undefined) {
    if (!f) return
    const rows = parseStepsCsv(await f.text())
    setCsv({ rows, name: f.name })
    if (fileRef.current) fileRef.current.value = ''
  }
  async function importCsv() {
    if (!csv) return
    await db.transaction('rw', db.metrics, async () => {
      for (const r of csv.rows) {
        const cur = (await db.metrics.get(r.date)) ?? { date: r.date }
        await db.metrics.put({ ...cur, steps: r.steps, stepsSource: 'import' })
      }
    })
    setMsg(`Импортировано дней: ${csv.rows.length}`)
    setCsv(null)
  }
  async function connect() {
    setBusy(true)
    setMsg('')
    try {
      const ok = await healthRequest()
      if (!ok) {
        setMsg('Доступ к шагам не выдан. Открой настройки Health Connect и разреши чтение шагов.')
        return
      }
      const r = await syncHealth(30)
      setMsg(`Готово: загружено дней с шагами — ${r.days}`)
    } catch (e) {
      setMsg('Ошибка: ' + String(e))
    } finally {
      setBusy(false)
    }
  }
  async function refresh() {
    setBusy(true)
    setMsg('')
    try {
      const r = await syncHealth(30)
      setMsg(`Обновлено: ${r.days} дн.`)
    } catch (e) {
      setMsg('Ошибка: ' + String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Здоровье"
        actions={
          <>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => onCsv(e.target.files?.[0])} />
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>
              <FileUp size={16} /> CSV
            </Button>
            <Button onClick={() => setEntry({ date: today, steps: '', weight: '', sleep: '' })}>
              <Plus size={16} /> Записать
            </Button>
          </>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Smartphone className="mt-0.5 shrink-0 text-accent" size={20} />
            <div className="text-sm">
              {isNative ? (
                <>
                  <div className="font-medium">Шаги из телефона (Health Connect)</div>
                  <div className="text-muted">
                    {hc === null ? 'Проверяю…' : hc.available ? (s.healthConnected ? `Подключено${s.healthLastSync ? ` · обновлено ${format(s.healthLastSync, 'd MMM HH:mm', { locale: ru })}` : ''}` : 'Разреши доступ, и шаги из твоего приложения-шагомера будут подтягиваться сами.') : 'Health Connect не найден. Установи «Health Connect» из Play Store (на Android 14+ он уже встроен).'}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-medium">Автоматические шаги работают в Android-приложении</div>
                  <div className="text-muted">Здесь, в браузере, шаги можно ввести вручную или импортировать CSV из приложения-шагомера (Google Fit, Samsung Health, Mi Fitness).</div>
                </>
              )}
              {msg && <div className="mt-1 text-accent">{msg}</div>}
            </div>
          </div>
          {isNative && hc?.available && (
            <div className="flex shrink-0 gap-2">
              {s.healthConnected ? (
                <Button variant="soft" disabled={busy} onClick={refresh}>
                  <RefreshCw size={16} className={busy ? 'animate-spin' : ''} /> Обновить
                </Button>
              ) : (
                <Button disabled={busy} onClick={connect}>
                  Подключить
                </Button>
              )}
              <Button variant="ghost" onClick={openHealthSettings}>
                Настройки
              </Button>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Шаги сегодня" value={fmtNum(todaySteps)} sub={`цель ${fmtNum(s.stepGoal)}`} icon={<Footprints size={16} />} tone={todaySteps >= s.stepGoal ? 'good' : undefined} />
        <Stat label="Среднее за неделю" value={fmtNum(weekAvg)} sub="шагов в день" />
        <Stat label="Вес" value={lastWeight?.weight ? `${lastWeight.weight} кг` : '—'} sub={lastWeight && weight30?.weight && weight30.date !== lastWeight.date ? `${(lastWeight.weight! - weight30.weight).toFixed(1) > '0' ? '+' : ''}${(lastWeight.weight! - weight30.weight).toFixed(1)} кг за 30 дней` : s.weightGoal ? `цель ${s.weightGoal} кг` : undefined} icon={<Scale size={16} />} />
        <Stat label="Сон" value={lastSleep?.sleep ? `${lastSleep.sleep} ч` : '—'} sub={sleepAvg ? `в среднем ${sleepAvg.toFixed(1)} ч` : undefined} icon={<Moon size={16} />} />
      </div>

      <Card title="Шаги, 14 дней">
        <Progress value={(todaySteps / s.stepGoal) * 100} className="mb-3" />
        <SimpleBars data={stepsData} goal={s.stepGoal} fmt={(v) => fmtNum(v) + ' шагов'} unitName="Шаги" />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Вес, 90 дней" action={<button className="text-xs text-accent" onClick={() => { const v = prompt('Целевой вес, кг', String(s.weightGoal ?? '')); if (v !== null) void setSetting('weightGoal', Number(v.replace(',', '.')) || undefined) }}>цель</button>}>
          {weightData.length ? <ValueLine data={weightData} goal={s.weightGoal} fmt={(v) => v + ' кг'} unitName="Вес" slot={2} /> : <div className="py-10 text-center text-sm text-muted">Запиши вес, чтобы увидеть график</div>}
        </Card>
        <Card title="Сон, 14 дней">
          <SimpleBars data={sleepData} goal={8} slot={6} fmt={(v) => v + ' ч'} unitName="Сон" />
        </Card>
      </div>

      <Modal open={!!entry} onClose={() => setEntry(null)} title="Записать показатели">
        {entry && (
          <div className="space-y-3">
            <Field label="Дата">
              <Input type="date" value={entry.date} onChange={(e) => setEntry({ ...entry, date: e.target.value })} />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Шаги">
                <Input inputMode="numeric" placeholder="8000" value={entry.steps} onChange={(e) => setEntry({ ...entry, steps: e.target.value })} />
              </Field>
              <Field label="Вес, кг">
                <Input inputMode="decimal" placeholder="75.5" value={entry.weight} onChange={(e) => setEntry({ ...entry, weight: e.target.value })} />
              </Field>
              <Field label="Сон, ч">
                <Input inputMode="decimal" placeholder="7.5" value={entry.sleep} onChange={(e) => setEntry({ ...entry, sleep: e.target.value })} />
              </Field>
            </div>
            <Button className="w-full" size="lg" onClick={saveEntry}>
              Сохранить
            </Button>
          </div>
        )}
      </Modal>
      <Modal open={!!csv} onClose={() => setCsv(null)} title="Импорт шагов из CSV">
        {csv && (
          <div className="space-y-3 text-sm">
            <div>
              Файл: <span className="font-medium">{csv.name}</span>
            </div>
            {csv.rows.length ? (
              <>
                <div>
                  Найдено дней: <span className="font-medium">{csv.rows.length}</span> ({csv.rows[0].date} — {csv.rows[csv.rows.length - 1].date})
                </div>
                <Button className="w-full" onClick={importCsv}>
                  Импортировать
                </Button>
              </>
            ) : (
              <div className="text-bad">Не нашёл колонку с шагами. Нужен CSV, где есть дата и количество шагов.</div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
