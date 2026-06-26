import { api } from './axios-instance';
import { ApiResponse, Employee, CreateEmployeeDto, UpdateEmployeeDto, PaginationParams, ConsultantType, UpcomingEvent, TodayEvent } from '@/types';

export const employeesApi = {
  // ── Admin endpoints ──
  getAll: (params?: PaginationParams & { search?: string; consultantType?: string; isActive?: boolean }) =>
    api.get<ApiResponse<Employee[]>>('/employees', { params }),

  /**
   * Export every employee in the company to Excel. Same filter contract
   * as `getAll` so the export matches what the page currently shows
   * (search + isActive + consultant type). Admin hits this route; HR
   * hits the mirrored `/employee/employees/export` below.
   *
   * Sprint 2: `fields` is a CSV of column keys the picker collected
   * (e.g. `'empCode,name,email,annualCtc'`). When omitted the server
   * falls back to the full column set.
   */
  exportAll: (params?: { search?: string; consultantType?: string; isActive?: 'true' | 'false'; fields?: string }) =>
    api.get<Blob>('/employees/export', { params, responseType: 'blob' }),

  /** HR-gated mirror of `exportAll`. */
  employeeExportAll: (params?: { search?: string; consultantType?: string; isActive?: 'true' | 'false'; fields?: string }) =>
    api.get<Blob>('/employee/employees/export', { params, responseType: 'blob' }),

  getOne: (id: number) => api.get<ApiResponse<Employee>>(`/employees/${id}`),

  getAdmin: (id: number) => api.get<ApiResponse<Employee>>(`/employees/admin/${id}`),

  getByType: (type: ConsultantType) =>
    api.get<ApiResponse<Employee[]>>(`/employees/by-type/${type}`),

  create: (dto: CreateEmployeeDto) => api.post<ApiResponse<Employee>>('/employees', dto),

  /**
   * Narrow payroll-identity update — admin / HR / accounts. Backs the
   * Payroll Identity card on the employee detail page. Accepts only
   * PAN / UAN / PF / bank / Annual CTC so accounts users can't reach
   * role / HR / admin toggles via this route.
   */
  updatePayrollIdentity: (
    id: number,
    dto: {
      panNumber?: string;
      uanNumber?: string;
      bankName?: string;
      bankAccountNo?: string;
      bankIfsc?: string;
      annualCTC?: number | null;
    },
  ) =>
    api.patch<ApiResponse<Employee>>(`/employees/${id}/payroll-identity`, dto),

  update: (id: number, dto: UpdateEmployeeDto) =>
    api.patch<ApiResponse<Employee>>(`/employees/${id}`, dto),

  remove: (id: number) => api.delete<ApiResponse<null>>(`/employees/${id}`),

  toggleActive: (id: number) => api.patch(`/employees/${id}/toggle-active`),

  resetPassword: (id: number, newPassword: string) =>
    api.patch(`/employees/${id}/reset-password`, { newPassword }),

  assignProject: (id: number, projectId: number | null) =>
    api.patch<ApiResponse<Employee>>(`/employees/${id}/assign`, { projectId }),

  // ── Employee self-update ──
  updateSelf: (dto: { name?: string; mobileNumber?: string; dateOfBirth?: string; bloodGroup?: string; maritalStatus?: string }) =>
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
