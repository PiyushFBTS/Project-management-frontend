import { api } from './axios-instance';
import { tokenStorage } from '@/lib/auth/token-storage';
import { ApiResponse, Project, CreateProjectDto, UpdateProjectDto, PaginationParams, Employee } from '@/types';

function projectsBase() {
  return tokenStorage.getLoginType() === 'admin' ? '/projects' : '/employee/projects';
}

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

  // Employee: only projects where employee has assigned tickets (HR sees all,
  // optionally filtered by status).
  employeeGetAll: (params?: { status?: string }) =>
    api.get<ApiResponse<Project[]>>('/employee/projects', { params }),

  employeeGetOne: (id: number) =>
    api.get<ApiResponse<Project>>(`/employee/projects/${id}`),

  employeeGetClients: (projectId: number) =>
    api.get(`/employee/projects/${projectId}/clients`),

  // Documents (admin)
  getDocuments: (projectId: number) =>
    api.get(`/projects/${projectId}/documents`),

  uploadDocument: (projectId: number, file: File, category: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('category', category);
    return api.post(`/projects/${projectId}/documents`, fd, {
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
    });
  },

  employeeDeleteDocument: (projectId: number, docId: number) =>
    api.delete(`/employee/projects/${projectId}/documents/${docId}`),

  // Client: own project
  clientGetProject: () =>
    api.get('/client/project'),

  // Client: documents (read-only)
  clientGetDocuments: (_projectId: number) =>
    api.get('/client/documents'),

  // Client users
  getClients: (projectId: number) =>
    api.get(`/projects/${projectId}/clients`),

  createClient: (projectId: number, dto: { fullName: string; email: string; password: string; mobileNumber?: string }) =>
    api.post(`/projects/${projectId}/clients`, dto),

  deleteClient: (projectId: number, clientId: number) =>
    api.delete(`/projects/${projectId}/clients/${clientId}`),

  // Milestones
  getMilestones: (projectId: number) =>
    api.get(`/projects/${projectId}/milestones`),

  createMilestone: (projectId: number, dto: { name: string; expectedPercentage: number; expectedAmount: number; receivedPercentage?: number; receivedAmount?: number }) =>
    api.post(`/projects/${projectId}/milestones`, dto),

  bulkCreateMilestones: (projectId: number, milestones: Array<{ name: string; expectedPercentage: number; expectedAmount: number; receivedPercentage?: number; receivedAmount?: number }>) =>
    api.post(`/projects/${projectId}/milestones/bulk`, { milestones }),

  updateMilestone: (projectId: number, milestoneId: number, dto: { name?: string; expectedPercentage?: number; expectedAmount?: number; receivedPercentage?: number; receivedAmount?: number }) =>
    api.patch(`/projects/${projectId}/milestones/${milestoneId}`, dto),

  deleteMilestone: (projectId: number, milestoneId: number) =>
    api.delete(`/projects/${projectId}/milestones/${milestoneId}`),

  // Project Types — admins use /projects, employees (incl. HR) use /employee/projects
  getProjectTypes: () =>
    api.get(`${projectsBase()}/types/list`),

  createProjectType: (dto: { value: string; label: string; description?: string }) =>
    api.post(`${projectsBase()}/types`, dto),

  deleteProjectType: (typeId: number) =>
    api.delete(`${projectsBase()}/types/${typeId}`),
};
