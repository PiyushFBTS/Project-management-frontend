import { api } from './axios-instance';
import { tokenStorage } from '@/lib/auth/token-storage';
import {
  ApiResponse, Announcement, AnnouncementAttachment, CreateAnnouncementDto, UpdateAnnouncementDto,
} from '@/types';

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

  // ── Attachments ──────────────────────────────────────────────────────
  uploadAttachment: (announcementId: number, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<ApiResponse<AnnouncementAttachment>>(
      `${base()}/${announcementId}/attachments`,
      fd,
    );
  },

  removeAttachment: (announcementId: number, attachmentId: number) =>
    api.delete<ApiResponse<{ message: string }>>(
      `${base()}/${announcementId}/attachments/${attachmentId}`,
    ),
};
