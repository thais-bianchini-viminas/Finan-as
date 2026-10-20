import prisma from './prisma';
import { CATEGORY_NAMES } from './categories';
import { daysInMonth, localParts, monthRange, monthLabel, percent, shiftMonth } from './format';

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

  const spentByCategory = {};
  for (const t of transactions) {
    spentByCategory[t.category] = (spentByCategory[t.category] || 0) + t.amount;
  }

  const budgetByCategory = {};
  for (const b of budgets) budgetByCategory[b.category] = b.amount;

  const categories = CATEGORY_NAMES
    .map(name => ({
      name,
      spent: spentByCategory[name] || 0,
      budget: budgetByCategory[name] || 0,
    }))
    .map(c => ({ ...c, pct: percent(c.spent, c.budget) }));

  const spent = transactions.reduce((acc, t) => acc + t.amount, 0);
  const budget = budgets.reduce((acc, b) => acc + b.amount, 0);

  // Ritmo do mês: só faz sentido para o mês corrente.
  const today = localParts();
  const totalDays = daysInMonth(month, year);
  const isCurrent = today.month === month && today.year === year;
  const elapsedDays = isCurrent ? today.day : totalDays;
  const remainingDays = isCurrent ? totalDays - today.day + 1 : 0;

  return {
    month, year, transactions, budgets, categories,
    spent, budget, pct: percent(spent, budget),
    isCurrent, totalDays, elapsedDays, remainingDays,
    projection: isCurrent && elapsedDays > 0 ? (spent / elapsedDays) * totalDays : spent,
    dailyAllowance: isCurrent && budget > 0 ? Math.max(budget - spent, 0) / remainingDays : null,
  };
}

// Total gasto nos últimos N meses (inclui o mês informado), em ordem cronológica.
export async function getHistory(month, year, months = 6) {
  const first = shiftMonth(month, year, -(months - 1));
  const { start } = monthRange(first.month, first.year);
  const { end } = monthRange(month, year);
  const rows = await prisma.transaction.findMany({
    where: { date: { gte: start, lt: end } },
    select: { date: true, amount: true },
  });

  const totals = new Map();
  for (let i = 0; i < months; i++) {
    const m = shiftMonth(first.month, first.year, i);
    totals.set(`${m.year}-${m.month}`, { name: monthLabel(m.month, m.year, 'short'), total: 0 });
  }
  for (const r of rows) {
    const p = localParts(r.date);
    const entry = totals.get(`${p.year}-${p.month}`);
    if (entry) entry.total += r.amount;
  }
  return [...totals.values()];
}

// Média mensal gasta por categoria nos N meses anteriores ao informado (base para sugerir metas).
export async function getCategoryAverages(month, year, months = 3) {
  const first = shiftMonth(month, year, -months);
  const { start } = monthRange(first.month, first.year);
  const { start: end } = monthRange(month, year);
  const rows = await prisma.transaction.groupBy({
    by: ['category'],
    _sum: { amount: true },
    where: { date: { gte: start, lt: end } },
  });
  return Object.fromEntries(rows.map(r => [r.category, Math.round((r._sum.amount || 0) / months)]));
}

export async function getKnownSenders() {
  const rows = await prisma.transaction.groupBy({
    by: ['senderName'],
    _count: { senderName: true },
    orderBy: { _count: { senderName: 'desc' } },
    take: 6,
  });
  return rows.map(r => r.senderName).filter(name => name && name !== 'Painel');
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
