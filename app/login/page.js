import { LoginForm } from './LoginForm';

export const metadata = { title: 'Entrar · Finanças' };

export default async function LoginPage({ searchParams }) {
  const { next } = await searchParams;
  return (
    <main className="login-screen">
      <div className="login-card">
        <div className="login-logo">R$</div>
        <h1>Finanças do Casal</h1>
        <p className="muted">Digite a senha para continuar.</p>
        <LoginForm next={next || '/'} />
      </div>
    </main>
  );
}
