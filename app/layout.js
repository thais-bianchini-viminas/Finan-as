import './globals.css'

export const metadata = {
  title: 'Finance Dashboard',
  description: 'Controle de gastos simplificado pelo Telegram',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
