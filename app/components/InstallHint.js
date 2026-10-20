'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

const DISMISS_KEY = 'fin:install-dismissed';
const noopSubscribe = () => () => {};

function detectEnvironment() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (standalone) return 'installed';
  let dismissed = false;
  try { dismissed = localStorage.getItem(DISMISS_KEY) === '1'; } catch {}
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return `${ios ? 'ios' : 'other'}${dismissed ? ':dismissed' : ''}`;
}

// Android/Chrome expõe "beforeinstallprompt"; no iPhone a instalação é manual pelo Safari.
// https://web.dev/articles/customize-install
// always: versão da aba Ajustes, que aparece mesmo depois de dispensada.
export function InstallHint({ always = false }) {
  const environment = useSyncExternalStore(noopSubscribe, detectEnvironment, () => 'server');
  const [promptEvent, setPromptEvent] = useState(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault();
      setPromptEvent(event);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (environment === 'server') return null;
  if (environment === 'installed') {
    return always ? <section className="card"><p className="small">📱 App instalado neste aparelho ✓</p></section> : null;
  }
  const [platform, dismissed] = environment.split(':');
  if (!always && (hidden || dismissed)) return null;
  const mode = promptEvent ? 'android' : platform === 'ios' ? 'ios' : always ? 'manual' : null;
  if (!mode) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
    setHidden(true);
  };

  const install = async () => {
    promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice?.outcome === 'accepted') setHidden(true);
  };

  return (
    <div className="install-hint card">
      <div className="install-icon" aria-hidden>📱</div>
      <div className="install-text">
        <strong>Instale o app no celular</strong>
        {mode === 'ios' && <span className="muted small">No Safari, toque em <b>Compartilhar</b> ⬆️ e depois em <b>Adicionar à Tela de Início</b>.</span>}
        {mode === 'android' && <span className="muted small">Abre direto, sem barra do navegador, e recebe notificações.</span>}
        {mode === 'manual' && <span className="muted small">No Chrome do Android: menu ⋮ → <b>Instalar app</b>.</span>}
      </div>
      {mode === 'android' && <button type="button" className="btn btn-primary btn-sm" onClick={install}>Instalar</button>}
      {!always && <button type="button" className="icon-btn" onClick={dismiss} aria-label="Dispensar">✕</button>}
    </div>
  );
}
