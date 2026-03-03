import { api } from './axios-instance';
import { Notification, NotificationMeta } from '@/types';

interface NotifApiResponse {
  success: boolean;
  data: Notification[];
  message: string;
  meta: NotificationMeta | null;
}

function prefix(isEmployee: boolean) {
  return isEmployee ? '/employee/notifications' : '/notifications';
}

export const notificationsApi = {
  getAll: (limit = 30, isEmployee = false) =>
    api.get<NotifApiResponse>(prefix(isEmployee), { params: { limit } }),

  markRead: (id: number, isEmployee = false) =>
    api.patch<{ success: boolean }>(`${prefix(isEmployee)}/${id}/read`),

  markAllRead: (isEmployee = false) =>
    api.patch<{ success: boolean }>(`${prefix(isEmployee)}/read-all`),

  remove: (id: number, isEmployee = false) =>
    api.delete<{ success: boolean }>(`${prefix(isEmployee)}/${id}`),

  clearAll: (isEmployee = false) =>
    api.delete<{ success: boolean }>(`${prefix(isEmployee)}/clear-all`),
};
