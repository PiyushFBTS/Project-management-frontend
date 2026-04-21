import { api } from './axios-instance';
import { tokenStorage } from '@/lib/auth/token-storage';
import { ApiResponse, DailyTaskSheet, TaskEntry, TaskStatus, PaginationParams, Project, TaskType } from '@/types';

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

  addEntry: (sheetId: number, data: {
    projectId?: number;
    otherProjectName?: string;
    taskTypeId?: number;
    ticketId?: number | null;
    activityType?: string | null;
    fromTime: string;
    toTime: string;
    taskDescription: string;
    status?: TaskStatus;
  }) =>
    api.post<ApiResponse<TaskEntry>>(`${base()}/${sheetId}/entries`, data),

  updateEntry: (sheetId: number, entryId: number, data: {
    projectId?: number;
    otherProjectName?: string;
    taskTypeId?: number;
    ticketId?: number | null;
    activityType?: string | null;
    fromTime?: string;
    toTime?: string;
    taskDescription?: string;
    status?: TaskStatus;
  }) =>
    api.patch<ApiResponse<TaskEntry>>(`${base()}/${sheetId}/entries/${entryId}`, data),

  deleteEntry: (sheetId: number, entryId: number) =>
    api.delete<ApiResponse<null>>(`${base()}/${sheetId}/entries/${entryId}`),

  // ── Dropdown data (admin uses admin endpoints, employees the scoped ones) ──
  getProjects: () => {
    const isAdmin = tokenStorage.getLoginType() === 'admin';
    return api.get<ApiResponse<Project[]>>(isAdmin ? '/projects/all-active' : '/employee/projects/all-active');
  },

  getTaskTypes: () => {
    const isAdmin = tokenStorage.getLoginType() === 'admin';
    return api.get<ApiResponse<TaskType[]>>(isAdmin ? '/task-types' : '/employee/task-types');
  },
};
