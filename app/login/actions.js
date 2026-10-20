'use server'

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_COOKIE, SESSION_MAX_AGE, checkPassword, sessionToken } from '../../lib/auth';

export async function login(_prevState, formData) {
  const password = formData.get('password')?.toString() || '';
  const next = formData.get('next')?.toString() || '/';

  if (!checkPassword(password)) {
    // Atraso simples para dificultar tentativa e erro.
    await new Promise(resolve => setTimeout(resolve, 800));
    return { error: 'Senha incorreta.' };
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });

  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/');
}
