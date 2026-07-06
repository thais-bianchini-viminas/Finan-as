'use server'

import prisma from '../lib/prisma';
import { revalidatePath } from 'next/cache';

export async function deleteTransaction(id) {
  try {
    await prisma.transaction.delete({
      where: { id }
    });
    revalidatePath('/');
  } catch (error) {
    console.error("Erro ao deletar:", error);
  }
}

export async function setCategoryBudget(formData) {
  const category = formData.get('category');
  const amountStr = formData.get('amount').replace(',', '.');
  const amount = parseFloat(amountStr);

  if (!category || isNaN(amount)) return;

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  try {
    const existing = await prisma.categoryBudget.findFirst({
      where: { month, year, category }
    });

    if (existing) {
      await prisma.categoryBudget.update({
        where: { id: existing.id },
        data: { amount }
      });
    } else {
      await prisma.categoryBudget.create({
        data: { month, year, category, amount }
      });
    }

    revalidatePath('/');
  } catch (error) {
    console.error("Erro ao salvar meta:", error);
  }
}
