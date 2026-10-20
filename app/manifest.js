export default function manifest() {
  return {
    name: 'Finanças do Casal',
    short_name: 'Finanças',
    description: 'Gastos e metas do casal, integrados ao bot do Telegram',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f2f5f3',
    theme_color: '#1f9d63',
    lang: 'pt-BR',
    icons: [
      { src: '/pwa-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512?maskable=1', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Atalhos ao pressionar o ícone (Android).
    shortcuts: [
      { name: 'Lançar despesa', short_name: 'Despesa', url: '/?tab=lancar', icons: [{ src: '/pwa-icon/192', sizes: '192x192' }] },
      { name: 'Lançar receita', short_name: 'Receita', url: '/?tab=lancar&tipo=receita', icons: [{ src: '/pwa-icon/192', sizes: '192x192' }] },
      { name: 'Metas do mês', short_name: 'Metas', url: '/?tab=metas', icons: [{ src: '/pwa-icon/192', sizes: '192x192' }] },
    ],
  };
}
