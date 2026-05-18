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

  // Admin endpoints
  getSettings: () =>
    api.get<ApiResponse<AiSettings>>('/admin/ai/settings'),

  updateSettings: (enabled: boolean) =>
    api.patch<ApiResponse<AiSettings>>('/admin/ai/settings', { enabled }),

  getUsage: () =>
    api.get<ApiResponse<AiUsageStats>>('/admin/ai/usage'),
};
