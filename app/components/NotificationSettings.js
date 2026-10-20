'use client';

import { useEffect, useState, useSyncExternalStore, useTransition } from 'react';
import { subscribePush, unsubscribePush } from '../actions';
import { Toast } from './Toast';

const NAME_KEY = 'fin:sender';
const noopSubscribe = () => () => {};

function detectSupport() {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (ios && !standalone) return 'ios-browser';
  return supported ? 'ok' : 'unsupported';
}

function base64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration('/')) || navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
}

export function NotificationSettings({ people, publicKey }) {
  const support = useSyncExternalStore(noopSubscribe, detectSupport, () => 'loading');
  const savedName = useSyncExternalStore(noopSubscribe, () => { try { return localStorage.getItem(NAME_KEY); } catch { return null; } }, () => null);
  const [chosenName, setName] = useState(null);
  const name = chosenName ?? savedName ?? '';
  const [subscription, setSubscription] = useState(undefined);
  const [toast, setToast] = useState(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (support !== 'ok') return;
    registration().then(reg => reg.pushManager.getSubscription()).then(sub => setSubscription(sub)).catch(() => setSubscription(null));
  }, [support]);

  function enable() {
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setToast({ ok: false, message: 'Permissão negada. Libere as notificações nas configurações do navegador.' });
          return;
        }
        const reg = await registration();
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8Array(publicKey) });
        const result = await subscribePush(JSON.parse(JSON.stringify(sub)), name);
        try { localStorage.setItem(NAME_KEY, name); } catch {}
        setSubscription(sub);
        setToast(result);
      } catch (error) {
        setToast({ ok: false, message: `Não foi possível ativar: ${error.message}` });
      }
    });
  }

  function disable() {
    startTransition(async () => {
      const endpoint = subscription?.endpoint;
      await subscription?.unsubscribe();
      setSubscription(null);
      setToast(await unsubscribePush(endpoint));
    });
  }

  if (!publicKey) return <p className="muted small">Notificações ainda não configuradas no servidor.</p>;
  if (support === 'loading') return null;
  if (support === 'ios-browser') {
    return <p className="muted small">No iPhone, as notificações só funcionam com o app instalado: Safari → Compartilhar ⬆️ → <b>Adicionar à Tela de Início</b>. Depois abra pelo ícone e volte aqui.</p>;
  }
  if (support === 'unsupported') return <p className="muted small">Este navegador não suporta notificações.</p>;

  return (
    <div className="stack">
      {subscription ? (
        <>
          <p className="small">✅ Ativadas neste aparelho. Você recebe um aviso quando a outra pessoa lançar algo, e quando uma meta passar de 80% ou de 100%.</p>
          <button type="button" className="btn btn-ghost" onClick={disable} disabled={pending}>Desativar neste aparelho</button>
        </>
      ) : (
        <>
          <div className="field">
            <span className="field-label">Quem usa este aparelho?</span>
            <div className="chips">
              {people.map(p => (
                <button type="button" key={p} className={`chip ${name === p ? 'chip-active' : ''}`} onClick={() => setName(p)}>{p}</button>
              ))}
            </div>
          </div>
          <button type="button" className="btn btn-primary" onClick={enable} disabled={pending || !name || subscription === undefined}>
            🔔 Ativar notificações
          </button>
        </>
      )}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </div>
  );
}
