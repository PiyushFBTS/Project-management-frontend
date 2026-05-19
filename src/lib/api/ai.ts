import { api } from './axios-instance';
import { ApiResponse } from '@/types';

export type AiTextFeature =
  | 'improve_writing'
  | 'tone_professional'
  | 'tone_concise'
  | 'tone_empathetic'
  | 'title_from_desc';

export interface AiTextRequest {
  feature: AiTextFeature;
  input: string;
  languageHint?: string;
}

export interface AiTextResponse {
  output: string;
  cached: boolean;
  model: string;
}

export interface AiSettings {
  aiEnabled: boolean;
  model: string;
  /** Server-side: false when no Gemini API key is configured. UI uses this to gray out the toggle. */
  available: boolean;
  dailyCompanyLimit: number;
  cacheTtlHours: number;
}

export interface AiUsageStats {
  windowHours: number;
  totalCalls: number;
  cacheHits: number;
  uncachedCalls: number;
  dailyCompanyLimit: number;
  perFeature: Array<{ feature: string; total: number; cached: number }>;
}

export const aiApi = {
  text: (req: AiTextRequest) =>
    api.post<ApiResponse<AiTextResponse>>('/ai/text', req),

  // Company-admin endpoints — READ-ONLY. The toggle moved to super admin.
  getSettings: () =>
    api.get<ApiResponse<AiSettings>>('/admin/ai/settings'),

  getUsage: () =>
    api.get<ApiResponse<AiUsageStats>>('/admin/ai/usage'),

  // Super-admin (platform-level) endpoints — pick which company to flip.
  getPlatformSettings: (companyId: number) =>
    api.get<ApiResponse<AiSettings>>(`/platform/companies/${companyId}/ai-settings`),

  updatePlatformSettings: (companyId: number, enabled: boolean) =>
    api.patch<ApiResponse<AiSettings>>(`/platform/companies/${companyId}/ai-settings`, { enabled }),
};
