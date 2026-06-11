/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { wfhRequestsApi } from '@/lib/api/wfh-requests';
import { leaveRequestsApi } from '@/lib/api/leave-requests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /**
   * 'self' renders just the date/reason/watchers form. 'on-behalf'
   * adds an employee picker (HR / admin filing for someone else).
   */
  mode: 'self' | 'on-behalf';
  /**
   * Caller is using the admin-guarded /wfh-requests endpoint when
   * true; the employee-guarded /employee/wfh-requests otherwise.
   */
  isAdmin: boolean;
}

/**
 * Apply WFH dialog. Same field shape as the inline Apply-Leave form
 * in the parent page minus the leave-type dropdown — WFH has no
 * types, just a required free-text reason. Submits via either
 * `wfhRequestsApi.submitAdmin` (admin) or `wfhRequestsApi.submit`
 * (employee). Auto-invalidates the my-wfh / team-wfh / wfh-detail
 * queries on success.
 */
export function ApplyWfhDialog({ open, onOpenChange, mode, isAdmin }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    dateFrom: '',
    dateTo: '',
    reason: '',
    watcherIds: [] as number[],
    onBehalfOfEmployeeId: '' as string,
  });

  // Colleagues for the watcher picker. Reuse leaveRequestsApi here —
  // same /employee/leave-requests/colleagues endpoint serves both
  // features and we don't want to duplicate the query cache.
  const { data: colleagues } = useQuery({
    queryKey: ['colleagues-dropdown', isAdmin ? 'admin' : 'emp'],
    queryFn: () =>
      (isAdmin
        ? leaveRequestsApi.getAdminColleagues()
        : leaveRequestsApi.getColleagues()
      ).then((r) => r.data.data),
    enabled: open,
  });

  const reset = () => {
    setForm({ dateFrom: '', dateTo: '', reason: '', watcherIds: [], onBehalfOfEmployeeId: '' });
  };

  const submit = useMutation({
    mutationFn: () => {
      const payload = {
        dateFrom: form.dateFrom,
        dateTo: form.dateTo,
        reason: form.reason.trim(),
        watcherIds: form.watcherIds.length > 0 ? form.watcherIds : undefined,
        onBehalfOfEmployeeId:
          mode === 'on-behalf' && form.onBehalfOfEmployeeId
            ? Number(form.onBehalfOfEmployeeId)
            : undefined,
      };
      return isAdmin
        ? wfhRequestsApi.submitAdmin(payload)
        : wfhRequestsApi.submit(payload);
    },
    onSuccess: () => {
      toast.success('WFH request submitted');
      onOpenChange(false);
      reset();
      queryClient.invalidateQueries({ queryKey: ['wfh-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-wfh-requests'] });
      queryClient.invalidateQueries({ queryKey: ['team-wfh-requests'] });
      queryClient.invalidateQueries({ queryKey: ['wfh-on-today'] });
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message;
      toast.error(typeof msg === 'string' ? msg : 'Failed to submit WFH request');
    },
  });

  const handleSubmit = () => {
    if (!form.dateFrom || !form.dateTo) {
      toast.error('Pick a date range');
      return;
    }
    if (!form.reason.trim()) {
      toast.error('Reason is required');
      return;
    }
    if (mode === 'on-behalf' && !form.onBehalfOfEmployeeId) {
      toast.error('Pick an employee');
      return;
    }
    if (form.dateFrom > form.dateTo) {
      toast.error('End date must be on or after start date');
      return;
    }
    submit.mutate();
  };

  const toggleWatcher = (id: number) => {
    setForm((p) => ({
      ...p,
      watcherIds: p.watcherIds.includes(id)
        ? p.watcherIds.filter((w) => w !== id)
        : [...p.watcherIds, id],
    }));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'on-behalf' ? 'Apply WFH on Behalf' : 'Apply for WFH'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {mode === 'on-behalf' && (
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Employee <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.onBehalfOfEmployeeId}
                onValueChange={(v) => setForm((p) => ({ ...p, onBehalfOfEmployeeId: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {(colleagues ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} ({c.empCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                From <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={form.dateFrom}
                onChange={(e) => setForm((p) => ({ ...p, dateFrom: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                To <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={form.dateTo}
                onChange={(e) => setForm((p) => ({ ...p, dateTo: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={form.reason}
              onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
              placeholder="Why are you working from home?"
              rows={3}
            />
          </div>

          {/* Watcher (CC) picker — optional. Excludes the on-behalf
              subject so HR doesn't accidentally CC the person they're
              filing for. */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              CC (optional)
            </Label>
            <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/30 p-2 space-y-1">
              {(colleagues ?? [])
                .filter((c) => String(c.id) !== form.onBehalfOfEmployeeId)
                .map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1 cursor-pointer hover:bg-accent/50 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={form.watcherIds.includes(c.id)}
                      onChange={() => toggleWatcher(c.id)}
                      className="accent-emerald-600"
                    />
                    <span className="flex-1">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.empCode}</span>
                  </label>
                ))}
              {(colleagues ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">No colleagues to CC.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submit.isPending}>
              {submit.isPending ? 'Submitting…' : 'Submit'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
