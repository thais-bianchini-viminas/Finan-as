import './globals.css'
import { cookies } from 'next/headers';
import { ServiceWorkerRegister } from './components/ServiceWorkerRegister';
import { THEME_COLORS, THEME_COOKIE, parseTheme } from '../lib/theme';

export const metadata = {
  title: 'Finanças do Casal',
  description: 'Controle de gastos e metas do casal, integrado ao Telegram',
  applicationName: 'Finanças',
  appleWebApp: { capable: true, title: 'Finanças', statusBarStyle: 'black-translucent' },
  icons: { apple: '/pwa-icon/180' },
  formatDetection: { telephone: false },
}

export async function generateViewport() {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return {
    themeColor: theme === 'auto'
      ? [{ media: '(prefers-color-scheme: dark)', color: THEME_COLORS.dark }, { media: '(prefers-color-scheme: light)', color: THEME_COLORS.light }]
      : THEME_COLORS[theme],
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
  };
}

export default async function RootLayout({ children }) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="pt-BR" data-theme={theme}>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
