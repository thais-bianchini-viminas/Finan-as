'use client';

import { useState, useTransition } from 'react';
import { categoryInfo } from '../../lib/categories';
import { defaultFixedKeys, suggestedBudgets } from '../../lib/budgets';
import { formatBRL, parseAmount, percent } from '../../lib/format';
import { copyPreviousBudgets, saveBudgets } from '../actions';
import { Toast } from './Toast';

const toInput = (value) => (value > 0 ? String(value).replace('.', ',') : '');
const valuesFrom = (categories) => Object.fromEntries(categories.map(c => [c.name, toInput(c.budget)]));
const signature = (categories) => categories.map(c => `${c.name}:${c.budget}`).join('|');

export function BudgetEditor({ month, year, monthName, prevMonthName, categories, suggestion }) {
  const [values, setValues] = useState(() => valuesFrom(categories));
  const [synced, setSynced] = useState(() => signature(categories));
  const [toast, setToast] = useState(null);
  const [pending, startTransition] = useTransition();
  const [generatorOpen, setGeneratorOpen] = useState(() => categories.every(c => !c.budget) && suggestion.fixedItems.length + Object.keys(suggestion.variableAverages).length > 0);
  const [selectedFixed, setSelectedFixed] = useState(() => new Set(defaultFixedKeys(suggestion)));
  const [fixedAmounts, setFixedAmounts] = useState(() => Object.fromEntries(suggestion.fixedItems.map(i => [i.key, toInput(i.amount)])));
  const [breakdown, setBreakdown] = useState(null);

  // Quando o servidor devolve metas novas (ex.: depois de copiar), atualiza os campos.
  const current = signature(categories);
  if (current !== synced) {
    setSynced(current);
    setValues(valuesFrom(categories));
  }

  const total = Object.values(values).reduce((acc, v) => acc + (parseAmount(v) || 0), 0);
  const dirty = categories.some(c => (parseAmount(values[c.name]) || 0) !== (c.budget || 0));

  const editedSuggestion = {
    ...suggestion,
    fixedItems: suggestion.fixedItems.map(i => ({ ...i, amount: parseAmount(fixedAmounts[i.key]) || 0 })),
  };
  const preview = suggestedBudgets(editedSuggestion, [...selectedFixed]);
  const previewTotal = Object.values(preview).reduce((a, b) => a + b, 0);

  function toggleFixed(key) {
    setSelectedFixed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function applySuggestion() {
    setValues(Object.fromEntries(Object.entries(preview).map(([name, v]) => [name, toInput(v)])));
    const parts = {};
    for (const c of categories) {
      const fixed = editedSuggestion.fixedItems.filter(i => i.category === c.name && selectedFixed.has(i.key)).reduce((a, i) => a + i.amount, 0);
      parts[c.name] = { fixed, variable: suggestion.variableAverages[c.name] || 0 };
    }
    setBreakdown(parts);
    setGeneratorOpen(false);
    setToast({ ok: true, message: 'Metas sugeridas! Ajuste o que quiser e toque em Salvar.' });
  }

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

  const hasHistory = suggestion.fixedItems.length > 0 || Object.keys(suggestion.variableAverages).length > 0;

  return (
    <form className="budget-editor" onSubmit={save}>
      <div className="card budget-total">
        <div>
          <div className="card-label">Total planejado · {monthName}</div>
          <div className="card-value">{formatBRL(total)}</div>
        </div>
        <div className="budget-actions">
          {hasHistory && (
            <button type="button" className="btn btn-accent btn-sm" onClick={() => setGeneratorOpen(o => !o)} aria-expanded={generatorOpen}>
              ✨ Gerar pelo histórico
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={copy} disabled={pending}>
            📋 Copiar de {prevMonthName}
          </button>
        </div>
      </div>

      {generatorOpen && (
        <section className="card generator">
          <h2 className="section-title">✨ Metas pelo histórico</h2>
          <p className="muted small">
            Meta = <b>custos fixos</b> que vão acontecer neste mês + <b>média do gasto variável</b> dos últimos {suggestion.months} mês(es).
            Desmarque o que não se repete agora (ex.: parcela que acabou) e ajuste valores que mudaram.
          </p>

          {suggestion.fixedItems.length > 0 && (
            <>
              <h3 className="sub-title">📌 Custos fixos</h3>
              <ul className="fixed-list">
                {suggestion.fixedItems.map(item => {
                  const info = categoryInfo(item.category);
                  const checked = selectedFixed.has(item.key);
                  return (
                    <li key={item.key} className={checked ? '' : 'is-off'}>
                      <label className="fixed-check">
                        <input type="checkbox" checked={checked} onChange={() => toggleFixed(item.key)} />
                        <span className="fixed-info">
                          <span className="fixed-name">{info.emoji} {item.description}</span>
                          <span className="muted small">
                            {item.category} · {item.monthsSeen === suggestion.months ? 'todo mês' : `apareceu em ${item.monthsSeen} de ${suggestion.months} meses`}
                          </span>
                        </span>
                      </label>
                      <label className="budget-input budget-input-sm">
                        <span aria-hidden>R$</span>
                        <input
                          value={fixedAmounts[item.key]}
                          onChange={e => setFixedAmounts(v => ({ ...v, [item.key]: e.target.value.replace(/[^\d.,]/g, '') }))}
                          inputMode="decimal"
                          disabled={!checked}
                          aria-label={`Valor de ${item.description}`}
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {Object.keys(suggestion.variableAverages).length > 0 && (
            <>
              <h3 className="sub-title">🛒 Média do gasto variável por mês</h3>
              <ul className="avg-list">
                {Object.entries(suggestion.variableAverages).sort((a, b) => b[1] - a[1]).map(([name, avg]) => (
                  <li key={name}><span>{categoryInfo(name).emoji} {name}</span><span>{formatBRL(avg)}</span></li>
                ))}
              </ul>
            </>
          )}

          <button type="button" className="btn btn-primary btn-block" onClick={applySuggestion}>
            Aplicar sugestão · {formatBRL(previewTotal)}
          </button>
        </section>
      )}

      <ul className="card budget-rows">
        {categories.map(c => {
          const info = categoryInfo(c.name);
          const target = parseAmount(values[c.name]) || 0;
          const pct = percent(c.spent, target);
          const parts = breakdown?.[c.name];
          return (
            <li key={c.name} className="budget-row">
              <span className="cat-dot" style={{ background: `${info.color}22` }} aria-hidden>{info.emoji}</span>
              <div className="budget-info">
                <span className="budget-name">{c.name}</span>
                <span className="muted small">
                  gasto {formatBRL(c.spent)}{target > 0 && ` · ${pct.toFixed(0)}%`}
                </span>
                {parts && (parts.fixed > 0 || parts.variable > 0) && (
                  <span className="small text-brand">
                    {parts.fixed > 0 && `fixos ${formatBRL(parts.fixed)}`}{parts.fixed > 0 && parts.variable > 0 && ' + '}{parts.variable > 0 && `variável ${formatBRL(parts.variable)}`}
                  </span>
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

      {/* Com o gerador aberto, a ação principal é "Aplicar sugestão"; o salvar fixo cobriria o botão. */}
      {!generatorOpen && (
        <div className="sticky-action">
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={pending || !dirty}>
            {pending ? 'Salvando…' : dirty ? 'Salvar metas' : 'Metas salvas ✓'}
          </button>
        </div>
      )}

      <Toast toast={toast} onDone={() => setToast(null)} />
    </form>
  );
}
