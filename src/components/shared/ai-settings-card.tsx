'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';
import { aiApi } from '@/lib/api/ai';
import { Button } from '@/components/ui/button';

/**
 * Admin-only settings card for the master AI toggle.
 *
 * Off by default. Toggling on warns the admin that prompts (without
 * names or attachments) leave the server and may be used by Google
 * Gemini's free-tier to improve their models.
 */
export function AiSettingsCard() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const settingsQ = useQuery({
    queryKey: ['ai-settings'],
    queryFn: () => aiApi.getSettings().then((r) => r.data.data),
  });
  const usageQ = useQuery({
    queryKey: ['ai-usage'],
    queryFn: () => aiApi.getUsage().then((r) => r.data.data),
    enabled: !!settingsQ.data?.aiEnabled,
  });

  const updateMut = useMutation({
    mutationFn: (enabled: boolean) => aiApi.updateSettings(enabled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-settings'] });
      qc.invalidateQueries({ queryKey: ['ai-usage'] });
      toast.success('AI settings updated');
    },
    onError: () => {
      toast.error('Could not update AI settings');
    },
    onSettled: () => setBusy(false),
  });

  const s = settingsQ.data;
  const u = usageQ.data;
  const loading = settingsQ.isLoading;

  function handleToggle(next: boolean) {
    if (next && s && !s.available) {
      toast.error('Gemini API key is not configured on the server.');
      return;
    }
    setBusy(true);
    updateMut.mutate(next);
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="h-1 -mt-6 -mx-6 mb-5 rounded-t-[inherit] bg-linear-to-r from-violet-500 via-indigo-500 to-blue-500" />
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-5 w-5 text-violet-500" />
        <h2 className="text-lg font-semibold">AI Assistant</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Enable Google Gemini-powered writing helpers (Improve writing, tone rewrites,
        title-from-description) across your workspace. Off by default. When enabled,
        the text you submit leaves the server and is sent to Google&apos;s free-tier
        Gemini API, which may use prompts to improve their models.
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
                AI features {s?.aiEnabled ? 'enabled' : 'disabled'}
              </p>
              <p className="text-xs text-muted-foreground">
                Model: <span className="font-mono">{s?.model ?? '—'}</span>
                {s && !s.available && (
                  <span className="ml-2 text-amber-600">
                    Server is missing GEMINI_API_KEY — toggle is locked.
                  </span>
                )}
              </p>
            </div>
            <Button
              size="sm"
              disabled={busy || !s?.available}
              variant={s?.aiEnabled ? 'outline' : 'default'}
              className={
                s?.aiEnabled
                  ? ''
                  : 'bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white'
              }
              onClick={() => handleToggle(!s?.aiEnabled)}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : s?.aiEnabled ? 'Disable' : 'Enable'}
            </Button>
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
