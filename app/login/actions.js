'use server'

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_COOKIE, INTRO_COOKIE, SESSION_MAX_AGE, checkPassword, sessionToken } from '../../lib/auth';

export async function login(_prevState, formData) {
  const password = formData.get('password')?.toString() || '';
  const next = formData.get('next')?.toString() || '/';

  if (!checkPassword(password)) {
    // Atraso simples para dificultar tentativa e erro.
    await new Promise(resolve => setTimeout(resolve, 800));
    // "at" muda a cada tentativa, para a animação de erro (tremida) repetir.
    return { error: 'Senha incorreta.', at: Date.now() };
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  // Sinal de curta duração para o app abrir com a animação de boas-vindas.
  cookieStore.set(INTRO_COOKIE, '1', { path: '/', maxAge: 15, sameSite: 'lax' });

  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/');
}
