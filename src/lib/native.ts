import { Capacitor } from '@capacitor/core'
import { format, subDays, startOfDay } from 'date-fns'
import { db } from '../db'
import { setSetting } from './settings'

export const isNative = Capacitor.isNativePlatform()
export const platform = Capacitor.getPlatform()

async function plugin() {
  const m = await import('@capgo/capacitor-health')
  return m.Health
}

export async function healthAvailable(): Promise<{ available: boolean; reason?: string }> {
  if (!isNative) return { available: false, reason: 'web' }
  try {
    const r = await (await plugin()).isAvailable()
    return { available: r.available, reason: r.reason }
  } catch (e) {
    return { available: false, reason: String(e) }
  }
}

export async function healthRequest(): Promise<boolean> {
  const H = await plugin()
  const st = await H.requestAuthorization({ read: ['steps', 'weight'], write: [], requestHistoryAccess: true })
  const ok = st.readAuthorized.includes('steps')
  await setSetting('healthConnected', ok)
  return ok
}

export async function healthCheck(): Promise<boolean> {
  try {
    const H = await plugin()
    const st = await H.checkAuthorization({ read: ['steps'], write: [] })
    return st.readAuthorized.includes('steps')
  } catch {
    return false
  }
}

export async function openHealthSettings() {
  try {
    await (await plugin()).openHealthConnectSettings()
  } catch {
    /* ignore */
  }
}

/** Pull daily steps (and weight when available) from Health Connect into the local DB. */
export async function syncHealth(days = 30): Promise<{ days: number }> {
  const H = await plugin()
  const end = new Date()
  const start = startOfDay(subDays(end, days - 1))
  const { samples } = await H.queryAggregated({
    dataType: 'steps',
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    bucket: 'day',
    aggregation: 'sum',
  })
  let n = 0
  await db.transaction('rw', db.metrics, async () => {
    for (const s of samples) {
      const steps = Math.round(s.value)
      if (!steps) continue
      const date = format(new Date(s.startDate), 'yyyy-MM-dd')
      const cur = await db.metrics.get(date)
      await db.metrics.put({ ...(cur ?? { date }), date, steps, stepsSource: 'health' })
      n++
    }
  })
  try {
    const w = await H.queryAggregated({
      dataType: 'weight',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      bucket: 'day',
      aggregation: 'average',
    })
    await db.transaction('rw', db.metrics, async () => {
      for (const s of w.samples) {
        if (!s.value) continue
        const date = format(new Date(s.startDate), 'yyyy-MM-dd')
        const cur = await db.metrics.get(date)
        await db.metrics.put({ ...(cur ?? { date }), date, weight: Math.round(s.value * 10) / 10 })
      }
    })
  } catch {
    /* weight is optional */
  }
  await setSetting('healthLastSync', Date.now())
  return { days: n }
}
