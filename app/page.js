import prisma from '../lib/prisma';
import { HistoryChart, DailyChart, CategoryChart, CategoryBudgetChart } from './components/DashboardCharts';
import { BudgetForm } from './components/BudgetForm';
import { format, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { deleteTransaction } from './actions';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const transactions = await prisma.transaction.findMany({
    orderBy: { date: 'desc' }
  });

  const budgets = await prisma.budget.findMany();

  const now = new Date();
  const currentMonthTransactions = transactions.filter(t => isSameMonth(t.date, now));
  const totalMes = currentMonthTransactions.reduce((acc, curr) => acc + curr.amount, 0);
  
  // Orçamento fixo ou do banco (usando default 5000 se não definido)
  const currentBudget = budgets.find(b => b.month === now.getMonth() + 1 && b.year === now.getFullYear());
  const orcado = currentBudget ? currentBudget.amount : 5000; 
  const percentual = (totalMes / orcado) * 100;

  // Process data for charts
  const historyMap = {};
  transactions.forEach(t => {
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

  // Metas por categoria
  const categoryBudgets = await prisma.categoryBudget.findMany({ 
    where: { month: now.getMonth() + 1, year: now.getFullYear() } 
  });
  
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

      <div className="charts-grid animate-fade-in delay-2">
        <div className="chart-container">
          <h2 className="section-title">Histórico (Mês a Mês)</h2>
          <HistoryChart data={historyData} />
        </div>
        <div className="chart-container">
          <h2 className="section-title">Neste Mês (Dia a Dia)</h2>
          <DailyChart data={dailyData} />
        </div>
        <div className="chart-container" style={{ gridColumn: '1 / -1' }}>
          <h2 className="section-title">Gastos por Categoria (Este Mês)</h2>
          <CategoryChart data={categoryData} />
        </div>
        <div className="chart-container" style={{ gridColumn: '1 / -1' }}>
          <h2 className="section-title">Meta vs Atingido (Por Categoria)</h2>
          <BudgetForm />
          <div style={{ marginTop: '2rem' }}>
            <CategoryBudgetChart data={categoryBudgetData} />
          </div>
        </div>
      </div>

      <section className="animate-fade-in delay-3" style={{ marginTop: '3rem' }}>
        <h2 className="section-title">Tabela de Gastos</h2>
        <div className="table-container">
          <table className="styled-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Quem</th>
                <th>Categoria</th>
                <th>Descrição</th>
                <th style={{ textAlign: 'right' }}>Valor (R$)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', color: '#94a3b8' }}>Nenhum registro encontrado.</td></tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{format(t.date, 'dd/MM/yyyy')}</td>
                    <td><span className="badge-user">{t.senderName}</span></td>
                    <td><span className="category-badge">{t.category}</span></td>
                    <td>{t.description}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>R$ {t.amount.toFixed(2).replace('.', ',')}</td>
                    <td style={{ textAlign: 'center' }}>
                      <form action={async () => {
                        'use server';
                        await deleteTransaction(t.id);
                      }}>
                        <button type="submit" className="delete-btn" title="Excluir">🗑️</button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
