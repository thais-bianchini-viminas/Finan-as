'use client';

import { useEffect } from 'react';
import { INTRO_COOKIE } from '../../lib/auth-constants';

// Vinheta de boas-vindas logo após o login. Renderizada pelo servidor (sem piscar) e
// animada só com CSS; aqui apenas apagamos o cookie para não repetir num recarregamento.
export function Splash({ name }) {
  useEffect(() => {
    document.cookie = `${INTRO_COOKIE}=; path=/; max-age=0`;
  }, []);

  return (
    <div className="splash" aria-hidden>
      <div className="splash-logo">R$</div>
      <div className="splash-text">{name ? `Olá, ${name}!` : 'Bem-vindos!'}</div>
    </div>
  );
}
