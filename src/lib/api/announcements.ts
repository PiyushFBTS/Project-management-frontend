import { api } from './axios-instance';
import { tokenStorage } from '@/lib/auth/token-storage';
import { ApiResponse, Announcement, CreateAnnouncementDto, UpdateAnnouncementDto } from '@/types';

function base() {
  return tokenStorage.getLoginType() === 'admin' ? '/admin/announcements' : '/employee/announcements';
}

export const announcementsApi = {
  getAll: () => api.get<ApiResponse<Announcement[]>>(base()),

  getActive: () => api.get<ApiResponse<Announcement[]>>(`${base()}/active`),

  create: (dto: CreateAnnouncementDto) =>
    api.post<ApiResponse<Announcement>>(base(), dto),

  update: (id: number, dto: UpdateAnnouncementDto) =>
    api.patch<ApiResponse<Announcement>>(`${base()}/${id}`, dto),

  remove: (id: number) =>
    api.delete<ApiResponse<null>>(`${base()}/${id}`),
};
