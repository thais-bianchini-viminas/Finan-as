import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendMessage(chatId, text, replyMarkup = null) {
  if (!TELEGRAM_BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body = { chat_id: chatId, text: text, parse_mode: 'Markdown' };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function sendPhoto(chatId, photoUrl) {
  if (!TELEGRAM_BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl }),
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
  
  if (desc.includes('almoço') || desc.includes('mercado') || desc.includes('ifood') || desc.includes('comida') || desc.includes('lanche') || desc.includes('pizza') || desc.includes('jantar') || desc.includes('padaria') || desc.includes('restaurante')) return 'Alimentação';
  if (desc.includes('uber') || desc.includes('gasolina') || desc.includes('ônibus') || desc.includes('metro') || desc.includes('estacionamento') || desc.includes('99') || desc.includes('pedágio')) return 'Transporte';
  if (desc.includes('cinema') || desc.includes('festa') || desc.includes('show') || desc.includes('bar') || desc.includes('passeio') || desc.includes('viagem') || desc.includes('netflix') || desc.includes('spotify')) return 'Lazer';
  if (desc.includes('farmácia') || desc.includes('remédio') || desc.includes('médico') || desc.includes('exame') || desc.includes('terapia') || desc.includes('dentista') || desc.includes('academia')) return 'Saúde';
  if (desc.includes('luz') || desc.includes('água') || desc.includes('internet') || desc.includes('aluguel') || desc.includes('condomínio') || desc.includes('energia') || desc.includes('gás')) return 'Moradia';
  if (desc.includes('cartão') || desc.includes('fatura') || desc.includes('boleto') || desc.includes('conta') || desc.includes('imposto')) return 'Contas/Cartão';

  return 'Outros';
}

export async function POST(req) {
  try {
    const update = await req.json();

    // 1. Lidar com o botão de excluir (Callback Query)
    if (update.callback_query) {
      const callbackData = update.callback_query.data;
      const callbackId = update.callback_query.id;
      const chatId = update.callback_query.message.chat.id.toString();
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
      const chatId = update.message.chat.id.toString();
      const text = update.message.text.trim();
      const senderName = update.message.from?.first_name || 'Usuário';

      // 2.0 Registrar/Atualizar usuário no banco para notificações
      await prisma.telegramUser.upsert({
        where: { chatId: chatId },
        update: { name: senderName },
        create: { chatId: chatId, name: senderName }
      });

      const textLower = text.toLowerCase();

      // 2.1 Comando Painel (Imagem)
      if (textLower === 'painel') {
        await sendMessage(chatId, '📸 Gerando a imagem do painel atualizado. Isso pode levar alguns segundos...');
        const cacheBuster = Date.now();
        // A API thum.io tira print de um site e devolve como imagem.
        const photoUrl = `https://image.thum.io/get/width/1200/crop/800/https://finan-as-rose.vercel.app?v=${cacheBuster}`;
        await sendPhoto(chatId, photoUrl);
        return NextResponse.json({ status: 'success' });
      }

      // 2.2 Comando de Orçamento
      if (textLower.startsWith('orçado') || textLower.startsWith('orcado') || textLower.startsWith('orçamento') || textLower.startsWith('orcamento')) {
        const parts = text.split(' ');
        const valueStr = parts.pop().replace(',', '.');
        const amount = parseFloat(valueStr);
        
        if (isNaN(amount)) {
           await sendMessage(chatId, `⚠️ Formato inválido. Envie no formato: "Orçado 5000"`);
           return NextResponse.json({ status: 'ignored' });
        }
        
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        
        const existing = await prisma.budget.findFirst({ where: { month, year } });
        if (existing) {
          await prisma.budget.update({ where: { id: existing.id }, data: { amount } });
        } else {
          await prisma.budget.create({ data: { month, year, amount } });
        }
        
        await sendMessage(chatId, `🎯 Orçamento deste mês (Mês ${month}) definido para R$ ${amount.toFixed(2)} com sucesso! (Atualize a página do site para ver)`);
        return NextResponse.json({ status: 'success' });
      }

      // 2.3 Comando de Resumo
      if (textLower === 'resumo') {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

        const transactions = await prisma.transaction.findMany({
          where: {
            date: {
              gte: startOfMonth,
              lte: endOfMonth
            }
          }
        });

        const totalMes = transactions.reduce((acc, curr) => acc + curr.amount, 0);

        const existingBudget = await prisma.budget.findFirst({ where: { month, year } });
        const orcado = existingBudget ? existingBudget.amount : 5000;
        
        const percentual = (totalMes / orcado) * 100;
        
        const responseText = `📊 *Resumo do Mês (${month}/${year})*\n\n🎯 Orçado: R$ ${orcado.toFixed(2)}\n💸 Realizado: R$ ${totalMes.toFixed(2)}\n📈 Utilizado: ${percentual.toFixed(1)}%`;
        
        await sendMessage(chatId, responseText);
        return NextResponse.json({ status: 'success' });
      }

      // 2.4 Gastos normais
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

      // NOVIDADE: Notificar os outros usuários cadastrados!
      const allUsers = await prisma.telegramUser.findMany();
      for (const user of allUsers) {
        if (user.chatId !== chatId) {
          await sendMessage(
            user.chatId,
            `🔔 **Aviso:** ${senderName} acabou de registrar um gasto:\n\n${description} (R$ ${amount.toFixed(2)})\n📂 Categoria: ${category}`
          );
        }
      }

      return NextResponse.json({ status: 'success' });
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
