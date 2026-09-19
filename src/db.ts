import Dexie, { type EntityTable } from 'dexie'

export type TxType = 'expense' | 'income'

export interface Transaction {
  id: number
  date: string // YYYY-MM-DD
  type: TxType
  amount: number
  categoryId: number
  note?: string
  createdAt: number
}

export interface Category {
  id: number
  name: string
  type: TxType
  icon: string
  color: number // palette slot 0..7, -1 = neutral
  budget?: number // monthly budget (expense categories)
  order: number
}

export interface Photo {
  id: number
  blob: Blob
  thumb: Blob
  name: string
  takenAt: string // YYYY-MM-DD
  album?: string
  favorite: 0 | 1
  createdAt: number
  w: number
  h: number
  size: number
}

export interface Note {
  id: number
  title: string
  body: string
  tags: string[]
  pinned: 0 | 1
  createdAt: number
  updatedAt: number
}

export interface Mood {
  date: string
  score: number // 1..5
  note?: string
}

export interface Habit {
  id: number
  name: string
  emoji: string
  color: number
  createdAt: number
  archived: 0 | 1
}

export interface HabitLog {
  id: number
  habitId: number
  date: string
}

export interface Goal {
  id: number
  name: string
  emoji: string
  target: number
  saved: number
  deadline?: string
  createdAt: number
  done: 0 | 1
}

export interface GoalDeposit {
  id: number
  goalId: number
  date: string
  amount: number
}

export interface Metric {
  date: string
  steps?: number
  weight?: number
  sleep?: number
  stepsSource?: 'manual' | 'health' | 'import'
}

export interface Wish {
  id: number
  name: string
  price?: number
  priority: 1 | 2 | 3
  link?: string
  note?: string
  bought: 0 | 1
  boughtAt?: string
  createdAt: number
}

export interface LifeEvent {
  id: number
  name: string
  date: string
  emoji: string
  yearly: 0 | 1
}

export interface Setting {
  key: string
  value: unknown
}

/** Event pulled from the phone calendar (Samsung/Google) or imported from an .ics file */
export interface ExtEvent {
  id: number
  externalId: string
  title: string
  start: number // ms
  end: number // ms
  allDay: 0 | 1
  calendar?: string
  location?: string
  source: 'device' | 'ics'
}

export const db = new Dexie('mydash') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>
  categories: EntityTable<Category, 'id'>
  photos: EntityTable<Photo, 'id'>
  notes: EntityTable<Note, 'id'>
  moods: EntityTable<Mood, 'date'>
  habits: EntityTable<Habit, 'id'>
  habitLogs: EntityTable<HabitLog, 'id'>
  goals: EntityTable<Goal, 'id'>
  goalDeposits: EntityTable<GoalDeposit, 'id'>
  metrics: EntityTable<Metric, 'date'>
  wishes: EntityTable<Wish, 'id'>
  events: EntityTable<LifeEvent, 'id'>
  settings: EntityTable<Setting, 'key'>
  calendarEvents: EntityTable<ExtEvent, 'id'>
}

db.version(1).stores({
  transactions: '++id, date, type, categoryId',
  categories: '++id, type, order',
  photos: '++id, takenAt, album, favorite, createdAt',
  notes: '++id, pinned, updatedAt, *tags',
  moods: 'date',
  habits: '++id, archived',
  habitLogs: '++id, habitId, date, [habitId+date]',
  goals: '++id, done',
  goalDeposits: '++id, goalId, date',
  metrics: 'date',
  wishes: '++id, bought, priority',
  events: '++id, date',
  settings: 'key',
})

db.version(2).stores({
  calendarEvents: '++id, externalId, start, end, source',
})

export const defaultCategories: Omit<Category, 'id'>[] = [
  { name: 'Еда', type: 'expense', icon: '🍔', color: 0, order: 0 },
  { name: 'Транспорт', type: 'expense', icon: '🚕', color: 1, order: 1 },
  { name: 'Дом', type: 'expense', icon: '🏠', color: 2, order: 2 },
  { name: 'Одежда', type: 'expense', icon: '👕', color: 3, order: 3 },
  { name: 'Здоровье', type: 'expense', icon: '💊', color: 4, order: 4 },
  { name: 'Развлечения', type: 'expense', icon: '🎮', color: 5, order: 5 },
  { name: 'Связь', type: 'expense', icon: '📱', color: 6, order: 6 },
  { name: 'Подарки', type: 'expense', icon: '🎁', color: 7, order: 7 },
  { name: 'Другое', type: 'expense', icon: '📦', color: -1, order: 8 },
  { name: 'Зарплата', type: 'income', icon: '💼', color: 0, order: 0 },
  { name: 'Фриланс', type: 'income', icon: '💻', color: 1, order: 1 },
  { name: 'Подарки', type: 'income', icon: '🎁', color: 2, order: 2 },
  { name: 'Другое', type: 'income', icon: '💰', color: -1, order: 3 },
]

db.on('populate', () => {
  void db.categories.bulkAdd(defaultCategories as Category[])
})

export const tableNames = [
  'transactions',
  'categories',
  'photos',
  'notes',
  'moods',
  'habits',
  'habitLogs',
  'goals',
  'goalDeposits',
  'metrics',
  'wishes',
  'events',
  'settings',
  'calendarEvents',
] as const
export type TableName = (typeof tableNames)[number]
