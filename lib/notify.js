import prisma from './prisma';
import { FIXED, INCOME, categoryInfo, normalize } from './categories';
import { formatBRL, percent } from './format';
import { categoryStatus } from './finance';
import { sendPush } from './push';
import { escapeHtml, isAllowedChat, progressBar, sendMessage, statusEmoji } from './telegram';

// Situação da meta depois de um lançamento. `added` é o valor recém-lançado, para detectar a virada de 80%/100%.
export function budgetAlert({ spent, budget }, added = 0) {
  if (!budget) return { level: 'none', pct: 0, crossed: null };
  const pct = percent(spent, budget);
  const before = percent(spent - added, budget);
  const crossed = before <= 100 && pct > 100 ? 100 : before < 80 && pct >= 80 ? 80 : null;
  return { level: pct > 100 ? 'over' : pct >= 80 ? 'warning' : 'ok', pct, crossed, remaining: budget - spent };
}

export function budgetLineHtml(category, status, added = 0) {
  const alert = budgetAlert(status, added);
  if (alert.level === 'none') {
    return `📊 ${escapeHtml(category)} no mês: ${formatBRL(status.spent)} (sem meta — envie <code>meta ${escapeHtml(normalize(category).split(/[/\s]/)[0])} valor</code>)`;
  }
  let line = `${statusEmoji(alert.pct, true)} ${escapeHtml(category)}: ${formatBRL(status.spent)} de ${formatBRL(status.budget)} (${alert.pct.toFixed(0)}%)\n${progressBar(alert.pct)}`;
  if (alert.crossed === 100) line += `\n🚨 <b>Meta estourada em ${formatBRL(-alert.remaining)}!</b>`;
  else if (alert.crossed === 80) line += `\n⚠️ <b>Atenção: 80% da meta usada.</b> Restam ${formatBRL(alert.remaining)}.`;
  else if (alert.level !== 'over') line += `\nRestam ${formatBRL(alert.remaining)}.`;
  return line;
}

function budgetLinePlain(category, status, added) {
  const alert = budgetAlert(status, added);
  if (alert.level === 'none') return `${category}: ${formatBRL(status.spent)} no mês`;
  if (alert.crossed === 100) return `🚨 Meta de ${category} estourada (${alert.pct.toFixed(0)}%)`;
  if (alert.crossed === 80) return `⚠️ ${category} chegou a ${alert.pct.toFixed(0)}% da meta`;
  return `${category}: ${alert.pct.toFixed(0)}% da meta · restam ${formatBRL(Math.max(alert.remaining, 0))}`;
}

// Avisa a outra pessoa (Telegram + notificação do app) sobre um lançamento novo.
// fromChatId: chat que originou o lançamento pelo bot (não recebe eco).
export async function notifyTransaction(tx, { fromChatId } = {}) {
  const info = categoryInfo(tx.category);
  const income = tx.type === INCOME;
  const status = income ? null : await categoryStatus(tx.category, tx.date);
  const kindLabel = !income && tx.kind === FIXED ? ' · custo fixo' : '';

  const users = await prisma.telegramUser.findMany();
  const sender = normalize(tx.senderName);
  const telegramTargets = users.filter(u => isAllowedChat(u.chatId) && u.chatId !== fromChatId && normalize(u.name) !== sender);
  const html = income
    ? `💰 ${escapeHtml(tx.senderName)} registrou uma receita: <b>${escapeHtml(tx.description)}</b> · ${formatBRL(tx.amount)} (${escapeHtml(tx.category)})`
    : `🔔 ${escapeHtml(tx.senderName)} registrou <b>${escapeHtml(tx.description)}</b> · ${formatBRL(tx.amount)} (${escapeHtml(tx.category)}${kindLabel})\n${budgetLineHtml(tx.category, status, tx.amount)}`;

  await Promise.all([
    ...telegramTargets.map(u => sendMessage(u.chatId, html)),
    sendPush({
      title: income ? `💰 ${tx.senderName} registrou ${formatBRL(tx.amount)}` : `${info.emoji} ${tx.senderName} gastou ${formatBRL(tx.amount)}`,
      body: income ? `${tx.description} · ${tx.category}` : `${tx.description} · ${tx.category}${kindLabel}\n${budgetLinePlain(tx.category, status, tx.amount)}`,
      url: income ? '/?tab=lancamentos&tipo=receita' : `/?tab=lancamentos&category=${encodeURIComponent(tx.category)}`,
      tag: `tx-${tx.id}`,
    }, { excludeName: tx.senderName }),
  ]);
}
