import { NextResponse, after } from 'next/server';
import prisma from '../../../lib/prisma';
import { CATEGORIES, EXPENSE, FIXED, INCOME, INCOME_CATEGORIES, VARIABLE, categoriesFor, categoryInfo, detectType, normalize, resolveCategory } from '../../../lib/categories';
import { classify, SOURCE_LABEL } from '../../../lib/classifier';
import { formatBRL, localParts, monthLabel, parseAmount } from '../../../lib/format';
import { categoryStatus, copyBudgetsFromPreviousMonth, getBudgetSuggestion, getMonthSummary, upsertBudget } from '../../../lib/finance';
import { defaultFixedKeys, suggestedBudgets } from '../../../lib/budgets';
import { budgetLineHtml, notifyTransaction } from '../../../lib/notify';
import { appUrl, authEnabled, safeEqual, screenshotKey } from '../../../lib/auth';
import { answerCallbackQuery, deleteMessage, downloadFile, editMessageText, escapeHtml, isAllowedChat, progressBar, sendMessage, sendPhoto, statusEmoji } from '../../../lib/telegram';
import { attachInvoice, findRecentCardTransaction } from '../../../lib/invoiceImport';
import { InvoiceError } from '../../../lib/invoice';

// Ler PDFs grandes pode passar do tempo padrão da função.
export const maxDuration = 60;

export const dynamic = 'force-dynamic';

const HELP = `🤖 <b>Como usar</b>

<b>Despesa</b> — descrição e valor:
• <code>Mercado 230,50</code>
• <code>Uber 18 #lazer</code> (força a categoria)
• Vários de uma vez, um por linha.
O bot aprende: se você corrigir a categoria, da próxima vez ele acerta.

<b>Receita</b> — comece com <code>+</code> ou <code>recebi</code>:
• <code>+5000 salário</code>
• <code>recebi 800 freela</code>

<b>Custo fixo x gasto variável</b>
Custo fixo é o que se repete todo mês (financiamento, internet, luz, fatura). Gasto variável é o do dia a dia. O bot identifica sozinho, e um botão permite trocar.

<b>Fatura do cartão detalhada</b>
• Envie o arquivo da fatura (PDF, OFX ou CSV) com a legenda <code>Cartão inter 500</code>
• Ou responda à mensagem do lançamento do cartão com o arquivo
• PDF com senha: legenda <code>senha 12345</code> (o bot apaga a mensagem depois de ler)
Cada compra da fatura fica guardada dentro do lançamento, já com a categoria.

<b>Metas</b>
• <code>gerar metas</code> — cria as metas do mês pelo histórico de 3 meses
• <code>metas</code> — mostra as metas e quanto já foi usado
• <code>meta alimentação 1500</code> ou várias, uma por linha após <code>metas</code>
• <code>copiar metas</code> — repete as do mês passado
• <code>meta lazer 0</code> — remove

<b>Consultas</b>
• <code>resumo</code> — saldo, receitas, despesas e metas
• <code>painel</code> / <code>gastos</code> — imagem do painel
• <code>app</code> — link do app

Categorias: ${CATEGORIES.map(c => `${c.emoji} ${c.name}`).join(', ')}
Receitas: ${INCOME_CATEGORIES.map(c => `${c.emoji} ${c.name}`).join(', ')}`;

function parseEntry(line) {
  const { type, text } = detectType(line);
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  let forcedCategory = null;
  const rest = [];
  for (const token of tokens) {
    const resolved = token.startsWith('#') ? resolveCategory(token, type) : null;
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
  return { description, amount, type, forcedCategory };
}

function parseBudgetLine(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  const amount = parseAmount(tokens.at(-1));
  const categoryInput = tokens.slice(0, -1).join(' ');
  return { input: line.trim(), amount, category: resolveCategory(categoryInput) };
}

function transactionKeyboard(tx) {
  const list = categoriesFor(tx.type);
  const buttons = list.map((c, i) => ({
    text: `${c.name === tx.category ? '✓ ' : ''}${c.emoji} ${c.name}`,
    callback_data: `c:${tx.id}:${i}`,
  }));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  const last = [{ text: '🗑️ Desfazer', callback_data: `d:${tx.id}` }];
  if (tx.type !== INCOME) {
    last.unshift({ text: tx.kind === FIXED ? '🔄 É gasto variável' : '📌 É custo fixo', callback_data: `k:${tx.id}` });
  }
  rows.push(last);
  return { inline_keyboard: rows };
}

function transactionText(tx, { status, source }) {
  const info = categoryInfo(tx.category);
  const how = source ? ` <i>(${SOURCE_LABEL[source]})</i>` : '';
  if (tx.type === INCOME) {
    return `💰 <b>Receita: ${escapeHtml(tx.description)}</b> · ${formatBRL(tx.amount)}\n${info.emoji} ${escapeHtml(tx.category)}${how} · por ${escapeHtml(tx.senderName)}\n\n<i>Categoria errada? Toque para trocar.</i>`;
  }
  const kind = tx.kind === FIXED ? '📌 Custo fixo' : '🛒 Gasto variável';
  return `✅ <b>${escapeHtml(tx.description)}</b> · ${formatBRL(tx.amount)}\n${info.emoji} ${escapeHtml(tx.category)}${how}\n${kind} · por ${escapeHtml(tx.senderName)}\n\n${budgetLineHtml(tx.category, status, tx.amount)}\n\n<i>Algo errado? Toque para corrigir.</i>`;
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
    if (!rows.length) return `🎯 Nenhuma meta para <b>${title}</b>.\n\nEnvie <code>gerar metas</code> para criar pelo histórico, ou <code>copiar metas</code> para repetir as do mês passado.`;
    return `🎯 <b>Metas de ${title}</b>\nTotal: ${formatBRL(summary.budget)}\n\n${rows.join('\n')}\n\nPara alterar: <code>meta lazer 500</code>`;
  }

  const lines = [`📊 <b>Resumo de ${title}</b>`, ''];
  if (summary.income > 0) {
    lines.push(`💰 Receitas: ${formatBRL(summary.income)}`);
    lines.push(`💸 Despesas: ${formatBRL(summary.spent)}`);
    lines.push(`${summary.balance >= 0 ? '🟢' : '🔴'} <b>Saldo: ${formatBRL(summary.balance)}</b> (${summary.savingsRate.toFixed(0)}% da renda)`);
    lines.push('');
  }
  if (summary.budget > 0) {
    lines.push(`🎯 ${formatBRL(summary.spent)} de ${formatBRL(summary.budget)} planejados (${summary.pct.toFixed(0)}%)`);
    lines.push(progressBar(summary.pct, 14));
  } else {
    lines.push(`💸 Gasto: ${formatBRL(summary.spent)} · sem metas definidas`);
  }
  lines.push(`📌 Custos fixos ${formatBRL(summary.fixedSpent)} · 🛒 variáveis ${formatBRL(summary.variableSpent)}`);
  if (summary.isCurrent) {
    lines.push(`📅 Dia ${summary.elapsedDays} de ${summary.totalDays}`);
    if (summary.dailyAllowance !== null) lines.push(`💡 Dá para gastar ${formatBRL(summary.dailyAllowance)}/dia até o fim do mês`);
    if (summary.spent > 0) lines.push(`📈 No ritmo atual as despesas fecham em ${formatBRL(summary.projection)}`);
  }
  if (rows.length) lines.push('', ...rows);
  return lines.join('\n');
}

function screenshotUrl(view) {
  const params = new URLSearchParams({ view, v: Date.now().toString() });
  if (authEnabled()) params.set('key', screenshotKey());
  const target = encodeURIComponent(`${appUrl()}/?${params}`);
  return `https://api.microlink.io/?url=${target}&screenshot=true&meta=false&embed=screenshot.url&fullPage=true&viewport.width=1200&waitFor=3000`;
}

const appButton = { inline_keyboard: [[{ text: '📱 Abrir o app', url: appUrl() }]] };

async function handleBudgets(chatId, lines) {
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
}

async function handleGenerateBudgets(chatId) {
  const now = localParts();
  const suggestion = await getBudgetSuggestion(now.month, now.year, 3);
  const keys = defaultFixedKeys(suggestion);
  const values = suggestedBudgets(suggestion, keys);
  const entries = Object.entries(values).filter(([, v]) => v > 0);
  if (!entries.length) {
    await sendMessage(chatId, '⚠️ Ainda não há histórico suficiente para gerar metas. Lance alguns gastos e tente no mês que vem.');
    return;
  }
  await Promise.all(Object.entries(values).map(([category, amount]) => upsertBudget(now.month, now.year, category, amount)));

  const fixed = suggestion.fixedItems.filter(i => keys.includes(i.key));
  const lines = [
    `✨ <b>Metas de ${monthLabel(now.month, now.year)} geradas</b> pela média de ${suggestion.months} mês(es).`,
    '',
    ...entries.map(([category, amount]) => `${categoryInfo(category).emoji} ${escapeHtml(category)}: <b>${formatBRL(amount)}</b>`),
    '',
    `Total: <b>${formatBRL(entries.reduce((a, [, v]) => a + v, 0))}</b>`,
  ];
  if (fixed.length) {
    lines.push('', '📌 Custos fixos incluídos:', ...fixed.map(i => `• ${escapeHtml(i.description)} ${formatBRL(i.amount)}`));
  }
  lines.push('', 'Para ajustar: <code>meta lazer 300</code>, ou pela aba <b>Metas</b> do app, onde dá para tirar ou incluir cada custo fixo.');
  await sendMessage(chatId, lines.join('\n'), appButton);
}

async function handleTransactions(chatId, senderName, lines) {
  const parsed = lines.map(line => ({ line, entry: parseEntry(line) }));
  const failed = parsed.filter(p => !p.entry);
  const ok = parsed.filter(p => p.entry);

  if (!ok.length) {
    await sendMessage(chatId, `⚠️ Não entendi, ${escapeHtml(senderName)}. Envie <code>descrição valor</code>, ex.: <code>Almoço 35,50</code>, ou <code>+5000 salário</code> para receita.\n\nDigite <code>ajuda</code> para ver todos os comandos.`);
    return;
  }

  // Histórico carregado uma vez por tipo, para classificar todas as linhas.
  const histories = {};
  const historyFor = async (type) => (histories[type] ||= await prisma.transaction.findMany({
    where: { type }, select: { description: true, category: true, kind: true }, orderBy: { date: 'desc' }, take: 600,
  }));

  const created = [];
  for (const { entry } of ok) {
    const result = await classify(entry.description, entry.type, await historyFor(entry.type));
    const category = entry.forcedCategory || result.category;
    const tx = await prisma.transaction.create({
      data: { description: entry.description, amount: entry.amount, type: entry.type, category, kind: entry.type === INCOME ? VARIABLE : result.kind, senderName },
    });
    created.push({ tx, source: entry.forcedCategory ? 'manual' : result.source });
  }

  if (created.length === 1) {
    const [{ tx, source }] = created;
    const status = tx.type === INCOME ? null : await categoryStatus(tx.category, tx.date);
    await sendMessage(chatId, transactionText(tx, { status, source }), transactionKeyboard(tx));
  } else {
    const total = (type) => created.filter(c => c.tx.type === type).reduce((acc, c) => acc + c.tx.amount, 0);
    const list = created.map(({ tx }) => `${tx.type === INCOME ? '💰' : categoryInfo(tx.category).emoji} ${escapeHtml(tx.description)} · ${formatBRL(tx.amount)} <i>(${escapeHtml(tx.category)}${tx.kind === FIXED ? ', fixo' : ''})</i>`).join('\n');
    const keyboard = { inline_keyboard: created.map(({ tx }) => [{ text: `🗑️ ${tx.description} ${formatBRL(tx.amount)}`.slice(0, 60), callback_data: `d:${tx.id}` }]) };
    const totals = [total(EXPENSE) && `despesas ${formatBRL(total(EXPENSE))}`, total(INCOME) && `receitas ${formatBRL(total(INCOME))}`].filter(Boolean).join(' · ');
    await sendMessage(chatId, `✅ <b>${created.length} lançamentos registrados</b> (${totals})\n\n${list}`, keyboard);
  }

  after(() => Promise.all(created.map(({ tx }) => notifyTransaction(tx, { fromChatId: chatId }))));

  if (failed.length) {
    await sendMessage(chatId, `⚠️ Estas linhas não foram registradas: ${failed.map(f => `<code>${escapeHtml(f.line)}</code>`).join(', ')}`);
  }
}

const INVOICE_EXTENSIONS = /\.(pdf|ofx|csv|txt)$/i;

// Qual lançamento recebe a fatura: legenda > mensagem respondida > cartão recente sem itens > novo.
async function invoiceTarget(message, caption, senderName) {
  if (caption) {
    const entry = parseEntry(caption);
    if (entry && entry.type === EXPENSE) {
      const result = await classify(entry.description, EXPENSE);
      const tx = await prisma.transaction.create({
        data: { description: entry.description, amount: entry.amount, type: EXPENSE, category: entry.forcedCategory || result.category, kind: result.kind, senderName },
      });
      return { ...tx, fresh: true };
    }
  }
  const buttons = message.reply_to_message?.reply_markup?.inline_keyboard?.flat() || [];
  const repliedId = buttons.map(b => b.callback_data?.match(/^(?:d|c|k):(\d+)/)?.[1]).find(Boolean);
  if (repliedId) {
    const tx = await prisma.transaction.findUnique({ where: { id: parseInt(repliedId, 10) } });
    if (tx) return tx;
  }
  return findRecentCardTransaction(senderName);
}

async function handleDocument(message, senderName) {
  const chatId = message.chat.id.toString();
  const doc = message.document;
  if (!INVOICE_EXTENSIONS.test(doc.file_name || '') && doc.mime_type !== 'application/pdf') {
    await sendMessage(chatId, '📎 Para detalhar a fatura, envie o arquivo em <b>PDF</b>, <b>OFX</b> ou <b>CSV</b>.');
    return;
  }

  // A senha do PDF vem na legenda e não é guardada; a mensagem é apagada depois de lida.
  const rawCaption = (message.caption || '').trim();
  const password = rawCaption.match(/senha[:\s]+(\S+)/i)?.[1];
  const caption = rawCaption.replace(/senha[:\s]+\S+/i, '').trim();
  if (password) await deleteMessage(chatId, message.message_id);

  await sendMessage(chatId, '📎 Lendo a fatura…');
  try {
    const buffer = await downloadFile(doc.file_id);
    const target = await invoiceTarget(message, caption, senderName);
    const result = await attachInvoice({ transactionId: target?.id, buffer, filename: doc.file_name, password, senderName });
    const tx = result.transaction;

    const diff = Math.round((result.total - tx.amount) * 100) / 100;
    const lines = [
      `📎 <b>Fatura ${result.created ? 'lançada' : 'anexada'}</b> em <b>${escapeHtml(tx.description)}</b> (${formatBRL(tx.amount)})`,
      `${result.items.length} compras · total da fatura ${formatBRL(result.total)}${Math.abs(diff) >= 0.01 ? ` · diferença ${formatBRL(diff)}` : ' ✓'}`,
      '',
      '<b>Por categoria</b>',
      ...result.breakdown.map(b => `${categoryInfo(b.category).emoji} ${escapeHtml(b.category)}: ${formatBRL(b.total)}`),
      '',
      '<b>Maiores compras</b>',
      ...[...result.items].sort((a, b) => b.amount - a.amount).slice(0, 8).map(i => `• ${escapeHtml(i.description)} ${formatBRL(i.amount)}`),
    ];
    if (result.items.length > 8) lines.push(`… e mais ${result.items.length - 8}. Veja tudo no app, tocando no lançamento.`);

    const keyboard = [[{ text: '📱 Ver no app', url: `${appUrl()}/?tab=lancamentos&tipo=despesa&category=${encodeURIComponent(tx.category)}` }]];
    if (Math.abs(diff) >= 0.01) keyboard.unshift([{ text: `✏️ Usar o total da fatura (${formatBRL(result.total)})`, callback_data: `u:${tx.id}` }]);
    await sendMessage(chatId, lines.join('\n'), { inline_keyboard: keyboard });
    if (result.created || target?.fresh) after(() => notifyTransaction(tx, { fromChatId: chatId }));
  } catch (error) {
    if (error instanceof InvoiceError && error.code === 'password') {
      await sendMessage(chatId, `🔒 ${escapeHtml(error.message)} Reenvie o PDF com a legenda <code>senha 12345</code> (costuma ser parte do CPF).\n\nAlternativa sem senha: no app do banco, exporte a fatura em <b>OFX</b> ou <b>CSV</b>.`);
    } else if (error instanceof InvoiceError) {
      await sendMessage(chatId, `⚠️ ${escapeHtml(error.message)}\n\nSe o PDF não funcionar, tente exportar a fatura em <b>OFX</b> ou <b>CSV</b> pelo app do banco.`);
    } else {
      console.error('Invoice import error:', error);
      await sendMessage(chatId, '⚠️ Não consegui ler a fatura. Tente de novo ou envie em OFX/CSV.');
    }
  }
}

async function handleMessage(message) {
  const chatId = message.chat.id.toString();
  const senderName = message.from?.first_name || 'Usuário';

  if (!isAllowedChat(chatId)) {
    await sendMessage(chatId, `🔒 Este bot é privado.\nSeu chat ID é <code>${chatId}</code>.`);
    return;
  }

  await prisma.telegramUser.upsert({
    where: { chatId },
    update: { name: senderName },
    create: { chatId, name: senderName },
  });

  if (message.document) {
    await handleDocument(message, senderName);
    return;
  }

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

  if (otherLines.length === 0 && ['gerar metas', 'gerar', 'gerarmetas', 'metas automaticas'].includes(head)) {
    await handleGenerateBudgets(chatId);
    return;
  }

  if (head === 'copiar metas' || head === 'copiar') {
    const { copied, sourceCount, prev } = await copyBudgetsFromPreviousMonth(now.month, now.year);
    if (!sourceCount) {
      await sendMessage(chatId, `⚠️ ${monthLabel(prev.month, prev.year)} não tem metas para copiar. Tente <code>gerar metas</code>.`);
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
    await handleBudgets(chatId, budgetLines);
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

  await handleTransactions(chatId, senderName, lines);
}

async function handleCallback(query) {
  const chatId = query.message.chat.id.toString();
  const messageId = query.message.message_id;
  if (!isAllowedChat(chatId)) {
    await answerCallbackQuery(query.id, 'Não autorizado.');
    return;
  }

  // "delete_<id>" mantém compatibilidade com mensagens antigas.
  const data = query.data || '';
  const deleteMatch = data.match(/^(?:d:|delete_)(\d+)$/);
  const categoryMatch = data.match(/^c:(\d+):(\d+)$/);
  const kindMatch = data.match(/^k:(\d+)$/);
  const totalMatch = data.match(/^u:(\d+)$/);
  const id = parseInt((deleteMatch || categoryMatch || kindMatch || totalMatch)?.[1], 10);
  const tx = Number.isFinite(id) ? await prisma.transaction.findUnique({ where: { id } }) : null;

  if ((deleteMatch || categoryMatch || kindMatch || totalMatch) && !tx) {
    await answerCallbackQuery(query.id, 'Esse lançamento já foi excluído.');
    return;
  }

  if (totalMatch) {
    const agg = await prisma.transactionItem.aggregate({ _sum: { amount: true }, where: { transactionId: id } });
    const total = Math.round((agg._sum.amount || 0) * 100) / 100;
    if (total > 0) await prisma.transaction.update({ where: { id }, data: { amount: total } });
    await answerCallbackQuery(query.id, `Valor atualizado para ${formatBRL(total)}`);
    await editMessageText(chatId, messageId, `✅ <b>${escapeHtml(tx.description)}</b> agora vale ${formatBRL(total)}, o total da fatura.`);
    return;
  }

  if (deleteMatch) {
    await prisma.transaction.delete({ where: { id } });
    await answerCallbackQuery(query.id, 'Lançamento excluído!');
    await editMessageText(chatId, messageId, `🗑️ <s>${escapeHtml(tx.description)} · ${formatBRL(tx.amount)}</s>\nExcluído do painel.`);
    return;
  }

  let updated = null;
  if (categoryMatch) {
    const category = categoriesFor(tx.type)[parseInt(categoryMatch[2], 10)]?.name;
    if (!category || tx.category === category) {
      await answerCallbackQuery(query.id, category ? `Já está em ${category}.` : 'Categoria inválida.');
      return;
    }
    updated = await prisma.transaction.update({ where: { id }, data: { category } });
    await answerCallbackQuery(query.id, `Movido para ${category}. Vou lembrar disso!`);
  }
  if (kindMatch && tx.type !== INCOME) {
    const kind = tx.kind === FIXED ? VARIABLE : FIXED;
    updated = await prisma.transaction.update({ where: { id }, data: { kind } });
    await answerCallbackQuery(query.id, kind === FIXED ? 'Marcado como custo fixo.' : 'Marcado como gasto variável.');
  }

  if (updated) {
    const status = updated.type === INCOME ? null : await categoryStatus(updated.category, updated.date);
    await editMessageText(chatId, messageId, transactionText(updated, { status, source: 'manual' }), transactionKeyboard(updated));
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
    else if (update.message?.text || update.message?.document) await handleMessage(update.message);
  } catch (error) {
    console.error('Webhook error:', error);
  }
  // Sempre 200: um erro aqui faria o Telegram reenviar a mesma mensagem e duplicar lançamentos.
  return NextResponse.json({ status: 'ok' });
}
