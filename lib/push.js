import webpush from 'web-push';
import prisma from './prisma';

// Web Push (padrão W3C Push API + VAPID, RFC 8292). Funciona no Android e, no iPhone,
// com o app instalado na Tela de Início (iOS 16.4+).
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
export const pushEnabled = Boolean(publicKey && privateKey);

if (pushEnabled) {
  // O "subject" identifica quem envia; a RFC aceita uma URL https do próprio app.
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || process.env.APP_URL || 'https://finan-as-rose.vercel.app', publicKey, privateKey);
}

// Envia para todos os aparelhos, exceto os de quem fez o lançamento.
export async function sendPush(payload, { excludeName } = {}) {
  if (!pushEnabled) return;
  const subscriptions = await prisma.pushSubscription.findMany();
  const targets = subscriptions.filter(s => !excludeName || s.userName.toLowerCase() !== excludeName.toLowerCase());

  await Promise.all(targets.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 24 }
      );
    } catch (error) {
      // 404/410: o navegador cancelou a inscrição; remove para não tentar de novo.
      if (error.statusCode === 404 || error.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      } else {
        console.error('Push error:', error.statusCode, error.body);
      }
    }
  }));
}
