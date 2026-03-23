'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AdminUser, Employee } from '@/types';
import { tokenStorage, LoginType } from '@/lib/auth/token-storage';
import { authApi } from '@/lib/api/auth';

type ClientUser = {
  id: number;
  fullName: string;
  email: string;
  mobileNumber?: string;
  projectId: number;
  projectName: string | null;
  companyId: number;
  companyName: string | null;
  companyLogoUrl: string | null;
  _type: 'client';
};

type AppUser = (AdminUser & { _type: 'admin' }) | (Employee & { _type: 'employee' }) | ClientUser;

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean;
  loginType: LoginType;
  login: (email: string, password: string, type: LoginType) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginType, setLoginType] = useState<LoginType>('admin');

  const fetchProfile = useCallback(async () => {
    const token = tokenStorage.getAccess();
    const refresh = tokenStorage.getRefresh();
    if (!token && !refresh) { setIsLoading(false); return; }

    const type = tokenStorage.getLoginType();
    setLoginType(type);

    try {
      if (type === 'employee') {
        const res = await authApi.getEmployeeProfile();
        setUser({ ...res.data.data, _type: 'employee' });
      } else if (type === 'client') {
        const res = await authApi.getClientProfile();
        setUser({ ...res.data.data, _type: 'client' });
      } else {
        const res = await authApi.getProfile();
        setUser({ ...res.data.data, _type: 'admin' });
      }
    } catch {
      tokenStorage.clear();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const login = async (email: string, password: string, type: LoginType) => {
    if (type === 'employee') {
      const res = await authApi.loginEmployee(email, password);
      const { accessToken, refreshToken, user: u } = res.data.data;
      tokenStorage.setAccess(accessToken);
      tokenStorage.setRefresh(refreshToken);
      tokenStorage.setLoginType('employee');
      setLoginType('employee');
      setUser({ ...u, _type: 'employee' });
    } else if (type === 'client') {
      const res = await authApi.loginClient(email, password);
      const { accessToken, refreshToken, user: u } = res.data.data;
      tokenStorage.setAccess(accessToken);
      tokenStorage.setRefresh(refreshToken);
      tokenStorage.setLoginType('client');
      setLoginType('client');
      setUser({ ...u, _type: 'client' });
    } else {
      const res = await authApi.login(email, password);
      const { accessToken, refreshToken, user: u } = res.data.data;
      tokenStorage.setAccess(accessToken);
      tokenStorage.setRefresh(refreshToken);
      tokenStorage.setLoginType('admin');
      setLoginType('admin');
      setUser({ ...u, _type: 'admin' });
    }
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
