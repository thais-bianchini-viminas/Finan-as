// Service worker: torna o app instalável, mostra uma tela amigável sem internet e exibe as notificações.
// Os dados não são cacheados de propósito — valores financeiros desatualizados confundem mais do que ajudam.

const OFFLINE_HTML = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sem conexão</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f6f4;color:#17211c;font-family:system-ui,sans-serif;text-align:center;padding:24px}
button{margin-top:16px;padding:12px 20px;border:0;border-radius:12px;background:#1f9d63;color:#fff;font-weight:700;font-size:16px}</style></head>
<body><div><div style="font-size:48px">📡</div><h1 style="font-size:20px">Sem conexão</h1>
<p style="color:#5f6f67">Você ainda pode lançar pelo bot do Telegram — ele envia quando a internet voltar.</p>
<button onclick="location.reload()">Tentar de novo</button></div></body></html>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() => new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/pwa-icon/192',
    badge: '/pwa-icon/192',
    tag: data.tag,
    vibrate: [80, 40, 80],
    data: { url: data.url || '/' },
  }));
});

// Toque na notificação: foca o app se já estiver aberto, senão abre.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(w => w.url.startsWith(self.location.origin));
    if (existing) {
      await existing.focus();
      return existing.navigate(url);
    }
    return self.clients.openWindow(url);
  })());
});
