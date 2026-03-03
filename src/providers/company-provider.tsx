'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth-provider';
import { setCompanyIdGetter } from '@/lib/api/axios-instance';

export interface SelectedCompany {
  id: number;
  name: string;
  slug: string;
}

interface CompanyContextType {
  selectedCompany: SelectedCompany | null;
  selectCompany: (company: SelectedCompany) => void;
  clearCompany: () => void;
  isSuperAdmin: boolean;
}

const CompanyContext = createContext<CompanyContextType | null>(null);
const STORAGE_KEY = 'selected_company';

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSuperAdmin = user?._type === 'admin' && user.role === 'super_admin';

  const [selectedCompany, setSelectedCompany] = useState<SelectedCompany | null>(null);

  // Restore from localStorage on mount (only for super admin)
  useEffect(() => {
    if (!isSuperAdmin) {
      setSelectedCompany(null);
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSelectedCompany(JSON.parse(stored));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [isSuperAdmin]);

  // Clear on logout
  useEffect(() => {
    if (!user) {
      setSelectedCompany(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  // Register the company ID getter on the axios module
  useEffect(() => {
    setCompanyIdGetter(() => selectedCompany?.id ?? null);
    return () => setCompanyIdGetter(() => null);
  }, [selectedCompany]);

  // Sync across browser tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const val = e.newValue ? JSON.parse(e.newValue) : null;
        setSelectedCompany(val);
        queryClient.invalidateQueries();
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [queryClient]);

  const selectCompany = useCallback(
    (company: SelectedCompany) => {
      setSelectedCompany(company);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(company));
      queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const clearCompany = useCallback(() => {
    setSelectedCompany(null);
    localStorage.removeItem(STORAGE_KEY);
    queryClient.invalidateQueries();
  }, [queryClient]);

  return (
    <CompanyContext.Provider value={{ selectedCompany, selectCompany, clearCompany, isSuperAdmin }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}
