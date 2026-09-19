import { addDays, format, subDays, subMonths } from 'date-fns'
import { db } from '../db'
import { setSetting } from './settings'

// deterministic pseudo-random
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function gradientPhoto(w: number, h: number, a: string, b: string, emoji: string): Promise<Blob> {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, a)
  g.addColorStop(1, b)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.font = `${Math.round(Math.min(w, h) * 0.4)}px system-ui`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, w / 2, h / 2)
  return new Promise((res) => c.toBlob((bl) => res(bl!), 'image/jpeg', 0.85))
}

export async function seedDemo() {
  const r = rng(42)
  const today = new Date()
  const d = (x: Date) => format(x, 'yyyy-MM-dd')
  const cats = await db.categories.toArray()
  const exp = cats.filter((c) => c.type === 'expense')
  const inc = cats.filter((c) => c.type === 'income')

  // transactions: 6 months
  const txs = []
  for (let m = 5; m >= 0; m--) {
    const base = subMonths(today, m)
    const monthStart = new Date(base.getFullYear(), base.getMonth(), 1)
    const salary = inc.find((c) => c.name === 'Зарплата')!
    txs.push({ date: d(addDays(monthStart, 4)), type: 'income' as const, amount: 9_000_000, categoryId: salary.id, note: 'Зарплата', createdAt: Date.now() })
    if (r() > 0.4) {
      const fr = inc.find((c) => c.name === 'Фриланс')!
      txs.push({ date: d(addDays(monthStart, 10 + Math.floor(r() * 15))), type: 'income' as const, amount: Math.round(1_000_000 + r() * 3_000_000), categoryId: fr.id, note: 'Проект', createdAt: Date.now() })
    }
    const daysInMonth = m === 0 ? today.getDate() : new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
    for (let day = 1; day <= daysInMonth; day++) {
      const n = 1 + Math.floor(r() * 3)
      for (let i = 0; i < n; i++) {
        const c = exp[Math.floor(r() * exp.length)]
        const scale = c.name === 'Дом' ? 1_500_000 : c.name === 'Одежда' ? 600_000 : c.name === 'Еда' ? 120_000 : 80_000
        const amount = Math.round((scale * (0.3 + r())) / 1000) * 1000
        txs.push({ date: d(new Date(base.getFullYear(), base.getMonth(), day)), type: 'expense' as const, amount, categoryId: c.id, note: '', createdAt: Date.now() })
      }
    }
  }
  await db.transactions.bulkAdd(txs)
  await db.categories.update(exp.find((c) => c.name === 'Еда')!.id, { budget: 3_000_000 })
  await db.categories.update(exp.find((c) => c.name === 'Транспорт')!.id, { budget: 1_200_000 })
  await db.categories.update(exp.find((c) => c.name === 'Развлечения')!.id, { budget: 1_500_000 })

  // habits
  const habitIds = await db.habits.bulkAdd(
    [
      { name: 'Спорт', emoji: '🏋️', color: 0, createdAt: Date.now(), archived: 0 as const },
      { name: 'Чтение 20 мин', emoji: '📚', color: 2, createdAt: Date.now(), archived: 0 as const },
      { name: 'Вода 2 л', emoji: '💧', color: 1, createdAt: Date.now(), archived: 0 as const },
      { name: 'Без сахара', emoji: '🍬', color: 4, createdAt: Date.now(), archived: 0 as const },
    ],
    { allKeys: true },
  )
  const logs = []
  for (let i = 0; i < 120; i++) {
    const date = d(subDays(today, i))
    for (const id of habitIds) if (r() > 0.35) logs.push({ habitId: id as number, date })
  }
  await db.habitLogs.bulkAdd(logs)

  // moods
  const moods = []
  for (let i = 0; i < 200; i++) {
    if (r() < 0.15) continue
    moods.push({ date: d(subDays(today, i)), score: 1 + Math.min(4, Math.floor(r() * 5.2)), note: '' })
  }
  await db.moods.bulkPut(moods)

  // metrics
  const metrics = []
  let weight = 78
  for (let i = 60; i >= 0; i--) {
    weight += (r() - 0.52) * 0.4
    metrics.push({
      date: d(subDays(today, i)),
      steps: Math.round(3000 + r() * 9000),
      weight: Math.round(weight * 10) / 10,
      sleep: Math.round((5.5 + r() * 3) * 2) / 2,
      stepsSource: 'manual' as const,
    })
  }
  await db.metrics.bulkPut(metrics)

  // goals
  const g1 = await db.goals.add({ name: 'Машина', emoji: '🚗', target: 150_000_000, saved: 42_000_000, deadline: d(addDays(today, 400)), createdAt: subMonths(today, 4).getTime(), done: 0 })
  const g2 = await db.goals.add({ name: 'Поездка в Дубай', emoji: '✈️', target: 20_000_000, saved: 13_500_000, deadline: d(addDays(today, 90)), createdAt: subMonths(today, 3).getTime(), done: 0 })
  await db.goalDeposits.bulkAdd([
    { goalId: g1, date: d(subMonths(today, 3)), amount: 10_000_000 },
    { goalId: g1, date: d(subMonths(today, 2)), amount: 12_000_000 },
    { goalId: g1, date: d(subMonths(today, 1)), amount: 10_000_000 },
    { goalId: g1, date: d(today), amount: 10_000_000 },
    { goalId: g2, date: d(subMonths(today, 2)), amount: 5_000_000 },
    { goalId: g2, date: d(subMonths(today, 1)), amount: 4_500_000 },
    { goalId: g2, date: d(today), amount: 4_000_000 },
  ])

  // wishes
  await db.wishes.bulkAdd([
    { name: 'Наушники Sony WH-1000XM6', price: 4_500_000, priority: 1, bought: 0, createdAt: Date.now() },
    { name: 'Книга «Атомные привычки»', price: 150_000, priority: 2, bought: 0, createdAt: Date.now() },
    { name: 'Курс по монтажу', price: 1_200_000, priority: 2, bought: 0, createdAt: Date.now() },
    { name: 'Кроссовки для бега', price: 1_800_000, priority: 3, bought: 0, createdAt: Date.now() },
  ])

  // events
  const y = today.getFullYear()
  await db.events.bulkAdd([
    { name: 'Новый год', date: `${y + 1}-01-01`, emoji: '🎄', yearly: 1 },
    { name: 'День рождения мамы', date: `${y - 30}-${format(addDays(today, 23), 'MM-dd')}`, emoji: '🎂', yearly: 1 },
    { name: 'Отпуск', date: d(addDays(today, 47)), emoji: '🏖️', yearly: 0 },
  ])

  // notes
  await db.notes.bulkAdd([
    { title: 'Идеи на неделю', body: '— Разобрать фото с поездки\n— Позвонить стоматологу\n— Купить подарок брату', tags: ['дела'], pinned: 1, createdAt: Date.now(), updatedAt: Date.now() },
    { title: 'Цитата', body: 'Лучший момент посадить дерево был 20 лет назад. Второй лучший момент — сейчас.', tags: ['мысли'], pinned: 0, createdAt: Date.now() - 86400000, updatedAt: Date.now() - 86400000 },
    { title: 'Рецепт плова', body: 'Рис 1 кг, морковь 1 кг, мясо 1 кг, лук 3 шт, масло 250 мл, зира, барбарис, чеснок.', tags: ['еда'], pinned: 0, createdAt: Date.now() - 3 * 86400000, updatedAt: Date.now() - 3 * 86400000 },
  ])

  // photos (generated placeholders)
  const specs: [string, string, string, string, number][] = [
    ['#2a78d6', '#9085e9', '🏔️', 'Горы', 3],
    ['#eb6834', '#eda100', '🌅', 'Закат', 10],
    ['#1baf7a', '#2a78d6', '🌊', 'Море', 40],
    ['#e87ba4', '#d55181', '🌸', 'Весна', 120],
    ['#4a3aa7', '#0d366b', '🌃', 'Город', 200],
    ['#008300', '#1baf7a', '🌲', 'Лес', 365],
  ]
  for (const [a, b, emoji, name, ago] of specs) {
    const blob = await gradientPhoto(1200, 900, a, b, emoji)
    const thumb = await gradientPhoto(480, 360, a, b, emoji)
    await db.photos.add({ blob, thumb, name: name + '.jpg', takenAt: d(subDays(today, ago)), album: ago > 100 ? 'Поездки' : undefined, favorite: ago === 10 ? 1 : 0, createdAt: Date.now(), w: 1200, h: 900, size: blob.size })
  }

  await setSetting('demoLoaded', true)
  if (!(await db.settings.get('name'))) await setSetting('name', 'Нодирбек')
}
