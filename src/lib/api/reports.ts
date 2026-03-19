import { api } from './axios-instance';
import { ApiResponse, EmployeeWiseReport, ProjectWiseReport, DailyFillReport, LastFilledRow } from '@/types';

export const reportsApi = {
  getEmployeeWise: (fromDate: string, toDate: string, consultantType?: string) =>
    api.get<ApiResponse<EmployeeWiseReport[]>>('/admin/reports/employee-wise', {
      params: { from_date: fromDate, to_date: toDate, consultant_type: consultantType },
    }),

  getProjectWise: (month: string) =>
    api.get<ApiResponse<ProjectWiseReport[]>>('/admin/reports/project-wise', { params: { month } }),

  getDailyFill: (date: string) =>
    api.get<ApiResponse<DailyFillReport>>('/admin/reports/daily-fill', { params: { date } }),

  exportEmployeeWise: (fromDate: string, toDate: string) =>
    api.get('/admin/reports/export/employee-wise', {
      params: { from_date: fromDate, to_date: toDate },
      responseType: 'blob',
    }),

  exportProjectWise: (month: string) =>
    api.get('/admin/reports/export/project-wise', {
      params: { month },
      responseType: 'blob',
    }),

  getLastFilled: () =>
    api.get<ApiResponse<LastFilledRow[]>>('/admin/reports/last-filled'),

  // ── Employee endpoints ──
  employeeGetEmployeeWise: (fromDate: string, toDate: string, consultantType?: string) =>
    api.get<ApiResponse<EmployeeWiseReport[]>>('/employee/reports/employee-wise', {
      params: { from_date: fromDate, to_date: toDate, consultant_type: consultantType },
    }),

  employeeGetProjectWise: (month: string) =>
    api.get<ApiResponse<ProjectWiseReport[]>>('/employee/reports/project-wise', { params: { month } }),

  employeeGetDailyFill: (date: string) =>
    api.get<ApiResponse<DailyFillReport>>('/employee/reports/daily-fill', { params: { date } }),

  employeeGetLastFilled: () =>
    api.get<ApiResponse<LastFilledRow[]>>('/employee/reports/last-filled'),
};
