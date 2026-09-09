import prisma from '../lib/prisma';
import { HistoryChart, DailyChart, CategoryChart, CategoryBudgetChart } from './components/DashboardCharts';
import { BudgetForm } from './components/BudgetForm';
import { ActiveBudgetsTable } from './components/ActiveBudgetsTable';
import { TransactionsTable } from './components/TransactionsTable';
import { AddTransactionForm } from './components/AddTransactionForm';
import { DashboardFilter } from './components/DashboardFilter';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { deleteTransaction } from './actions';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }) {
  const { view, month, year, category } = await searchParams;
  const isChartsView = view === 'charts';
  const isGastosView = view === 'gastos';
  const isDefaultView = !view;

  const now = new Date();
  const filterMonth = month ? parseInt(month, 10) : now.getMonth() + 1;
  const filterYear = year ? parseInt(year, 10) : now.getFullYear();
  const filterCategory = category && category !== 'all' ? category : null;

  const startOfMonth = new Date(filterYear, filterMonth - 1, 1);
  const endOfMonth = new Date(filterYear, filterMonth, 0, 23, 59, 59, 999);

  // Busca todos para o histórico
  const allTransactions = await prisma.transaction.findMany({
    where: filterCategory ? { category: filterCategory } : {},
    orderBy: { date: 'desc' }
  });

  // Busca apenas os do mês selecionado
  const currentMonthTransactions = allTransactions.filter(t => t.date >= startOfMonth && t.date <= endOfMonth);
  const totalMes = currentMonthTransactions.reduce((acc, curr) => acc + curr.amount, 0);
  
  // Metas por categoria
  const categoryBudgets = await prisma.categoryBudget.findMany({ 
    where: { 
      month: filterMonth, 
      year: filterYear,
      ...(filterCategory && { category: filterCategory })
    } 
  });

  // Orçamento Geral agora é a soma de todas as metas
  const orcado = categoryBudgets.reduce((acc, curr) => acc + curr.amount, 0);
  const percentual = (totalMes / orcado) * 100;

  // Process data for charts
  const historyMap = {};
  allTransactions.forEach(t => {
    const m = format(t.date, 'MMM/yy', { locale: ptBR });
    historyMap[m] = (historyMap[m] || 0) + t.amount;
  });
  const historyData = Object.keys(historyMap).reverse().map(k => ({ name: k, total: historyMap[k] }));

  const dailyMap = {};
  const categoryMap = {};
  
  currentMonthTransactions.forEach(t => {
    // Para o gráfico de dia a dia
    const d = format(t.date, 'dd/MM');
    dailyMap[d] = (dailyMap[d] || 0) + t.amount;

    // Para o gráfico de categorias
    categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
  });
  
  const dailyData = Object.keys(dailyMap).sort().map(k => ({ day: k, total: dailyMap[k] }));
  const categoryData = Object.keys(categoryMap).map(k => ({ category: k, total: categoryMap[k] }));


  
  const categoryBudgetMap = {};
  categoryBudgets.forEach(cb => {
    categoryBudgetMap[cb.category] = cb.amount;
  });

  const allCategories = new Set([...Object.keys(categoryMap), ...Object.keys(categoryBudgetMap)]);
  const categoryBudgetData = Array.from(allCategories).map(cat => ({
    category: cat,
    atingido: categoryMap[cat] || 0,
    meta: categoryBudgetMap[cat] || 0
  }));

  return (
    <main className="container">
      <header className="header animate-fade-in">
        <h1>Finance Dashboard</h1>
        <p>Visão do Casal - Registros via Telegram</p>
      </header>

      {isDefaultView && <DashboardFilter />}

      {(isDefaultView || isChartsView) && (
        <section className="summary-cards animate-fade-in delay-1">
          <div className="card">
            <div className="card-title">Orçado (Mês)</div>
            <div className="card-value">R$ {orcado.toFixed(2).replace('.', ',')}</div>
          </div>
          <div className="card">
            <div className="card-title">Realizado (Mês)</div>
            <div className={`card-value ${totalMes > orcado ? 'negative' : 'positive'}`}>
              R$ {totalMes.toFixed(2).replace('.', ',')}
            </div>
            <div style={{ marginTop: '1rem', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(percentual, 100)}%`, background: totalMes > orcado ? 'var(--danger)' : 'var(--success)', borderRadius: 4 }} />
            </div>
          </div>
        </section>
      )}

      {(isDefaultView || isChartsView || isGastosView) && (
        <div className="charts-grid animate-fade-in delay-2">
          
          {(isDefaultView || isChartsView) && (
            <>
              <div className="chart-container">
                <h2 className="section-title">Histórico (Mês a Mês)</h2>
                <HistoryChart data={historyData} />
              </div>
              <div className="chart-container">
                <h2 className="section-title">Neste Mês (Dia a Dia)</h2>
                <DailyChart data={dailyData} />
              </div>
            </>
          )}

          <div className="chart-container" style={{ gridColumn: '1 / -1' }}>
            <h2 className="section-title">Gastos por Categoria (Este Mês)</h2>
            <CategoryChart data={categoryData} />
          </div>

          {(isDefaultView || isChartsView) && (
            <div className="chart-container" style={{ gridColumn: '1 / -1' }}>
              <h2 className="section-title">Meta vs Atingido (Por Categoria)</h2>
              {isDefaultView && (
                <div className="hide-on-print">
                  <BudgetForm />
                  <ActiveBudgetsTable budgets={categoryBudgets} />
                </div>
              )}
              <div style={{ marginTop: '2rem' }}>
                <CategoryBudgetChart data={categoryBudgetData} />
              </div>
            </div>
          )}
        </div>
      )}

      {(isDefaultView || isGastosView) && (
        <section className="animate-fade-in delay-3" style={{ marginTop: '3rem' }}>
          <h2 className="section-title">Tabela de Gastos {isDefaultView && "(Editável)"}</h2>
          {isDefaultView && <AddTransactionForm />}
          <TransactionsTable transactions={currentMonthTransactions} hideActions={!isDefaultView} />
        </section>
      )}
    </main>
  );
}
