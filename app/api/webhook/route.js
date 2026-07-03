import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendMessage(chatId, text, replyMarkup = null) {
  if (!TELEGRAM_BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body = { chat_id: chatId, text: text };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function answerCallbackQuery(callbackQueryId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text: text }),
  });
}

async function editMessageText(chatId, messageId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: text }),
  });
}

function categorize(description) {
  const desc = description.toLowerCase();
  if (desc.includes('almoço') || desc.includes('mercado') || desc.includes('ifood') || desc.includes('comida') || desc.includes('lanche') || desc.includes('pizza') || desc.includes('jantar')) return 'Alimentação';
  if (desc.includes('uber') || desc.includes('gasolina') || desc.includes('ônibus') || desc.includes('metro') || desc.includes('estacionamento') || desc.includes('99')) return 'Transporte';
  if (desc.includes('cinema') || desc.includes('festa') || desc.includes('show') || desc.includes('bar') || desc.includes('passeio')) return 'Lazer';
  if (desc.includes('farmácia') || desc.includes('remédio') || desc.includes('médico') || desc.includes('exame')) return 'Saúde';
  if (desc.includes('luz') || desc.includes('água') || desc.includes('internet') || desc.includes('aluguel') || desc.includes('condomínio')) return 'Moradia';
  return 'Outros';
}

export async function POST(req) {
  try {
    const update = await req.json();

    // 1. Lidar com o botão de excluir (Callback Query)
    if (update.callback_query) {
      const callbackData = update.callback_query.data;
      const callbackId = update.callback_query.id;
      const chatId = update.callback_query.message.chat.id;
      const messageId = update.callback_query.message.message_id;

      if (callbackData.startsWith('delete_')) {
        const transactionId = parseInt(callbackData.replace('delete_', ''), 10);
        
        try {
          await prisma.transaction.delete({ where: { id: transactionId } });
          await answerCallbackQuery(callbackId, "Gasto excluído com sucesso do Painel!");
          await editMessageText(chatId, messageId, "🗑️ Este gasto foi cancelado e excluído do Painel.");
        } catch(e) {
          await answerCallbackQuery(callbackId, "Erro: Gasto já excluído ou não encontrado.");
        }
        
        return NextResponse.json({ status: 'deleted' });
      }
    }

    // 2. Lidar com novas mensagens de texto
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

      const transaction = await prisma.transaction.create({
        data: {
          description,
          amount,
          category,
          senderName
        }
      });

      // Botão "Desfazer" direto no Telegram
      const replyMarkup = {
        inline_keyboard: [
          [{ text: "🗑️ Desfazer / Excluir", callback_data: `delete_${transaction.id}` }]
        ]
      };

      await sendMessage(
        chatId, 
        `✅ Registrado por ${senderName}:\n${description} (R$ ${amount.toFixed(2)})\n📂 Categoria: ${category}`, 
        replyMarkup
      );
      return NextResponse.json({ status: 'success' });
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
