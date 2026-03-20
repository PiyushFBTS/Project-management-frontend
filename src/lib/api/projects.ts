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

  getManagers: () =>
    api.get<ApiResponse<{ id: number; empName: string; empCode: string }[]>>('/projects/managers/list'),

  // Employee: only projects where employee has assigned tickets
  employeeGetAll: () =>
    api.get<ApiResponse<Project[]>>('/employee/projects'),

  employeeGetOne: (id: number) =>
    api.get<ApiResponse<Project>>(`/employee/projects/${id}`),

  // Documents (admin)
  getDocuments: (projectId: number) =>
    api.get(`/projects/${projectId}/documents`),

  uploadDocument: (projectId: number, file: File, category: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('category', category);
    return api.post(`/projects/${projectId}/documents`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteDocument: (projectId: number, docId: number) =>
    api.delete(`/projects/${projectId}/documents/${docId}`),

  // Documents (employee)
  employeeGetDocuments: (projectId: number) =>
    api.get(`/employee/projects/${projectId}/documents`),

  employeeUploadDocument: (projectId: number, file: File, category: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('category', category);
    return api.post(`/employee/projects/${projectId}/documents`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  employeeDeleteDocument: (projectId: number, docId: number) =>
    api.delete(`/employee/projects/${projectId}/documents/${docId}`),
};
