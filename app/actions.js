'use server'

import prisma from '../lib/prisma';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_COOKIE, isValidSession } from '../lib/auth';
import { CATEGORY_NAMES, categorize } from '../lib/categories';
import { dateFromISO, formatBRL, parseAmount } from '../lib/format';
import { copyBudgetsFromPreviousMonth, upsertBudget } from '../lib/finance';

// O proxy já barra quem não está logado; aqui é a segunda trava (as actions são endpoints públicos).
async function requireAuth() {
  const cookieStore = await cookies();
  if (!isValidSession(cookieStore.get(AUTH_COOKIE)?.value)) throw new Error('Não autorizado');
}

const validCategory = (value) => (CATEGORY_NAMES.includes(value) ? value : null);

function parseMonthYear(formData) {
  const month = parseInt(formData.get('month'), 10);
  const year = parseInt(formData.get('year'), 10);
  if (!(month >= 1 && month <= 12) || !(year >= 2000 && year <= 2100)) return null;
  return { month, year };
}

export async function createTransaction(formData) {
  await requireAuth();
  const description = formData.get('description')?.toString().replace(/[\s:=\-–]+$/, '').trim();
  const amount = parseAmount(formData.get('amount'));
  const category = validCategory(formData.get('category')?.toString()) || categorize(description || '');
  const senderName = formData.get('senderName')?.toString().trim() || 'Painel';
  const dateStr = formData.get('date')?.toString();
  const date = dateStr ? dateFromISO(dateStr) : new Date();

  if (!description) return { ok: false, message: 'Informe uma descrição.' };
  if (!(amount > 0)) return { ok: false, message: 'Valor inválido.' };

  try {
    await prisma.transaction.create({ data: { description, amount, category, senderName, date } });
    revalidatePath('/');
    return { ok: true, message: `${description} · ${formatBRL(amount)} salvo em ${category}` };
  } catch (error) {
    console.error('Erro ao criar transação:', error);
    return { ok: false, message: 'Erro ao salvar. Tente de novo.' };
  }
}

export async function updateTransaction(id, formData) {
  await requireAuth();
  const amount = parseAmount(formData.get('amount'));
  const description = formData.get('description')?.toString().trim();
  const category = validCategory(formData.get('category')?.toString());
  const dateStr = formData.get('date')?.toString();
  if (!description || !category || !(amount > 0)) return { ok: false, message: 'Dados inválidos.' };

  try {
    await prisma.transaction.update({
      where: { id },
      data: { category, description, amount, ...(dateStr && { date: dateFromISO(dateStr) }) },
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

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
  redirect('/login');
}
