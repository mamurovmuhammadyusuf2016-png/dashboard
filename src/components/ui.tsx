import { useEffect, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { X } from 'lucide-react'

export function cx(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(' ')
}

export function Card({ children, className, title, action, padding = true }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; padding?: boolean }) {
  return (
    <section className={cx('rounded-2xl bg-surface border border-border', padding && 'p-4', className)}>
      {(title || action) && (
        <div className={cx('flex items-center justify-between gap-3 mb-3', !padding && 'px-4 pt-4')}>
          {title && <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wide">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'soft'; size?: 'sm' | 'md' | 'lg' }
export function Button({ variant = 'primary', size = 'md', className, ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
        size === 'sm' && 'h-8 px-3 text-sm',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-5 text-base',
        variant === 'primary' && 'bg-accent text-white hover:opacity-90',
        variant === 'soft' && 'bg-accent-soft text-accent hover:opacity-90',
        variant === 'ghost' && 'bg-transparent text-ink-2 hover:bg-surface-2',
        variant === 'danger' && 'bg-bad/10 text-bad hover:bg-bad/20',
        className,
      )}
    />
  )
}

export function IconButton({ className, label, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button aria-label={label} title={label} {...p} className={cx('inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2 transition disabled:opacity-40', className)} />
}

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx('h-11 w-full rounded-xl border border-border bg-surface-2/60 px-3 text-base text-ink placeholder:text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/25', className)} />
}

export function Select({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx('h-11 w-full rounded-xl border border-border bg-surface-2/60 px-3 text-base text-ink outline-none focus:border-accent', className)} />
}

export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx('w-full rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-base text-ink placeholder:text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/25', className)} />
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={cx('max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl sm:rounded-3xl safe-bottom', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <IconButton label="Закрыть" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Stat({ label, value, sub, tone, icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' | 'neutral'; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface border border-border p-4 min-w-0">
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-ink-2">
        <span className="truncate">{label}</span>
        {icon && <span className="text-muted">{icon}</span>}
      </div>
      <div className={cx('mt-1 text-lg font-semibold leading-tight tracking-tight sm:text-2xl', tone === 'good' && 'text-good', tone === 'bad' && 'text-bad')}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted truncate">{sub}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center">
      {icon && <div className="mb-2 text-3xl">{icon}</div>}
      <div className="font-medium">{title}</div>
      {text && <div className="mt-1 max-w-sm text-sm text-muted">{text}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Chip({ active, children, onClick, className }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cx('h-8 shrink-0 rounded-full border px-3 text-sm transition', active ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface text-ink-2 hover:bg-surface-2', className)}>
      {children}
    </button>
  )
}

export function Progress({ value, color, className }: { value: number; color?: string; className?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-surface-2', className)}>
      <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: color ?? 'var(--accent)' }} />
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} className={cx('h-8 rounded-lg px-3 text-sm font-medium transition', value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-2')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Row({ left, title, sub, right, onClick }: { left?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void }) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp onClick={onClick} className={cx('flex w-full items-center gap-3 py-2.5 text-left', onClick && 'hover:bg-surface-2/60 -mx-2 px-2 rounded-xl transition')}>
      {left && <div className="shrink-0">{left}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        {sub && <div className="truncate text-xs text-muted">{sub}</div>}
      </div>
      {right && <div className="shrink-0 text-right">{right}</div>}
    </Comp>
  )
}
