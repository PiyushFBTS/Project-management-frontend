import { api } from './axios-instance';
import { ApiResponse, Project, CreateProjectDto, UpdateProjectDto, PaginationParams, Employee } from '@/types';

export const projectsApi = {
  getAll: (params?: PaginationParams & { search?: string; status?: string; type?: string }) =>
    api.get<ApiResponse<Project[]>>('/projects', { params }),

  getOne: (id: number) => api.get<ApiResponse<Project>>(`/projects/${id}`),

  create: (dto: CreateProjectDto) => api.post<ApiResponse<Project>>('/projects', dto),

  update: (id: number, dto: UpdateProjectDto) =>
    api.patch<ApiResponse<Project>>(`/projects/${id}`, dto),

  remove: (id: number) => api.delete<ApiResponse<null>>(`/projects/${id}`),

  getEmployees: (id: number) => api.get<ApiResponse<Employee[]>>(`/projects/${id}/employees`),

  // Employee: only projects where employee has assigned tickets
  employeeGetAll: () =>
    api.get<ApiResponse<Project[]>>('/employee/projects'),
};
