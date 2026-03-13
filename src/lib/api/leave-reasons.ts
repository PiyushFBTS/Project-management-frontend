import { api } from './axios-instance';
import { ApiResponse, LeaveType, CreateLeaveTypeDto, UpdateLeaveTypeDto, PaginationParams } from '@/types';

export const leaveTypesApi = {
  getAll: (params?: PaginationParams & { search?: string; isActive?: boolean }) =>
    api.get<ApiResponse<LeaveType[]>>('/leave-types', { params }),

  getOne: (id: number) => api.get<ApiResponse<LeaveType>>(`/leave-types/${id}`),

  create: (dto: CreateLeaveTypeDto) => api.post<ApiResponse<LeaveType>>('/leave-types', dto),

  update: (id: number, dto: UpdateLeaveTypeDto) =>
    api.patch<ApiResponse<LeaveType>>(`/leave-types/${id}`, dto),

  remove: (id: number) => api.delete<ApiResponse<null>>(`/leave-types/${id}`),

  // ── Employee endpoints ──
  employeeGetAll: (params?: PaginationParams & { search?: string; isActive?: boolean }) =>
    api.get<ApiResponse<LeaveType[]>>('/employee/leave-types', { params }),

  employeeGetOne: (id: number) => api.get<ApiResponse<LeaveType>>(`/employee/leave-types/${id}`),

  employeeCreate: (dto: CreateLeaveTypeDto) => api.post<ApiResponse<LeaveType>>('/employee/leave-types', dto),

  employeeUpdate: (id: number, dto: UpdateLeaveTypeDto) =>
    api.patch<ApiResponse<LeaveType>>(`/employee/leave-types/${id}`, dto),

  employeeRemove: (id: number) => api.delete<ApiResponse<null>>(`/employee/leave-types/${id}`),
};
