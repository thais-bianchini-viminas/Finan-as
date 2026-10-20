import Link from 'next/link';

const TABS = [
  { id: 'resumo', label: 'Resumo', icon: '📊' },
  { id: 'lancamentos', label: 'Lançamentos', icon: '🧾' },
  { id: 'metas', label: 'Metas', icon: '🎯' },
  { id: 'ajustes', label: 'Ajustes', icon: '⚙️' },
];

export function BottomNav({ active, hrefFor, addHref }) {
  return (
    <>
      {/* Nas telas com botão de salvar fixo (Metas) ou formulário (Lançar), o "+" atrapalharia. */}
      {(active === 'resumo' || active === 'lancamentos') && (
        <Link href={addHref} className="fab" aria-label="Novo lançamento">+</Link>
      )}
      <nav className="bottom-nav" aria-label="Navegação">
        {TABS.map(tab => (
          <Link
            key={tab.id}
            href={hrefFor({ tab: tab.id })}
            className={`nav-item ${active === tab.id ? 'active' : ''}`}
            aria-current={active === tab.id ? 'page' : undefined}
          >
            <span className="nav-icon" aria-hidden>{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
