'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

const DISMISS_KEY = 'fin:install-dismissed';
const noopSubscribe = () => () => {};

function detectEnvironment() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  let dismissed = false;
  try { dismissed = localStorage.getItem(DISMISS_KEY) === '1'; } catch {}
  if (standalone || dismissed) return 'hide';
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ? 'ios' : 'other';
}

// Android/Chrome expõe "beforeinstallprompt"; no iPhone a instalação é manual pelo Safari.
// https://web.dev/articles/customize-install
export function InstallHint() {
  const environment = useSyncExternalStore(noopSubscribe, detectEnvironment, () => 'hide');
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

  const mode = hidden || environment === 'hide' ? null : promptEvent ? 'android' : environment === 'ios' ? 'ios' : null;
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
        {mode === 'ios'
          ? <span className="muted small">No Safari, toque em <b>Compartilhar</b> ⬆️ e depois em <b>Adicionar à Tela de Início</b>.</span>
          : <span className="muted small">Abre direto no lançamento, sem barra do navegador.</span>}
      </div>
      {mode === 'android' && <button type="button" className="btn btn-primary" onClick={install}>Instalar</button>}
      <button type="button" className="icon-btn" onClick={dismiss} aria-label="Dispensar">✕</button>
    </div>
  );
}
