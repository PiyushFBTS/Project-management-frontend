import { api } from './axios-instance';
import { tokenStorage } from '@/lib/auth/token-storage';
import { ApiResponse, WeeklyOffRequest, WeeklyOffRequestStatus, PaginationParams } from '@/types';

// Admin actions live under /weekly-off-requests/:id/..., employee actions
// under /employee/weekly-off-requests/:id/... — auto-route by login type.
function actionPath(id: number, action: 'approve' | 'reject' | 'cancel') {
  return tokenStorage.getLoginType() === 'admin'
    ? `/weekly-off-requests/${id}/${action}`
    : `/employee/weekly-off-requests/${id}/${action}`;
}

interface SubmitPayload {
  offDate: string;
  workDate: string;
  reason?: string;
  onBehalfOfEmployeeId?: number;
}

export const weeklyOffRequestsApi = {
  // ── Admin ──────────────────────────────────────────────────────────
  getAll: (params?: PaginationParams & {
    search?: string;
    status?: WeeklyOffRequestStatus;
    employeeId?: number;
    dateFrom?: string;
    dateTo?: string;
  }) => api.get<ApiResponse<WeeklyOffRequest[]>>('/weekly-off-requests', { params }),

  getOne: (id: number) =>
    api.get<ApiResponse<WeeklyOffRequest>>(`/weekly-off-requests/${id}`),

  submitAdmin: (data: SubmitPayload) =>
    api.post<ApiResponse<WeeklyOffRequest>>('/weekly-off-requests', data),

  getAdminColleagues: () =>
    api.get<ApiResponse<{ id: number; name: string; empCode: string }[]>>('/weekly-off-requests/colleagues'),

  // ── Employee ───────────────────────────────────────────────────────
  getMyRequests: (params?: PaginationParams & {
    status?: WeeklyOffRequestStatus;
    dateFrom?: string;
    dateTo?: string;
  }) => api.get<ApiResponse<WeeklyOffRequest[]>>('/employee/weekly-off-requests', { params }),

  getPendingApprovals: (params?: PaginationParams & {
    status?: WeeklyOffRequestStatus;
    dateFrom?: string;
    dateTo?: string;
  }) => api.get<ApiResponse<WeeklyOffRequest[]>>('/employee/weekly-off-requests/pending-approvals', { params }),

  getTeamRequests: (params?: PaginationParams & {
    status?: WeeklyOffRequestStatus;
    employeeId?: number;
    dateFrom?: string;
    dateTo?: string;
  }) => api.get<ApiResponse<WeeklyOffRequest[]>>('/employee/weekly-off-requests/team', { params }),

  getOneForEmployee: (id: number) =>
    api.get<ApiResponse<WeeklyOffRequest>>(`/employee/weekly-off-requests/${id}`),

  getColleagues: () =>
    api.get<ApiResponse<{ id: number; name: string; empCode: string }[]>>('/employee/weekly-off-requests/colleagues'),

  submit: (data: SubmitPayload) =>
    api.post<ApiResponse<WeeklyOffRequest>>('/employee/weekly-off-requests', data),

  update: (id: number, data: Omit<SubmitPayload, 'onBehalfOfEmployeeId'>) =>
    api.patch<ApiResponse<WeeklyOffRequest>>(`/employee/weekly-off-requests/${id}`, data),

  // ── Shared actions (routed by login type) ──────────────────────────
  cancel: (id: number) =>
    api.patch<ApiResponse<WeeklyOffRequest>>(actionPath(id, 'cancel')),

  approve: (id: number, remarks?: string) =>
    api.patch<ApiResponse<WeeklyOffRequest>>(actionPath(id, 'approve'), { remarks }),

  reject: (id: number, remarks?: string) =>
    api.patch<ApiResponse<WeeklyOffRequest>>(actionPath(id, 'reject'), { remarks }),
};
