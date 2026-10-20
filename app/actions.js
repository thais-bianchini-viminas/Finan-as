'use server'

import prisma from '../lib/prisma';
import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_COOKIE, isValidSession } from '../lib/auth';
import { CATEGORY_NAMES, EXPENSE, FIXED, INCOME, VARIABLE, categoryNamesFor, defaultCategoryFor } from '../lib/categories';
import { classify } from '../lib/classifier';
import { dateFromISO, formatBRL, parseAmount } from '../lib/format';
import { copyBudgetsFromPreviousMonth, upsertBudget } from '../lib/finance';
import { notifyTransaction } from '../lib/notify';
import { attachInvoice } from '../lib/invoiceImport';
import { InvoiceError } from '../lib/invoice';

// O proxy já barra quem não está logado; aqui é a segunda trava (as actions são endpoints públicos).
async function requireAuth() {
  const cookieStore = await cookies();
  if (!isValidSession(cookieStore.get(AUTH_COOKIE)?.value)) throw new Error('Não autorizado');
}

const cleanDescription = (value) => value?.toString().replace(/[\s:=\-–]+$/, '').trim();
const parseType = (value) => (value === INCOME ? INCOME : EXPENSE);
const parseKind = (value, type) => (type === INCOME ? VARIABLE : value === FIXED ? FIXED : VARIABLE);

function parseMonthYear(formData) {
  const month = parseInt(formData.get('month'), 10);
  const year = parseInt(formData.get('year'), 10);
  if (!(month >= 1 && month <= 12) || !(year >= 2000 && year <= 2100)) return null;
  return { month, year };
}

// Sugestão para o formulário do app, com o mesmo classificador (que aprende) do bot.
export async function suggestClassification(description, type) {
  await requireAuth();
  if (!description?.trim()) return null;
  return classify(description, parseType(type));
}

export async function createTransaction(formData) {
  await requireAuth();
  const type = parseType(formData.get('type'));
  const description = cleanDescription(formData.get('description'));
  const amount = parseAmount(formData.get('amount'));
  const senderName = formData.get('senderName')?.toString().trim() || 'Painel';
  const dateStr = formData.get('date')?.toString();
  const date = dateStr ? dateFromISO(dateStr) : new Date();

  if (!description) return { ok: false, message: 'Informe uma descrição.' };
  if (!(amount > 0)) return { ok: false, message: 'Valor inválido.' };

  const chosen = formData.get('category')?.toString();
  const auto = categoryNamesFor(type).includes(chosen) ? null : await classify(description, type);
  const category = auto ? auto.category : chosen || defaultCategoryFor(type);
  const kindInput = formData.get('kind')?.toString();
  const kind = parseKind(kindInput || auto?.kind, type);

  try {
    const tx = await prisma.transaction.create({ data: { description, amount, type, category, kind, senderName, date } });
    after(() => notifyTransaction(tx));
    revalidatePath('/');
    const label = type === INCOME ? 'Receita' : kind === FIXED ? 'Custo fixo' : 'Gasto';
    return { ok: true, message: `${label} salvo: ${description} · ${formatBRL(amount)} em ${category}` };
  } catch (error) {
    console.error('Erro ao criar transação:', error);
    return { ok: false, message: 'Erro ao salvar. Tente de novo.' };
  }
}

export async function updateTransaction(id, formData) {
  await requireAuth();
  const type = parseType(formData.get('type'));
  const amount = parseAmount(formData.get('amount'));
  const description = cleanDescription(formData.get('description'));
  const category = formData.get('category')?.toString();
  const kind = parseKind(formData.get('kind')?.toString(), type);
  const dateStr = formData.get('date')?.toString();
  if (!description || !categoryNamesFor(type).includes(category) || !(amount > 0)) return { ok: false, message: 'Dados inválidos.' };

  try {
    await prisma.transaction.update({
      where: { id },
      data: { type, category, kind, description, amount, ...(dateStr && { date: dateFromISO(dateStr) }) },
    });
    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    console.error('Erro ao atualizar transação:', error);
    return { ok: false, message: 'Erro ao atualizar.' };
  }
}

export async function deleteTransaction(id) {
  await requireAuth();
  try {
    await prisma.transaction.delete({ where: { id } });
    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    console.error('Erro ao deletar:', error);
    return { ok: false };
  }
}

// Salva todas as metas do mês de uma vez. Campo vazio ou 0 remove a meta.
export async function saveBudgets(formData) {
  await requireAuth();
  const period = parseMonthYear(formData);
  if (!period) return { ok: false, message: 'Mês inválido.' };

  try {
    await Promise.all(CATEGORY_NAMES.map(category => {
      const raw = formData.get(`budget:${category}`)?.toString().trim();
      return upsertBudget(period.month, period.year, category, raw ? parseAmount(raw) : 0);
    }));
    revalidatePath('/');
    return { ok: true, message: 'Metas salvas!' };
  } catch (error) {
    console.error('Erro ao salvar metas:', error);
    return { ok: false, message: 'Erro ao salvar metas.' };
  }
}

export async function copyPreviousBudgets(formData) {
  await requireAuth();
  const period = parseMonthYear(formData);
  if (!period) return { ok: false, message: 'Mês inválido.' };

  const { copied, sourceCount } = await copyBudgetsFromPreviousMonth(period.month, period.year);
  revalidatePath('/');
  if (!sourceCount) return { ok: false, message: 'O mês anterior não tem metas.' };
  return { ok: true, message: copied ? `${copied} meta(s) copiada(s).` : 'As metas já estavam copiadas.' };
}

// Anexa a fatura (PDF/OFX/CSV) ao lançamento: cada compra vira um item com categoria.
export async function importInvoice(transactionId, formData) {
  await requireAuth();
  const file = formData.get('file');
  if (!file || typeof file === 'string' || !file.size) return { ok: false, message: 'Escolha o arquivo da fatura.' };
  if (file.size > 4 * 1024 * 1024) return { ok: false, message: 'Arquivo maior que 4 MB. Tente o OFX ou CSV.' };

  try {
    const result = await attachInvoice({
      transactionId,
      buffer: Buffer.from(await file.arrayBuffer()),
      filename: file.name,
      password: formData.get('password')?.toString() || undefined,
    });
    revalidatePath('/');
    const diff = Math.round((result.total - result.transaction.amount) * 100) / 100;
    return {
      ok: true,
      message: `${result.items.length} compras importadas (${formatBRL(result.total)})${Math.abs(diff) >= 0.01 ? ` · diferença de ${formatBRL(diff)}` : ''}`,
      diff,
      total: result.total,
    };
  } catch (error) {
    if (error instanceof InvoiceError) return { ok: false, code: error.code, message: error.message };
    console.error('Erro ao importar fatura:', error);
    return { ok: false, message: 'Não consegui ler a fatura. Tente o OFX ou CSV.' };
  }
}

export async function applyInvoiceTotal(transactionId) {
  await requireAuth();
  const agg = await prisma.transactionItem.aggregate({ _sum: { amount: true }, where: { transactionId } });
  const total = Math.round((agg._sum.amount || 0) * 100) / 100;
  if (total > 0) await prisma.transaction.update({ where: { id: transactionId }, data: { amount: total } });
  revalidatePath('/');
  return { ok: true, message: `Valor atualizado para ${formatBRL(total)}` };
}

export async function clearInvoice(transactionId) {
  await requireAuth();
  await prisma.transactionItem.deleteMany({ where: { transactionId } });
  revalidatePath('/');
  return { ok: true, message: 'Detalhamento removido.' };
}

export async function subscribePush(subscription, userName) {
  await requireAuth();
  const { endpoint, keys } = subscription || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth || !userName?.trim()) return { ok: false, message: 'Inscrição inválida.' };
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { p256dh: keys.p256dh, auth: keys.auth, userName: userName.trim() },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userName: userName.trim() },
  });
  return { ok: true, message: 'Notificações ativadas neste aparelho!' };
}

export async function unsubscribePush(endpoint) {
  await requireAuth();
  if (endpoint) await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return { ok: true, message: 'Notificações desativadas neste aparelho.' };
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
  redirect('/login');
}
