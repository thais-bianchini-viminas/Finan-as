'use client';

import { useState } from 'react';
import { logout } from '../actions';

// Mostra a despedida por um instante antes de encerrar a sessão.
export function LogoutButton() {
  const [leaving, setLeaving] = useState(false);

  function leave() {
    setLeaving(true);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => logout(), reduced ? 0 : 900);
  }

  return (
    <>
      <button type="button" className="btn btn-ghost btn-block" onClick={leave} disabled={leaving}>Sair deste aparelho</button>
      {leaving && (
        <div className="goodbye" role="status">
          <div className="splash-logo">R$</div>
          <div className="splash-text">Até logo 👋</div>
        </div>
      )}
    </>
  );
}
