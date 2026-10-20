import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { CATEGORIES, categorize, categoryInfo, normalize, resolveCategory } from '../../../lib/categories';
import { formatBRL, localParts, monthLabel, monthRange, parseAmount, percent } from '../../../lib/format';
import { copyBudgetsFromPreviousMonth, getMonthSummary, upsertBudget } from '../../../lib/finance';
import { appUrl, authEnabled, safeEqual, screenshotKey } from '../../../lib/auth';
import { answerCallbackQuery, editMessageText, escapeHtml, progressBar, sendMessage, sendPhoto, statusEmoji } from '../../../lib/telegram';

export const dynamic = 'force-dynamic';

const HELP = `🤖 <b>Como usar</b>

<b>Lançar gasto</b> — descrição e valor:
• <code>Mercado 230,50</code>
• <code>Uber 18 #lazer</code> (força a categoria)
• Vários de uma vez, um por linha.

<b>Metas</b>
• <code>meta alimentação 1500</code>
• Várias de uma vez:
<code>metas
alimentação 1500
moradia 2800
lazer 400</code>
• <code>metas</code> — mostra as metas e quanto já foi usado
• <code>copiar metas</code> — repete as metas do mês passado
• <code>meta lazer 0</code> — remove a meta

<b>Consultas</b>
• <code>resumo</code> — visão do mês
• <code>painel</code> / <code>gastos</code> — imagem do painel
• <code>app</code> — link do app para instalar no celular

Categorias: ${CATEGORIES.map(c => `${c.emoji} ${c.name}`).join(', ')}`;

// Se ALLOWED_CHAT_IDS estiver definido, só esses chats podem usar o bot.
function isAllowed(chatId) {
  const allowed = (process.env.ALLOWED_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  return allowed.length === 0 || allowed.includes(chatId);
}

function parseExpense(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  let forcedCategory = null;
  const rest = [];
  for (const token of tokens) {
    const resolved = token.startsWith('#') ? resolveCategory(token) : null;
    if (resolved) forcedCategory = resolved;
    else rest.push(token);
  }

  // Valor no fim ("Uber 15") ou no começo ("15 uber").
  let amount = parseAmount(rest.at(-1));
  let descriptionTokens = rest.slice(0, -1);
  if (!(amount > 0)) {
    amount = parseAmount(rest[0]);
    descriptionTokens = rest.slice(1);
  }
  // "Barbeiro: 60" e "Uber - 15" chegam com pontuação sobrando antes do valor.
  const description = descriptionTokens.filter(t => !/^r\$$/i.test(t)).join(' ').replace(/[\s:=\-–]+$/, '').trim();
  if (!(amount > 0) || !description) return null;
  return { description, amount, category: forcedCategory || categorize(description) };
}

function parseBudgetLine(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  const amount = parseAmount(tokens.at(-1));
  const categoryInput = tokens.slice(0, -1).join(' ');
  return { input: line.trim(), amount, category: resolveCategory(categoryInput) };
}

async function categoryStatus(category, date = new Date()) {
  const { month, year } = localParts(date);
  const { start, end } = monthRange(month, year);
  const [agg, budget] = await Promise.all([
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { category, date: { gte: start, lt: end } } }),
    prisma.categoryBudget.findFirst({ where: { category, month, year } }),
  ]);
  const spent = agg._sum.amount || 0;
  return { spent, budget: budget?.amount || 0 };
}

function budgetLine(category, { spent, budget }, added = 0) {
  if (!budget) return `📊 ${escapeHtml(category)} no mês: ${formatBRL(spent)} (sem meta — envie <code>meta ${escapeHtml(normalize(category).split('/')[0])} valor</code>)`;
  const pct = percent(spent, budget);
  const before = percent(spent - added, budget);
  let line = `${statusEmoji(pct, true)} ${escapeHtml(category)}: ${formatBRL(spent)} de ${formatBRL(budget)} (${pct.toFixed(0)}%)\n${progressBar(pct)}`;
  if (before <= 100 && pct > 100) line += `\n🚨 <b>Meta estourada em ${formatBRL(spent - budget)}!</b>`;
  else if (before < 80 && pct >= 80) line += `\n⚠️ <b>Atenção: 80% da meta usada.</b> Restam ${formatBRL(budget - spent)}.`;
  else if (pct <= 100) line += `\nRestam ${formatBRL(budget - spent)}.`;
  return line;
}

function expenseKeyboard(transaction) {
  const buttons = CATEGORIES.map((c, i) => ({
    text: `${c.name === transaction.category ? '✓ ' : ''}${c.emoji} ${c.name}`,
    callback_data: `c:${transaction.id}:${i}`,
  }));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  rows.push([{ text: '🗑️ Desfazer', callback_data: `d:${transaction.id}` }]);
  return { inline_keyboard: rows };
}

function expenseText(transaction, status, added) {
  const info = categoryInfo(transaction.category);
  return `✅ <b>${escapeHtml(transaction.description)}</b> · ${formatBRL(transaction.amount)}\n${info.emoji} ${escapeHtml(transaction.category)} · por ${escapeHtml(transaction.senderName)}\n\n${budgetLine(transaction.category, status, added)}\n\n<i>Categoria errada? Toque para trocar.</i>`;
}

function summaryText(summary, { onlyBudgets = false } = {}) {
  const title = monthLabel(summary.month, summary.year);
  const rows = summary.categories
    .filter(c => (onlyBudgets ? c.budget > 0 : c.budget > 0 || c.spent > 0))
    .map(c => {
      const info = categoryInfo(c.name);
      const target = c.budget ? ` / ${formatBRL(c.budget)} (${c.pct.toFixed(0)}%)` : ' (sem meta)';
      return `${statusEmoji(c.pct, c.budget > 0)} ${info.emoji} <b>${escapeHtml(c.name)}</b>: ${formatBRL(c.spent)}${target}`;
    });

  if (onlyBudgets) {
    if (!rows.length) return `🎯 Nenhuma meta para <b>${title}</b>.\n\nEnvie por exemplo:\n<code>metas\nalimentação 1500\nmoradia 2800</code>\n\nou <code>copiar metas</code> para repetir as do mês passado.`;
    return `🎯 <b>Metas de ${title}</b>\nTotal: ${formatBRL(summary.budget)}\n\n${rows.join('\n')}\n\nPara alterar: <code>meta lazer 500</code>`;
  }

  const lines = [`📊 <b>Resumo de ${title}</b>`, ''];
  if (summary.budget > 0) {
    lines.push(`💸 ${formatBRL(summary.spent)} de ${formatBRL(summary.budget)} (${summary.pct.toFixed(0)}%)`);
    lines.push(progressBar(summary.pct, 14));
  } else {
    lines.push(`💸 Gasto: ${formatBRL(summary.spent)} · sem metas definidas`);
  }
  if (summary.isCurrent) {
    lines.push(`📅 Dia ${summary.elapsedDays} de ${summary.totalDays}`);
    if (summary.dailyAllowance !== null) lines.push(`💡 Dá para gastar ${formatBRL(summary.dailyAllowance)}/dia até o fim do mês`);
    if (summary.spent > 0) lines.push(`📈 No ritmo atual o mês fecha em ${formatBRL(summary.projection)}`);
  }
  if (rows.length) lines.push('', ...rows);
  return lines.join('\n');
}

async function notifyOthers(chatId, text) {
  const users = await prisma.telegramUser.findMany();
  await Promise.all(users.filter(u => u.chatId !== chatId && isAllowed(u.chatId)).map(u => sendMessage(u.chatId, text)));
}

function screenshotUrl(view) {
  const params = new URLSearchParams({ view, v: Date.now().toString() });
  if (authEnabled()) params.set('key', screenshotKey());
  const target = encodeURIComponent(`${appUrl()}/?${params}`);
  return `https://api.microlink.io/?url=${target}&screenshot=true&meta=false&embed=screenshot.url&fullPage=true&viewport.width=1200&waitFor=3000`;
}

const appButton = { inline_keyboard: [[{ text: '📱 Abrir o app', url: appUrl() }]] };

async function handleBudgets(chatId, senderName, lines) {
  const now = localParts();
  const entries = lines.map(parseBudgetLine);
  const invalid = entries.filter(e => !e.category || Number.isNaN(e.amount));
  const valid = entries.filter(e => e.category && !Number.isNaN(e.amount));

  await Promise.all(valid.map(e => upsertBudget(now.month, now.year, e.category, e.amount)));

  const summary = await getMonthSummary(now.month, now.year);
  let text = valid.length
    ? `✅ ${valid.length} meta(s) atualizada(s) para ${monthLabel(now.month, now.year)}.\n\n${summaryText(summary, { onlyBudgets: true })}`
    : '';
  if (invalid.length) {
    text += `${text ? '\n\n' : ''}⚠️ Não entendi: ${invalid.map(e => `<code>${escapeHtml(e.input)}</code>`).join(', ')}\nUse <code>categoria valor</code>, ex.: <code>moradia 2800</code>.`;
  }
  await sendMessage(chatId, text);
  if (valid.length) {
    await notifyOthers(chatId, `🎯 ${escapeHtml(senderName)} atualizou as metas: ${valid.map(e => `${e.category} ${formatBRL(e.amount)}`).join(', ')}`);
  }
}

async function handleExpenses(chatId, senderName, lines) {
  const parsed = lines.map(line => ({ line, expense: parseExpense(line) }));
  const failed = parsed.filter(p => !p.expense);
  const ok = parsed.filter(p => p.expense);

  if (!ok.length) {
    await sendMessage(chatId, `⚠️ Não entendi, ${escapeHtml(senderName)}. Envie <code>descrição valor</code>, ex.: <code>Almoço 35,50</code>.\n\nDigite <code>ajuda</code> para ver todos os comandos.`);
    return;
  }

  const created = [];
  for (const { expense } of ok) {
    created.push(await prisma.transaction.create({ data: { ...expense, senderName } }));
  }

  if (created.length === 1) {
    const [tx] = created;
    const status = await categoryStatus(tx.category, tx.date);
    await sendMessage(chatId, expenseText(tx, status, tx.amount), expenseKeyboard(tx));
    await notifyOthers(chatId, `🔔 ${escapeHtml(senderName)} registrou <b>${escapeHtml(tx.description)}</b> · ${formatBRL(tx.amount)} (${escapeHtml(tx.category)})\n${budgetLine(tx.category, status, tx.amount)}`);
  } else {
    const total = created.reduce((acc, t) => acc + t.amount, 0);
    const list = created.map(t => `${categoryInfo(t.category).emoji} ${escapeHtml(t.description)} · ${formatBRL(t.amount)}`).join('\n');
    const keyboard = { inline_keyboard: created.map(t => [{ text: `🗑️ ${t.description} ${formatBRL(t.amount)}`.slice(0, 60), callback_data: `d:${t.id}` }]) };
    await sendMessage(chatId, `✅ <b>${created.length} gastos registrados</b> (${formatBRL(total)})\n\n${list}`, keyboard);
    await notifyOthers(chatId, `🔔 ${escapeHtml(senderName)} registrou ${created.length} gastos (${formatBRL(total)}):\n\n${list}`);
  }

  if (failed.length) {
    await sendMessage(chatId, `⚠️ Estas linhas não foram registradas: ${failed.map(f => `<code>${escapeHtml(f.line)}</code>`).join(', ')}`);
  }
}

async function handleMessage(message) {
  const chatId = message.chat.id.toString();
  const senderName = message.from?.first_name || 'Usuário';

  if (!isAllowed(chatId)) {
    await sendMessage(chatId, `🔒 Este bot é privado.\nSeu chat ID é <code>${chatId}</code>.`);
    return;
  }

  await prisma.telegramUser.upsert({
    where: { chatId },
    update: { name: senderName },
    create: { chatId, name: senderName },
  });

  const lines = message.text.split('\n').map(l => l.trim()).filter(Boolean);
  const [firstLine, ...otherLines] = lines;
  // Aceita "/resumo", "/resumo@MeuBot" e "Resumo".
  const head = normalize(firstLine).replace(/^\//, '').replace(/@\S+/, '');
  const [command, ...args] = head.split(/\s+/);
  // Comandos de consulta só valem sozinhos: "Painel solar 500" continua sendo um gasto.
  const single = args.length === 0 && otherLines.length === 0;
  const now = localParts();

  if (single && ['start', 'ajuda', 'help', 'comandos', '?'].includes(command)) {
    await sendMessage(chatId, HELP, appButton);
    return;
  }

  if (single && command === 'resumo') {
    await sendMessage(chatId, summaryText(await getMonthSummary(now.month, now.year)), appButton);
    return;
  }

  if (head === 'copiar metas' || head === 'copiar') {
    const { copied, sourceCount, prev } = await copyBudgetsFromPreviousMonth(now.month, now.year);
    if (!sourceCount) {
      await sendMessage(chatId, `⚠️ ${monthLabel(prev.month, prev.year)} não tem metas para copiar.`);
      return;
    }
    const summary = await getMonthSummary(now.month, now.year);
    await sendMessage(chatId, `📋 ${copied} meta(s) copiada(s) de ${monthLabel(prev.month, prev.year)}.\n\n${summaryText(summary, { onlyBudgets: true })}`);
    return;
  }

  if (command === 'meta' || command === 'metas') {
    const budgetLines = [firstLine.split(/\s+/).slice(1).join(' '), ...otherLines].filter(Boolean);
    if (!budgetLines.length) {
      await sendMessage(chatId, summaryText(await getMonthSummary(now.month, now.year), { onlyBudgets: true }));
      return;
    }
    await handleBudgets(chatId, senderName, budgetLines);
    return;
  }

  if (single && (command === 'painel' || command === 'gastos')) {
    await sendMessage(chatId, '📸 Gerando a imagem… isso leva alguns segundos.');
    await sendPhoto(chatId, screenshotUrl(command === 'painel' ? 'charts' : 'gastos'), undefined, appButton);
    return;
  }

  if (single && (command === 'app' || command === 'link')) {
    await sendMessage(chatId, `📱 <b>App de Finanças</b>\n\nAbra o link no celular e toque em <b>Instalar</b> (Android) ou <b>Compartilhar → Adicionar à Tela de Início</b> (iPhone).\n\n${appUrl()}`, appButton);
    return;
  }

  await handleExpenses(chatId, senderName, lines);
}

async function handleCallback(query) {
  const chatId = query.message.chat.id.toString();
  const messageId = query.message.message_id;
  if (!isAllowed(chatId)) {
    await answerCallbackQuery(query.id, 'Não autorizado.');
    return;
  }

  // "delete_<id>" mantém compatibilidade com mensagens antigas.
  const data = query.data || '';
  const deleteMatch = data.match(/^(?:d:|delete_)(\d+)$/);
  const categoryMatch = data.match(/^c:(\d+):(\d+)$/);

  if (deleteMatch) {
    const id = parseInt(deleteMatch[1], 10);
    const tx = await prisma.transaction.findUnique({ where: { id } });
    if (!tx) {
      await answerCallbackQuery(query.id, 'Esse gasto já foi excluído.');
      return;
    }
    await prisma.transaction.delete({ where: { id } });
    await answerCallbackQuery(query.id, 'Gasto excluído!');
    await editMessageText(chatId, messageId, `🗑️ <s>${escapeHtml(tx.description)} · ${formatBRL(tx.amount)}</s>\nExcluído do painel.`);
    return;
  }

  if (categoryMatch) {
    const id = parseInt(categoryMatch[1], 10);
    const category = CATEGORIES[parseInt(categoryMatch[2], 10)]?.name;
    const tx = category && await prisma.transaction.findUnique({ where: { id } });
    if (!tx) {
      await answerCallbackQuery(query.id, 'Gasto não encontrado.');
      return;
    }
    if (tx.category === category) {
      await answerCallbackQuery(query.id, `Já está em ${category}.`);
      return;
    }
    const updated = await prisma.transaction.update({ where: { id }, data: { category } });
    const status = await categoryStatus(category, updated.date);
    await answerCallbackQuery(query.id, `Movido para ${category}`);
    await editMessageText(chatId, messageId, expenseText(updated, status, updated.amount), expenseKeyboard(updated));
    return;
  }

  await answerCallbackQuery(query.id);
}

export async function POST(req) {
  // Configurado via setWebhook(secret_token). Garante que a chamada veio do Telegram.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && !safeEqual(req.headers.get('x-telegram-bot-api-secret-token'), secret)) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 });
  }

  try {
    const update = await req.json();
    if (update.callback_query) await handleCallback(update.callback_query);
    else if (update.message?.text) await handleMessage(update.message);
  } catch (error) {
    console.error('Webhook error:', error);
  }
  // Sempre 200: um erro aqui faria o Telegram reenviar a mesma mensagem e duplicar gastos.
  return NextResponse.json({ status: 'ok' });
}
