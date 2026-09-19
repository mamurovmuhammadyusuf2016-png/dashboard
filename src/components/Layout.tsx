import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Calendar, CalendarDays, CircleCheck, Gift, HeartPulse, Home, Image, LayoutGrid, NotebookPen, Settings, Smile, Target, Wallet } from 'lucide-react'
import { Modal, cx } from './ui'

const MAIN = [
  { to: '/', label: 'Сегодня', icon: Home },
  { to: '/finance', label: 'Финансы', icon: Wallet },
  { to: '/photos', label: 'Фото', icon: Image },
  { to: '/notes', label: 'Заметки', icon: NotebookPen },
]
const MORE = [
  { to: '/calendar', label: 'Календарь', icon: Calendar },
  { to: '/habits', label: 'Привычки', icon: CircleCheck },
  { to: '/mood', label: 'Настроение', icon: Smile },
  { to: '/goals', label: 'Цели', icon: Target },
  { to: '/health', label: 'Здоровье', icon: HeartPulse },
  { to: '/wishlist', label: 'Вишлист', icon: Gift },
  { to: '/events', label: 'События', icon: CalendarDays },
  { to: '/settings', label: 'Настройки', icon: Settings },
]

export function Layout() {
  const [more, setMore] = useState(false)
  const loc = useLocation()
  const moreActive = MORE.some((m) => loc.pathname.startsWith(m.to))
  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-border md:bg-surface md:sticky md:top-0 md:h-dvh">
        <div className="px-5 py-5">
          <div className="text-lg font-bold tracking-tight">Мой дашборд</div>
          <div className="text-xs text-muted">всё о моей жизни</div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {[...MAIN, ...MORE].map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition', isActive ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-surface-2')}>
              <n.icon size={18} />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 safe-top">
        <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-4 md:px-8 md:pb-10 md:pt-8">
          <Outlet />
        </div>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur md:hidden safe-bottom">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
          {MAIN.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cx('flex w-16 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium', isActive ? 'text-accent' : 'text-muted')}>
              <n.icon size={22} />
              {n.label}
            </NavLink>
          ))}
          <button type="button" onClick={() => setMore(true)} className={cx('flex w-16 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium', moreActive ? 'text-accent' : 'text-muted')}>
            <LayoutGrid size={22} />
            Ещё
          </button>
        </div>
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title="Разделы">
        <div className="grid grid-cols-3 gap-2">
          {MORE.map((n) => (
            <NavLink key={n.to} to={n.to} onClick={() => setMore(false)} className={({ isActive }) => cx('flex flex-col items-center gap-2 rounded-2xl border border-border p-4 text-xs font-medium', isActive ? 'bg-accent-soft text-accent border-accent/40' : 'bg-surface-2/50 text-ink-2')}>
              <n.icon size={22} />
              {n.label}
            </NavLink>
          ))}
        </div>
      </Modal>
    </div>
  )
}
