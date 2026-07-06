'use client';

import { useRef } from 'react';
import { setCategoryBudget } from '../actions';

const CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Lazer',
  'Saúde',
  'Moradia',
  'Contas/Cartão',
  'Outros'
];

export function BudgetForm() {
  const formRef = useRef(null);

  return (
    <form 
      ref={formRef}
      action={async (formData) => {
        await setCategoryBudget(formData);
        formRef.current?.reset();
      }}
      className="budget-form animate-fade-in delay-2"
    >
      <div className="form-group">
        <label htmlFor="category">Categoria</label>
        <select name="category" id="category" required>
          <option value="" disabled selected>Selecione a categoria</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="amount">Meta (R$)</label>
        <input 
          type="number" 
          name="amount" 
          id="amount" 
          step="0.01" 
          min="0" 
          placeholder="Ex: 500" 
          required 
        />
      </div>

      <button type="submit" className="btn-primary">
        Salvar Meta
      </button>
    </form>
  );
}
