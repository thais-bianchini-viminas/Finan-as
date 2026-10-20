'use client';

import { useState, useTransition } from 'react';
import { categoryInfo } from '../../lib/categories';
import { formatBRL, parseAmount, percent } from '../../lib/format';
import { copyPreviousBudgets, saveBudgets } from '../actions';
import { Toast } from './Toast';

const toInput = (value) => (value > 0 ? String(value).replace('.', ',') : '');
const valuesFrom = (categories) => Object.fromEntries(categories.map(c => [c.name, toInput(c.budget)]));
const signature = (categories) => categories.map(c => `${c.name}:${c.budget}`).join('|');

export function BudgetEditor({ month, year, monthName, prevMonthName, categories, averages }) {
  const [values, setValues] = useState(() => valuesFrom(categories));
  const [synced, setSynced] = useState(() => signature(categories));
  const [toast, setToast] = useState(null);
  const [pending, startTransition] = useTransition();

  // Quando o servidor devolve metas novas (ex.: depois de copiar), atualiza os campos.
  const current = signature(categories);
  if (current !== synced) {
    setSynced(current);
    setValues(valuesFrom(categories));
  }

  const total = Object.values(values).reduce((acc, v) => acc + (parseAmount(v) || 0), 0);
  const dirty = categories.some(c => (parseAmount(values[c.name]) || 0) !== (c.budget || 0));

  const periodData = () => {
    const formData = new FormData();
    formData.set('month', month);
    formData.set('year', year);
    return formData;
  };

  function save(event) {
    event.preventDefault();
    const formData = periodData();
    for (const [name, value] of Object.entries(values)) formData.set(`budget:${name}`, value);
    startTransition(async () => setToast(await saveBudgets(formData)));
  }

  function copy() {
    startTransition(async () => setToast(await copyPreviousBudgets(periodData())));
  }

  return (
    <form className="budget-editor" onSubmit={save}>
      <div className="budget-total card">
        <div>
          <div className="card-label">Total planejado · {monthName}</div>
          <div className="card-value">{formatBRL(total)}</div>
        </div>
        <button type="button" className="btn btn-ghost" onClick={copy} disabled={pending}>
          📋 Copiar de {prevMonthName}
        </button>
      </div>

      <ul className="budget-rows">
        {categories.map(c => {
          const info = categoryInfo(c.name);
          const target = parseAmount(values[c.name]) || 0;
          const pct = percent(c.spent, target);
          const avg = averages[c.name];
          return (
            <li key={c.name} className="budget-row">
              <span className="cat-dot" style={{ background: info.color }} aria-hidden>{info.emoji}</span>
              <div className="budget-info">
                <span className="budget-name">{c.name}</span>
                <span className="muted small">
                  gasto {formatBRL(c.spent)}{target > 0 && ` · ${pct.toFixed(0)}%`}
                </span>
                {avg > 0 && toInput(avg) !== values[c.name] && (
                  <button type="button" className="link-btn small" onClick={() => setValues(v => ({ ...v, [c.name]: toInput(avg) }))}>
                    usar média 3 meses: {formatBRL(avg)}
                  </button>
                )}
              </div>
              <label className="budget-input">
                <span aria-hidden>R$</span>
                <input
                  value={values[c.name]}
                  onChange={e => setValues(v => ({ ...v, [c.name]: e.target.value.replace(/[^\d.,]/g, '') }))}
                  inputMode="decimal"
                  placeholder="—"
                  aria-label={`Meta de ${c.name}`}
                />
              </label>
            </li>
          );
        })}
      </ul>

      <p className="muted small center">Deixe em branco para não ter meta na categoria.</p>

      <div className="sticky-action">
        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={pending || !dirty}>
          {pending ? 'Salvando…' : dirty ? 'Salvar metas' : 'Metas salvas ✓'}
        </button>
      </div>

      <Toast toast={toast} onDone={() => setToast(null)} />
    </form>
  );
}
