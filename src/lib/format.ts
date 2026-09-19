import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import { ru } from 'date-fns/locale'

export const CURRENCIES = [
  { code: 'UZS', label: 'Сум (UZS)', digits: 0 },
  { code: 'USD', label: 'Доллар (USD)', digits: 2 },
  { code: 'EUR', label: 'Евро (EUR)', digits: 2 },
  { code: 'RUB', label: 'Рубль (RUB)', digits: 0 },
  { code: 'KZT', label: 'Тенге (KZT)', digits: 0 },
  { code: 'KGS', label: 'Сом (KGS)', digits: 0 },
  { code: 'TRY', label: 'Лира (TRY)', digits: 2 },
] as const

export type CurrencyCode = (typeof CURRENCIES)[number]['code']

const fmtCache = new Map<string, Intl.NumberFormat>()

export function fmtMoney(n: number, currency: string, opts: { sign?: boolean } = {}) {
  const c = CURRENCIES.find((x) => x.code === currency) ?? CURRENCIES[0]
  const key = c.code
  let f = fmtCache.get(key)
  if (!f) {
    f = new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: c.code,
      maximumFractionDigits: c.digits,
      minimumFractionDigits: 0,
    })
    fmtCache.set(key, f)
  }
  // ru-RU uses narrow no-break spaces between groups: allow wrapping there, keep the
  // no-break space before the currency code so the code never wraps alone.
  const s = f.format(Math.abs(n)).replace(/\u202f/g, ' ')
  if (opts.sign) return (n < 0 ? '−' : '+') + s
  return n < 0 ? '−' + s : s
}

/** Short number for axes: 1,2 млн / 350 тыс. */
export function fmtShort(n: number) {
  const a = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (a >= 1_000_000_000) return sign + trim(a / 1_000_000_000) + ' млрд'
  if (a >= 1_000_000) return sign + trim(a / 1_000_000) + ' млн'
  if (a >= 1_000) return sign + trim(a / 1_000) + ' тыс'
  return sign + trim(a)
}
function trim(x: number) {
  return (Math.round(x * 10) / 10).toLocaleString('ru-RU')
}

export function fmtNum(n: number) {
  return Math.round(n).toLocaleString('ru-RU')
}

export function todayStr(d = new Date()) {
  return format(d, 'yyyy-MM-dd')
}

export function monthKey(d = new Date()) {
  return format(d, 'yyyy-MM')
}

export function fmtDate(s: string, pattern = 'd MMMM yyyy') {
  try {
    return format(parseISO(s), pattern, { locale: ru })
  } catch {
    return s
  }
}

export function fmtDay(s: string) {
  const today = todayStr()
  if (s === today) return 'Сегодня'
  const diff = differenceInCalendarDays(parseISO(today), parseISO(s))
  if (diff === 1) return 'Вчера'
  return fmtDate(s, 'd MMMM, EEEE')
}

export function fmtMonth(key: string) {
  return format(parseISO(key + '-01'), 'LLLL yyyy', { locale: ru })
}

export function pluralRu(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return many
  if (b > 1 && b < 5) return few
  if (b === 1) return one
  return many
}

export function daysWord(n: number) {
  return pluralRu(n, 'день', 'дня', 'дней')
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}
