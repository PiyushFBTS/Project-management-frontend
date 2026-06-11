import { api } from './axios-instance';
import { tokenStorage } from '@/lib/auth/token-storage';
import { ApiResponse, WfhRequest, WfhRequestStatus, PaginationParams } from '@/types';

/**
 * Mirror of {@link OnLeaveTodayUser} for the calendar overlay — same
 * shape so the existing calendar grid can swap data source without
 * branching on the response.
 */
export interface OnWfhTodayUser {
  id: number;
  wfhRequestId: number;
  name: string;
  empCode: string | null;
  _type: 'admin' | 'employee';
  dateFrom: string;
  dateTo: string;
  totalDays: number;
  status: 'pending' | 'manager_approved' | 'hr_approved';
}

// Admin actions live under /wfh-requests/:id/..., employee actions
// under /employee/wfh-requests/:id/... — auto-route by login type the
// same way `leaveRequestsApi.actionPath` does.
function actionPath(id: number, action: 'approve' | 'reject' | 'cancel') {
  return tokenStorage.getLoginType() === 'admin'
    ? `/wfh-requests/${id}/${action}`
    : `/employee/wfh-requests/${id}/${action}`;
}

export const wfhRequestsApi = {
  // ── Admin endpoints ────────────────────────────────────────────────
  getAll: (params?: PaginationParams & {
    search?: string;
    status?: WfhRequestStatus;
    employeeId?: number;
    dateFrom?: string;
    dateTo?: string;
  }) =>
    api.get<ApiResponse<WfhRequest[]>>('/wfh-requests', { params }),

  getOne: (id: number) =>
    api.get<ApiResponse<WfhRequest>>(`/wfh-requests/${id}`),

  // ── Employee endpoints ─────────────────────────────────────────────
  getMyRequests: (params?: PaginationParams & {
    status?: WfhRequestStatus;
    dateFrom?: string;
    dateTo?: string;
  }) =>
    api.get<ApiResponse<WfhRequest[]>>('/employee/wfh-requests', { params }),

  getPendingApprovals: (params?: PaginationParams & {
    status?: WfhRequestStatus;
    dateFrom?: string;
    dateTo?: string;
  }) =>
    api.get<ApiResponse<WfhRequest[]>>('/employee/wfh-requests/pending-approvals', { params }),

  getTeamRequests: (params?: PaginationParams & {
    status?: WfhRequestStatus;
    employeeId?: number;
    dateFrom?: string;
    dateTo?: string;
  }) =>
    api.get<ApiResponse<WfhRequest[]>>('/employee/wfh-requests/team', { params }),

  getOneForEmployee: (id: number) =>
    api.get<ApiResponse<WfhRequest>>(`/employee/wfh-requests/${id}`),

  cancel: (id: number) =>
    api.patch<ApiResponse<WfhRequest>>(actionPath(id, 'cancel')),

  approve: (id: number, remarks?: string) =>
    api.patch<ApiResponse<WfhRequest>>(actionPath(id, 'approve'), { remarks }),

  reject: (id: number, remarks?: string) =>
    api.patch<ApiResponse<WfhRequest>>(actionPath(id, 'reject'), { remarks }),

  getColleagues: () =>
    api.get<ApiResponse<{ id: number; name: string; empCode: string }[]>>(
      '/employee/wfh-requests/colleagues',
    ),

  getAdminColleagues: () =>
    api.get<ApiResponse<{ id: number; name: string; empCode: string }[]>>(
      '/wfh-requests/colleagues',
    ),

  // ── Apply ───────────────────────────────────────────────────────────
  submit: (data: {
    dateFrom: string;
    dateTo: string;
    reason: string;
    watcherIds?: number[];
    onBehalfOfEmployeeId?: number;
  }) =>
    api.post<ApiResponse<WfhRequest>>('/employee/wfh-requests', data),

  submitAdmin: (data: {
    dateFrom: string;
    dateTo: string;
    reason: string;
    watcherIds?: number[];
    onBehalfOfEmployeeId?: number;
  }) =>
    api.post<ApiResponse<WfhRequest>>('/wfh-requests', data),

  // ── Calendar overlay feed ──────────────────────────────────────────
  getOnWfhToday: () =>
    api.get<ApiResponse<OnWfhTodayUser[]>>(
      tokenStorage.getLoginType() === 'admin'
        ? '/wfh-requests/on-wfh-today'
        : '/employee/wfh-requests/on-wfh-today',
    ),
};
