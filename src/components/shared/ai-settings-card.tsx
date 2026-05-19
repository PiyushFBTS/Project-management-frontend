'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, Sparkles, Lock } from 'lucide-react';
import { aiApi } from '@/lib/api/ai';
import { Badge } from '@/components/ui/badge';

/**
 * Read-only status card for company admins.
 *
 * AI is enabled at the platform level by a super admin — company admins
 * see whether their tenant is opted in, plus 24-h usage stats when on,
 * but they cannot toggle it themselves.
 */
export function AiSettingsCard() {
  const settingsQ = useQuery({
    queryKey: ['ai-settings'],
    queryFn: () => aiApi.getSettings().then((r) => r.data.data),
  });
  const usageQ = useQuery({
    queryKey: ['ai-usage'],
    queryFn: () => aiApi.getUsage().then((r) => r.data.data),
    enabled: !!settingsQ.data?.aiEnabled,
  });

  const s = settingsQ.data;
  const u = usageQ.data;
  const loading = settingsQ.isLoading;

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="h-1 -mt-6 -mx-6 mb-5 rounded-t-[inherit] bg-linear-to-r from-violet-500 via-indigo-500 to-blue-500" />
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-5 w-5 text-violet-500" />
        <h2 className="text-lg font-semibold">AI Assistant</h2>
        <Badge variant="outline" className="ml-1 text-[10px] uppercase tracking-wide">
          <Lock className="h-3 w-3 mr-1" />
          Platform-controlled
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Google Gemini-powered writing helpers (Improve writing, tone rewrites,
        title-from-description) are enabled at the platform level. Contact your
        platform administrator to change this setting for your organisation.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4 rounded-md border bg-muted/20 px-4 py-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                AI features{' '}
                <span className={s?.aiEnabled ? 'text-emerald-600' : 'text-slate-500'}>
                  {s?.aiEnabled ? 'enabled' : 'disabled'}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Model: <span className="font-mono">{s?.model ?? '—'}</span>
                {s && !s.available && (
                  <span className="ml-2 text-amber-600">
                    Gemini API key is not configured on the server.
                  </span>
                )}
              </p>
            </div>
            <Badge
              className={
                s?.aiEnabled
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-100'
              }
            >
              {s?.aiEnabled ? 'ON' : 'OFF'}
            </Badge>
          </div>

          {s?.aiEnabled && u && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Stat label="Calls (24h)" value={u.totalCalls} />
              <Stat label="Cache hits" value={u.cacheHits} />
              <Stat label="Uncached" value={u.uncachedCalls} accent />
              <Stat label="Daily limit" value={u.dailyCompanyLimit} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${accent ? 'text-violet-600' : ''}`}>{value}</p>
    </div>
  );
}
