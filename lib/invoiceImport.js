import prisma from './prisma';
import { EXPENSE, FIXED } from './categories';
import { classify } from './classifier';
import { parseInvoice } from './invoice';

const CARD_CATEGORY = 'Contas/Cartão';

// Lê a fatura e grava os itens no lançamento informado (ou cria um "Fatura cartão" com o total).
// Reenviar a fatura substitui os itens anteriores.
export async function attachInvoice({ transactionId, buffer, filename, password, senderName, description }) {
  const parsed = await parseInvoice(buffer, filename, { password });

  const history = await prisma.transaction.findMany({
    where: { type: EXPENSE },
    select: { description: true, category: true, kind: true },
    orderBy: { date: 'desc' },
    take: 600,
  });
  const items = [];
  for (const item of parsed.items) {
    const { category } = await classify(item.description, EXPENSE, history);
    items.push({ ...item, category });
  }

  let transaction = transactionId ? await prisma.transaction.findUnique({ where: { id: transactionId } }) : null;
  const created = !transaction;
  if (!transaction) {
    transaction = await prisma.transaction.create({
      data: { description: description || 'Fatura cartão', amount: parsed.total, type: EXPENSE, category: CARD_CATEGORY, kind: FIXED, senderName: senderName || 'Painel' },
    });
  }

  await prisma.$transaction([
    prisma.transactionItem.deleteMany({ where: { transactionId: transaction.id } }),
    prisma.transactionItem.createMany({
      data: items.map(i => ({
        transactionId: transaction.id,
        description: i.description,
        amount: i.amount,
        category: i.category,
        date: i.date ? new Date(`${i.date}T12:00:00-03:00`) : null,
      })),
    }),
  ]);

  return { transaction, created, format: parsed.format, items, total: parsed.total, breakdown: breakdownOf(items) };
}

export function breakdownOf(items) {
  const totals = {};
  for (const i of items) totals[i.category] = (totals[i.category] || 0) + i.amount;
  return Object.entries(totals).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
}

// Lançamento de cartão recente ao qual uma fatura enviada "solta" provavelmente pertence.
export async function findRecentCardTransaction(senderName) {
  const since = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
  const candidates = await prisma.transaction.findMany({
    where: { type: EXPENSE, category: CARD_CATEGORY, date: { gte: since }, items: { none: {} } },
    orderBy: { date: 'desc' },
    take: 5,
  });
  return candidates.find(t => t.senderName === senderName) || candidates[0] || null;
}
