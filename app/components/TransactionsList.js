'use client';

import { useState, useTransition } from 'react';
import { CATEGORY_NAMES, categoryInfo } from '../../lib/categories';
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

export function TransactionsList({ transactions, readOnly = false }) {
  const [editingId, setEditingId] = useState(null);

  if (!transactions.length) return <p className="muted empty">Nenhum gasto encontrado.</p>;

  return (
    <div className="tx-groups">
      {groupByDay(transactions).map(group => (
        <section key={group.key} className="tx-group">
          <header className="tx-day">
            <span>{formatDate(group.date, { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
            <span>{formatBRL(group.items.reduce((acc, t) => acc + t.amount, 0))}</span>
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
      ))}
    </div>
  );
}

function TransactionRow({ transaction: t, onClick }) {
  const info = categoryInfo(t.category);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className="tx-item" onClick={onClick}>
      <span className="cat-dot" style={{ background: info.color }} aria-hidden>{info.emoji}</span>
      <span className="tx-main">
        <span className="tx-desc">{t.description}</span>
        <span className="tx-meta">{t.category} · {t.senderName}</span>
      </span>
      <span className="tx-amount">{formatBRL(t.amount)}</span>
    </Tag>
  );
}

function EditForm({ transaction: t, onClose }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);

  function save(formData) {
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
      <input name="description" defaultValue={t.description} className="input" required aria-label="Descrição" />
      <div className="row-2">
        <input name="amount" defaultValue={String(t.amount).replace('.', ',')} inputMode="decimal" className="input" required aria-label="Valor" />
        <input name="date" type="date" defaultValue={toISODate(t.date)} className="input" required aria-label="Data" />
      </div>
      <select name="category" defaultValue={t.category} className="input" aria-label="Categoria">
        {CATEGORY_NAMES.map(c => <option key={c} value={c}>{categoryInfo(c).emoji} {c}</option>)}
      </select>
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
