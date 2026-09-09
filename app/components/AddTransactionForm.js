'use client';

import { useRef } from 'react';
import { createTransaction } from '../actions';

const CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Lazer',
  'Saúde',
  'Moradia',
  'Contas/Cartão',
  'Outros'
];

const today = () => new Date().toISOString().split('T')[0];

export function AddTransactionForm() {
  const formRef = useRef(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await createTransaction(formData);
        formRef.current?.reset();
      }}
      className="add-transaction-form hide-on-print"
    >
      <h3 style={{ gridColumn: '1 / -1', margin: 0, fontSize: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        ➕ Novo Lançamento
      </h3>

      <div className="form-group">
        <label>Quem</label>
        <input type="text" name="senderName" placeholder="Seu nome" required />
      </div>

      <div className="form-group">
        <label>Data</label>
        <input type="date" name="date" defaultValue={today()} required />
      </div>

      <div className="form-group">
        <label>Categoria</label>
        <select name="category" required>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="form-group" style={{ flex: 2 }}>
        <label>Descrição</label>
        <input type="text" name="description" placeholder="Ex: Aluguel, Mercado..." required />
      </div>

      <div className="form-group">
        <label>Valor (R$)</label>
        <input type="number" name="amount" placeholder="0,00" step="0.01" min="0.01" required />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        <button type="submit" className="btn-primary">Salvar</button>
      </div>
    </form>
  );
}
