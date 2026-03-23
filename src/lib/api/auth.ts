import { api } from './axios-instance';
import { ApiResponse, AdminUser, Employee } from '@/types';

export const authApi = {
  // Admin
  login: (email: string, password: string) =>
    api.post<ApiResponse<{ accessToken: string; refreshToken: string; user: AdminUser }>>(
      '/auth/admin/login',
      { email, password },
    ),

  getProfile: () => api.get<ApiResponse<AdminUser>>('/auth/profile'),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch<ApiResponse<null>>('/auth/change-password', { currentPassword, newPassword }),

  // Employee
  loginEmployee: (email: string, password: string) =>
    api.post<ApiResponse<{ accessToken: string; refreshToken: string; user: Employee }>>(
      '/auth/employee/login',
      { email, password },
    ),

  getEmployeeProfile: () => api.get<ApiResponse<Employee>>('/auth/employee/profile'),

  // Client
  loginClient: (email: string, password: string) =>
    api.post<ApiResponse<{ accessToken: string; refreshToken: string; user: any }>>(
      '/auth/client/login',
      { email, password },
    ),

  getClientProfile: () => api.get<ApiResponse<any>>('/auth/client/profile'),
};
