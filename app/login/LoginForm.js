'use client';

import { useActionState } from 'react';
import { login } from './actions';

export function LoginForm({ next }) {
  const [state, action, pending] = useActionState(login, null);

  return (
    <form action={action} className="stack">
      <input type="hidden" name="next" value={next} />
      <input
        type="password"
        name="password"
        placeholder="Senha"
        autoComplete="current-password"
        autoFocus
        required
        className="input input-lg"
      />
      {state?.error && <p className="error-text">{state.error}</p>}
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
