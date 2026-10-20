import Link from 'next/link';
import { CategoryChart, HistoryChart, PaceChart } from './components/DashboardCharts';
import { BottomNav } from './components/BottomNav';
import { BudgetEditor } from './components/BudgetEditor';
import { CategoryProgress } from './components/CategoryProgress';
import { InstallHint } from './components/InstallHint';
import { QuickAdd } from './components/QuickAdd';
import { TransactionsList } from './components/TransactionsList';
import { logout } from './actions';
import { authEnabled } from '../lib/auth';
import { CATEGORIES, CATEGORY_NAMES } from '../lib/categories';
import { formatBRL, localParts, monthLabel, percent, shiftMonth } from '../lib/format';
import { getCategoryAverages, getHistory, getKnownSenders, getMonthSummary } from '../lib/finance';

export const dynamic = 'force-dynamic';

const TABS = ['resumo', 'gastos', 'lancar', 'metas'];

export default async function Home({ searchParams }) {
  const params = await searchParams;
  // ?view=charts|gastos: telas somente-leitura que o bot captura como imagem.
  const readOnly = params.view === 'charts' || params.view === 'gastos';
  const tab = params.view === 'charts' ? 'resumo' : params.view === 'gastos' ? 'gastos' : TABS.includes(params.tab) ? params.tab : 'resumo';

  const today = localParts();
  const monthParam = parseInt(params.month, 10);
  const yearParam = parseInt(params.year, 10);
  const month = monthParam >= 1 && monthParam <= 12 ? monthParam : today.month;
  const year = yearParam >= 2000 && yearParam <= 2100 ? yearParam : today.year;
  const category = CATEGORY_NAMES.includes(params.category) ? params.category : null;

  const hrefFor = (overrides = {}) => {
    const next = { tab, month, year, ...overrides };
    const query = new URLSearchParams();
    if (next.tab && next.tab !== 'resumo') query.set('tab', next.tab);
    if (next.month !== today.month || next.year !== today.year) {
      query.set('month', next.month);
      query.set('year', next.year);
    }
    if (next.category) query.set('category', next.category);
    const qs = query.toString();
    return qs ? `/?${qs}` : '/';
  };

  const summary = await getMonthSummary(month, year);
  const prev = shiftMonth(month, year, -1);
  const nextMonth = shiftMonth(month, year, 1);

  let content;
  if (tab === 'resumo') content = <ResumoTab summary={summary} readOnly={readOnly} hrefFor={readOnly ? null : hrefFor} />;
  if (tab === 'gastos') content = <GastosTab summary={summary} category={category} readOnly={readOnly} hrefFor={hrefFor} />;
  if (tab === 'lancar') content = <LancarTab summary={summary} />;
  if (tab === 'metas') content = <MetasTab summary={summary} prevName={monthLabel(prev.month, prev.year).split(' ')[0]} />;

  return (
    <div className={`app ${readOnly ? 'app-readonly' : ''}`}>
      <header className="topbar">
        {readOnly ? (
          <h1 className="month-title">Finanças · {monthLabel(month, year)}</h1>
        ) : (
          <>
            <div className="month-switcher">
              <Link href={hrefFor({ ...prev, category })} className="icon-btn" aria-label="Mês anterior">‹</Link>
              <h1 className="month-title">{monthLabel(month, year)}</h1>
              <Link href={hrefFor({ ...nextMonth, category })} className="icon-btn" aria-label="Próximo mês">›</Link>
            </div>
            <div className="topbar-actions">
              {(month !== today.month || year !== today.year) && (
                <Link href={hrefFor({ month: today.month, year: today.year, category })} className="btn btn-ghost btn-sm">Hoje</Link>
              )}
              {authEnabled() && (
                <form action={logout}>
                  <button type="submit" className="icon-btn" aria-label="Sair" title="Sair">⎋</button>
                </form>
              )}
            </div>
          </>
        )}
      </header>

      <main className="content">{content}</main>

      {!readOnly && <BottomNav active={tab} hrefFor={hrefFor} />}
    </div>
  );
}

async function ResumoTab({ summary, readOnly, hrefFor }) {
  const history = await getHistory(summary.month, summary.year, 6);
  const { spent, budget, pct, isCurrent } = summary;
  const remaining = budget - spent;
  const tone = budget <= 0 ? '' : pct > 100 ? 'danger' : pct >= 80 ? 'warning' : 'success';

  // Gasto acumulado por dia + linha do ritmo ideal da meta.
  const byDay = new Array(summary.totalDays).fill(0);
  for (const t of summary.transactions) byDay[localParts(t.date).day - 1] += t.amount;
  const cumulative = [];
  for (const value of byDay) cumulative.push((cumulative.at(-1) || 0) + value);
  const paceData = cumulative.map((total, i) => ({
    day: i + 1,
    acumulado: i < summary.elapsedDays ? Math.round(total * 100) / 100 : null,
    ideal: budget > 0 ? Math.round((budget * (i + 1)) / summary.totalDays) : null,
  }));

  const categoryData = summary.categories
    .filter(c => c.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .map(c => ({ category: c.name, total: c.spent, share: percent(c.spent, spent) }));

  return (
    <div className="stack-lg">
      {!readOnly && <InstallHint />}

      <section className="hero card">
        <div className="card-label">Gasto no mês</div>
        <div className={`hero-value text-${tone}`}>{formatBRL(spent)}</div>
        {budget > 0 ? (
          <>
            <div className="muted">de {formatBRL(budget)} planejados · {pct.toFixed(0)}%</div>
            <div className={`bar bar-lg bar-${tone}`}>
              <div className="bar-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
              {isCurrent && <div className="bar-marker" style={{ left: `${(summary.elapsedDays / summary.totalDays) * 100}%` }} title="Hoje" />}
            </div>
          </>
        ) : (
          !readOnly && <Link href={hrefFor({ tab: 'metas' })} className="btn btn-ghost btn-sm">🎯 Definir metas do mês</Link>
        )}

        <div className="stats">
          <Stat label={remaining >= 0 ? 'Disponível' : 'Acima da meta'} value={budget > 0 ? formatBRL(Math.abs(remaining)) : '—'} tone={remaining < 0 ? 'danger' : ''} />
          {isCurrent ? (
            <>
              <Stat label="Pode gastar/dia" value={summary.dailyAllowance !== null ? formatBRL(summary.dailyAllowance) : '—'} />
              <Stat label="Projeção do mês" value={formatBRL(summary.projection)} tone={budget > 0 && summary.projection > budget ? 'warning' : ''} />
            </>
          ) : (
            <Stat label="Lançamentos" value={summary.transactions.length} />
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">Metas por categoria</h2>
        <CategoryProgress categories={summary.categories} hrefFor={hrefFor} />
      </section>

      <div className="grid-2">
        <section className="card">
          <h2 className="section-title">Ritmo do mês</h2>
          <PaceChart data={paceData} hasBudget={budget > 0} />
        </section>
        <section className="card">
          <h2 className="section-title">Para onde foi</h2>
          <CategoryChart data={categoryData} />
        </section>
      </div>

      <section className="card">
        <h2 className="section-title">Últimos 6 meses</h2>
        <HistoryChart data={history} />
      </section>
    </div>
  );
}

function Stat({ label, value, tone = '' }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value text-${tone}`}>{value}</div>
    </div>
  );
}

function GastosTab({ summary, category, readOnly, hrefFor }) {
  const transactions = category ? summary.transactions.filter(t => t.category === category) : summary.transactions;
  const total = transactions.reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="stack">
      {!readOnly && (
        <div className="chips chips-scroll">
          <Link href={hrefFor({ category: null })} className={`chip ${!category ? 'chip-active' : ''}`}>Todas</Link>
          {CATEGORIES.map(c => (
            <Link key={c.name} href={hrefFor({ category: c.name })} className={`chip ${category === c.name ? 'chip-active' : ''}`}>
              {c.emoji} {c.name}
            </Link>
          ))}
        </div>
      )}
      <div className="list-summary">
        <span className="muted">{transactions.length} lançamento(s){category && ` em ${category}`}</span>
        <strong>{formatBRL(total)}</strong>
      </div>
      {!readOnly && transactions.length > 0 && <p className="muted small">Toque num gasto para editar ou excluir.</p>}
      <TransactionsList transactions={transactions} readOnly={readOnly} />
    </div>
  );
}

async function LancarTab({ summary }) {
  const senders = await getKnownSenders();
  return (
    <div className="stack-lg">
      <QuickAdd senders={senders} />
      {summary.transactions.length > 0 && (
        <section>
          <h2 className="section-title">Últimos lançamentos</h2>
          <TransactionsList transactions={summary.transactions.slice(0, 5)} />
        </section>
      )}
      <p className="muted small center">
        Dica: no Telegram, mande <code>Mercado 230</code> para lançar ou <code>metas</code> para ver as metas.
      </p>
    </div>
  );
}

async function MetasTab({ summary, prevName }) {
  const averages = await getCategoryAverages(summary.month, summary.year, 3);
  return (
    <BudgetEditor
      month={summary.month}
      year={summary.year}
      monthName={monthLabel(summary.month, summary.year).split(' ')[0]}
      prevMonthName={prevName}
      categories={summary.categories.map(({ name, spent, budget }) => ({ name, spent, budget }))}
      averages={averages}
    />
  );
}
