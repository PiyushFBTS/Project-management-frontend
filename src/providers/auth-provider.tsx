'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { tokenStorage, LoginType } from '@/lib/auth/token-storage';
import { authApi, MergedUser, ClientLoginUser } from '@/lib/api/auth';

/**
 * Post-merge auth provider.
 *
 * One `login(email, password)` for every kind of user. The backend
 * cascades through `users` (admin + employee) → `clients`, and the
 * response carries `user.userType` so the provider can branch:
 *
 *   - 'admin' | 'employee' → MergedUser, `_type` mirrored from userType
 *                            for existing `user._type === 'admin'`
 *                            checks across the app.
 *   - 'client'             → ClientUser shape, `_type: 'client'`.
 *
 * Mirroring `userType → _type` avoids a 48-site sweep across the
 * dashboard, sidebar, page guards, etc.
 */

export type SessionUser =
  | (MergedUser & { _type: 'admin' | 'employee' })
  | (ClientLoginUser & { _type: 'client' });

interface AuthContextType {
  user: SessionUser | null;
  isLoading: boolean;
  loginType: LoginType;
  /** Unified login — auto-detects user (admin/employee) vs client. */
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginType, setLoginType] = useState<LoginType>('admin');

  const fetchProfile = useCallback(async () => {
    const token = tokenStorage.getAccess();
    const refresh = tokenStorage.getRefresh();
    if (!token && !refresh) { setIsLoading(false); return; }

    const type = tokenStorage.getLoginType();
    setLoginType(type);

    try {
      if (type === 'client') {
        const res = await authApi.getClientProfile();
        const c = res.data.data;
        setUser({ ...c, _type: 'client' });
      } else {
        // Merged user (admin or employee). `/auth/me` returns one row
        // with a userType discriminator that we mirror onto _type.
        // Soft-admins: a row with userType='employee' AND isAdmin=true
        // (the "Admin Access" toggle on the employee form) passes the
        // backend's @AdminOnly() guard. Promote them to _type='admin' on
        // the client too so every UI gate (sidebar, project-types,
        // settings, email-outbox, etc.) treats them as admin without
        // touching every call site.
        const res = await authApi.me();
        const u = res.data.data;
        const effectiveType =
          u.userType === 'employee' && (u as any).isAdmin ? 'admin' : u.userType;
        setUser({ ...u, _type: effectiveType });
      }
    } catch {
      tokenStorage.clear();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const login = async (email: string, password: string): Promise<SessionUser> => {
    const res = await authApi.login(email, password);
    const body = res.data.data;
    tokenStorage.setAccess(body.accessToken);
    // Both user and client login flows now return a refresh token —
    // store it so hard-refresh / cold reload can re-issue an access
    // token via /auth/refresh.
    if (body.refreshToken) {
      tokenStorage.setRefresh(body.refreshToken);
    }

    if (body.user.userType === 'client') {
      tokenStorage.setLoginType('client');
      setLoginType('client');
      const next: SessionUser = { ...body.user, _type: 'client' };
      setUser(next);
      return next;
    }

    // Admin or employee. Same soft-admin promotion as fetchProfile so
    // a fresh login is consistent with reload.
    tokenStorage.setLoginType(body.user.userType);
    setLoginType(body.user.userType);
    const effectiveType =
      body.user.userType === 'employee' && (body.user as any).isAdmin
        ? 'admin'
        : body.user.userType;
    const next: SessionUser = { ...body.user, _type: effectiveType };
    setUser(next);
    return next;
  };

  const logout = () => {
    tokenStorage.clear();
    setUser(null);
    setLoginType('admin');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, loginType, login, logout, refreshProfile: fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
