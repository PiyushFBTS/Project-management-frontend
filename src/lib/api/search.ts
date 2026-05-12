import { api } from './axios-instance';
import { tokenStorage } from '@/lib/auth/token-storage';

/**
 * Result shape returned by `/admin/search` and `/employee/search`.
 * Matches the SearchService DTO on the backend.
 */
export interface SearchTicket {
  id: number;
  ticketNumber: string | null;
  title: string;
  status: string;
  priority: string;
  projectId: number;
  projectName: string | null;
  projectCode: string | null;
}
export interface SearchEmployee {
  id: number;
  empCode: string;
  empName: string;
  email: string;
  consultantType: string | null;
  isActive: boolean;
}
export interface SearchProject {
  id: number;
  projectCode: string | null;
  projectName: string;
  status: string | null;
}
export interface GlobalSearchResults {
  query: string;
  tickets: SearchTicket[];
  employees: SearchEmployee[];
  projects: SearchProject[];
}

export const searchApi = {
  /**
   * Auto-routes to the admin or employee endpoint based on login type.
   * Clients aren't supported in v1 (their visibility is so narrow that
   * a global palette adds little value). The backend will reject if a
   * client token is somehow used.
   */
  global: (query: string, opts?: { limit?: number; signal?: AbortSignal }) => {
    const loginType = tokenStorage.getLoginType();
    const path = loginType === 'admin' ? '/admin/search' : '/employee/search';
    return api.get<{ success: boolean; data: GlobalSearchResults }>(path, {
      params: { q: query, limit: opts?.limit ?? 8 },
      signal: opts?.signal,
    });
  },
};
