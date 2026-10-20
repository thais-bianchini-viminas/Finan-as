'use client';

import { useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { CATEGORIES, categorize } from '../../lib/categories';
import { parseAmount, todayISO } from '../../lib/format';
import { createTransaction } from '../actions';
import { Toast } from './Toast';

const SENDER_KEY = 'fin:sender';

function readSavedSender() {
  try { return localStorage.getItem(SENDER_KEY); } catch { return null; }
}
const noopSubscribe = () => () => {};

export function QuickAdd({ senders }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [manualCategory, setManualCategory] = useState(null);
  // Lembra quem lançou por último neste aparelho (no servidor não há localStorage).
  const savedSender = useSyncExternalStore(noopSubscribe, readSavedSender, () => null);
  const [chosenSender, setSender] = useState(null);
  const sender = chosenSender ?? savedSender ?? senders[0] ?? '';
  const [date, setDate] = useState(todayISO);
  const [toast, setToast] = useState(null);
  const [pending, startTransition] = useTransition();
  const amountRef = useRef(null);

  const category = manualCategory || (description ? categorize(description) : null);
  const canSubmit = parseAmount(amount) > 0 && description.trim() && sender.trim();

  function submit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    const formData = new FormData();
    formData.set('amount', amount);
    formData.set('description', description);
    formData.set('category', category || 'Outros');
    formData.set('senderName', sender);
    formData.set('date', date);

    startTransition(async () => {
      const result = await createTransaction(formData);
      setToast(result);
      if (result.ok) {
        try { localStorage.setItem(SENDER_KEY, sender); } catch {}
        setAmount('');
        setDescription('');
        setManualCategory(null);
        amountRef.current?.focus();
      }
    });
  }

  return (
    <form className="quick-add" onSubmit={submit}>
      <label className="amount-field">
        <span className="amount-prefix">R$</span>
        <input
          ref={amountRef}
          value={amount}
          onChange={e => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
          inputMode="decimal"
          placeholder="0,00"
          aria-label="Valor"
          autoFocus
          enterKeyHint="next"
        />
      </label>

      <input
        className="input input-lg"
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="O que foi? Ex.: mercado, uber, farmácia"
        aria-label="Descrição"
        enterKeyHint="done"
        autoComplete="off"
      />

      <fieldset className="chips-field">
        <legend>Categoria {category && !manualCategory && <span className="tag">automática</span>}</legend>
        <div className="chips">
          {CATEGORIES.map(c => (
            <button
              type="button"
              key={c.name}
              className={`chip ${category === c.name ? 'chip-active' : ''}`}
              style={category === c.name ? { borderColor: c.color, background: `${c.color}26` } : undefined}
              onClick={() => setManualCategory(manualCategory === c.name ? null : c.name)}
            >
              <span aria-hidden>{c.emoji}</span> {c.name}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="row-2">
        <fieldset className="chips-field">
          <legend>Quem</legend>
          <div className="chips">
            {senders.map(name => (
              <button type="button" key={name} className={`chip ${sender === name ? 'chip-active' : ''}`} onClick={() => setSender(name)}>
                {name}
              </button>
            ))}
            <input
              className="input input-sm"
              value={senders.includes(sender) ? '' : sender}
              onChange={e => setSender(e.target.value)}
              placeholder={senders.length ? 'Outro' : 'Seu nome'}
              aria-label="Nome de quem lançou"
            />
          </div>
        </fieldset>

        <label className="field">
          <span className="field-label">Data</span>
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} max={todayISO()} />
        </label>
      </div>

      <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={!canSubmit || pending}>
        {pending ? 'Salvando…' : 'Salvar gasto'}
      </button>

      <Toast toast={toast} onDone={() => setToast(null)} />
    </form>
  );
}
