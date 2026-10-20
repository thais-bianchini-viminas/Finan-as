import { CATEGORY_NAMES } from './categories';

// Metas automáticas = custos fixos escolhidos + média do variável, arredondado para cima (múltiplo de 10).
// Sem acesso ao banco: roda tanto no servidor (bot) quanto no navegador (tela de metas).
export function suggestedBudgets(suggestion, selectedFixedKeys) {
  const selected = new Set(selectedFixedKeys);
  const result = {};
  for (const name of CATEGORY_NAMES) {
    const fixed = suggestion.fixedItems.filter(i => i.category === name && selected.has(i.key)).reduce((a, i) => a + i.amount, 0);
    const variable = suggestion.variableAverages[name] || 0;
    const total = fixed + variable;
    result[name] = total > 0 ? Math.ceil(total / 10) * 10 : 0;
  }
  return result;
}

// Por padrão entram os fixos do mês passado ou que se repetiram em 2+ meses (um mês esquecido não tira
// a internet da meta). Os esporádicos (IPVA, anuidade) ficam desmarcados.
export const defaultFixedKeys = (suggestion) => suggestion.fixedItems.filter(i => i.inLastMonth || i.monthsSeen >= 2).map(i => i.key);
