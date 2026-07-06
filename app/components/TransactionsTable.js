'use client';

import { useState } from 'react';
import { deleteTransaction, updateTransaction } from '../actions';
import { format } from 'date-fns';

const CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Lazer',
  'Saúde',
  'Moradia',
  'Contas/Cartão',
  'Outros'
];

export function TransactionsTable({ transactions }) {
  const [editingId, setEditingId] = useState(null);

  if (transactions.length === 0) {
    return (
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
            <tr><td colSpan="6" style={{ textAlign: 'center', color: '#94a3b8' }}>Nenhum registro encontrado.</td></tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="styled-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Quem</th>
            <th>Categoria</th>
            <th>Descrição</th>
            <th style={{ textAlign: 'right' }}>Valor (R$)</th>
            <th style={{ textAlign: 'center' }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id}>
              {editingId === t.id ? (
                <EditableRow 
                  transaction={t} 
                  onCancel={() => setEditingId(null)} 
                  onSave={() => setEditingId(null)} 
                />
              ) : (
                <>
                  <td>{format(new Date(t.date), 'dd/MM/yyyy')}</td>
                  <td><span className="badge-user">{t.senderName}</span></td>
                  <td><span className="category-badge">{t.category}</span></td>
                  <td>{t.description}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>R$ {t.amount.toFixed(2).replace('.', ',')}</td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button onClick={() => setEditingId(t.id)} className="action-btn edit-btn" title="Editar">✏️</button>
                      <form action={async () => {
                        if (confirm('Deseja excluir este gasto?')) {
                          await deleteTransaction(t.id);
                        }
                      }}>
                        <button type="submit" className="action-btn delete-btn" title="Excluir">🗑️</button>
                      </form>
                    </div>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditableRow({ transaction, onCancel, onSave }) {
  return (
    <>
      <td style={{ color: '#94a3b8' }}>{format(new Date(transaction.date), 'dd/MM/yyyy')}</td>
      <td style={{ color: '#94a3b8' }}><span className="badge-user">{transaction.senderName}</span></td>
      <td colSpan="4">
        <form 
          action={async (formData) => {
            const data = {
              category: formData.get('category'),
              description: formData.get('description'),
              amount: formData.get('amount').replace(',', '.')
            };
            await updateTransaction(transaction.id, data);
            onSave();
          }}
          style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
        >
          <select name="category" defaultValue={transaction.category} required className="edit-input">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="text" name="description" defaultValue={transaction.description} required className="edit-input" style={{ flex: 1 }} />
          <input type="number" name="amount" defaultValue={transaction.amount} step="0.01" required className="edit-input" style={{ width: '100px' }} />
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="action-btn save-btn" title="Salvar">✅</button>
            <button type="button" onClick={onCancel} className="action-btn cancel-btn" title="Cancelar">❌</button>
          </div>
        </form>
      </td>
    </>
  );
}
