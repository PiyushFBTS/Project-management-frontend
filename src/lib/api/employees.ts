import { api } from './axios-instance';
import { ApiResponse, Employee, CreateEmployeeDto, UpdateEmployeeDto, PaginationParams, ConsultantType } from '@/types';

export const employeesApi = {
  // ── Admin endpoints ──
  getAll: (params?: PaginationParams & { search?: string; consultantType?: string; isActive?: boolean }) =>
    api.get<ApiResponse<Employee[]>>('/employees', { params }),

  getOne: (id: number) => api.get<ApiResponse<Employee>>(`/employees/${id}`),

  getByType: (type: ConsultantType) =>
    api.get<ApiResponse<Employee[]>>(`/employees/by-type/${type}`),

  create: (dto: CreateEmployeeDto) => api.post<ApiResponse<Employee>>('/employees', dto),

  update: (id: number, dto: UpdateEmployeeDto) =>
    api.patch<ApiResponse<Employee>>(`/employees/${id}`, dto),

  remove: (id: number) => api.delete<ApiResponse<null>>(`/employees/${id}`),

  assignProject: (id: number, projectId: number | null) =>
    api.patch<ApiResponse<Employee>>(`/employees/${id}/assign`, { projectId }),

  // ── Employee endpoints (read-only) ──
  employeeGetAll: (params?: PaginationParams & { search?: string; consultantType?: string; isActive?: boolean }) =>
    api.get<ApiResponse<Employee[]>>('/employee/employees', { params }),

  employeeGetOne: (id: number) => api.get<ApiResponse<Employee>>(`/employee/employees/${id}`),
};
