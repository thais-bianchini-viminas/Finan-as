// Configura o webhook e o menu de comandos do bot.
// Uso: node --env-file=.env setup-webhook.js
// Variáveis: TELEGRAM_BOT_TOKEN, APP_URL e (recomendado) TELEGRAM_WEBHOOK_SECRET.

const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = (process.env.APP_URL || 'https://finan-as-rose.vercel.app').replace(/\/$/, '');
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token) {
  console.error('Defina TELEGRAM_BOT_TOKEN no .env');
  process.exit(1);
}

const call = (method, body) =>
  fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(res => res.json());

async function main() {
  console.log('setWebhook:', await call('setWebhook', {
    url: `${appUrl}/api/webhook`,
    allowed_updates: ['message', 'callback_query'],
    ...(secret && { secret_token: secret }),
  }));

  // Menu "/" do Telegram: deixa os comandos à vista no celular.
  console.log('setMyCommands:', await call('setMyCommands', {
    commands: [
      { command: 'resumo', description: 'Resumo do mês' },
      { command: 'metas', description: 'Ver metas e quanto já foi usado' },
      { command: 'copiar', description: 'Copiar metas do mês passado' },
      { command: 'painel', description: 'Imagem dos gráficos' },
      { command: 'gastos', description: 'Imagem da lista de gastos' },
      { command: 'app', description: 'Link do app para instalar' },
      { command: 'ajuda', description: 'Como lançar gastos e metas' },
    ],
  }));
}

main().catch(console.error);
