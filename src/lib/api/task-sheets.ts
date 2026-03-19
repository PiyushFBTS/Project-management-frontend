import { api } from './axios-instance';
import { ApiResponse, DailyTaskSheet, TaskEntry, TaskStatus, PaginationParams, Project, TaskType } from '@/types';

export const taskSheetsApi = {
  // ── Admin endpoints ──
  adminGetAll: (params?: PaginationParams & { employeeId?: number; fromDate?: string; toDate?: string; isSubmitted?: boolean }) =>
    api.get<ApiResponse<DailyTaskSheet[]>>('/admin/task-sheets', { params }),

  adminGetOne: (id: number) =>
    api.get<ApiResponse<DailyTaskSheet>>(`/admin/task-sheets/${id}`),

  // ── Employee endpoints ──
  getToday: () =>
    api.get<ApiResponse<DailyTaskSheet>>('/task-sheets/today'),

  getByDate: (date: string) =>
    api.get<ApiResponse<DailyTaskSheet>>('/task-sheets/by-date', { params: { date } }),

  getHistory: (params?: PaginationParams & { fromDate?: string; toDate?: string }) =>
    api.get<ApiResponse<DailyTaskSheet[]>>('/task-sheets/history', { params }),

  getById: (id: number) =>
    api.get<ApiResponse<DailyTaskSheet>>(`/task-sheets/${id}`),

  submit: (id: number) =>
    api.post<ApiResponse<DailyTaskSheet>>(`/task-sheets/${id}/submit`),

  addEntry: (sheetId: number, data: {
    projectId?: number;
    otherProjectName?: string;
    taskTypeId?: number;
    fromTime: string;
    toTime: string;
    taskDescription: string;
    status?: TaskStatus;
  }) =>
    api.post<ApiResponse<TaskEntry>>(`/task-sheets/${sheetId}/entries`, data),

  updateEntry: (sheetId: number, entryId: number, data: {
    projectId?: number;
    otherProjectName?: string;
    taskTypeId?: number;
    fromTime?: string;
    toTime?: string;
    taskDescription?: string;
    status?: TaskStatus;
  }) =>
    api.patch<ApiResponse<TaskEntry>>(`/task-sheets/${sheetId}/entries/${entryId}`, data),

  deleteEntry: (sheetId: number, entryId: number) =>
    api.delete<ApiResponse<null>>(`/task-sheets/${sheetId}/entries/${entryId}`),

  // ── Employee dropdown data ──
  getProjects: () =>
    api.get<ApiResponse<Project[]>>('/employee/projects/all-active'),

  getTaskTypes: () =>
    api.get<ApiResponse<TaskType[]>>('/employee/task-types'),
};
