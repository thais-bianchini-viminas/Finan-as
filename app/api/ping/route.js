import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Uma consulta simples e leve apenas para simular atividade e manter o Supabase acordado
    await prisma.telegramUser.count();
    
    return NextResponse.json({ 
      status: 'ok', 
      message: 'Ping realizado com sucesso. Banco de dados acordado!' 
    });
  } catch (error) {
    console.error('Erro no ping automático:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
