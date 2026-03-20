import { api } from './axios-instance';
import {
  ApiResponse,
  ProjectPhase,
  ProjectTask,
  ProjectSummary,
  CreatePhaseDto,
  UpdatePhaseDto,
  CreateTaskDto,
  UpdateTaskDto,
  CreateCommentDto,
  ProjectTaskComment,
  ProjectTaskHistory,
  ProjectTaskStatus,
  TaskPriority,
} from '@/types';

// ── Admin: Project Planning ──────────────────────────────────────────────────

export const projectPlanningApi = {
  // Summary
  getSummary: (projectId: number) =>
    api.get<ApiResponse<ProjectSummary>>(`/projects/${projectId}/planning/summary`),

  // Phases
  getPhases: (projectId: number) =>
    api.get<ApiResponse<ProjectPhase[]>>(`/projects/${projectId}/planning/phases`),

  createPhase: (projectId: number, dto: CreatePhaseDto) =>
    api.post<ApiResponse<ProjectPhase>>(`/projects/${projectId}/planning/phases`, dto),

  updatePhase: (projectId: number, phaseId: number, dto: UpdatePhaseDto) =>
    api.patch<ApiResponse<ProjectPhase>>(`/projects/${projectId}/planning/phases/${phaseId}`, dto),

  deletePhase: (projectId: number, phaseId: number) =>
    api.delete<ApiResponse<null>>(`/projects/${projectId}/planning/phases/${phaseId}`),

  reorderPhases: (projectId: number, phaseIds: number[]) =>
    api.put<ApiResponse<null>>(`/projects/${projectId}/planning/phases/reorder`, { phaseIds }),

  // Tasks
  getTasks: (projectId: number, params?: {
    page?: number;
    limit?: number;
    status?: ProjectTaskStatus;
    priority?: TaskPriority;
    assigneeId?: number;
    phaseId?: number;
  }) =>
    api.get<ApiResponse<ProjectTask[]>>(`/projects/${projectId}/planning/tasks`, { params }),

  createTask: (projectId: number, dto: CreateTaskDto) =>
    api.post<ApiResponse<ProjectTask>>(`/projects/${projectId}/planning/tasks`, dto),

  getTask: (projectId: number, taskId: number) =>
    api.get<ApiResponse<ProjectTask>>(`/projects/${projectId}/planning/tasks/${taskId}`),

  updateTask: (projectId: number, taskId: number, dto: UpdateTaskDto) =>
    api.patch<ApiResponse<ProjectTask>>(`/projects/${projectId}/planning/tasks/${taskId}`, dto),

  deleteTask: (projectId: number, taskId: number) =>
    api.delete<ApiResponse<null>>(`/projects/${projectId}/planning/tasks/${taskId}`),

  // History
  getHistory: (projectId: number, taskId: number) =>
    api.get<ApiResponse<ProjectTaskHistory[]>>(`/projects/${projectId}/planning/tasks/${taskId}/history`),

  // Comments
  addComment: (projectId: number, taskId: number, dto: CreateCommentDto) =>
    api.post<ApiResponse<ProjectTaskComment>>(`/projects/${projectId}/planning/tasks/${taskId}/comments`, dto),
};

// ── Employee: Project Planning ───────────────────────────────────────────────

export const employeePlanningApi = {
  getSummary: (projectId: number) =>
    api.get<ApiResponse<ProjectSummary>>(`/employee/projects/${projectId}/planning/summary`),

  getPhases: (projectId: number) =>
    api.get<ApiResponse<ProjectPhase[]>>(`/employee/projects/${projectId}/planning/phases`),

  createPhase: (projectId: number, dto: CreatePhaseDto) =>
    api.post<ApiResponse<ProjectPhase>>(`/employee/projects/${projectId}/planning/phases`, dto),

  updatePhase: (projectId: number, phaseId: number, dto: UpdatePhaseDto) =>
    api.patch<ApiResponse<ProjectPhase>>(`/employee/projects/${projectId}/planning/phases/${phaseId}`, dto),

  deletePhase: (projectId: number, phaseId: number) =>
    api.delete<ApiResponse<null>>(`/employee/projects/${projectId}/planning/phases/${phaseId}`),

  reorderPhases: (projectId: number, phaseIds: number[]) =>
    api.put<ApiResponse<null>>(`/employee/projects/${projectId}/planning/phases/reorder`, { phaseIds }),

  getTasks: (projectId: number, params?: {
    page?: number;
    limit?: number;
    status?: ProjectTaskStatus;
    priority?: TaskPriority;
    assigneeId?: number;
    phaseId?: number;
  }) =>
    api.get<ApiResponse<ProjectTask[]>>(`/employee/projects/${projectId}/planning/tasks`, { params }),

  createTask: (projectId: number, dto: CreateTaskDto) =>
    api.post<ApiResponse<ProjectTask>>(`/employee/projects/${projectId}/planning/tasks`, dto),

  getTask: (projectId: number, taskId: number) =>
    api.get<ApiResponse<ProjectTask>>(`/employee/projects/${projectId}/planning/tasks/${taskId}`),

  updateTask: (projectId: number, taskId: number, dto: UpdateTaskDto) =>
    api.patch<ApiResponse<ProjectTask>>(`/employee/projects/${projectId}/planning/tasks/${taskId}`, dto),

  deleteTask: (projectId: number, taskId: number) =>
    api.delete<ApiResponse<null>>(`/employee/projects/${projectId}/planning/tasks/${taskId}`),

  getHistory: (projectId: number, taskId: number) =>
    api.get<ApiResponse<ProjectTaskHistory[]>>(`/employee/projects/${projectId}/planning/tasks/${taskId}/history`),

  addComment: (projectId: number, taskId: number, dto: CreateCommentDto) =>
    api.post<ApiResponse<ProjectTaskComment>>(`/employee/projects/${projectId}/planning/tasks/${taskId}/comments`, dto),
};

// ── Employee: My Tasks ───────────────────────────────────────────────────────

export const myTasksApi = {
  getSummary: () =>
    api.get<ApiResponse<{
      totalTasks: number;
      todoCount: number;
      inProgressCount: number;
      inReviewCount: number;
      doneCount: number;
      byStatus: { status: string; count: string }[];
      byPriority: { priority: string; count: string }[];
    }>>('/employee/my-tasks/summary'),

  getAll: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: ProjectTaskStatus;
    priority?: TaskPriority;
    projectId?: number;
  }) =>
    api.get<ApiResponse<ProjectTask[]>>('/employee/my-tasks', { params }),

  getOne: (taskId: number) =>
    api.get<ApiResponse<ProjectTask>>(`/employee/my-tasks/${taskId}`),

  updateStatus: (taskId: number, status: ProjectTaskStatus, assignToAdminId?: number) =>
    api.patch<ApiResponse<ProjectTask>>(`/employee/my-tasks/${taskId}/status`, { status, ...(assignToAdminId ? { assignToAdminId } : {}) }),

  getAdmins: () =>
    api.get<ApiResponse<{ id: number; name: string; email: string }[]>>('/employee/my-tasks/admins'),

  reassign: (taskId: number, assigneeId: number) =>
    api.patch<ApiResponse<ProjectTask>>(`/employee/my-tasks/${taskId}/reassign`, { assigneeId }),

  getHistory: (taskId: number) =>
    api.get<ApiResponse<ProjectTaskHistory[]>>(`/employee/my-tasks/${taskId}/history`),

  addComment: (taskId: number, dto: CreateCommentDto) =>
    api.post<ApiResponse<ProjectTaskComment>>(`/employee/my-tasks/${taskId}/comments`, dto),

  searchByTicket: (ticket: string) =>
    api.get<ApiResponse<ProjectTask>>('/employee/my-tasks/search', { params: { ticket } }),

  autocomplete: (q: string) =>
    api.get<ApiResponse<ProjectTask[]>>('/employee/my-tasks/autocomplete', { params: { q } }),
};

// ── Admin: All Tickets ──────────────────────────────────────────────────────

export const adminTicketsApi = {
  getProjects: () =>
    api.get<ApiResponse<{ id: number; projectName: string; projectCode: string }[]>>('/admin/all-tickets/projects'),

  getAll: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: ProjectTaskStatus;
    priority?: TaskPriority;
    projectId?: number;
  }) =>
    api.get<ApiResponse<ProjectTask[]>>('/admin/all-tickets', { params }),

  getOne: (taskId: number) =>
    api.get<ApiResponse<ProjectTask>>(`/admin/all-tickets/${taskId}`),

  updateStatus: (taskId: number, status: ProjectTaskStatus, assignToAdminId?: number) =>
    api.patch<ApiResponse<ProjectTask>>(`/admin/all-tickets/${taskId}/status`, { status, ...(assignToAdminId ? { assignToAdminId } : {}) }),

  getAdmins: () =>
    api.get<ApiResponse<{ id: number; name: string; email: string }[]>>('/admin/all-tickets/admins'),

  reassign: (taskId: number, assigneeId: number) =>
    api.patch<ApiResponse<ProjectTask>>(`/admin/all-tickets/${taskId}/reassign`, { assigneeId }),

  getHistory: (taskId: number) =>
    api.get<ApiResponse<ProjectTaskHistory[]>>(`/admin/all-tickets/${taskId}/history`),

  addComment: (taskId: number, dto: CreateCommentDto) =>
    api.post<ApiResponse<ProjectTaskComment>>(`/admin/all-tickets/${taskId}/comments`, dto),

  getSuggestedContributors: (taskId: number) =>
    api.get(`/admin/all-tickets/${taskId}/contributors/suggested`),

  getContributors: (taskId: number) =>
    api.get(`/admin/all-tickets/${taskId}/contributors`),

  setContributors: (taskId: number, employeeIds: number[]) =>
    api.post(`/admin/all-tickets/${taskId}/contributors`, { employeeIds }),
};

// ── Employee: All Project Tickets ───────────────────────────────────────────

export const projectTicketsApi = {
  getProjects: () =>
    api.get<ApiResponse<{ id: number; projectName: string; projectCode: string }[]>>('/employee/project-tickets/projects'),

  getAll: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: ProjectTaskStatus;
    priority?: TaskPriority;
    projectId?: number;
  }) =>
    api.get<ApiResponse<ProjectTask[]>>('/employee/project-tickets', { params }),

  getOne: (taskId: number) =>
    api.get<ApiResponse<ProjectTask>>(`/employee/project-tickets/${taskId}`),

  updateStatus: (taskId: number, status: ProjectTaskStatus, assignToAdminId?: number) =>
    api.patch<ApiResponse<ProjectTask>>(`/employee/project-tickets/${taskId}/status`, { status, ...(assignToAdminId ? { assignToAdminId } : {}) }),

  getAdmins: () =>
    api.get<ApiResponse<{ id: number; name: string; email: string }[]>>('/employee/project-tickets/admins'),

  reassign: (taskId: number, assigneeId: number) =>
    api.patch<ApiResponse<ProjectTask>>(`/employee/project-tickets/${taskId}/reassign`, { assigneeId }),

  getHistory: (taskId: number) =>
    api.get<ApiResponse<ProjectTaskHistory[]>>(`/employee/project-tickets/${taskId}/history`),

  addComment: (taskId: number, dto: CreateCommentDto) =>
    api.post<ApiResponse<ProjectTaskComment>>(`/employee/project-tickets/${taskId}/comments`, dto),

  getSuggestedContributors: (taskId: number) =>
    api.get(`/employee/project-tickets/${taskId}/contributors/suggested`),

  getContributors: (taskId: number) =>
    api.get(`/employee/project-tickets/${taskId}/contributors`),

  setContributors: (taskId: number, employeeIds: number[]) =>
    api.post(`/employee/project-tickets/${taskId}/contributors`, { employeeIds }),
};
