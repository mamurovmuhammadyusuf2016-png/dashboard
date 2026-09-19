import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { applyTheme, resolveTheme, useSettings } from './settings'
import type { Theme } from './palette'

const ThemeCtx = createContext<Theme>('dark')

export function ThemeProvider({ children }: { children: ReactNode }) {
  const s = useSettings()
  const [t, setT] = useState<Theme>(() => resolveTheme(s.theme))
  useEffect(() => {
    setT(applyTheme(s.theme))
    if (s.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const h = () => setT(applyTheme('system'))
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [s.theme])
  return <ThemeCtx.Provider value={t}>{children}</ThemeCtx.Provider>
}

export const useTheme = () => useContext(ThemeCtx)
