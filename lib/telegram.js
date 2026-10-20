// Cliente mínimo da Bot API do Telegram: https://core.telegram.org/bots/api

async function callApi(method, body) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) console.error(`Telegram ${method} error:`, json.description);
    return json;
  } catch (error) {
    console.error(`Telegram ${method} fetch error:`, error);
    return null;
  }
}

export const sendMessage = (chatId, text, replyMarkup) =>
  callApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...(replyMarkup && { reply_markup: replyMarkup }),
  });

export const editMessageText = (chatId, messageId, text, replyMarkup) =>
  callApi('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    ...(replyMarkup && { reply_markup: replyMarkup }),
  });

export const answerCallbackQuery = (callbackQueryId, text) =>
  callApi('answerCallbackQuery', { callback_query_id: callbackQueryId, text });

export const sendPhoto = (chatId, photo, caption, replyMarkup) =>
  callApi('sendPhoto', { chat_id: chatId, photo, caption, parse_mode: 'HTML', ...(replyMarkup && { reply_markup: replyMarkup }) });

export const deleteMessage = (chatId, messageId) => callApi('deleteMessage', { chat_id: chatId, message_id: messageId });

// Baixa um arquivo enviado ao bot (limite da Bot API: 20 MB).
export async function downloadFile(fileId) {
  const info = await callApi('getFile', { file_id: fileId });
  const path = info?.result?.file_path;
  if (!path) throw new Error('Não consegui baixar o arquivo do Telegram.');
  const res = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${path}`);
  if (!res.ok) throw new Error('Não consegui baixar o arquivo do Telegram.');
  return Buffer.from(await res.arrayBuffer());
}

export const escapeHtml = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function progressBar(pct, width = 10) {
  const filled = Math.max(0, Math.min(width, Math.round((pct / 100) * width)));
  return '▓'.repeat(filled) + '░'.repeat(width - filled);
}

// Se ALLOWED_CHAT_IDS estiver definido, só esses chats podem usar o bot.
export function isAllowedChat(chatId) {
  const allowed = (process.env.ALLOWED_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  return allowed.length === 0 || allowed.includes(String(chatId));
}

export function statusEmoji(pct, hasBudget) {
  if (!hasBudget) return '⚪';
  if (pct > 100) return '🔴';
  if (pct >= 80) return '🟡';
  return '🟢';
}
