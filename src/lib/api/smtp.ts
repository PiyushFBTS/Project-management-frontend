import { api } from './axios-instance';
import { SmtpConfig, SaveSmtpConfigDto } from '@/types';

function buildSendFormData(
  recipientEmail: string,
  subject: string,
  body: string,
  attachments?: File[],
): FormData {
  const fd = new FormData();
  fd.append('recipientEmail', recipientEmail);
  fd.append('subject', subject);
  fd.append('body', body);
  if (attachments) {
    attachments.forEach((file) => fd.append('attachments', file));
  }
  return fd;
}

export const smtpApi = {
  // ── Platform / Super Admin ──────────────────────────────────────────────

  getGlobalConfigs: () =>
    api.get<SmtpConfig[]>('/platform/smtp'),

  createGlobalConfig: (dto: SaveSmtpConfigDto) =>
    api.post<SmtpConfig>('/platform/smtp', dto),

  updateGlobalConfig: (smtpId: number, dto: SaveSmtpConfigDto) =>
    api.put<SmtpConfig>(`/platform/smtp/${smtpId}`, dto),

  deleteGlobalConfig: (smtpId: number) =>
    api.delete<{ message: string }>(`/platform/smtp/${smtpId}`),

  testGlobalConfig: (smtpId: number, dto: { recipientEmail: string }) =>
    api.post<{ message: string }>(`/platform/smtp/${smtpId}/test`, dto),

  sendGlobalEmail: (smtpId: number, recipientEmail: string, subject: string, body: string, attachments?: File[]) =>
    api.post<{ message: string }>(
      `/platform/smtp/${smtpId}/send`,
      buildSendFormData(recipientEmail, subject, body, attachments),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ),

  // ── Platform per-company ──────────────────────────────────────────────

  getCompanyConfigs: (companyId: number) =>
    api.get<SmtpConfig[]>(`/platform/companies/${companyId}/smtp`),

  createCompanyConfig: (companyId: number, dto: SaveSmtpConfigDto) =>
    api.post<SmtpConfig>(`/platform/companies/${companyId}/smtp`, dto),

  updateCompanyConfig: (companyId: number, smtpId: number, dto: SaveSmtpConfigDto) =>
    api.put<SmtpConfig>(`/platform/companies/${companyId}/smtp/${smtpId}`, dto),

  deleteCompanyConfig: (companyId: number, smtpId: number) =>
    api.delete<{ message: string }>(`/platform/companies/${companyId}/smtp/${smtpId}`),

  testCompanyConfig: (companyId: number, smtpId: number, dto: { recipientEmail: string }) =>
    api.post<{ message: string }>(`/platform/companies/${companyId}/smtp/${smtpId}/test`, dto),

  sendCompanyEmail: (companyId: number, smtpId: number, recipientEmail: string, subject: string, body: string, attachments?: File[]) =>
    api.post<{ message: string }>(
      `/platform/companies/${companyId}/smtp/${smtpId}/send`,
      buildSendFormData(recipientEmail, subject, body, attachments),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ),

  // ── Company Admin ───────────────────────────────────────────────────────

  getOwnConfigs: () =>
    api.get<SmtpConfig[]>('/admin/smtp'),

  createOwnConfig: (dto: SaveSmtpConfigDto) =>
    api.post<SmtpConfig>('/admin/smtp', dto),

  updateOwnConfig: (smtpId: number, dto: SaveSmtpConfigDto) =>
    api.put<SmtpConfig>(`/admin/smtp/${smtpId}`, dto),

  deleteOwnConfig: (smtpId: number) =>
    api.delete<{ message: string }>(`/admin/smtp/${smtpId}`),

  testOwnConfig: (smtpId: number, dto: { recipientEmail: string }) =>
    api.post<{ message: string }>(`/admin/smtp/${smtpId}/test`, dto),

  sendOwnEmail: (smtpId: number, recipientEmail: string, subject: string, body: string, attachments?: File[]) =>
    api.post<{ message: string }>(
      `/admin/smtp/${smtpId}/send`,
      buildSendFormData(recipientEmail, subject, body, attachments),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ),
};
