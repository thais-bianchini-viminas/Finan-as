import Link from 'next/link';
import { formatBRL } from '../../lib/format';
import { ThemeToggle } from './ThemeToggle';

// Cabeçalho no estilo dos apps de controle financeiro: saldo em destaque e alternância Despesas/Receitas.
export function AppHeader({ title, nav, summary, segment }) {
  const { balance, income, spent } = summary;
  return (
    <header className="app-header">
      <div className="header-top">
        {nav ? (
          <>
            <ThemeToggle variant="icon" />
            <Link href={nav.prev} className="header-btn" aria-label="Mês anterior">‹</Link>
            <span className="header-month">{title}</span>
            <Link href={nav.next} className="header-btn" aria-label="Próximo mês">›</Link>
            {nav.today && <Link href={nav.today} className="header-chip">Hoje</Link>}
            {/* No topo, o "+" não cobre valores da lista (antes ficava flutuando sobre o conteúdo). */}
            {nav.add && <Link href={nav.add} className="header-add" aria-label="Novo lançamento">+</Link>}
          </>
        ) : (
          <span className="header-month">{title}</span>
        )}
      </div>

      {/* Sem receitas lançadas, o "saldo" seria só o gasto com sinal negativo; mostra as despesas. */}
      <div className="header-balance">
        <span className="header-label">{income > 0 ? 'Saldo do mês' : 'Despesas do mês'}</span>
        <span className="header-value">{formatBRL(income > 0 ? balance : spent)}</span>
        <span className="header-sub">
          {income > 0 ? (
            <>
              <span>↑ Receitas {formatBRL(income)}</span>
              <span>↓ Despesas {formatBRL(spent)}</span>
            </>
          ) : (
            <span>Lance as receitas para ver o saldo</span>
          )}
        </span>
      </div>

      {segment && (
        <nav className="header-tabs" aria-label="Tipo">
          {segment.items.map(item => (
            <Link key={item.id} href={item.href} className={`header-tab ${segment.active === item.id ? 'active' : ''}`} aria-current={segment.active === item.id ? 'page' : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
