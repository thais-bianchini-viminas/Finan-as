// Fonte única das categorias: usada pelo bot, pelas server actions e pelos componentes.

export const CATEGORIES = [
  {
    name: 'Alimentação', emoji: '🍽️', color: '#f59e0b',
    aliases: ['alimentacao', 'alim', 'comida'],
    keywords: ['almoco', 'janta', 'jantar', 'cafe', 'mercado', 'supermercado', 'ifood', 'comida', 'lanche', 'pizza', 'padaria', 'restaurante', 'acougue', 'hortifruti', 'feira', 'sorvete', 'hamburguer', 'sushi', 'rappi', 'delivery', 'marmita'],
  },
  {
    name: 'Transporte', emoji: '🚗', color: '#3b82f6',
    aliases: ['transp', 'carro'],
    keywords: ['uber', 'gasolina', 'combustivel', 'etanol', 'onibus', 'metro', 'trem', 'estacionamento', 'pedagio', 'taxi', '99pop', '99taxi', 'oficina', 'mecanico', 'ipva', 'seguro carro', 'lavagem', 'passagem'],
  },
  {
    name: 'Lazer', emoji: '🎉', color: '#ec4899',
    aliases: ['diversao'],
    keywords: ['cinema', 'festa', 'show', 'bar', 'boteco', 'cerveja', 'passeio', 'viagem', 'hotel', 'netflix', 'spotify', 'disney', 'prime', 'hbo', 'jogo', 'ingresso', 'teatro', 'parque'],
  },
  {
    name: 'Saúde', emoji: '💊', color: '#10b981',
    aliases: ['saude'],
    keywords: ['farmacia', 'remedio', 'medico', 'consulta', 'exame', 'terapia', 'psicologo', 'dentista', 'academia', 'plano de saude', 'hospital', 'vacina', 'drogaria'],
  },
  {
    name: 'Moradia', emoji: '🏠', color: '#8b5cf6',
    aliases: ['casa'],
    keywords: ['luz', 'agua', 'internet', 'aluguel', 'condominio', 'energia', 'gas', 'iptu', 'faxina', 'diarista', 'reforma', 'moveis', 'limpeza'],
  },
  {
    name: 'Contas/Cartão', emoji: '💳', color: '#ef4444',
    aliases: ['contas', 'conta', 'cartao', 'contas/cartao', 'fatura'],
    keywords: ['cartao', 'fatura', 'boleto', 'conta', 'imposto', 'tarifa', 'anuidade', 'juros', 'emprestimo', 'parcela', 'celular', 'telefone'],
  },
  {
    name: 'Outros', emoji: '📦', color: '#64748b',
    aliases: ['outro', 'outras'],
    keywords: [],
    // Sem palavras-chave: é o destino padrão quando nada casa.
  },
];

export const CATEGORY_NAMES = CATEGORIES.map(c => c.name);
export const DEFAULT_CATEGORY = 'Outros';

const byName = Object.fromEntries(CATEGORIES.map(c => [c.name, c]));
export const categoryInfo = (name) => byName[name] || byName[DEFAULT_CATEGORY];

export function normalize(text) {
  return String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Palavra inteira (aceita plural): "bar" casa com "bares", mas não com "barbearia".
const keywordMatchers = CATEGORIES.map(c => ({
  name: c.name,
  regex: c.keywords.length
    ? new RegExp(`(^|[^a-z0-9])(${c.keywords.map(escapeRegex).join('|')})(s|es)?(?=[^a-z0-9]|$)`)
    : null,
}));

export function categorize(description) {
  const desc = normalize(description);
  const match = keywordMatchers.find(m => m.regex && m.regex.test(desc));
  return match ? match.name : DEFAULT_CATEGORY;
}

// Resolve o que a pessoa digitou ("alim", "saude", "Contas/Cartão") para o nome oficial.
export function resolveCategory(input) {
  const value = normalize(input).replace(/^#/, '');
  if (!value) return null;
  const exact = CATEGORIES.find(c => normalize(c.name) === value || c.aliases.includes(value));
  if (exact) return exact.name;
  if (value.length >= 3) {
    const prefix = CATEGORIES.filter(c => normalize(c.name).startsWith(value));
    if (prefix.length === 1) return prefix[0].name;
  }
  return null;
}
