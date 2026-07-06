'use client';

import { deleteCategoryBudget } from '../actions';

export function ActiveBudgetsTable({ budgets }) {
  if (budgets.length === 0) return null;

  return (
    <div className="table-container" style={{ marginTop: '1.5rem', background: 'rgba(15, 23, 42, 0.4)' }}>
      <h3 style={{ padding: '1rem 1.5rem', fontSize: '1rem', color: 'var(--text-muted)' }}>Metas Ativas</h3>
      <table className="styled-table">
        <thead>
          <tr>
            <th>Categoria</th>
            <th style={{ textAlign: 'right' }}>Meta (R$)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {budgets.map(b => (
            <tr key={b.id}>
              <td><span className="category-badge">{b.category}</span></td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                R$ {b.amount.toFixed(2).replace('.', ',')}
              </td>
              <td style={{ textAlign: 'center' }}>
                <form action={async () => {
                  if (confirm('Deseja excluir esta meta?')) {
                    await deleteCategoryBudget(b.id);
                  }
                }}>
                  <button type="submit" className="delete-btn" title="Excluir">🗑️</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
