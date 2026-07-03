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
