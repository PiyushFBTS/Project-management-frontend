import { api } from './axios-instance';
import { ApiResponse, TaskType, CreateTaskTypeDto, UpdateTaskTypeDto, PaginationParams } from '@/types';

export const taskTypesApi = {
  getAll: (params?: PaginationParams & { search?: string; category?: string; isActive?: boolean }) =>
    api.get<ApiResponse<TaskType[]>>('/task-types', { params }),

  getOne: (id: number) => api.get<ApiResponse<TaskType>>(`/task-types/${id}`),

  create: (dto: CreateTaskTypeDto) => api.post<ApiResponse<TaskType>>('/task-types', dto),

  update: (id: number, dto: UpdateTaskTypeDto) =>
    api.patch<ApiResponse<TaskType>>(`/task-types/${id}`, dto),

  remove: (id: number) => api.delete<ApiResponse<null>>(`/task-types/${id}`),
};
