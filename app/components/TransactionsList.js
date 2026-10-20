'use client';

import { useState, useTransition } from 'react';
import { EXPENSE, FIXED, INCOME, VARIABLE, categoriesFor, categoryInfo } from '../../lib/categories';
import { formatBRL, formatDate, toISODate } from '../../lib/format';
import { applyInvoiceTotal, clearInvoice, deleteTransaction, importInvoice, updateTransaction } from '../actions';
import { Toast } from './Toast';

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
  const [open, setOpen] = useState({ id: null, mode: null });
  const [toast, setToast] = useState(null);

  if (!transactions.length) return <p className="muted empty">Nenhum lançamento encontrado.</p>;
  const close = () => setOpen({ id: null, mode: null });

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
                <li key={t.id} className={open.id === t.id ? 'is-open' : ''}>
                  {open.id === t.id && open.mode === 'edit' ? (
                    <EditForm transaction={t} onClose={close} />
                  ) : (
                    <>
                      <TransactionRow
                        transaction={t}
                        onClick={readOnly ? undefined : () => setOpen(open.id === t.id ? { id: null, mode: null } : { id: t.id, mode: 'details' })}
                      />
                      {open.id === t.id && (
                        <Details transaction={t} onEdit={() => setOpen({ id: t.id, mode: 'edit' })} onToast={setToast} />
                      )}
                      {readOnly && t.items?.length > 0 && <ItemsList items={t.items} compact />}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <Toast toast={toast} onDone={() => setToast(null)} />
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
          {t.items?.length > 0 && <span className="badge badge-items">📎 {t.items.length}</span>}
        </span>
      </span>
      <span className={`tx-amount ${income ? 'text-success' : ''}`}>{income ? '+' : '−'} {formatBRL(t.amount)}</span>
    </Tag>
  );
}

function ItemsList({ items, compact = false }) {
  return (
    <ul className={`items-list ${compact ? 'items-compact' : ''}`}>
      {items.map(item => (
        <li key={item.id}>
          <span className="items-date muted">{item.date ? formatDate(item.date) : ''}</span>
          <span className="items-desc">
            <span aria-hidden>{categoryInfo(item.category).emoji}</span> {item.description}
          </span>
          <span className={`items-amount ${item.amount < 0 ? 'text-success' : ''}`}>{formatBRL(item.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

function Details({ transaction: t, onEdit, onToast }) {
  const [pending, startTransition] = useTransition();
  const [needsPassword, setNeedsPassword] = useState(false);
  const items = t.items || [];
  const itemsTotal = Math.round(items.reduce((a, i) => a + i.amount, 0) * 100) / 100;
  const diff = Math.round((itemsTotal - t.amount) * 100) / 100;

  const breakdown = Object.entries(items.reduce((acc, i) => ({ ...acc, [i.category]: (acc[i.category] || 0) + i.amount }), {}))
    .sort((a, b) => b[1] - a[1]);

  function upload(formData) {
    startTransition(async () => {
      const result = await importInvoice(t.id, formData);
      if (result.code === 'password') setNeedsPassword(true);
      onToast(result);
    });
  }

  function remove() {
    if (!confirm(`Excluir "${t.description}"?`)) return;
    startTransition(async () => { await deleteTransaction(t.id); });
  }

  return (
    <div className="tx-details">
      {items.length > 0 ? (
        <>
          <div className="details-head">
            <strong>Detalhamento · {items.length} compras</strong>
            <span>{formatBRL(itemsTotal)}</span>
          </div>
          <div className="chips">
            {breakdown.map(([category, total]) => (
              <span key={category} className="chip chip-static">{categoryInfo(category).emoji} {category} <b>{formatBRL(total)}</b></span>
            ))}
          </div>
          {Math.abs(diff) >= 0.01 && (
            <div className="details-diff">
              <span className="small">A fatura soma {formatBRL(itemsTotal)}, {diff > 0 ? 'acima' : 'abaixo'} do lançado em {formatBRL(Math.abs(diff))}.</span>
              <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => startTransition(async () => onToast(await applyInvoiceTotal(t.id)))}>
                Usar {formatBRL(itemsTotal)}
              </button>
            </div>
          )}
          <ItemsList items={items} />
        </>
      ) : t.type !== INCOME && (
        <p className="muted small">É a fatura do cartão? Anexe o arquivo e cada compra aparece aqui, já com categoria.</p>
      )}

      {t.type !== INCOME && (
        <form action={upload} className="attach-form">
          <label className="file-input">
            <span>📎 {items.length ? 'Substituir fatura' : 'Anexar fatura'} <span className="muted small">(PDF, OFX ou CSV)</span></span>
            <input type="file" name="file" accept=".pdf,.ofx,.csv,.txt,application/pdf,text/csv" required />
          </label>
          {needsPassword && <input name="password" type="password" className="input" placeholder="Senha do PDF (geralmente parte do CPF)" autoComplete="off" />}
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>{pending ? 'Lendo…' : 'Importar'}</button>
        </form>
      )}

      <div className="tx-edit-actions">
        <button type="button" className="btn btn-danger btn-sm" onClick={remove} disabled={pending}>Excluir</button>
        {items.length > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => startTransition(async () => onToast(await clearInvoice(t.id)))}>Remover itens</button>
        )}
        <span className="spacer" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>✏️ Editar</button>
      </div>
    </div>
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
        <span className="spacer" />
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={pending}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? '…' : 'Salvar'}</button>
      </div>
    </form>
  );
}
