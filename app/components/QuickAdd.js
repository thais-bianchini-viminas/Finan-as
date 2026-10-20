'use client';

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { EXPENSE, FIXED, INCOME, VARIABLE, categoriesFor, categorize, detectKind } from '../../lib/categories';
import { parseAmount, todayISO } from '../../lib/format';
import { createTransaction, suggestClassification } from '../actions';
import { Toast } from './Toast';

const SENDER_KEY = 'fin:sender';

function readSavedSender() {
  try { return localStorage.getItem(SENDER_KEY); } catch { return null; }
}
const noopSubscribe = () => () => {};

const SOURCE_TAG = { history: 'aprendida', similar: 'aprendida', keyword: 'automática', default: null };

export function QuickAdd({ senders, initialType = EXPENSE }) {
  const [type, setType] = useState(initialType);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [manualCategory, setManualCategory] = useState(null);
  const [manualKind, setManualKind] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  // Lembra quem lançou por último neste aparelho (no servidor não há localStorage).
  const savedSender = useSyncExternalStore(noopSubscribe, readSavedSender, () => null);
  const [chosenSender, setSender] = useState(null);
  const sender = chosenSender ?? savedSender ?? senders[0] ?? '';
  const [date, setDate] = useState(todayISO);
  const [toast, setToast] = useState(null);
  const [pending, startTransition] = useTransition();
  const amountRef = useRef(null);

  // Pergunta ao servidor (que conhece o histórico) enquanto a pessoa digita.
  const text = description.trim();
  const suggestionKey = `${type}|${text}`;
  useEffect(() => {
    if (!text) return;
    const timer = setTimeout(async () => {
      const result = await suggestClassification(text, type).catch(() => null);
      setSuggestion(result ? { ...result, key: `${type}|${text}` } : null);
    }, 350);
    return () => clearTimeout(timer);
  }, [text, type]);

  const learned = suggestion?.key === suggestionKey ? suggestion : null;
  const autoCategory = text ? learned?.category || categorize(text, type) : null;
  const category = manualCategory || autoCategory;
  const kind = type === INCOME ? VARIABLE : manualKind ?? (text ? learned?.kind || detectKind(text) : VARIABLE);
  const tag = !manualCategory && text ? SOURCE_TAG[learned?.source || 'keyword'] : null;
  const canSubmit = parseAmount(amount) > 0 && text && sender.trim();

  function switchType(next) {
    setType(next);
    setManualCategory(null);
    setManualKind(null);
  }

  function submit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    const formData = new FormData();
    formData.set('type', type);
    formData.set('amount', amount);
    formData.set('description', description);
    formData.set('category', category || '');
    formData.set('kind', kind);
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
        setManualKind(null);
        amountRef.current?.focus();
      }
    });
  }

  return (
    <form className={`quick-add card ${type === INCOME ? 'is-income' : ''}`} onSubmit={submit}>
      <div className="segmented" role="tablist">
        <button type="button" role="tab" aria-selected={type === EXPENSE} className={type === EXPENSE ? 'active' : ''} onClick={() => switchType(EXPENSE)}>Despesa</button>
        <button type="button" role="tab" aria-selected={type === INCOME} className={type === INCOME ? 'active' : ''} onClick={() => switchType(INCOME)}>Receita</button>
      </div>

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
        placeholder={type === INCOME ? 'De onde veio? Ex.: salário, freela' : 'O que foi? Ex.: mercado, uber, farmácia'}
        aria-label="Descrição"
        enterKeyHint="done"
        autoComplete="off"
      />

      <fieldset className="chips-field">
        <legend>Categoria {tag && <span className="tag">{tag}</span>}</legend>
        <div className="chips">
          {categoriesFor(type).map(c => (
            <button
              type="button"
              key={c.name}
              className={`chip ${category === c.name ? 'chip-active' : ''}`}
              style={category === c.name ? { borderColor: c.color, background: `${c.color}1f` } : undefined}
              onClick={() => setManualCategory(manualCategory === c.name ? null : c.name)}
            >
              <span aria-hidden>{c.emoji}</span> {c.name}
            </button>
          ))}
        </div>
      </fieldset>

      {type === EXPENSE && (
        <fieldset className="chips-field">
          <legend>Natureza</legend>
          <div className="segmented segmented-sm">
            <button type="button" className={kind === VARIABLE ? 'active' : ''} onClick={() => setManualKind(VARIABLE)}>🛒 Gasto variável</button>
            <button type="button" className={kind === FIXED ? 'active' : ''} onClick={() => setManualKind(FIXED)}>📌 Custo fixo</button>
          </div>
          <p className="muted small hint">
            {kind === FIXED ? 'Se repete todo mês (financiamento, internet, luz, fatura). Entra automático nas metas.' : 'Consumo do dia a dia, varia de mês a mês.'}
          </p>
        </fieldset>
      )}

      <div className="row-2">
        <fieldset className="chips-field">
          <legend>Quem</legend>
          <div className="chips">
            {senders.map(name => (
              <button type="button" key={name} className={`chip ${sender === name ? 'chip-active' : ''}`} onClick={() => setSender(name)}>
                {name}
              </button>
            ))}
            {!senders.length && (
              <input className="input input-sm" value={sender} onChange={e => setSender(e.target.value)} placeholder="Seu nome" aria-label="Nome de quem lançou" />
            )}
          </div>
        </fieldset>

        <label className="field">
          <span className="field-label">Data</span>
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} max={todayISO()} />
        </label>
      </div>

      <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={!canSubmit || pending}>
        {pending ? 'Salvando…' : type === INCOME ? 'Salvar receita' : 'Salvar despesa'}
      </button>

      <Toast toast={toast} onDone={() => setToast(null)} />
    </form>
  );
}
