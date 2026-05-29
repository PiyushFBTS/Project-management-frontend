import { api } from './axios-instance';
import { tokenStorage } from '@/lib/auth/token-storage';
import { ApiResponse, Project, CreateProjectDto, UpdateProjectDto, PaginationParams, Employee, ProjectGroup } from '@/types';

export interface ProjectGroupDto {
  name: string;
  code?: string;
  clientName?: string;
  description?: string;
}

export interface ProjectMember {
  id: number;
  name: string;
  empCode: string | null;
  email: string;
  consultantType: string | null;
  isActive: boolean;
  memberSince: string;
}

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

  // ── Project members (admin via /projects, HR via /employee/projects) ──
  getMembers: (projectId: number) =>
    api.get<ApiResponse<ProjectMember[]>>(`${projectsBase()}/${projectId}/members`),

  addMembers: (projectId: number, userIds: number[]) =>
    api.post<ApiResponse<{ added: number[]; skipped: number[] }>>(
      `${projectsBase()}/${projectId}/members`,
      { userIds },
    ),

  removeMember: (projectId: number, userId: number) =>
    api.delete<ApiResponse<{ removed: number }>>(
      `${projectsBase()}/${projectId}/members/${userId}`,
    ),

  getManagers: () =>
    api.get<ApiResponse<{ id: number; name: string; empCode: string }[]>>('/projects/managers/list'),

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

  // Project Groups (primary-name umbrellas) — admins use /projects,
  // employees/HR use /employee/projects (reads open, writes HR-only).
  getGroups: (search?: string) =>
    api.get<ApiResponse<ProjectGroup[]>>(`${projectsBase()}/groups/list`, {
      params: search ? { search } : undefined,
    }),

  getGroup: (id: number) =>
    api.get<ApiResponse<ProjectGroup>>(`${projectsBase()}/groups/${id}`),

  createGroup: (dto: ProjectGroupDto) =>
    api.post<ApiResponse<ProjectGroup>>(`${projectsBase()}/groups`, dto),

  updateGroup: (id: number, dto: Partial<ProjectGroupDto>) =>
    api.patch<ApiResponse<ProjectGroup>>(`${projectsBase()}/groups/${id}`, dto),

  deleteGroup: (id: number) =>
    api.delete<ApiResponse<{ ungrouped: number }>>(`${projectsBase()}/groups/${id}`),

  // Bulk-fold existing projects into a group (migration helper).
  assignProjectsToGroup: (groupId: number, projectIds: number[]) =>
    api.post<ApiResponse<{ assigned: number }>>(`${projectsBase()}/groups/${groupId}/assign`, { projectIds }),
};
