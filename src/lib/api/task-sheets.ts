import { api } from './axios-instance';
import { tokenStorage } from '@/lib/auth/token-storage';
import { ApiResponse, DailyTaskSheet, TaskEntry, TaskStatus, PaginationParams, Project, TaskSheetApproval } from '@/types';

// Auto-route "my task sheet" endpoints based on login type.
// Admin → /admin/task-sheets/my/* (bridged via email to an employee record)
// Employee/HR → /task-sheets/*
function base() {
  return tokenStorage.getLoginType() === 'admin' ? '/admin/task-sheets/my' : '/task-sheets';
}

export const taskSheetsApi = {
  // ── Admin (team) endpoints ──
  adminGetAll: (params?: PaginationParams & { employeeId?: number; fromDate?: string; toDate?: string; isSubmitted?: boolean }) =>
    api.get<ApiResponse<DailyTaskSheet[]>>('/admin/task-sheets', { params }),

  adminGetOne: (id: number) =>
    api.get<ApiResponse<DailyTaskSheet>>(`/admin/task-sheets/${id}`),

  // ── Self endpoints (routed by login type) ──
  getToday: () =>
    api.get<ApiResponse<DailyTaskSheet>>(`${base()}/today`),

  getByDate: (date: string) =>
    api.get<ApiResponse<DailyTaskSheet>>(`${base()}/by-date`, { params: { date } }),

  getHistory: (params?: PaginationParams & { fromDate?: string; toDate?: string }) =>
    api.get<ApiResponse<DailyTaskSheet[]>>(`${base()}/history`, { params }),

  getById: (id: number) => {
    // Admin reads any sheet via /admin/task-sheets/:id; employee via /task-sheets/:id.
    const isAdmin = tokenStorage.getLoginType() === 'admin';
    const path = isAdmin ? `/admin/task-sheets/${id}` : `/task-sheets/${id}`;
    return api.get<ApiResponse<DailyTaskSheet>>(path);
  },

  submit: (id: number) =>
    api.post<ApiResponse<DailyTaskSheet>>(`${base()}/${id}/submit`),

  /**
   * Full PM-approval audit history for the sheet — every project segment,
   * every round, newest round first. Backend mounts the read on the
   * employee controller so admins also see it via the same path.
   */
  getApprovals: (id: number) =>
    api.get<ApiResponse<TaskSheetApproval[]>>(`/task-sheets/${id}/approvals`),

  addEntry: (sheetId: number, data: {
    projectId?: number;
    otherProjectName?: string;
    ticketId?: number | null;
    activityType?: string | null;
    fromTime: string;
    toTime: string;
    taskDescription: string;
    blockers?: string | null;
    status?: TaskStatus;
    taskApproverId?: number | null;
  }) =>
    api.post<ApiResponse<TaskEntry>>(`${base()}/${sheetId}/entries`, data),

  updateEntry: (sheetId: number, entryId: number, data: {
    projectId?: number;
    otherProjectName?: string;
    ticketId?: number | null;
    activityType?: string | null;
    fromTime?: string;
    toTime?: string;
    taskDescription?: string;
    blockers?: string | null;
    status?: TaskStatus;
    taskApproverId?: number | null;
  }) =>
    api.patch<ApiResponse<TaskEntry>>(`${base()}/${sheetId}/entries/${entryId}`, data),

  deleteEntry: (sheetId: number, entryId: number) =>
    api.delete<ApiResponse<null>>(`${base()}/${sheetId}/entries/${entryId}`),

  // ── Export Task Sheet History (Excel) ──
  // Self export — routed by login type (admin → my/export-history, employee → /export-history).
  exportHistory: (params?: { fromDate?: string; toDate?: string }) =>
    api.get(`${base()}/export-history`, {
      params,
      responseType: 'blob',
    }),

  // Admin team export — full company sheets with filters.
  adminExportTeam: (params?: {
    fromDate?: string;
    toDate?: string;
    employeeId?: number;
    isSubmitted?: boolean;
  }) =>
    api.get('/admin/task-sheets/export', {
      params,
      responseType: 'blob',
    }),

  // ── Dropdown data (admin uses admin endpoints, employees the scoped ones) ──
  getProjects: () => {
    const isAdmin = tokenStorage.getLoginType() === 'admin';
    return api.get<ApiResponse<Project[]>>(isAdmin ? '/projects/all-active' : '/employee/projects/all-active');
  },
};

// ── PM approval inbox ─────────────────────────────────────────────────────
// Endpoints sit on /pm/task-approvals (employee JWT). A user with no PM
// assignments simply sees an empty list; admins/HR also see null-project
// rows (the "no project" bucket).
export const pmTaskApprovalsApi = {
  list: (status?: 'pending' | 'approved' | 'rejected') =>
    api.get<ApiResponse<TaskSheetApproval[]>>('/pm/task-approvals', {
      params: status ? { status } : undefined,
    }),

  getOne: (id: number) =>
    api.get<ApiResponse<TaskSheetApproval>>(`/pm/task-approvals/${id}`),

  approve: (id: number, notes?: string) =>
    api.post<ApiResponse<TaskSheetApproval>>(
      `/pm/task-approvals/${id}/approve`,
      { notes },
    ),

  reject: (id: number, notes: string) =>
    api.post<ApiResponse<TaskSheetApproval>>(
      `/pm/task-approvals/${id}/reject`,
      { notes },
    ),
};
