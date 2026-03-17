import { api } from './axios-instance';
import { ApiResponse, EmailLog, PaginationParams } from '@/types';

export interface EmailLogFilter extends PaginationParams {
  search?: string;
  status?: 'sent' | 'failed';
  dateFrom?: string;
  dateTo?: string;
}

export const emailLogsApi = {
  // Admin: company's own email logs
  getAll: (params?: EmailLogFilter) =>
    api.get<ApiResponse<EmailLog[]>>('/admin/email-logs', { params }),

  getOne: (id: number) =>
    api.get<ApiResponse<EmailLog>>(`/admin/email-logs/${id}`),

  // Super admin: all companies
  getAllPlatform: (params?: EmailLogFilter & { companyId?: number }) =>
    api.get<ApiResponse<EmailLog[]>>('/platform/email-logs', { params }),

  getOnePlatform: (id: number) =>
    api.get<ApiResponse<EmailLog>>(`/platform/email-logs/${id}`),
};
