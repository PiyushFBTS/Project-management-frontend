import { api } from './axios-instance';
import { ApiResponse, LeaveReason, CreateLeaveReasonDto, UpdateLeaveReasonDto, PaginationParams } from '@/types';

export const leaveReasonsApi = {
  getAll: (params?: PaginationParams & { search?: string; isActive?: boolean }) =>
    api.get<ApiResponse<LeaveReason[]>>('/leave-reasons', { params }),

  getOne: (id: number) => api.get<ApiResponse<LeaveReason>>(`/leave-reasons/${id}`),

  create: (dto: CreateLeaveReasonDto) => api.post<ApiResponse<LeaveReason>>('/leave-reasons', dto),

  update: (id: number, dto: UpdateLeaveReasonDto) =>
    api.patch<ApiResponse<LeaveReason>>(`/leave-reasons/${id}`, dto),

  remove: (id: number) => api.delete<ApiResponse<null>>(`/leave-reasons/${id}`),

  // ── Employee endpoints ──
  employeeGetAll: (params?: PaginationParams & { search?: string; isActive?: boolean }) =>
    api.get<ApiResponse<LeaveReason[]>>('/employee/leave-reasons', { params }),

  employeeGetOne: (id: number) => api.get<ApiResponse<LeaveReason>>(`/employee/leave-reasons/${id}`),

  employeeCreate: (dto: CreateLeaveReasonDto) => api.post<ApiResponse<LeaveReason>>('/employee/leave-reasons', dto),

  employeeUpdate: (id: number, dto: UpdateLeaveReasonDto) =>
    api.patch<ApiResponse<LeaveReason>>(`/employee/leave-reasons/${id}`, dto),

  employeeRemove: (id: number) => api.delete<ApiResponse<null>>(`/employee/leave-reasons/${id}`),
};
