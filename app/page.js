import Link from 'next/link';
import prisma from '../lib/prisma';
import { CategoryDonut, HistoryChart, PaceChart } from './components/DashboardCharts';
import { AppHeader } from './components/AppHeader';
import { BottomNav } from './components/BottomNav';
import { BudgetEditor } from './components/BudgetEditor';
import { CategoryProgress } from './components/CategoryProgress';
import { InstallHint } from './components/InstallHint';
import { NotificationSettings } from './components/NotificationSettings';
import { QuickAdd } from './components/QuickAdd';
import { TransactionsList } from './components/TransactionsList';
import { ThemeToggle } from './components/ThemeToggle';
import { MonthSwipe } from './components/MonthSwipe';
import { Splash } from './components/Splash';
import { LogoutButton } from './components/LogoutButton';
import { cookies } from 'next/headers';
import { INTRO_COOKIE } from '../lib/auth-constants';
import { authEnabled } from '../lib/auth';
import { EXPENSE, FIXED, INCOME, categoriesFor, categoryNamesFor } from '../lib/categories';
import { formatBRL, localParts, monthLabel, percent, shiftMonth } from '../lib/format';
import { buildInsights, getBudgetSuggestion, getHistory, getKnownSenders, getMonthSummary } from '../lib/finance';

export const dynamic = 'force-dynamic';

const TABS = ['resumo', 'lancamentos', 'lancar', 'metas', 'ajustes'];
const TYPES = [EXPENSE, INCOME, 'todos'];

export default async function Home({ searchParams }) {
  const params = await searchParams;
  // ?view=charts|gastos: telas somente-leitura que o bot captura como imagem.
  const readOnly = params.view === 'charts' || params.view === 'gastos';
  const requestedTab = params.tab === 'gastos' ? 'lancamentos' : params.tab;
  const tab = params.view === 'charts' ? 'resumo' : params.view === 'gastos' ? 'lancamentos' : TABS.includes(requestedTab) ? requestedTab : 'resumo';
  const defaultType = tab === 'lancamentos' ? 'todos' : EXPENSE;
  const tipo = TYPES.includes(params.tipo) && !(tab === 'resumo' && params.tipo === 'todos') ? params.tipo : defaultType;

  const today = localParts();
  const monthParam = parseInt(params.month, 10);
  const yearParam = parseInt(params.year, 10);
  const month = monthParam >= 1 && monthParam <= 12 ? monthParam : today.month;
  const year = yearParam >= 2000 && yearParam <= 2100 ? yearParam : today.year;
  const categoryType = tipo === INCOME ? INCOME : EXPENSE;
  const category = categoryNamesFor(categoryType).includes(params.category) ? params.category : null;
  const isToday = month === today.month && year === today.year;

  const hrefFor = (overrides = {}) => {
    const next = { tab, month, year, tipo: null, category: null, ...overrides };
    const query = new URLSearchParams();
    if (next.tab && next.tab !== 'resumo') query.set('tab', next.tab);
    if (next.tipo) query.set('tipo', next.tipo);
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
  const keep = { tipo: tipo === defaultType ? null : tipo, category };

  const segment = tab === 'resumo' || tab === 'lancamentos'
    ? {
        active: tipo,
        items: [
          ...(tab === 'lancamentos' ? [{ id: 'todos', label: 'Tudo', href: hrefFor({ tipo: null }) }] : []),
          { id: EXPENSE, label: 'Despesas', href: hrefFor({ tipo: tab === 'lancamentos' ? EXPENSE : null }) },
          { id: INCOME, label: 'Receitas', href: hrefFor({ tipo: INCOME }) },
        ],
      }
    : null;

  let content;
  if (tab === 'resumo') content = tipo === INCOME
    ? <ReceitasTab summary={summary} readOnly={readOnly} hrefFor={hrefFor} />
    : <DespesasTab summary={summary} readOnly={readOnly} hrefFor={readOnly ? null : hrefFor} />;
  if (tab === 'lancamentos') content = <LancamentosTab summary={summary} tipo={tipo} category={category} readOnly={readOnly} hrefFor={hrefFor} />;
  if (tab === 'lancar') content = <LancarTab summary={summary} initialType={params.tipo === INCOME ? INCOME : EXPENSE} />;
  if (tab === 'metas') content = <MetasTab summary={summary} prevName={monthLabel(prev.month, prev.year).split(' ')[0]} />;
  if (tab === 'ajustes') content = <AjustesTab />;

  const showIntro = !readOnly && (await cookies()).get(INTRO_COOKIE)?.value === '1';
  const header = (
      <AppHeader
        title={readOnly ? `Finanças · ${monthLabel(month, year)}` : monthLabel(month, year)}
        nav={readOnly ? null : {
          prev: hrefFor({ ...prev, ...keep }),
          next: hrefFor({ ...nextMonth, ...keep }),
          today: isToday ? null : hrefFor({ month: today.month, year: today.year, ...keep }),
          add: tab === 'lancar' ? null : hrefFor({ tab: 'lancar', tipo: tipo === INCOME ? INCOME : null }),
        }}
        summary={summary}
        segment={readOnly ? null : segment}
      />
  );

  return (
    <div className={`app ${readOnly ? 'app-readonly' : ''}`}>
      {showIntro && <Splash />}
      {readOnly ? (
        <>
          {header}
          <main className="content">{content}</main>
        </>
      ) : (
        <MonthSwipe monthKey={`${year}-${month}`} prevHref={hrefFor({ ...prev, ...keep })} nextHref={hrefFor({ ...nextMonth, ...keep })}>
          {header}
          <main className="content">{content}</main>
        </MonthSwipe>
      )}

      {!readOnly && <BottomNav active={tab} hrefFor={hrefFor} />}
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

const donutData = (rows, total, hrefFor, type) => rows
  .filter(r => r.total > 0)
  .sort((a, b) => b.total - a.total)
  .map(r => ({ category: r.name, total: r.total, share: percent(r.total, total), href: hrefFor ? hrefFor({ tab: 'lancamentos', tipo: type, category: r.name }) : null }));

async function DespesasTab({ summary, readOnly, hrefFor }) {
  const [history, suggestion] = await Promise.all([
    getHistory(summary.month, summary.year, 6),
    getBudgetSuggestion(summary.month, summary.year, 3),
  ]);
  const { spent, budget, pct, isCurrent } = summary;
  const remaining = budget - spent;
  const tone = budget <= 0 ? '' : pct > 100 ? 'danger' : pct >= 80 ? 'warning' : 'success';
  const insights = buildInsights(summary, suggestion);

  // Despesas acumuladas por dia + linha do ritmo ideal da meta.
  const byDay = new Array(summary.totalDays).fill(0);
  for (const t of summary.expenses) byDay[localParts(t.date).day - 1] += t.amount;
  const cumulative = [];
  for (const value of byDay) cumulative.push((cumulative.at(-1) || 0) + value);
  const paceData = cumulative.map((total, i) => ({
    day: i + 1,
    acumulado: i < summary.elapsedDays ? Math.round(total * 100) / 100 : null,
    ideal: budget > 0 ? Math.round((budget * (i + 1)) / summary.totalDays) : null,
  }));

  return (
    <div className="stack-lg">
      {!readOnly && <InstallHint />}

      <section className="card">
        <CategoryDonut
          data={donutData(summary.categories.map(c => ({ name: c.name, total: c.spent })), spent, hrefFor, EXPENSE)}
          centerLabel="Despesas"
          emptyText="Nenhuma despesa neste mês ainda."
        />
      </section>

      {insights.length > 0 && (
        <section className="card insights">
          {insights.map((insight, i) => <p key={i} className={`insight insight-${insight.tone}`}>{insight.text}</p>)}
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2 className="section-title">Metas do mês</h2>
          {!readOnly && <Link href={hrefFor({ tab: 'metas' })} className="link-btn small">Editar</Link>}
        </div>
        {budget > 0 ? (
          <>
            <div className="meta-head">
              <span className={`meta-value text-${tone}`}>{formatBRL(spent)}</span>
              <span className="muted">de {formatBRL(budget)} · {pct.toFixed(0)}%</span>
            </div>
            <div className={`bar bar-lg bar-${tone}`}>
              <div className="bar-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
              {isCurrent && <div className="bar-marker" style={{ left: `${(summary.elapsedDays / summary.totalDays) * 100}%` }} title="Hoje" />}
            </div>
            <div className="stats">
              <Stat label={remaining >= 0 ? 'Disponível' : 'Acima da meta'} value={formatBRL(Math.abs(remaining))} tone={remaining < 0 ? 'danger' : ''} />
              {isCurrent ? (
                <>
                  <Stat label="Pode gastar/dia" value={summary.dailyAllowance !== null ? formatBRL(summary.dailyAllowance) : '—'} />
                  <Stat label="Projeção" value={formatBRL(summary.projection)} tone={summary.projection > budget ? 'warning' : ''} />
                </>
              ) : (
                <Stat label="Lançamentos" value={summary.expenses.length} />
              )}
            </div>
            <div className="divider" />
            <CategoryProgress categories={summary.categories} hrefFor={hrefFor} />
          </>
        ) : (
          <div className="empty-cta">
            <p className="muted">Sem metas para este mês.</p>
            {!readOnly && <Link href={hrefFor({ tab: 'metas' })} className="btn btn-primary btn-sm">✨ Gerar metas pelo histórico</Link>}
          </div>
        )}
      </section>

      <FinancialHealth summary={summary} />

      <section className="card">
        <h2 className="section-title">Ritmo do mês</h2>
        <PaceChart data={paceData} hasBudget={budget > 0} />
      </section>

      <section className="card">
        <h2 className="section-title">Últimos 6 meses</h2>
        <HistoryChart data={history} />
      </section>
    </div>
  );
}

// Custos fixos x gastos variáveis e, com renda lançada, a referência 50/30/20.
function FinancialHealth({ summary }) {
  const { fixedSpent, variableSpent, spent, income } = summary;
  if (spent <= 0 && income <= 0) return null;
  const fixedShare = percent(fixedSpent, spent);

  return (
    <section className="card">
      <h2 className="section-title">Custos fixos x gastos variáveis</h2>
      <div className="split-bar" role="img" aria-label={`Custos fixos ${fixedShare.toFixed(0)}%`}>
        <div className="split-fixed" style={{ width: `${fixedShare}%` }} />
        <div className="split-variable" style={{ width: `${100 - fixedShare}%` }} />
      </div>
      <div className="split-legend">
        <span><i className="dot dot-fixed" /> 📌 Fixos <b>{formatBRL(fixedSpent)}</b> <span className="muted">({fixedShare.toFixed(0)}%)</span></span>
        <span><i className="dot dot-variable" /> 🛒 Variáveis <b>{formatBRL(variableSpent)}</b> <span className="muted">({(100 - fixedShare).toFixed(0)}%)</span></span>
      </div>

      {income > 0 ? (
        <>
          <div className="divider" />
          <h3 className="sub-title">Regra 50/30/20 · em relação à renda</h3>
          <Rule label="📌 Custos fixos" value={percent(fixedSpent, income)} target={50} mode="max" />
          <Rule label="🛒 Gastos variáveis" value={percent(variableSpent, income)} target={30} mode="max" />
          <Rule label="💰 Sobra / poupança" value={Math.max(percent(income - spent, income), 0)} target={20} mode="min" />
          <p className="muted small">Referência: até 50% da renda em necessidades, até 30% em desejos e pelo menos 20% guardados (Warren & Tyagi, 2005).</p>
        </>
      ) : (
        <p className="muted small">Lance as receitas do mês (ex.: <code>+5000 salário</code> no bot) para ver quanto da renda vai para cada parte.</p>
      )}
    </section>
  );
}

function Rule({ label, value, target, mode }) {
  const ok = mode === 'max' ? value <= target : value >= target;
  return (
    <div className="rule">
      <div className="rule-head">
        <span>{label}</span>
        <span className={ok ? 'text-success' : 'text-warning'}><b>{value.toFixed(0)}%</b> <span className="muted">/ {mode === 'max' ? 'até' : 'mín.'} {target}%</span></span>
      </div>
      <div className={`bar bar-${ok ? 'success' : 'warning'}`}>
        <div className="bar-fill" style={{ width: `${Math.min(value, 100)}%` }} />
        <div className="bar-marker" style={{ left: `${target}%` }} />
      </div>
    </div>
  );
}

async function ReceitasTab({ summary, readOnly, hrefFor }) {
  const history = await getHistory(summary.month, summary.year, 6);
  return (
    <div className="stack-lg">
      <section className="card">
        <CategoryDonut
          data={donutData(summary.incomeCategories, summary.income, readOnly ? null : hrefFor, INCOME)}
          centerLabel="Receitas"
          emptyText="Nenhuma receita lançada neste mês."
        />
        {summary.income === 0 && !readOnly && (
          <div className="empty-cta">
            <p className="muted small">No bot: <code>+5000 salário</code> ou <code>recebi 800 freela</code>.</p>
            <Link href={hrefFor({ tab: 'lancar', tipo: INCOME })} className="btn btn-primary btn-sm">+ Lançar receita</Link>
          </div>
        )}
      </section>

      {summary.income > 0 && (
        <section className="card">
          <h2 className="section-title">Para onde vai a renda</h2>
          <div className="stats stats-3">
            <Stat label="Custos fixos" value={`${percent(summary.fixedSpent, summary.income).toFixed(0)}%`} />
            <Stat label="Variáveis" value={`${percent(summary.variableSpent, summary.income).toFixed(0)}%`} />
            <Stat label="Sobra" value={`${(summary.savingsRate ?? 0).toFixed(0)}%`} tone={summary.balance < 0 ? 'danger' : 'success'} />
          </div>
        </section>
      )}

      {summary.incomes.length > 0 && (
        <section>
          <h2 className="section-title">Receitas do mês</h2>
          <TransactionsList transactions={summary.incomes} readOnly={readOnly} />
        </section>
      )}

      <section className="card">
        <h2 className="section-title">Receitas x despesas · 6 meses</h2>
        <HistoryChart data={history} />
      </section>
    </div>
  );
}

function LancamentosTab({ summary, tipo, category, readOnly, hrefFor }) {
  const base = tipo === INCOME ? summary.incomes : tipo === EXPENSE ? summary.expenses : summary.transactions;
  const transactions = category ? base.filter(t => t.category === category) : base;
  const expenses = transactions.filter(t => t.type !== INCOME).reduce((a, t) => a + t.amount, 0);
  const incomes = transactions.filter(t => t.type === INCOME).reduce((a, t) => a + t.amount, 0);
  const fixedCount = transactions.filter(t => t.kind === FIXED && t.type !== INCOME).length;

  return (
    <div className="stack">
      {!readOnly && tipo !== 'todos' && (
        <div className="chips chips-scroll">
          <Link href={hrefFor({ tipo })} className={`chip ${!category ? 'chip-active' : ''}`}>Todas</Link>
          {categoriesFor(tipo).map(c => (
            <Link key={c.name} href={hrefFor({ tipo, category: c.name })} className={`chip ${category === c.name ? 'chip-active' : ''}`}>
              {c.emoji} {c.name}
            </Link>
          ))}
        </div>
      )}
      <div className="list-summary card">
        <span className="muted">{transactions.length} lançamento(s){category && ` em ${category}`}{fixedCount > 0 && ` · ${fixedCount} fixo(s)`}</span>
        <span>
          {incomes > 0 && <strong className="text-success">+{formatBRL(incomes)} </strong>}
          {expenses > 0 && <strong>−{formatBRL(expenses)}</strong>}
        </span>
      </div>
      {!readOnly && transactions.length > 0 && <p className="muted small">Toque num lançamento para editar, mudar categoria, marcar como fixo ou excluir.</p>}
      <TransactionsList transactions={transactions} readOnly={readOnly} />
    </div>
  );
}

async function LancarTab({ summary, initialType }) {
  const senders = await getKnownSenders();
  return (
    <div className="stack-lg">
      <QuickAdd senders={senders} initialType={initialType} />
      {summary.transactions.length > 0 && (
        <section>
          <h2 className="section-title">Últimos lançamentos</h2>
          <TransactionsList transactions={summary.transactions.slice(0, 5)} />
        </section>
      )}
      <p className="muted small center">
        Dica: no Telegram, mande <code>Mercado 230</code> para despesa ou <code>+5000 salário</code> para receita.
      </p>
    </div>
  );
}

async function MetasTab({ summary, prevName }) {
  const suggestion = await getBudgetSuggestion(summary.month, summary.year, 3);
  return (
    <BudgetEditor
      month={summary.month}
      year={summary.year}
      monthName={monthLabel(summary.month, summary.year).split(' ')[0]}
      prevMonthName={prevName}
      categories={summary.categories.map(({ name, spent, budget }) => ({ name, spent, budget }))}
      suggestion={suggestion}
    />
  );
}

async function AjustesTab() {
  const [senders, telegramUsers] = await Promise.all([getKnownSenders(), prisma.telegramUser.findMany()]);
  const people = [...new Set([...telegramUsers.map(u => u.name), ...senders])];

  return (
    <div className="stack-lg">
      <section className="card">
        <h2 className="section-title">🔔 Notificações no celular</h2>
        <NotificationSettings people={people} publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''} />
      </section>

      <section className="card">
        <h2 className="section-title">🎨 Tema</h2>
        <ThemeToggle />
      </section>

      <InstallHint always />

      <section className="card">
        <h2 className="section-title">🤖 Bot do Telegram</h2>
        <ul className="help-list">
          <li><code>Mercado 230</code> despesa (categoria e fixo/variável automáticos)</li>
          <li><code>+5000 salário</code> receita</li>
          <li><code>gerar metas</code> metas do mês pelo histórico</li>
          <li><code>metas</code> · <code>resumo</code> · <code>ajuda</code></li>
        </ul>
        <p className="muted small">Errou a categoria? Toque no botão certo na mensagem do bot. Ele aprende e acerta da próxima vez.</p>
      </section>

      {authEnabled() && <LogoutButton />}
    </div>
  );
}
