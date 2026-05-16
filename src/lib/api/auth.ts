import { api } from './axios-instance';
import { ApiResponse } from '@/types';

/**
 * Auth API surface after the admin_users + employees → users merge.
 *
 * `login()` is the ONE endpoint for every login surface. The backend
 * looks up the email in `users` first (admin + employee) and falls
 * back to `clients`. The response carries `user.userType` so the
 * caller can branch without inspecting field presence.
 *
 *   - 'admin' | 'employee' → merged-table user; `accessToken` only.
 *   - 'client'             → client portal; both `accessToken` and
 *                            `refreshToken`, and a client-shaped user.
 */

export type UserType = 'admin' | 'employee' | 'client';
export type UserRole = 'super_admin' | 'admin';

export interface MergedUser {
  id: number;
  name: string;
  email: string;
  userType: 'admin' | 'employee';
  role: UserRole | null;
  isHr: boolean;
  isAccounts: boolean;
  companyId: number | null;
  empCode?: string | null;
  consultantType?: string | null;
  mobileNumber?: string | null;
  assignedProjectId?: number | null;
}

export interface ClientLoginUser {
  id: number;
  fullName: string;
  email: string;
  mobileNumber?: string | null;
  projectId: number;
  projectName: string | null;
  companyId: number;
  companyName: string | null;
  companyLogoUrl: string | null;
  userType: 'client';
}

export type LoginResponse =
  | { accessToken: string; refreshToken: string; user: MergedUser }
  | { accessToken: string; refreshToken: string; user: ClientLoginUser };

export const authApi = {
  // ── Unified login (user OR client — backend cascades) ──
  login: (email: string, password: string) =>
    api.post<ApiResponse<LoginResponse>>('/auth/login', { email, password }),

  me: () => api.get<ApiResponse<MergedUser>>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch<ApiResponse<null>>('/auth/change-password', { currentPassword, newPassword }),

  getClientProfile: () => api.get<ApiResponse<ClientLoginUser>>('/auth/client/profile'),
};
