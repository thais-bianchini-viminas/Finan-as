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

export async function updateTransaction(id, data) {
  try {
    await prisma.transaction.update({
      where: { id },
      data: {
        category: data.category,
        description: data.description,
        amount: parseFloat(data.amount)
      }
    });
    revalidatePath('/');
  } catch (error) {
    console.error("Erro ao atualizar transação:", error);
  }
}

export async function deleteCategoryBudget(id) {
  try {
    await prisma.categoryBudget.delete({
      where: { id }
    });
    revalidatePath('/');
  } catch (error) {
    console.error("Erro ao deletar meta:", error);
  }
}
