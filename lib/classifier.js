import prisma from './prisma';
import { EXPENSE, FIXED, VARIABLE, categoryNamesFor, defaultCategoryFor, descriptionKey, detectKind, keywordMatch } from './categories';

// Classificação em camadas, da mais confiável para a menos:
// 1. Histórico exato: a mesma descrição já foi lançada (e possivelmente corrigida por vocês).
// 2. Palavra-chave: dicionário em lib/categories.js.
// 3. Histórico parcial: compartilha uma palavra relevante com lançamentos anteriores.
// 4. Padrão: "Outros" / "Outras receitas".
// Cada correção feita pelos botões do bot ou pelo app vira histórico, então o bot aprende sozinho.

const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'para', 'pra', 'com', 'sem', 'na', 'no', 'em', 'um', 'uma', 'e', 'o', 'a', 'os', 'as', 'meu', 'minha', 'conta']);
const tokens = (key) => key.split(' ').filter(t => t.length >= 3 && !STOPWORDS.has(t));

async function recentHistory(type) {
  return prisma.transaction.findMany({
    where: { type },
    select: { description: true, category: true, kind: true },
    orderBy: { date: 'desc' },
    take: 600,
  });
}

// Voto ponderado pela recência: correções recentes valem mais que lançamentos antigos.
function vote(rows, field) {
  const scores = new Map();
  rows.forEach((row, index) => scores.set(row[field], (scores.get(row[field]) || 0) + 1 / (1 + index * 0.1)));
  return [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export async function classify(description, type = EXPENSE, history) {
  const key = descriptionKey(description);
  const valid = new Set(categoryNamesFor(type));
  const rows = (history || await recentHistory(type)).filter(r => valid.has(r.category));
  const withKeys = rows.map(r => ({ ...r, key: descriptionKey(r.description) }));

  const exact = withKeys.filter(r => r.key === key);
  if (exact.length) {
    return { category: vote(exact, 'category'), kind: type === EXPENSE ? vote(exact, 'kind') || VARIABLE : VARIABLE, source: 'history' };
  }

  const kind = type === EXPENSE ? detectKind(description) : VARIABLE;
  const keyword = keywordMatch(description, type);
  if (keyword) return { category: keyword.category, kind, source: 'keyword' };

  const words = new Set(tokens(key));
  const partial = words.size ? withKeys.filter(r => tokens(r.key).some(t => words.has(t))) : [];
  if (partial.length) {
    const fixedVotes = partial.filter(r => r.kind === FIXED).length;
    return { category: vote(partial, 'category'), kind: type === EXPENSE && fixedVotes > partial.length / 2 ? FIXED : kind, source: 'similar' };
  }

  return { category: defaultCategoryFor(type), kind, source: 'default' };
}

export const SOURCE_LABEL = {
  history: 'aprendido com lançamentos anteriores',
  keyword: 'pela descrição',
  similar: 'parecido com lançamentos anteriores',
  default: 'não reconheci — toque para escolher',
  manual: 'escolhida por você',
};
