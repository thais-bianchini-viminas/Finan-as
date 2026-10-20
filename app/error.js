'use client'

// Exibido quando o banco não responde (ex.: Supabase acordando ou rede instável no celular).
export default function Error({ unstable_retry }) {
  return (
    <main className="login-screen">
      <div className="login-card">
        <div style={{ fontSize: '3rem' }} aria-hidden>📡</div>
        <h1>Não deu para carregar</h1>
        <p className="muted">O banco de dados demorou para responder. Isso costuma se resolver em segundos.</p>
        <button type="button" className="btn btn-primary btn-block" onClick={() => unstable_retry()}>
          Tentar de novo
        </button>
      </div>
    </main>
  );
}
