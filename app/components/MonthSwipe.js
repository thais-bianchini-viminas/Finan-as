'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const MIN_DISTANCE = 60;      // px de deslize para contar como troca de mês
const LEAVE_MS = 170;         // duração da saída antes de navegar
// Gestos que começam aqui pertencem ao componente (rolagem de chips, gráficos, campos).
const IGNORE = '.chips-scroll, .chart, .donut-chart, input, textarea, select, [data-no-swipe]';

// Deslizar para a esquerda → mês anterior; para a direita → mês seguinte (como pedido).
// As setas do cabeçalho (data-month-nav) usam a mesma animação.
export function MonthSwipe({ monthKey, prevHref, nextHref, children }) {
  const router = useRouter();
  const start = useRef(null);
  const [phase, setPhase] = useState({ key: monthKey, state: 'idle', dir: null });

  // Novo mês chegou do servidor: entra deslizando a partir do lado certo.
  if (phase.key !== monthKey) setPhase({ key: monthKey, state: 'enter', dir: phase.dir });

  function go(dir) {
    const href = dir === 'prev' ? prevHref : nextHref;
    if (!href || phase.state === 'leave') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPhase(p => ({ ...p, state: 'leave', dir }));
    setTimeout(() => router.push(href, { scroll: false }), reduced ? 0 : LEAVE_MS);
  }

  // Intercepta as setas ‹ › do cabeçalho para animar também.
  useEffect(() => {
    const onClick = (event) => {
      const link = event.target.closest?.('[data-month-nav]');
      if (!link || event.metaKey || event.ctrlKey) return;
      event.preventDefault();
      go(link.dataset.monthNav);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  });

  function onTouchStart(event) {
    if (event.touches.length !== 1 || event.target.closest(IGNORE)) { start.current = null; return; }
    const t = event.touches[0];
    start.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  }

  function onTouchEnd(event) {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    // Precisa ser claramente horizontal e rápido o bastante (não confundir com rolagem).
    if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5 || Date.now() - s.time > 800) return;
    go(dx < 0 ? 'prev' : 'next');
  }

  const className = phase.state === 'idle' ? '' : `swipe-${phase.state}-${phase.dir}`;
  return (
    <div className={`month-swipe ${className}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      onAnimationEnd={() => phase.state === 'enter' && setPhase(p => ({ ...p, state: 'idle' }))}>
      {children}
    </div>
  );
}
