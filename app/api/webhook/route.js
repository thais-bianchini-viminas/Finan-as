import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendMessage(chatId, text) {
  if (!TELEGRAM_BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text }),
  });
}

function categorize(description) {
  const desc = description.toLowerCase();
  if (desc.includes('almoço') || desc.includes('mercado') || desc.includes('ifood') || desc.includes('comida') || desc.includes('lanche')) return 'Alimentação';
  if (desc.includes('uber') || desc.includes('gasolina') || desc.includes('ônibus') || desc.includes('metro')) return 'Transporte';
  if (desc.includes('cinema') || desc.includes('festa') || desc.includes('show')) return 'Lazer';
  if (desc.includes('farmácia') || desc.includes('remédio') || desc.includes('médico')) return 'Saúde';
  return 'Outros';
}

export async function POST(req) {
  try {
    const update = await req.json();

    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();
      const senderName = update.message.from?.first_name || 'Usuário';

      const parts = text.split(' ');
      
      if (parts.length < 2) {
        await sendMessage(chatId, `⚠️ Olá ${senderName}, formato inválido. Envie no formato: "Descrição Valor". Ex: Almoço 35.50`);
        return NextResponse.json({ status: 'ignored' });
      }

      const valueStr = parts.pop().replace(',', '.'); 
      const amount = parseFloat(valueStr);
      
      const description = parts.join(' ');

      if (isNaN(amount)) {
        await sendMessage(chatId, `⚠️ ${senderName}, não entendi o valor. Certifique-se de colocar um número no final, ex: "Uber 15"`);
        return NextResponse.json({ status: 'ignored' });
      }

      const category = categorize(description);

      await prisma.transaction.create({
        data: {
          description,
          amount,
          category,
          senderName
        }
      });

      await sendMessage(chatId, `✅ Registrado por ${senderName}:\n${description} (R$ ${amount.toFixed(2)})\n📂 Categoria: ${category}`);
      return NextResponse.json({ status: 'success' });
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
