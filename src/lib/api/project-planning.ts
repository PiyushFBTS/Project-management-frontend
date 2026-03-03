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

  // Comments
  addComment: (projectId: number, taskId: number, dto: CreateCommentDto) =>
    api.post<ApiResponse<ProjectTaskComment>>(`/projects/${projectId}/planning/tasks/${taskId}/comments`, dto),
};

// ── Employee: My Tasks ───────────────────────────────────────────────────────

export const myTasksApi = {
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

  updateStatus: (taskId: number, status: ProjectTaskStatus) =>
    api.patch<ApiResponse<ProjectTask>>(`/employee/my-tasks/${taskId}/status`, { status }),

  addComment: (taskId: number, dto: CreateCommentDto) =>
    api.post<ApiResponse<ProjectTaskComment>>(`/employee/my-tasks/${taskId}/comments`, dto),

  searchByTicket: (ticket: string) =>
    api.get<ApiResponse<ProjectTask>>('/employee/my-tasks/search', { params: { ticket } }),

  autocomplete: (q: string) =>
    api.get<ApiResponse<ProjectTask[]>>('/employee/my-tasks/autocomplete', { params: { q } }),
};
