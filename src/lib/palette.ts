// Chart palette (validated categorical order, light + dark steps).
export const SERIES = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
} as const

export const NEUTRAL = { light: '#a3a29b', dark: '#5f5e5a' }

// Sequential blue ramp, light -> dark (steps 100..700)
export const SEQ = {
  light: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'],
  dark: ['#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#86b6ef'],
}

// Mood 1..5: diverging red <-> blue with a neutral midpoint
export const MOOD = {
  light: ['#d03b3b', '#eca1a1', '#cfcec8', '#86b6ef', '#2a78d6'],
  dark: ['#e66767', '#8f4444', '#4a4a47', '#4b8fe0', '#86b6ef'],
}

export const CHROME = {
  light: { grid: '#e1e0d9', axis: '#c3c2b7', muted: '#898781', ink: '#0b0b0b', ink2: '#52514e', surface: '#fcfcfb', good: '#006300', bad: '#d03b3b' },
  dark: { grid: '#2c2c2a', axis: '#383835', muted: '#898781', ink: '#ffffff', ink2: '#c3c2b7', surface: '#1a1a19', good: '#0ca30c', bad: '#e66767' },
}

export type Theme = 'light' | 'dark'

export function seriesColor(slot: number, theme: Theme) {
  if (slot < 0) return NEUTRAL[theme]
  return SERIES[theme][slot % 8]
}

/** Solid swatch color for UI (category icons etc.) */
export function slotBg(slot: number, theme: Theme) {
  return seriesColor(slot, theme) + (theme === 'dark' ? '33' : '22')
}
