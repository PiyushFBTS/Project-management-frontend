import { api } from './axios-instance';
import { tokenStorage } from '@/lib/auth/token-storage';
import { ApiResponse, TaskType, CreateTaskTypeDto, UpdateTaskTypeDto, PaginationParams } from '@/types';

// Admins go to `/task-types`; employees (incl. HR) hit `/employee/task-types`.
function base() {
  return tokenStorage.getLoginType() === 'admin' ? '/task-types' : '/employee/task-types';
}

export const taskTypesApi = {
  getAll: (params?: PaginationParams & { search?: string; category?: string; isActive?: boolean }) =>
    api.get<ApiResponse<TaskType[]>>(base(), { params }),

  getOne: (id: number) => api.get<ApiResponse<TaskType>>(`${base()}/${id}`),

  create: (dto: CreateTaskTypeDto) => api.post<ApiResponse<TaskType>>(base(), dto),

  update: (id: number, dto: UpdateTaskTypeDto) =>
    api.patch<ApiResponse<TaskType>>(`${base()}/${id}`, dto),

  remove: (id: number) => api.delete<ApiResponse<null>>(`${base()}/${id}`),
};
