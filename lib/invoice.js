import { getDocumentProxy } from 'unpdf';
import { normalize } from './categories';

// Leitura de faturas de cartão em OFX, CSV ou PDF. Cada item vira { date, description, amount },
// com amount > 0 para compras e < 0 para estornos/créditos. Pagamentos da fatura anterior são ignorados.

export class InvoiceError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const IGNORE = /pagamento|pgto|saldo anterior|total d|limite|encargos rotativ|juros do rotativ|credito de pagamento|pagto/;

// "1.234,56", "-150.00", "R$ 1.234,56-", "(150,00)" → número com sinal.
function parseSigned(raw) {
  if (raw === undefined || raw === null) return NaN;
  let s = String(raw).trim().replace(/r\$|\s/gi, '');
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (s.startsWith('-')) { negative = true; s = s.slice(1); }
  if (s.endsWith('-')) { negative = true; s = s.slice(0, -1); }
  if (s.startsWith('+')) s = s.slice(1);
  if (!/^\d[\d.,]*$/.test(s)) return NaN;
  // O último separador seguido de 3 dígitos é milhar; senão, é decimal.
  const lastSep = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  let value;
  if (lastSep === -1) {
    value = Number(s);
  } else {
    const decimals = s.slice(lastSep + 1);
    const integer = s.slice(0, lastSep).replace(/[.,]/g, '');
    value = decimals.length === 3 ? Number(integer + decimals) : Number(`${integer}.${decimals}`);
  }
  return Number.isFinite(value) ? (negative ? -value : value) : NaN;
}

const cleanDescription = (text) => String(text).replace(/\s+/g, ' ').replace(/^[\s*\-–]+|[\s*\-–]+$/g, '').trim();

function finalize(items, format) {
  const valid = items
    .map(i => ({ ...i, description: cleanDescription(i.description), amount: Math.round(i.amount * 100) / 100 }))
    .filter(i => i.description && Number.isFinite(i.amount) && i.amount !== 0 && !IGNORE.test(normalize(i.description)));
  if (!valid.length) throw new InvoiceError('empty', 'Não encontrei lançamentos na fatura.');
  const total = Math.round(valid.reduce((acc, i) => acc + i.amount, 0) * 100) / 100;
  return { format, items: valid, total };
}

// ---------- OFX (padrão bancário; o mais confiável) ----------
function parseOfx(text) {
  const items = [];
  for (const block of text.split(/<STMTTRN>/i).slice(1)) {
    const field = (name) => block.match(new RegExp(`<${name}>([^<\\r\\n]+)`, 'i'))?.[1]?.trim();
    const amount = parseSigned(field('TRNAMT'));
    const date = field('DTPOSTED')?.slice(0, 8);
    // No cartão, compra vem negativa (débito); invertemos para "valor gasto".
    items.push({
      date: date ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` : null,
      description: field('MEMO') || field('NAME') || 'Lançamento',
      amount: -amount,
    });
  }
  return finalize(items, 'OFX');
}

// ---------- CSV (Nubank: date,title,amount · Inter: Data;Lançamento;...;Valor) ----------
function splitCsvLine(line, sep) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === sep && !quoted) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(c => c.trim());
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new InvoiceError('empty', 'CSV vazio.');
  const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const header = splitCsvLine(lines[0], sep).map(h => normalize(h));
  const find = (...names) => header.findIndex(h => names.some(n => h.includes(n)));
  const dateCol = find('data', 'date');
  const descCol = find('descri', 'titulo', 'title', 'lancamento', 'estabelecimento', 'historico');
  const amountCol = find('valor', 'amount', 'quantia');
  if (descCol < 0 || amountCol < 0) throw new InvoiceError('format', 'Não reconheci as colunas do CSV (preciso de descrição e valor).');

  const rows = lines.slice(1).map(l => splitCsvLine(l, sep));
  const amounts = rows.map(r => parseSigned(r[amountCol]));
  // Nubank exporta compras positivas; alguns bancos exportam compras negativas. Usa o sinal da maioria.
  const negatives = amounts.filter(a => a < 0).length;
  const flip = negatives > amounts.length / 2 ? -1 : 1;

  const items = rows.map((r, i) => {
    const rawDate = dateCol >= 0 ? r[dateCol] : '';
    const br = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    return {
      date: br ? `${br[3]}-${br[2]}-${br[1]}` : /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : null,
      description: r[descCol],
      amount: amounts[i] * flip,
    };
  });
  return finalize(items, 'CSV');
}

// ---------- PDF (texto reconstruído linha a linha pela posição na página) ----------
async function pdfLines(buffer, password) {
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(buffer), password ? { password } : {});
  } catch (error) {
    if (error?.name === 'PasswordException') {
      throw new InvoiceError('password', password ? 'Senha do PDF incorreta.' : 'O PDF tem senha.');
    }
    throw new InvoiceError('format', 'Não consegui abrir o PDF.');
  }
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const rows = new Map();
    for (const item of content.items) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5] / 3) * 3;
      const row = rows.get(y) || [];
      row.push({ x: item.transform[4], text: item.str });
      rows.set(y, row);
    }
    [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([, row]) => lines.push(row.sort((a, b) => a.x - b.x).map(r => r.text).join(' ').replace(/\s+/g, ' ').trim()));
  }
  return lines;
}

const MONTHS = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
const AMOUNT = String.raw`(-?\s?(?:R\$\s?)?-?\d{1,3}(?:\.\d{3})*,\d{2}-?)`;
// "12/10 SHOPEE*LOJA 199,90", "12/10/2026 MERCADO LIVRE 2/3 150,00", "12 OUT WELLHUB R$ 150,00"
const LINE = new RegExp(String.raw`^(\d{2})[\/\s](\d{2}|[a-z]{3})(?:\/\d{2,4})?\s+(.+?)\s+${AMOUNT}(?:\s+.*)?$`, 'i');

function parsePdfLines(lines) {
  const items = [];
  for (const line of lines) {
    const m = line.match(LINE);
    if (!m) continue;
    const [, day, monthRaw, description, amountRaw] = m;
    const month = /^\d+$/.test(monthRaw) ? Number(monthRaw) : MONTHS[normalize(monthRaw)];
    if (!month || month > 12 || Number(day) > 31) continue;
    // Descrição não pode ser só números (evita linhas de resumo/código de barras).
    if (!/[a-z]/i.test(description)) continue;
    items.push({ day: Number(day), month, description: description.replace(/R\$\s*$/, ''), amount: parseSigned(amountRaw) });
  }
  return items;
}

export async function parseInvoice(buffer, filename = '', { password } = {}) {
  const name = filename.toLowerCase();
  const head = Buffer.from(buffer.slice(0, 1024)).toString('latin1');

  if (name.endsWith('.ofx') || /OFXHEADER|<OFX>/i.test(head)) {
    return parseOfx(Buffer.from(buffer).toString('latin1'));
  }
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const text = Buffer.from(buffer).toString('utf8');
    return parseCsv(text.includes('�') ? Buffer.from(buffer).toString('latin1') : text);
  }
  if (name.endsWith('.pdf') || head.startsWith('%PDF')) {
    const lines = await pdfLines(buffer, password);
    const raw = parsePdfLines(lines);
    // A fatura não traz o ano: compras de dezembro numa fatura de janeiro são do ano anterior.
    const now = new Date();
    const yearFor = (month) => (month > now.getMonth() + 2 ? now.getFullYear() - 1 : now.getFullYear());
    return finalize(raw.map(i => ({ date: `${yearFor(i.month)}-${String(i.month).padStart(2, '0')}-${String(i.day).padStart(2, '0')}`, description: i.description, amount: i.amount })), 'PDF');
  }
  throw new InvoiceError('format', 'Formato não suportado. Envie PDF, OFX ou CSV.');
}
