'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState } from 'react';

const CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Lazer',
  'Saúde',
  'Moradia',
  'Contas/Cartão',
  'Outros'
];

export function DashboardFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const currentMonth = searchParams.get('month') || (new Date().getMonth() + 1).toString();
  const currentYear = searchParams.get('year') || new Date().getFullYear().toString();
  const currentCategory = searchParams.get('category') || 'all';

  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [category, setCategory] = useState(currentCategory);

  const handleFilter = (e) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    
    if (month) params.set('month', month);
    else params.delete('month');
    
    if (year) params.set('year', year);
    else params.delete('year');
    
    if (category && category !== 'all') params.set('category', category);
    else params.delete('category');

    router.push(`${pathname}?${params.toString()}`);
  };

  const handleClear = () => {
    setMonth((new Date().getMonth() + 1).toString());
    setYear(new Date().getFullYear().toString());
    setCategory('all');
    router.push(pathname);
  };

  return (
    <form className="dashboard-filter hide-on-print" onSubmit={handleFilter}>
      <div className="filter-group">
        <label>Mês</label>
        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>
              {new Date(2000, m - 1).toLocaleString('pt-BR', { month: 'long' })}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>Ano</label>
        <select value={year} onChange={(e) => setYear(e.target.value)}>
          {[2024, 2025, 2026, 2027, 2028].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>Categoria</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">Todas as Categorias</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="filter-actions">
        <button type="submit" className="btn-primary">Filtrar</button>
        <button type="button" onClick={handleClear} className="btn-secondary">Limpar</button>
      </div>
    </form>
  );
}
