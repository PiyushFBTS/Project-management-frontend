'use client';

import Cookies from 'js-cookie';

const REFRESH_KEY = 'app_refresh';
const TYPE_KEY = 'app_login_type';

/**
 * Login-type cookie value.
 *
 * Post-merge the backend exposes a single `/auth/login` for the merged
 * users table (admin + employee) and `/auth/client/login` for clients.
 * The cookie still stores the granular role ('admin' | 'employee' |
 * 'client') so existing role-aware UI conditionals (`user._type === 'admin'`,
 * sidebar `adminOnly`, route guards) keep working unchanged. The value is
 * derived from `MergedUser.userType` at login time by `AuthProvider`.
 */
export type LoginType = 'admin' | 'employee' | 'client';

let memoryToken: string | null = null;

export const tokenStorage = {
  getAccess: (): string | null => memoryToken,
  setAccess: (token: string) => { memoryToken = token; },
  clearAccess: () => { memoryToken = null; },

  getRefresh: (): string | null => Cookies.get(REFRESH_KEY) ?? null,
  setRefresh: (token: string) => {
    Cookies.set(REFRESH_KEY, token, { expires: 30, sameSite: 'strict' });
  },
  clearRefresh: () => Cookies.remove(REFRESH_KEY),

  getLoginType: (): LoginType => (Cookies.get(TYPE_KEY) as LoginType) ?? 'admin',
  setLoginType: (type: LoginType) => {
    Cookies.set(TYPE_KEY, type, { expires: 30, sameSite: 'strict' });
  },

  clear: () => {
    memoryToken = null;
    Cookies.remove(REFRESH_KEY);
    Cookies.remove(TYPE_KEY);
  },
};
