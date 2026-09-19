import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

export type ThemePref = 'system' | 'light' | 'dark'

export interface Settings {
  name: string
  currency: string
  theme: ThemePref
  stepGoal: number
  weightGoal?: number
  healthConnected: boolean
  healthLastSync?: number
  calendarConnected?: boolean
  calendarLastSync?: number
  demoLoaded?: boolean
}

export const defaultSettings: Settings = {
  name: '',
  currency: 'UZS',
  theme: 'system',
  stepGoal: 8000,
  healthConnected: false,
}

export function useSettings(): Settings {
  const rows = useLiveQuery(() => db.settings.toArray(), [])
  const s: Settings = { ...defaultSettings }
  for (const r of rows ?? []) (s as unknown as Record<string, unknown>)[r.key] = r.value
  return s
}

export async function getSettings(): Promise<Settings> {
  const rows = await db.settings.toArray()
  const s: Settings = { ...defaultSettings }
  for (const r of rows) (s as unknown as Record<string, unknown>)[r.key] = r.value
  return s
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  await db.settings.put({ key, value })
  if (key === 'theme') {
    try {
      localStorage.setItem('theme', String(value))
    } catch {
      /* ignore */
    }
  }
}

export function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref
}

export function applyTheme(pref: ThemePref) {
  const t = resolveTheme(pref)
  document.documentElement.dataset.theme = t
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', t === 'dark' ? '#0d0d0d' : '#f4f4f1')
  return t
}
