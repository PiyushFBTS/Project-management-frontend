import { api } from './axios-instance';
import { ApiResponse, LeaveRequest, LeaveType, PaginationParams, LeaveRequestStatus } from '@/types';

export const leaveRequestsApi = {
  // Admin endpoints
  getAll: (params?: PaginationParams & {
    search?: string;
    status?: LeaveRequestStatus;
    employeeId?: number;
    dateFrom?: string;
    dateTo?: string;
  }) =>
    api.get<ApiResponse<LeaveRequest[]>>('/leave-requests', { params }),

  getOne: (id: number) => api.get<ApiResponse<LeaveRequest>>(`/leave-requests/${id}`),

  getReport: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get<ApiResponse<unknown[]>>('/leave-requests/report', { params }),

  // Employee endpoints
  getMyLeaves: (params?: PaginationParams & {
    status?: LeaveRequestStatus;
    dateFrom?: string;
    dateTo?: string;
  }) =>
    api.get<ApiResponse<LeaveRequest[]>>('/employee/leave-requests', { params }),

  getPendingApprovals: (params?: PaginationParams & {
    status?: LeaveRequestStatus;
    dateFrom?: string;
    dateTo?: string;
  }) =>
    api.get<ApiResponse<LeaveRequest[]>>('/employee/leave-requests/pending-approvals', { params }),

  getTeamLeaves: (params?: PaginationParams & {
    status?: LeaveRequestStatus;
    employeeId?: number;
    dateFrom?: string;
    dateTo?: string;
  }) =>
    api.get<ApiResponse<LeaveRequest[]>>('/employee/leave-requests/team', { params }),

  getOneForEmployee: (id: number) =>
    api.get<ApiResponse<LeaveRequest>>(`/employee/leave-requests/${id}`),

  cancelLeave: (id: number) =>
    api.patch<ApiResponse<LeaveRequest>>(`/employee/leave-requests/${id}/cancel`),

  approveLeave: (id: number, remarks?: string) =>
    api.patch<ApiResponse<LeaveRequest>>(`/employee/leave-requests/${id}/approve`, { remarks }),

  rejectLeave: (id: number, remarks?: string) =>
    api.patch<ApiResponse<LeaveRequest>>(`/employee/leave-requests/${id}/reject`, { remarks }),

  getLeaveReasons: () =>
    api.get<ApiResponse<LeaveType[]>>('/employee/leave-types'),

  getColleagues: () =>
    api.get<ApiResponse<{ id: number; empName: string; empCode: string }[]>>('/employee/leave-requests/colleagues'),

  submitLeave: (data: {
    leaveReasonId: number;
    dateFrom: string;
    dateTo: string;
    remarks?: string;
    watcherIds?: number[];
  }) =>
    api.post<ApiResponse<LeaveRequest>>('/employee/leave-requests', data),
};
