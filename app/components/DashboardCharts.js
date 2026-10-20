'use client';

import Link from 'next/link';
import { Area, AreaChart, Bar, BarChart, Cell, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { categoryInfo } from '../../lib/categories';
import { formatBRL } from '../../lib/format';

import { useResolvedTheme } from './ThemeToggle';

// SVG não lê variáveis CSS nos atributos, então cada tema tem sua paleta explícita.
const PALETTES = {
  light: { axis: '#8a978f', grid: '#e8eeea', tipBg: '#ffffff', tipBorder: '#e3e9e6', tipText: '#17211c', line: '#1f9d63', ideal: '#9aa8a0', income: '#1f9d63', expense: '#e5484d', cursor: 'rgba(0,0,0,0.04)' },
  dark: { axis: '#64748b', grid: '#1f2b45', tipBg: '#111a2e', tipBorder: '#1f2b45', tipText: '#e2e8f0', line: '#22c55e', ideal: '#64748b', income: '#22c55e', expense: '#ef4444', cursor: 'rgba(255,255,255,0.04)' },
};

function useChartPalette() {
  const p = PALETTES[useResolvedTheme()] || PALETTES.dark;
  return {
    p,
    AXIS: { stroke: p.axis, fontSize: 12, tickLine: false, axisLine: false },
    TOOLTIP: {
      contentStyle: { backgroundColor: p.tipBg, border: `1px solid ${p.tipBorder}`, borderRadius: 10, color: p.tipText, boxShadow: '0 6px 20px rgba(0,0,0,0.12)' },
      itemStyle: { color: p.tipText },
      formatter: (value) => formatBRL(value),
    },
  };
}
const compact = (v) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : v);

const Empty = ({ text = 'Sem dados suficientes.' }) => <p className="muted empty">{text}</p>;

// Rosca com o total no centro e legenda clicável (leva para os lançamentos da categoria).
export function CategoryDonut({ data, centerLabel, emptyText }) {
  const { TOOLTIP } = useChartPalette();
  if (!data.length) return <Empty text={emptyText} />;
  const total = data.reduce((a, d) => a + d.total, 0);
  return (
    <div className="donut">
      <div className="donut-chart">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="total" nameKey="category" innerRadius="70%" outerRadius="100%" paddingAngle={2} stroke="none" startAngle={90} endAngle={-270} isAnimationActive={false}>
              {data.map(d => <Cell key={d.category} fill={categoryInfo(d.category).color} />)}
            </Pie>
            <Tooltip {...TOOLTIP} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <span className="donut-center-label">{centerLabel}</span>
          <strong>{formatBRL(total)}</strong>
        </div>
      </div>
      <ul className="legend">
        {data.map(d => {
          const info = categoryInfo(d.category);
          const content = (
            <>
              <span className="cat-dot sm" style={{ background: `${info.color}22` }} aria-hidden>{info.emoji}</span>
              <span className="legend-name">{d.category}</span>
              <span className="legend-pct muted">{d.share.toFixed(0)}%</span>
              <strong className="legend-value">{formatBRL(d.total)}</strong>
            </>
          );
          return <li key={d.category}>{d.href ? <Link href={d.href} className="legend-row">{content}</Link> : <div className="legend-row">{content}</div>}</li>;
        })}
      </ul>
    </div>
  );
}

// Gasto acumulado no mês vs. ritmo ideal (meta distribuída por igual nos dias).
export function PaceChart({ data, hasBudget }) {
  const { p, AXIS, TOOLTIP } = useChartPalette();
  if (!data.length) return <Empty />;
  return (
    <div className="chart">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="paceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p.line} stopOpacity={0.3} />
              <stop offset="100%" stopColor={p.line} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={p.grid} />
          <XAxis dataKey="day" {...AXIS} interval="preserveStartEnd" minTickGap={16} />
          <YAxis {...AXIS} tickFormatter={compact} width={48} />
          <Tooltip {...TOOLTIP} labelFormatter={(d) => `Dia ${d}`} />
          {hasBudget && <Line dataKey="ideal" name="Ritmo da meta" stroke={p.ideal} strokeDasharray="5 5" dot={false} strokeWidth={2} isAnimationActive={false} />}
          <Area dataKey="acumulado" name="Despesas acumuladas" stroke={p.line} strokeWidth={2.5} fill="url(#paceFill)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HistoryChart({ data }) {
  const { p, AXIS, TOOLTIP } = useChartPalette();
  if (!data.some(d => d.despesas > 0 || d.receitas > 0)) return <Empty />;
  const hasIncome = data.some(d => d.receitas > 0);
  return (
    <div className="chart">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke={p.grid} />
          <XAxis dataKey="name" {...AXIS} />
          <YAxis {...AXIS} tickFormatter={compact} width={48} />
          <Tooltip {...TOOLTIP} cursor={{ fill: p.cursor }} />
          {hasIncome && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: p.axis }} />}
          {hasIncome && <Bar dataKey="receitas" name="Receitas" fill={p.income} radius={[6, 6, 0, 0]} isAnimationActive={false} />}
          <Bar dataKey="despesas" name="Despesas" fill={p.expense} radius={[6, 6, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
