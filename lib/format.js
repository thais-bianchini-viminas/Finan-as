// Datas e valores no fuso de Brasília. O servidor (Vercel) roda em UTC; sem isso,
// gastos lançados após as 21h caíam no dia (ou mês) seguinte.
// O Brasil não tem horário de verão desde 2019 (Decreto 9.772/2019), então o offset é fixo.

export const TIME_ZONE = 'America/Sao_Paulo';
const OFFSET_MS = 3 * 60 * 60 * 1000;

export function localParts(date = new Date()) {
  const shifted = new Date(date.getTime() - OFFSET_MS);
  return {
    day: shifted.getUTCDate(),
    month: shifted.getUTCMonth() + 1,
    year: shifted.getUTCFullYear(),
  };
}

// Intervalo [start, end) do mês no horário de Brasília.
export function monthRange(month, year) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1) + OFFSET_MS),
    end: new Date(Date.UTC(year, month, 1) + OFFSET_MS),
  };
}

export const daysInMonth = (month, year) => new Date(Date.UTC(year, month, 0)).getUTCDate();

export function shiftMonth(month, year, delta) {
  const index = year * 12 + (month - 1) + delta;
  return { month: (index % 12) + 1, year: Math.floor(index / 12) };
}

export function todayISO() {
  const { day, month, year } = localParts();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// "2026-10-20" -> meio-dia em Brasília, longe de qualquer virada de dia.
export const dateFromISO = (iso) => new Date(`${iso}T12:00:00-03:00`);

export function toISODate(date) {
  const { day, month, year } = localParts(new Date(date));
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatDate(date, options = { day: '2-digit', month: '2-digit' }) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, ...options }).format(new Date(date));
}

export function monthLabel(month, year, style = 'long') {
  const label = new Intl.DateTimeFormat('pt-BR', { month: style, timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
  return style === 'long' ? `${label[0].toUpperCase()}${label.slice(1)} ${year}` : `${label.replace('.', '')}/${String(year).slice(2)}`;
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatBRL = (value) => brl.format(value || 0);

// Aceita "35", "35,50", "35.50", "1.234,56", "1,234.56", "2.800", "R$ 40".
// Um separador seguido de exatamente 3 dígitos é tratado como milhar.
export function parseAmount(input) {
  if (input === null || input === undefined) return NaN;
  const s = String(input).replace(/r\$|\s/gi, '');
  if (!/^\d[\d.,]*$/.test(s)) return NaN;

  const lastSep = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  let normalized;
  if (lastSep === -1) {
    normalized = s;
  } else if (s.length - lastSep - 1 === 3) {
    normalized = s.replace(/[.,]/g, '');
  } else {
    normalized = s.slice(0, lastSep).replace(/[.,]/g, '') + '.' + s.slice(lastSep + 1);
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : NaN;
}

export const percent = (part, total) => (total > 0 ? (part / total) * 100 : 0);
