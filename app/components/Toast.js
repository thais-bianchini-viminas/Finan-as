'use client';

import { useEffect, useEffectEvent } from 'react';

export function Toast({ toast, onDone, duration = 2800 }) {
  const done = useEffectEvent(onDone);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(done, duration);
    return () => clearTimeout(timer);
  }, [toast, duration]);

  if (!toast) return null;
  return (
    <div className={`toast ${toast.ok ? 'toast-ok' : 'toast-error'}`} role="status">
      {toast.ok ? '✓ ' : '⚠️ '}{toast.message}
    </div>
  );
}
