import './globals.css'
import { ServiceWorkerRegister } from './components/ServiceWorkerRegister';

export const metadata = {
  title: 'Finanças do Casal',
  description: 'Controle de gastos e metas do casal, integrado ao Telegram',
  applicationName: 'Finanças',
  appleWebApp: { capable: true, title: 'Finanças', statusBarStyle: 'default' },
  icons: { apple: '/pwa-icon/180' },
  formatDetection: { telephone: false },
}

export const viewport = {
  themeColor: '#1f9d63',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
