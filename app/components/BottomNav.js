import Link from 'next/link';

const TABS = [
  { id: 'resumo', label: 'Resumo', icon: '📊' },
  { id: 'gastos', label: 'Gastos', icon: '🧾' },
  { id: 'lancar', label: 'Lançar', icon: '+', primary: true },
  { id: 'metas', label: 'Metas', icon: '🎯' },
];

export function BottomNav({ active, hrefFor }) {
  return (
    <nav className="bottom-nav" aria-label="Navegação">
      {TABS.map(tab => (
        <Link
          key={tab.id}
          href={hrefFor({ tab: tab.id })}
          className={`nav-item ${tab.primary ? 'nav-primary' : ''} ${active === tab.id ? 'active' : ''}`}
          aria-current={active === tab.id ? 'page' : undefined}
          prefetch
        >
          <span className="nav-icon" aria-hidden>{tab.icon}</span>
          <span className="nav-label">{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
