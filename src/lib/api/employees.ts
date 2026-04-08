import { api } from './axios-instance';
import { ApiResponse, Employee, CreateEmployeeDto, UpdateEmployeeDto, PaginationParams, ConsultantType, UpcomingEvent, TodayEvent } from '@/types';

export const employeesApi = {
  // ── Admin endpoints ──
  getAll: (params?: PaginationParams & { search?: string; consultantType?: string; isActive?: boolean }) =>
    api.get<ApiResponse<Employee[]>>('/employees', { params }),

  getOne: (id: number) => api.get<ApiResponse<Employee>>(`/employees/${id}`),

  getAdmin: (id: number) => api.get<ApiResponse<Employee>>(`/employees/admin/${id}`),

  getByType: (type: ConsultantType) =>
    api.get<ApiResponse<Employee[]>>(`/employees/by-type/${type}`),

  create: (dto: CreateEmployeeDto) => api.post<ApiResponse<Employee>>('/employees', dto),

  update: (id: number, dto: UpdateEmployeeDto) =>
    api.patch<ApiResponse<Employee>>(`/employees/${id}`, dto),

  remove: (id: number) => api.delete<ApiResponse<null>>(`/employees/${id}`),

  toggleActive: (id: number) => api.patch(`/employees/${id}/toggle-active`),

  resetPassword: (id: number, newPassword: string) =>
    api.patch(`/employees/${id}/reset-password`, { newPassword }),

  assignProject: (id: number, projectId: number | null) =>
    api.patch<ApiResponse<Employee>>(`/employees/${id}/assign`, { projectId }),

  // ── Employee self-update ──
  updateSelf: (dto: { empName?: string; mobileNumber?: string; dateOfBirth?: string }) =>
    api.patch<ApiResponse<Employee>>('/employee/employees/me', dto),

  // ── Employee endpoints (read-only) ──
  employeeGetAll: (params?: PaginationParams & { search?: string; consultantType?: string; isActive?: boolean }) =>
    api.get<ApiResponse<Employee[]>>('/employee/employees', { params }),

  employeeGetOne: (id: number) => api.get<ApiResponse<Employee>>(`/employee/employees/${id}`),

  getUpcomingEvents: (days?: number) =>
    api.get<ApiResponse<UpcomingEvent[]>>('/employees/upcoming-events', { params: { days } }),

  employeeGetUpcomingEvents: (days?: number) =>
    api.get<ApiResponse<UpcomingEvent[]>>('/employee/employees/upcoming-events', { params: { days } }),

  getTodayEvents: () =>
    api.get<ApiResponse<TodayEvent[]>>('/employees/today-events'),

  employeeGetTodayEvents: () =>
    api.get<ApiResponse<TodayEvent[]>>('/employee/employees/today-events'),

  // ── Employee Documents (admin endpoint) ──
  getDocuments: (userType: string, userId: number) =>
    api.get(`/employees/documents/${userType}/${userId}`),

  uploadDocument: (userType: string, userId: number, file: File, category: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('category', category);
    return api.post(`/employees/documents/${userType}/${userId}`, fd);
  },

  deleteDocument: (docId: number) =>
    api.delete(`/employees/documents/${docId}`),

  // ── Employee Documents (employee/HR endpoint) ──
  employeeGetDocuments: (userType: string, userId: number) =>
    api.get(`/employee/employees/documents/${userType}/${userId}`),

  employeeUploadDocument: (userType: string, userId: number, file: File, category: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('category', category);
    return api.post(`/employee/employees/documents/${userType}/${userId}`, fd);
  },

  employeeDeleteDocument: (docId: number) =>
    api.delete(`/employee/employees/documents/${docId}`),

  // ── Employee: own documents ──
  getMyDocuments: () =>
    api.get('/employee/employees/me/documents'),

  uploadMyDocument: (file: File, category: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('category', category);
    return api.post('/employee/employees/me/documents', fd);
  },
};
