// Service worker mínimo: torna o app instalável e mostra uma tela amigável sem internet.
// Os dados não são cacheados de propósito — valores financeiros desatualizados confundem mais do que ajudam.

const OFFLINE_HTML = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sem conexão</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1120;color:#e2e8f0;font-family:system-ui,sans-serif;text-align:center;padding:24px}
button{margin-top:16px;padding:12px 20px;border:0;border-radius:12px;background:#22c55e;color:#04140a;font-weight:700;font-size:16px}</style></head>
<body><div><div style="font-size:48px">📡</div><h1 style="font-size:20px">Sem conexão</h1>
<p style="color:#94a3b8">Você ainda pode lançar gastos pelo bot do Telegram — ele envia quando a internet voltar.</p>
<button onclick="location.reload()">Tentar de novo</button></div></body></html>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() => new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
  );
});
