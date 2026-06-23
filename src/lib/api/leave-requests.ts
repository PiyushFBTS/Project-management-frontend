import { api } from './axios-instance';
import { tokenStorage } from '@/lib/auth/token-storage';
import { ApiResponse, LeaveRequest, LeaveType, PaginationParams, LeaveRequestStatus } from '@/types';

export interface OnLeaveTodayUser {
  id: number;
  leaveRequestId: number;
  name: string;
  empCode: string | null;
  _type: 'admin' | 'employee';
  leaveType: string;
  dateFrom: string;
  dateTo: string;
  totalDays: number;
  /** Approval state — UI badges these as "Approved" / "Pending HR" / "Pending RM". */
  status: 'pending' | 'manager_approved' | 'hr_approved';
  /** Half-day marker (Sprint: half-day leaves). Null on full-day rows. */
  halfDayKind?: 'first_half' | 'second_half' | null;
}

// Admin approve/reject/cancel live under /leave-requests/:id/... (JwtAdminGuard).
// Employees use the /employee/leave-requests/:id/... routes. Auto-route by login type.
function actionPath(id: number, action: 'approve' | 'reject' | 'cancel') {
  return tokenStorage.getLoginType() === 'admin'
    ? `/leave-requests/${id}/${action}`
    : `/employee/leave-requests/${id}/${action}`;
}

export const leaveRequestsApi = {
  // Admin endpoints
  getAll: (params?: PaginationParams & {
    search?: string;
    status?: LeaveRequestStatus;
    employeeId?: number;
    dateFrom?: string;
    dateTo?: string;
  }) =>
    api.get<ApiResponse<LeaveRequest[]>>('/leave-requests', { params }),

  getOne: (id: number) => api.get<ApiResponse<LeaveRequest>>(`/leave-requests/${id}`),

  getReport: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get<ApiResponse<unknown[]>>('/leave-requests/report', { params }),

  // Employee endpoints
  getMyLeaves: (params?: PaginationParams & {
    status?: LeaveRequestStatus;
    dateFrom?: string;
    dateTo?: string;
  }) =>
    api.get<ApiResponse<LeaveRequest[]>>('/employee/leave-requests', { params }),

  getPendingApprovals: (params?: PaginationParams & {
    status?: LeaveRequestStatus;
    dateFrom?: string;
    dateTo?: string;
  }) =>
    api.get<ApiResponse<LeaveRequest[]>>('/employee/leave-requests/pending-approvals', { params }),

  getTeamLeaves: (params?: PaginationParams & {
    status?: LeaveRequestStatus;
    employeeId?: number;
    dateFrom?: string;
    dateTo?: string;
  }) =>
    api.get<ApiResponse<LeaveRequest[]>>('/employee/leave-requests/team', { params }),

  getOneForEmployee: (id: number) =>
    api.get<ApiResponse<LeaveRequest>>(`/employee/leave-requests/${id}`),

  cancelLeave: (id: number) =>
    api.patch<ApiResponse<LeaveRequest>>(actionPath(id, 'cancel')),

  approveLeave: (id: number, remarks?: string) =>
    api.patch<ApiResponse<LeaveRequest>>(actionPath(id, 'approve'), { remarks }),

  rejectLeave: (id: number, remarks?: string) =>
    api.patch<ApiResponse<LeaveRequest>>(actionPath(id, 'reject'), { remarks }),

  getLeaveReasons: () =>
    api.get<ApiResponse<LeaveType[]>>('/employee/leave-types'),

  getColleagues: () =>
    api.get<ApiResponse<{ id: number; name: string; empCode: string }[]>>('/employee/leave-requests/colleagues'),

  submitLeave: (data: {
    leaveReasonId: number;
    dateFrom: string;
    dateTo: string;
    remarks?: string;
    watcherIds?: number[];
    // When set, an HR employee files leave for someone else. The backend
    // stamps the actual caller in `applied_by_*` columns for audit.
    onBehalfOfEmployeeId?: number;
    // Half-day marker. Server rejects unless dateFrom === dateTo.
    halfDayKind?: 'first_half' | 'second_half';
  }) =>
    api.post<ApiResponse<LeaveRequest>>('/employee/leave-requests', data),

  // ── Admin "apply for leave" ────────────────────────────────────────────
  // Admins submit through the admin-guarded /leave-requests root, not the
  // /employee path. Backend stamps adminId (employeeId stays null) so the
  // request still flows through the same approval pipeline. With
  // `onBehalfOfEmployeeId` set, the leave's subject becomes that employee
  // and `applied_by_*` records the admin actor.
  submitAdminLeave: (data: {
    leaveReasonId: number;
    dateFrom: string;
    dateTo: string;
    remarks?: string;
    watcherIds?: number[];
    onBehalfOfEmployeeId?: number;
    halfDayKind?: 'first_half' | 'second_half';
  }) =>
    api.post<ApiResponse<LeaveRequest>>('/leave-requests', data),

  getAdminLeaveTypes: () =>
    api.get<ApiResponse<LeaveType[]>>('/leave-requests/leave-types'),

  getAdminColleagues: () =>
    api.get<ApiResponse<{ id: number; name: string; empCode: string }[]>>('/leave-requests/colleagues'),

  // ── Who's on leave today ──────────────────────────────────────────────
  // Available to admins + employees; routes diverge but the response
  // shape matches.
  getOnLeaveToday: () =>
    api.get<ApiResponse<OnLeaveTodayUser[]>>(
      tokenStorage.getLoginType() === 'admin'
        ? '/leave-requests/on-leave-today'
        : '/employee/leave-requests/on-leave-today',
    ),
};
