'use client';

import { useSyncExternalStore } from 'react';
import { THEME_COLORS, THEME_COOKIE } from '../../lib/theme';

// Tema efetivo (resolve "auto" pelo sistema) e reage a mudanças no atributo do <html> e no sistema.
function subscribe(callback) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  media.addEventListener('change', callback);
  return () => { observer.disconnect(); media.removeEventListener('change', callback); };
}
const preference = () => document.documentElement.dataset.theme || 'dark';
const resolved = () => {
  const pref = preference();
  return pref === 'auto' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : pref;
};

export const useThemePreference = () => useSyncExternalStore(subscribe, preference, () => 'dark');
export const useResolvedTheme = () => useSyncExternalStore(subscribe, resolved, () => 'dark');

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
  const effective = resolved();
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', THEME_COLORS[effective]));
}

const OPTIONS = [
  { id: 'dark', label: '🌙 Escuro' },
  { id: 'light', label: '☀️ Claro' },
  { id: 'auto', label: '⚙️ Automático' },
];

// variant="icon": botão do cabeçalho que alterna escuro/claro. Padrão: seletor completo (Ajustes).
export function ThemeToggle({ variant = 'full' }) {
  const pref = useThemePreference();
  const effective = useResolvedTheme();

  if (variant === 'icon') {
    return (
      <button type="button" className="header-btn header-theme" onClick={() => applyTheme(effective === 'dark' ? 'light' : 'dark')} aria-label={effective === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}>
        {effective === 'dark' ? '☀️' : '🌙'}
      </button>
    );
  }

  return (
    <div className="segmented" role="radiogroup" aria-label="Tema">
      {OPTIONS.map(o => (
        <button key={o.id} type="button" role="radio" aria-checked={pref === o.id} className={pref === o.id ? 'active' : ''} onClick={() => applyTheme(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
