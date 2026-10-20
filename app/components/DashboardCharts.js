'use client';

import { Area, AreaChart, Bar, BarChart, Cell, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { categoryInfo } from '../../lib/categories';
import { formatBRL } from '../../lib/format';

const AXIS = { stroke: '#64748b', fontSize: 12, tickLine: false, axisLine: false };
const TOOLTIP = {
  contentStyle: { backgroundColor: '#111a2e', border: '1px solid #1f2b45', borderRadius: 10, color: '#e2e8f0' },
  formatter: (value) => formatBRL(value),
};
const compact = (v) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : v);

const Empty = () => <p className="muted empty">Sem dados suficientes.</p>;

// Gasto acumulado no mês vs. ritmo ideal (meta distribuída por igual nos dias).
export function PaceChart({ data, hasBudget }) {
  if (!data.length) return <Empty />;
  return (
    <div className="chart">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="paceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#1f2b45" />
          <XAxis dataKey="day" {...AXIS} interval="preserveStartEnd" minTickGap={16} />
          <YAxis {...AXIS} tickFormatter={compact} width={48} />
          <Tooltip {...TOOLTIP} labelFormatter={(d) => `Dia ${d}`} />
          {hasBudget && <Line dataKey="ideal" name="Ritmo da meta" stroke="#64748b" strokeDasharray="5 5" dot={false} strokeWidth={2} isAnimationActive={false} />}
          <Area dataKey="acumulado" name="Gasto acumulado" stroke="#22c55e" strokeWidth={2.5} fill="url(#paceFill)" connectNulls={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HistoryChart({ data }) {
  if (!data.some(d => d.total > 0)) return <Empty />;
  return (
    <div className="chart">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#1f2b45" />
          <XAxis dataKey="name" {...AXIS} />
          <YAxis {...AXIS} tickFormatter={compact} width={48} />
          <Tooltip {...TOOLTIP} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="total" name="Total" radius={[6, 6, 0, 0]} isAnimationActive={false}>
            {data.map((_, i) => <Cell key={i} fill={i === data.length - 1 ? '#0ea5e9' : '#1e3a5f'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryChart({ data }) {
  if (!data.length) return <Empty />;
  return (
    <div className="donut">
      <div className="chart chart-sm">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="total" nameKey="category" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none" isAnimationActive={false}>
              {data.map(d => <Cell key={d.category} fill={categoryInfo(d.category).color} />)}
            </Pie>
            <Tooltip {...TOOLTIP} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="legend">
        {data.map(d => (
          <li key={d.category}>
            <span className="legend-dot" style={{ background: categoryInfo(d.category).color }} />
            <span>{d.category}</span>
            <span className="muted">{d.share.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
