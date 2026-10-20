import { createHmac, timingSafeEqual } from 'node:crypto';

// Proteção por senha única (APP_PASSWORD). Sem a variável definida, o app continua aberto
// como antes, para não quebrar o deploy atual.
export const AUTH_COOKIE = 'fin_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365;
export { INTRO_COOKIE } from './auth-constants';

export const authEnabled = () => Boolean(process.env.APP_PASSWORD);

const secret = () => process.env.AUTH_SECRET || process.env.APP_PASSWORD || 'dev';
const sign = (value) => createHmac('sha256', secret()).update(value).digest('base64url');

export function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && timingSafeEqual(x, y);
}

export const sessionToken = () => sign('session:v1');
export const isValidSession = (token) => !authEnabled() || safeEqual(token, sessionToken());
export const checkPassword = (password) => safeEqual(password, process.env.APP_PASSWORD);

// Chave que o bot usa para o microlink capturar as telas somente-leitura (?view=charts|gastos).
export const screenshotKey = () => sign('screenshot:v1').slice(0, 24);
export const READ_ONLY_VIEWS = ['charts', 'gastos'];

export const appUrl = () => (process.env.APP_URL || 'https://finan-as-rose.vercel.app').replace(/\/$/, '');
