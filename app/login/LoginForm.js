'use client';

import { useActionState, useState } from 'react';
import { login } from './actions';

export function LoginForm({ next }) {
  const [state, action, pending] = useActionState(login, null);
  const [visible, setVisible] = useState(false);

  return (
    // key muda a cada erro: o cartão "treme" de novo a cada senha errada.
    <form action={action} className={`stack login-form ${pending ? 'is-sending' : ''} ${state?.error ? 'is-error' : ''}`} key={state?.at || 'form'}>
      <input type="hidden" name="next" value={next} />
      <div className="password-field">
        <input
          type={visible ? 'text' : 'password'}
          name="password"
          placeholder="Senha"
          autoComplete="current-password"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          required
          className="input input-lg"
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
        >
          {visible ? '🙈' : '👁️'}
        </button>
      </div>
      {state?.error && <p className="error-text">{state.error}</p>}
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? <span className="spinner" aria-label="Entrando" /> : 'Entrar'}
      </button>
    </form>
  );
}
