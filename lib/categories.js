// Fonte única das categorias: usada pelo bot, pelas server actions e pelos componentes.
// Palavras-chave já normalizadas (minúsculas, sem acento). O vencedor é a categoria cuja
// palavra-chave casada é a mais longa (mais específica): "recarga cartao de passagem" → Transporte.

export const EXPENSE = 'despesa';
export const INCOME = 'receita';
export const FIXED = 'fixo';
export const VARIABLE = 'variavel';

export const CATEGORIES = [
  {
    name: 'Alimentação', emoji: '🍽️', color: '#f59e0b',
    aliases: ['alimentacao', 'alim', 'comida'],
    keywords: ['almoco', 'janta', 'jantar', 'cafe', 'mercado', 'supermercado', 'ifood', 'comida', 'lanche', 'pizza', 'padaria', 'restaurante', 'acougue', 'hortifruti', 'feira', 'sorvete', 'hamburguer', 'sushi', 'rappi', 'delivery', 'marmita', 'salgado', 'bolo', 'biscoito', 'bebida', 'queijaria', 'pacoca', 'assai', 'atacadao', 'carrefour', 'pao de acucar', 'quitanda', 'sacolao', 'doces', 'chocolate', 'acai', 'refrigerante', 'cerveja de casa'],
  },
  {
    name: 'Transporte', emoji: '🚗', color: '#3b82f6',
    aliases: ['transp', 'carro'],
    keywords: ['uber', 'gasolina', 'combustivel', 'etanol', 'abastecimento', 'onibus', 'metro', 'trem', 'estacionamento', 'pedagio', 'taxi', '99pop', '99taxi', 'oficina', 'mecanico', 'ipva', 'licenciamento', 'seguro do carro', 'seguro carro', 'lavagem', 'lava jato', 'passagem', 'cartao de passagem', 'shell', 'ipiranga', 'pneu', 'troca de oleo', 'multa', 'financiamento do carro', 'emprestimo carro'],
  },
  {
    name: 'Moradia', emoji: '🏠', color: '#8b5cf6',
    aliases: ['casa'],
    keywords: ['luz', 'energia', 'conta de luz', 'agua', 'conta de agua', 'internet', 'aluguel', 'condominio', 'gas', 'iptu', 'faxina', 'diarista', 'reforma', 'moveis', 'limpeza', 'financiamento', 'material de construcao', 'material construcao', 'eletricista', 'encanador', 'pedreiro', 'melhorias de casa', 'coisinhas para o lar', 'lampada', 'pregos', 'tv', 'sabesp', 'cemig', 'enel', 'copasa', 'light', 'jardim', 'humos', 'npk', 'adubo', 'veneno', 'utensilios'],
  },
  {
    name: 'Contas/Cartão', emoji: '💳', color: '#ef4444',
    aliases: ['contas', 'conta', 'cartao', 'contas/cartao', 'fatura'],
    keywords: ['cartao', 'fatura', 'boleto', 'conta', 'imposto', 'tarifa', 'anuidade', 'juros', 'emprestimo', 'parcela', 'telefone', 'tim', 'conta tim', 'vivo', 'claro', 'oi', 'plano celular', 'cartao inter', 'cartao bb', 'nubank', 'banco do brasil', 'iof', 'anuidade cartao', 'seguro cartao'],
  },
  {
    name: 'Saúde', emoji: '💊', color: '#10b981',
    aliases: ['saude'],
    keywords: ['farmacia', 'remedio', 'medico', 'consulta', 'exame', 'terapia', 'psicologo', 'dentista', 'academia', 'plano de saude', 'hospital', 'vacina', 'drogaria', 'drogasil', 'raia', 'pague menos', 'fisioterapia', 'nutricionista', 'wellhub', 'gympass', 'totalpass', 'smartfit', 'smart fit'],
  },
  {
    name: 'Cuidados pessoais', emoji: '💈', color: '#14b8a6',
    aliases: ['cuidados', 'pessoal', 'beleza'],
    keywords: ['barbeiro', 'barbearia', 'cabelo', 'cabeleireiro', 'salao', 'manicure', 'unha', 'sobrancelha', 'depilacao', 'shampoo', 'shampoo barba', 'oleo barba', 'escova de cabelo', 'kit escova de cabelo', 'perfume', 'maquiagem', 'cosmetico', 'creme'],
  },
  {
    name: 'Lazer', emoji: '🎉', color: '#ec4899',
    aliases: ['diversao'],
    keywords: ['cinema', 'festa', 'show', 'bar', 'boteco', 'cerveja', 'passeio', 'viagem', 'hotel', 'netflix', 'spotify', 'disney', 'prime video', 'hbo', 'hbo max', 'globoplay', 'jogo', 'ingresso', 'teatro', 'parque', 'cartola', 'cartola pro', 'liga cartola', 'bolao', 'bolao da caixa', 'loteria', 'mega sena', 'aposta'],
  },
  {
    name: 'Compras', emoji: '🛍️', color: '#f97316',
    aliases: ['compra', 'shopping'],
    keywords: ['shopee', 'shoppe', 'shopping', 'mercado livre', 'mercadolivre', 'mercadopago', 'amazon', 'amazon marketplace', 'pag shopee', 'shein', 'magalu', 'aliexpress', 'roupa', 'roupas', 'camisa', 'camisas', 'camiseta', 'calca', 'sapato', 'tenis', 'pijama', 'pijamas', 'presente', 'presentes', 'aniversario', 'niver', 'celular novo', 'celular', 'fone', 'eletronico', 'colchao', 'frigideira', 'panela'],
  },
  {
    name: 'Pets', emoji: '🐾', color: '#a16207',
    aliases: ['pet', 'animais'],
    keywords: ['racao', 'veterinario', 'petshop', 'pet shop', 'banho e tosa', 'areia do gato', 'vacina do cachorro'],
  },
  {
    name: 'Outros', emoji: '📦', color: '#64748b',
    aliases: ['outro', 'outras'],
    keywords: [],
  },
];

export const INCOME_CATEGORIES = [
  { name: 'Salário', emoji: '💼', color: '#16a34a', aliases: ['salario', 'pagamento'], keywords: ['salario', 'pagamento', 'ordenado', 'holerite', 'adiantamento', '13o', 'decimo terceiro', 'ferias', 'plr', 'bonus'] },
  { name: 'Renda extra', emoji: '💡', color: '#0ea5e9', aliases: ['extra', 'freela'], keywords: ['freela', 'freelance', 'extra', 'bico', 'venda', 'vendi', 'servico', 'consultoria', 'comissao', 'aula'] },
  { name: 'Rendimentos', emoji: '📈', color: '#8b5cf6', aliases: ['rendimento', 'investimento'], keywords: ['rendimento', 'rendimentos', 'juros recebidos', 'dividendos', 'cdb', 'poupanca', 'tesouro', 'resgate', 'cashback'] },
  { name: 'Reembolso', emoji: '↩️', color: '#f59e0b', aliases: ['reembolso', 'devolucao'], keywords: ['reembolso', 'devolucao', 'estorno', 'me pagou', 'pagou de volta', 'restituicao'] },
  { name: 'Outras receitas', emoji: '💰', color: '#64748b', aliases: ['outras', 'outra'], keywords: [] },
];

// Custos fixos: obrigações que se repetem todo mês (contratos, contas de consumo, parcelas).
// Gastos variáveis: consumo do dia a dia. É a divisão usada nos métodos 50/30/20 e afins.
const FIXED_KEYWORDS = ['aluguel', 'condominio', 'financiamento', 'emprestimo', 'parcela', 'prestacao', 'internet', 'energia', 'luz', 'conta de luz', 'agua', 'conta de agua', 'gas encanado', 'iptu', 'ipva', 'seguro', 'plano de saude', 'plano', 'mensalidade', 'escola', 'faculdade', 'curso', 'academia', 'assinatura', 'netflix', 'spotify', 'disney', 'prime video', 'hbo', 'globoplay', 'telefone', 'tim', 'vivo', 'claro', 'oi', 'conta tim', 'fatura', 'conta do cartao', 'cartao inter', 'cartao bb', 'cartao banco do brasil', 'nubank', 'diarista', 'faxina mensal', 'sabesp', 'cemig', 'enel', 'copasa'];

const INCOME_PREFIXES = ['recebi', 'recebido', 'receita', 'entrada', 'ganhei', 'renda'];

export const DEFAULT_CATEGORY = 'Outros';
export const DEFAULT_INCOME_CATEGORY = 'Outras receitas';

export const categoriesFor = (type) => (type === INCOME ? INCOME_CATEGORIES : CATEGORIES);
export const categoryNamesFor = (type) => categoriesFor(type).map(c => c.name);
export const CATEGORY_NAMES = CATEGORIES.map(c => c.name);
export const INCOME_CATEGORY_NAMES = INCOME_CATEGORIES.map(c => c.name);
export const defaultCategoryFor = (type) => (type === INCOME ? DEFAULT_INCOME_CATEGORY : DEFAULT_CATEGORY);

const byName = Object.fromEntries([...CATEGORIES, ...INCOME_CATEGORIES].map(c => [c.name, c]));
export const categoryInfo = (name) => byName[name] || byName[DEFAULT_CATEGORY];

export function normalize(text) {
  return String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Texto comparável: sem acento, pontuação ou números ("Conta TIM: 52" → "conta tim").
export function descriptionKey(text) {
  return normalize(text).replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Chave para agrupar o mesmo custo fixo escrito de formas diferentes:
// "Conta Tim" = "Tim", "Conta de água" = "Água", "Conta do cartão BB" = "Cartão BB".
const GROUP_STOPWORDS = new Set(['conta', 'de', 'da', 'do', 'das', 'dos', 'e', 'o', 'a', 'pagamento', 'fatura', 'mensal', 'mensalidade']);
export function fixedGroupKey(text) {
  const words = descriptionKey(text).split(' ').filter(w => w && !GROUP_STOPWORDS.has(w));
  return words.join(' ') || descriptionKey(text);
}

const escapeRegex =(s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Palavra inteira (aceita plural): "bar" casa com "bares", mas não com "barbearia".
const wordRegex = (kw) => new RegExp(`(^|[^a-z0-9])${escapeRegex(kw)}(s|es)?(?=[^a-z0-9]|$)`);

const compile = (list) => list.map(c => ({ name: c.name, matchers: c.keywords.map(kw => ({ kw, regex: wordRegex(kw) })) }));
const expenseMatchers = compile(CATEGORIES);
const incomeMatchers = compile(INCOME_CATEGORIES);
const fixedMatchers = FIXED_KEYWORDS.map(wordRegex);

// Retorna { category, keyword } da palavra-chave mais específica, ou null.
export function keywordMatch(description, type = EXPENSE) {
  const desc = normalize(description);
  let best = null;
  for (const c of type === INCOME ? incomeMatchers : expenseMatchers) {
    for (const m of c.matchers) {
      if (m.regex.test(desc) && (!best || m.kw.length > best.keyword.length)) best = { category: c.name, keyword: m.kw };
    }
  }
  return best;
}

export function categorize(description, type = EXPENSE) {
  return keywordMatch(description, type)?.category || defaultCategoryFor(type);
}

export function detectKind(description) {
  const desc = normalize(description);
  return fixedMatchers.some(rx => rx.test(desc)) ? FIXED : VARIABLE;
}

// Decide se uma linha do Telegram é receita: "+5000 salário", "recebi 800 freela", "salário 5000".
export function detectType(text) {
  const trimmed = String(text).trim();
  if (trimmed.startsWith('+')) return { type: INCOME, text: trimmed.slice(1).trim() };
  const [first, ...rest] = trimmed.split(/\s+/);
  if (INCOME_PREFIXES.includes(normalize(first))) return { type: INCOME, text: rest.join(' ') };
  const incomeHit = keywordMatch(trimmed, INCOME);
  // Só palavras inequívocas de renda; "venda" ou "extra" sozinhos não bastam sem um prefixo.
  if (incomeHit && ['Salário', 'Rendimentos', 'Reembolso'].includes(incomeHit.category) && !keywordMatch(trimmed, EXPENSE)) {
    return { type: INCOME, text: trimmed };
  }
  return { type: EXPENSE, text: trimmed };
}

// Resolve o que a pessoa digitou ("alim", "saude", "Contas/Cartão") para o nome oficial.
export function resolveCategory(input, type = EXPENSE) {
  const value = normalize(input).replace(/^#/, '');
  if (!value) return null;
  const list = categoriesFor(type);
  const exact = list.find(c => normalize(c.name) === value || c.aliases.includes(value));
  if (exact) return exact.name;
  if (value.length >= 3) {
    const prefix = list.filter(c => normalize(c.name).startsWith(value));
    if (prefix.length === 1) return prefix[0].name;
  }
  return null;
}
