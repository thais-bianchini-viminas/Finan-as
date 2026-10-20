'use client';

import { useState, useTransition } from 'react';
import { EXPENSE, FIXED, INCOME, VARIABLE, categoriesFor, categoryInfo } from '../../lib/categories';
import { formatBRL, formatDate, toISODate } from '../../lib/format';
import { deleteTransaction, updateTransaction } from '../actions';

function groupByDay(transactions) {
  const groups = [];
  for (const t of transactions) {
    const key = toISODate(t.date);
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(t);
    else groups.push({ key, date: t.date, items: [t] });
  }
  return groups;
}

const signed = (t) => (t.type === INCOME ? t.amount : -t.amount);

export function TransactionsList({ transactions, readOnly = false }) {
  const [editingId, setEditingId] = useState(null);

  if (!transactions.length) return <p className="muted empty">Nenhum lançamento encontrado.</p>;

  return (
    <div className="tx-groups">
      {groupByDay(transactions).map(group => {
        const net = group.items.reduce((acc, t) => acc + signed(t), 0);
        return (
          <section key={group.key} className="tx-group">
            <header className="tx-day">
              <span>{formatDate(group.date, { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
              <span className={net > 0 ? 'text-success' : ''}>{net > 0 ? '+' : ''}{formatBRL(net)}</span>
            </header>
            <ul className="tx-list">
              {group.items.map(t => (
                <li key={t.id}>
                  {editingId === t.id ? (
                    <EditForm transaction={t} onClose={() => setEditingId(null)} />
                  ) : (
                    <TransactionRow transaction={t} onClick={readOnly ? undefined : () => setEditingId(t.id)} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function TransactionRow({ transaction: t, onClick }) {
  const info = categoryInfo(t.category);
  const income = t.type === INCOME;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className="tx-item" onClick={onClick}>
      <span className="cat-dot" style={{ background: `${info.color}22` }} aria-hidden>{info.emoji}</span>
      <span className="tx-main">
        <span className="tx-desc">{t.description}</span>
        <span className="tx-meta">
          {t.category} · {t.senderName}
          {!income && t.kind === FIXED && <span className="badge">fixo</span>}
        </span>
      </span>
      <span className={`tx-amount ${income ? 'text-success' : ''}`}>{income ? '+' : '−'} {formatBRL(t.amount)}</span>
    </Tag>
  );
}

function EditForm({ transaction: t, onClose }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const [type, setType] = useState(t.type || EXPENSE);
  const categories = categoriesFor(type);

  function save(formData) {
    formData.set('type', type);
    startTransition(async () => {
      const result = await updateTransaction(t.id, formData);
      if (result.ok) onClose();
      else setError(result.message);
    });
  }

  function remove() {
    if (!confirm(`Excluir "${t.description}"?`)) return;
    startTransition(async () => {
      await deleteTransaction(t.id);
      onClose();
    });
  }

  return (
    <form action={save} className="tx-edit">
      <div className="segmented segmented-sm">
        <button type="button" className={type === EXPENSE ? 'active' : ''} onClick={() => setType(EXPENSE)}>Despesa</button>
        <button type="button" className={type === INCOME ? 'active' : ''} onClick={() => setType(INCOME)}>Receita</button>
      </div>
      <input name="description" defaultValue={t.description} className="input" required aria-label="Descrição" />
      <div className="row-2">
        <input name="amount" defaultValue={String(t.amount).replace('.', ',')} inputMode="decimal" className="input" required aria-label="Valor" />
        <input name="date" type="date" defaultValue={toISODate(t.date)} className="input" required aria-label="Data" />
      </div>
      <select key={type} name="category" defaultValue={categories.some(c => c.name === t.category) ? t.category : categories.at(-1).name} className="input" aria-label="Categoria">
        {categories.map(c => <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}
      </select>
      {type === EXPENSE && (
        <select name="kind" defaultValue={t.kind || VARIABLE} className="input" aria-label="Natureza">
          <option value={VARIABLE}>🛒 Gasto variável</option>
          <option value={FIXED}>📌 Custo fixo (todo mês)</option>
        </select>
      )}
      {error && <p className="error-text">{error}</p>}
      <div className="tx-edit-actions">
        <button type="button" className="btn btn-danger" onClick={remove} disabled={pending}>Excluir</button>
        <span className="spacer" />
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={pending}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? '…' : 'Salvar'}</button>
      </div>
    </form>
  );
}
