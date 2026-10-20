import Link from 'next/link';
import { categoryInfo } from '../../lib/categories';
import { formatBRL } from '../../lib/format';

function tone(pct, hasBudget) {
  if (!hasBudget) return 'neutral';
  if (pct > 100) return 'danger';
  if (pct >= 80) return 'warning';
  return 'success';
}

// Barra de progresso com a meta como referência (inspirada no "bullet graph" de Stephen Few).
export function CategoryProgress({ categories, hrefFor }) {
  const visible = categories.filter(c => c.spent > 0 || c.budget > 0);
  if (!visible.length) return <p className="muted empty">Nenhum gasto ou meta neste mês ainda.</p>;

  return (
    <ul className="progress-list">
      {visible
        .sort((a, b) => (b.budget > 0) - (a.budget > 0) || b.pct - a.pct || b.spent - a.spent)
        .map(c => {
          const info = categoryInfo(c.name);
          const t = tone(c.pct, c.budget > 0);
          const content = (
            <>
              <div className="progress-head">
                <span className="cat-dot" style={{ background: `${info.color}22` }} aria-hidden>{info.emoji}</span>
                <span className="progress-name">{c.name}</span>
                <span className="progress-values">
                  <strong>{formatBRL(c.spent)}</strong>
                  {c.budget > 0 ? <span className="muted"> / {formatBRL(c.budget)}</span> : <span className="muted"> · sem meta</span>}
                </span>
              </div>
              <div className={`bar bar-${t}`}>
                <div className="bar-fill" style={{ width: `${Math.min(c.budget > 0 ? c.pct : 100, 100)}%` }} />
              </div>
              {c.budget > 0 && (
                <div className={`progress-foot text-${t}`}>
                  {c.pct > 100
                    ? `Passou ${formatBRL(c.spent - c.budget)} da meta`
                    : `${c.pct.toFixed(0)}% usado · restam ${formatBRL(c.budget - c.spent)}`}
                </div>
              )}
            </>
          );
          return (
            <li key={c.name}>
              {hrefFor ? <Link href={hrefFor({ tab: 'lancamentos', tipo: 'despesa', category: c.name })} className="progress-item">{content}</Link> : <div className="progress-item">{content}</div>}
            </li>
          );
        })}
    </ul>
  );
}
