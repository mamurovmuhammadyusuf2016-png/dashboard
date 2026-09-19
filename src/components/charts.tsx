import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHROME, SERIES, seriesColor } from '../lib/palette'
import { useTheme } from '../lib/theme'
import { fmtMoney, fmtShort } from '../lib/format'

type TipPayload = { name?: string; value?: number | string; color?: string; dataKey?: string | number; payload?: Record<string, unknown> }

function Tip({ active, payload, label, fmt, names }: { active?: boolean; payload?: TipPayload[]; label?: string | number; fmt: (v: number) => string; names?: Record<string, string> }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      {label !== undefined && <div className="mb-1 font-medium text-ink-2">{String(label)}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 tabular">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
          <span className="text-muted">{names?.[String(p.dataKey)] ?? p.name}</span>
          <span className="ml-auto font-medium">{fmt(Number(p.value))}</span>
        </div>
      ))}
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

export function MonthlyBars({ data, currency }: { data: { label: string; income: number; expense: number }[]; currency: string }) {
  const t = useTheme()
  const c = CHROME[t]
  const exp = SERIES[t][0]
  const inc = SERIES[t][2]
  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="label" tick={{ fill: c.muted, fontSize: 11 }} axisLine={{ stroke: c.axis }} tickLine={false} />
          <YAxis tick={{ fill: c.muted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmtShort} width={52} />
          <Tooltip cursor={{ fill: c.grid, opacity: 0.4 }} content={<Tip fmt={(v) => fmtMoney(v, currency)} names={{ expense: 'Расходы', income: 'Доходы' }} />} />
          <Bar dataKey="expense" fill={exp} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="income" fill={inc} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
      <Legend items={[{ label: 'Расходы', color: exp }, { label: 'Доходы', color: inc }]} />
    </div>
  )
}

export function Donut({ data, currency, total }: { data: { name: string; value: number; slot: number }[]; currency: string; total: number }) {
  const t = useTheme()
  const c = CHROME[t]
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="96%" paddingAngle={2} stroke={c.surface} strokeWidth={2} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.name} fill={seriesColor(d.slot, t)} />
              ))}
            </Pie>
            <Tooltip content={<Tip fmt={(v) => fmtMoney(v, currency)} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[10px] uppercase tracking-wide text-muted">Всего</div>
          <div className="text-sm font-semibold tabular">{fmtShort(total)}</div>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: seriesColor(d.slot, t) }} />
            <span className="truncate text-ink-2">{d.name}</span>
            <span className="ml-auto shrink-0 text-xs text-muted tabular">{total ? Math.round((d.value / total) * 100) : 0}%</span>
            <span className="w-24 shrink-0 text-right font-medium tabular">{fmtShort(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DailyLine({ data, currency }: { data: { label: string; value: number }[]; currency: string }) {
  const t = useTheme()
  const c = CHROME[t]
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="label" tick={{ fill: c.muted, fontSize: 11 }} axisLine={{ stroke: c.axis }} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
        <YAxis tick={{ fill: c.muted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmtShort} width={52} />
        <Tooltip cursor={{ stroke: c.axis }} content={<Tip fmt={(v) => fmtMoney(v, currency)} names={{ value: 'Расходы' }} />} />
        <Line type="monotone" dataKey="value" stroke={SERIES[t][0]} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function SimpleBars({ data, goal, slot = 0, fmt, height = 160, unitName }: { data: { label: string; value: number; muted?: boolean }[]; goal?: number; slot?: number; fmt: (v: number) => string; height?: number; unitName: string }) {
  const t = useTheme()
  const c = CHROME[t]
  const color = seriesColor(slot, t)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barCategoryGap="30%" margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="label" tick={{ fill: c.muted, fontSize: 11 }} axisLine={{ stroke: c.axis }} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
        <YAxis tick={{ fill: c.muted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmtShort} width={44} />
        <Tooltip cursor={{ fill: c.grid, opacity: 0.4 }} content={<Tip fmt={fmt} names={{ value: unitName }} />} />
        {goal !== undefined && <ReferenceLine y={goal} stroke={c.muted} strokeDasharray="4 4" />}
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={color} opacity={d.muted ? 0.45 : 1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ValueLine({ data, goal, slot = 0, fmt, height = 180, unitName, pad = 1 }: { data: { label: string; value: number | null }[]; goal?: number; slot?: number; fmt: (v: number) => string; height?: number; unitName: string; pad?: number }) {
  const t = useTheme()
  const c = CHROME[t]
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="label" tick={{ fill: c.muted, fontSize: 11 }} axisLine={{ stroke: c.axis }} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
        <YAxis tick={{ fill: c.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={40} domain={[`dataMin - ${pad}`, `dataMax + ${pad}`]} />
        <Tooltip cursor={{ stroke: c.axis }} content={<Tip fmt={fmt} names={{ value: unitName }} />} />
        {goal !== undefined && <ReferenceLine y={goal} stroke={c.muted} strokeDasharray="4 4" />}
        <Line type="monotone" dataKey="value" stroke={seriesColor(slot, t)} strokeWidth={2} dot={false} connectNulls activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
