import { api } from './axios-instance';
import { ApiResponse, DashboardSummary, ManDaysByType, ManDaysByProject, FillRateTrend, TopEmployee } from '@/types';

export const dashboardApi = {
  getSummary: () =>
    api.get<ApiResponse<DashboardSummary>>('/admin/dashboard/summary'),

  getTaskSummary: () =>
    api.get<ApiResponse<{
      totalTasks: number;
      todoCount: number;
      inProgressCount: number;
      inReviewCount: number;
      doneCount: number;
      byStatus: { status: string; count: string }[];
      byPriority: { priority: string; count: string }[];
    }>>('/admin/dashboard/task-summary'),

  getManDaysByType: (month: string) =>
    api.get<ApiResponse<ManDaysByType[]>>('/admin/dashboard/man-days-by-type', { params: { month } }),

  getManDaysByProject: (month: string) =>
    api.get<ApiResponse<ManDaysByProject[]>>('/admin/dashboard/man-days-by-project', { params: { month } }),

  getFillRateTrend: (days?: number) =>
    api.get<ApiResponse<FillRateTrend[]>>('/admin/dashboard/fill-rate-trend', { params: { days } }),

  getTopEmployees: (month: string, limit?: number) =>
    api.get<ApiResponse<TopEmployee[]>>('/admin/dashboard/top-employees', { params: { month, limit } }),

  // ── Employee endpoints ──
  getPersonalDashboard: () =>
    api.get('/employee/dashboard/personal'),
};
