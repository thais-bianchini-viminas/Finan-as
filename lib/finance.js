import prisma from './prisma';
import { CATEGORY_NAMES, EXPENSE, FIXED, INCOME, INCOME_CATEGORY_NAMES, fixedGroupKey } from './categories';
import { daysInMonth, localParts, monthRange, monthLabel, percent, shiftMonth } from './format';

const sum = (rows) => rows.reduce((acc, r) => acc + r.amount, 0);
const isIncome = (t) => t.type === INCOME;

// Tudo o que o painel e o bot precisam sobre um mês, em uma ida ao banco.
export async function getMonthSummary(month, year) {
  const { start, end } = monthRange(month, year);
  const [transactions, budgets] = await Promise.all([
    prisma.transaction.findMany({
      where: { date: { gte: start, lt: end } },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    }),
    prisma.categoryBudget.findMany({ where: { month, year }, orderBy: { id: 'asc' } }),
  ]);

  const expenses = transactions.filter(t => !isIncome(t));
  const incomes = transactions.filter(isIncome);

  const totalsBy = (rows) => {
    const map = {};
    for (const t of rows) map[t.category] = (map[t.category] || 0) + t.amount;
    return map;
  };
  const spentByCategory = totalsBy(expenses);
  const incomeByCategory = totalsBy(incomes);

  const budgetByCategory = {};
  for (const b of budgets) budgetByCategory[b.category] = b.amount;

  const categories = CATEGORY_NAMES
    .map(name => ({ name, spent: spentByCategory[name] || 0, budget: budgetByCategory[name] || 0 }))
    .map(c => ({ ...c, pct: percent(c.spent, c.budget) }));

  const incomeCategories = INCOME_CATEGORY_NAMES
    .map(name => ({ name, total: incomeByCategory[name] || 0 }))
    .filter(c => c.total > 0);

  const spent = sum(expenses);
  const income = sum(incomes);
  const fixedSpent = sum(expenses.filter(t => t.kind === FIXED));
  const budget = budgets.reduce((acc, b) => acc + b.amount, 0);

  // Ritmo do mês: só faz sentido para o mês corrente.
  const today = localParts();
  const totalDays = daysInMonth(month, year);
  const isCurrent = today.month === month && today.year === year;
  const elapsedDays = isCurrent ? today.day : totalDays;
  const remainingDays = isCurrent ? totalDays - today.day + 1 : 0;

  // Projeção: custos fixos já lançados não se repetem; só o variável segue o ritmo diário.
  const variableSpent = spent - fixedSpent;
  const projection = isCurrent && elapsedDays > 0 ? fixedSpent + (variableSpent / elapsedDays) * totalDays : spent;

  return {
    month, year, transactions, expenses, incomes, budgets, categories, incomeCategories,
    spent, income, balance: income - spent, fixedSpent, variableSpent,
    budget, pct: percent(spent, budget),
    savingsRate: income > 0 ? ((income - spent) / income) * 100 : null,
    isCurrent, totalDays, elapsedDays, remainingDays, projection,
    dailyAllowance: isCurrent && budget > 0 ? Math.max(budget - spent, 0) / remainingDays : null,
  };
}

// Despesas e receitas dos últimos N meses (inclui o mês informado), em ordem cronológica.
export async function getHistory(month, year, months = 6) {
  const first = shiftMonth(month, year, -(months - 1));
  const { start } = monthRange(first.month, first.year);
  const { end } = monthRange(month, year);
  const rows = await prisma.transaction.findMany({
    where: { date: { gte: start, lt: end } },
    select: { date: true, amount: true, type: true },
  });

  const totals = new Map();
  for (let i = 0; i < months; i++) {
    const m = shiftMonth(first.month, first.year, i);
    totals.set(`${m.year}-${m.month}`, { name: monthLabel(m.month, m.year, 'short'), despesas: 0, receitas: 0 });
  }
  for (const r of rows) {
    const p = localParts(r.date);
    const entry = totals.get(`${p.year}-${p.month}`);
    if (entry) entry[r.type === INCOME ? 'receitas' : 'despesas'] += r.amount;
  }
  return [...totals.values()];
}

// Base para gerar metas: custos fixos detectados (com valor médio) + média do variável,
// por categoria, nos N meses anteriores ao informado. Meses sem nenhum lançamento não
// entram na média, para não puxá-la para baixo nos primeiros meses de uso.
export async function getBudgetSuggestion(month, year, months = 3) {
  const first = shiftMonth(month, year, -months);
  const { start } = monthRange(first.month, first.year);
  const { start: end } = monthRange(month, year);
  const rows = await prisma.transaction.findMany({
    where: { type: EXPENSE, date: { gte: start, lt: end } },
    select: { description: true, amount: true, category: true, kind: true, date: true },
    orderBy: { date: 'asc' },
  });

  const monthKey = (d) => { const p = localParts(d); return `${p.year}-${p.month}`; };
  const monthsWithData = new Set(rows.map(r => monthKey(r.date)));
  const divisor = Math.max(monthsWithData.size, 1);
  const lastMonth = shiftMonth(month, year, -1);
  const lastKey = `${lastMonth.year}-${lastMonth.month}`;

  const variable = {};
  const fixedGroups = new Map();
  for (const r of rows) {
    if (r.kind === FIXED) {
      // Agrupa pela descrição (sem a categoria): vale a categoria e o texto mais recentes.
      const key = fixedGroupKey(r.description);
      const group = fixedGroups.get(key) || { key, amounts: [], months: new Set() };
      group.amounts.push(r.amount);
      group.months.add(monthKey(r.date));
      group.description = r.description;
      group.category = r.category;
      fixedGroups.set(key, group);
    } else {
      variable[r.category] = (variable[r.category] || 0) + r.amount;
    }
  }

  const fixedItems = [...fixedGroups.values()].map(g => ({
    key: g.key,
    category: g.category,
    description: g.description.replace(/[\s:=\-–]+$/, ''),
    // Média por mês em que apareceu (luz e água variam; financiamento quase não).
    amount: Math.round(g.amounts.reduce((a, b) => a + b, 0) / g.months.size),
    monthsSeen: g.months.size,
    inLastMonth: g.months.has(lastKey),
  })).sort((a, b) => b.amount - a.amount);

  const variableAverages = Object.fromEntries(
    Object.entries(variable).map(([category, total]) => [category, Math.round(total / divisor)])
  );

  return { months: divisor, fixedItems, variableAverages };
}

export async function getKnownSenders() {
  const rows = await prisma.transaction.groupBy({
    by: ['senderName'],
    _count: { senderName: true },
    orderBy: { _count: { senderName: 'desc' } },
    take: 6,
  });
  return rows.map(r => r.senderName).filter(name => name && name !== 'Painel' && name !== 'Usuário');
}

// Situação de uma categoria no mês da data informada (usada nos avisos do bot e do app).
export async function categoryStatus(category, date = new Date()) {
  const { month, year } = localParts(date);
  const { start, end } = monthRange(month, year);
  const [agg, budget] = await Promise.all([
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: EXPENSE, category, date: { gte: start, lt: end } } }),
    prisma.categoryBudget.findFirst({ where: { category, month, year } }),
  ]);
  return { spent: agg._sum.amount || 0, budget: budget?.amount || 0 };
}

// Destaques do mês comparados com a média dos meses anteriores.
export function buildInsights(summary, suggestion) {
  const insights = [];
  if (summary.income > 0) {
    const rate = summary.savingsRate;
    insights.push(rate >= 20
      ? { tone: 'success', text: `Vocês estão guardando ${rate.toFixed(0)}% da renda — acima dos 20% recomendados.` }
      : rate >= 0
        ? { tone: 'warning', text: `Sobra ${rate.toFixed(0)}% da renda. A referência é guardar 20%.` }
        : { tone: 'danger', text: `As despesas passaram a renda do mês em ${Math.abs(summary.balance).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.` });
  }
  if (summary.isCurrent && summary.elapsedDays >= 7) {
    const factor = summary.totalDays / summary.elapsedDays;
    const comparisons = summary.categories
      .map(c => {
        const avg = suggestion.variableAverages[c.name] || 0;
        const variableNow = summary.expenses.filter(t => t.category === c.name && t.kind !== FIXED).reduce((a, t) => a + t.amount, 0);
        return { name: c.name, avg, projected: variableNow * factor };
      })
      .filter(c => c.avg >= 50 && c.projected > c.avg * 1.25)
      .sort((a, b) => b.projected / b.avg - a.projected / a.avg);
    for (const c of comparisons.slice(0, 2)) {
      insights.push({ tone: 'warning', text: `${c.name} está no ritmo de ${(c.projected / c.avg * 100 - 100).toFixed(0)}% acima da média dos últimos meses.` });
    }
  }
  const over = summary.categories.filter(c => c.budget > 0 && c.pct > 100);
  if (over.length) insights.push({ tone: 'danger', text: `Meta estourada em: ${over.map(c => c.name).join(', ')}.` });
  return insights;
}

// Valor <= 0 remove a meta.
export async function upsertBudget(month, year, category, amount) {
  const existing = await prisma.categoryBudget.findMany({ where: { month, year, category } });
  if (!(amount > 0)) {
    if (existing.length) await prisma.categoryBudget.deleteMany({ where: { month, year, category } });
    return null;
  }
  if (existing.length) {
    const [keep, ...duplicates] = existing;
    if (duplicates.length) await prisma.categoryBudget.deleteMany({ where: { id: { in: duplicates.map(d => d.id) } } });
    return prisma.categoryBudget.update({ where: { id: keep.id }, data: { amount } });
  }
  return prisma.categoryBudget.create({ data: { month, year, category, amount } });
}

// Copia as metas do mês anterior que ainda não existem no mês alvo.
export async function copyBudgetsFromPreviousMonth(month, year) {
  const prev = shiftMonth(month, year, -1);
  const [source, target] = await Promise.all([
    prisma.categoryBudget.findMany({ where: { month: prev.month, year: prev.year } }),
    prisma.categoryBudget.findMany({ where: { month, year } }),
  ]);
  const existing = new Set(target.map(b => b.category));
  const toCreate = source.filter(b => !existing.has(b.category));
  if (toCreate.length) {
    await prisma.categoryBudget.createMany({
      data: toCreate.map(b => ({ month, year, category: b.category, amount: b.amount })),
    });
  }
  return { copied: toCreate.length, sourceCount: source.length, prev };
}
