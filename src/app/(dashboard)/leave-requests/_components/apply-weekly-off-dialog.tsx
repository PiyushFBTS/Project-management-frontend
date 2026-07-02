/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { weeklyOffRequestsApi } from '@/lib/api/weekly-off-requests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'self' | 'on-behalf';
  isAdmin: boolean;
}

// ── Local date helpers (no timezone drift) ─────────────────────────────
function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
/** Saturday of the Mon–Sun week containing `dateStr`. */
function saturdayOfWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const dow = d.getDay(); // 0=Sun … 6=Sat
  const toMonday = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + toMonday + 5); // Monday + 5 = Saturday
  return fmt(d);
}
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function dayName(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : WEEKDAY[d.getDay()];
}

/**
 * Apply for a Weekly-Off (comp-off swap). Pick the weekday taken off → the
 * paired Saturday auto-fills. Not a leave type, so no balance impact.
 */
export function ApplyWeeklyOffDialog({ open, onOpenChange, mode, isAdmin }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ offDate: '', workDate: '', reason: '', onBehalfOfEmployeeId: '' });

  const { data: colleagues } = useQuery({
    queryKey: ['weekoff-colleagues', isAdmin ? 'admin' : 'emp'],
    queryFn: () =>
      (isAdmin ? weeklyOffRequestsApi.getAdminColleagues() : weeklyOffRequestsApi.getColleagues())
        .then((r) => r.data.data),
    enabled: open,
  });

  const reset = () => setForm({ offDate: '', workDate: '', reason: '', onBehalfOfEmployeeId: '' });
  useEffect(() => { if (!open) reset(); }, [open]);

  const offDow = form.offDate ? new Date(`${form.offDate}T00:00:00`).getDay() : -1;
  const offIsWeekday = offDow >= 1 && offDow <= 5;

  const submit = useMutation({
    mutationFn: () => {
      const payload = {
        offDate: form.offDate,
        workDate: form.workDate,
        reason: form.reason.trim() || undefined,
        onBehalfOfEmployeeId:
          mode === 'on-behalf' && form.onBehalfOfEmployeeId ? Number(form.onBehalfOfEmployeeId) : undefined,
      };
      return isAdmin ? weeklyOffRequestsApi.submitAdmin(payload) : weeklyOffRequestsApi.submit(payload);
    },
    onSuccess: () => {
      toast.success('Weekly-off request submitted');
      onOpenChange(false);
      reset();
      queryClient.invalidateQueries({ queryKey: ['weekly-off-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-weekly-off-requests'] });
      queryClient.invalidateQueries({ queryKey: ['team-weekly-off-requests'] });
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message;
      toast.error(typeof msg === 'string' ? msg : Array.isArray(msg) ? msg.join(', ') : 'Failed to submit weekly-off request');
    },
  });

  const handleSubmit = () => {
    if (mode === 'on-behalf' && !form.onBehalfOfEmployeeId) { toast.error('Pick an employee'); return; }
    if (!form.offDate) { toast.error('Pick the day you are taking off'); return; }
    if (!offIsWeekday) { toast.error('The day off must be a weekday (Mon–Fri)'); return; }
    if (!form.workDate) { toast.error('Pick the Saturday you will work'); return; }
    if (new Date(`${form.workDate}T00:00:00`).getDay() !== 6) { toast.error('The working day must be a Saturday'); return; }
    submit.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'on-behalf' ? 'Apply Weekly-Off on Behalf' : 'Apply for Weekly-Off'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {mode === 'on-behalf' && (
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Employee <span className="text-red-500">*</span>
              </Label>
              <SearchableSelect
                placeholder="Select employee"
                value={form.onBehalfOfEmployeeId}
                onValueChange={(v) => setForm((p) => ({ ...p, onBehalfOfEmployeeId: v }))}
                options={(colleagues ?? []).map((c: any) => ({ value: String(c.id), label: `${c.name} (${c.empCode})` }))}
              />
            </div>
          )}

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Day Off (weekday) <span className="text-red-500">*</span>
            </Label>
            <Input
              type="date"
              value={form.offDate}
              onChange={(e) => {
                const offDate = e.target.value;
                // Auto-fill the paired Saturday of the same week.
                setForm((p) => ({ ...p, offDate, workDate: offDate ? saturdayOfWeek(offDate) : '' }));
              }}
            />
            {form.offDate && !offIsWeekday && (
              <p className="text-[11px] text-red-500 mt-1">Pick a weekday (Mon–Fri) — {dayName(form.offDate)} isn&apos;t allowed.</p>
            )}
          </div>

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Saturday Worked (locked)
            </Label>
            <Input
              type="date"
              value={form.workDate}
              readOnly
              disabled
              className="cursor-not-allowed opacity-70"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Automatically set to that week&apos;s Saturday — this can&apos;t be changed.
            </p>
          </div>

          {form.offDate && form.workDate && offIsWeekday && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs">
              You&apos;ll take <span className="font-semibold">{dayName(form.offDate)} {form.offDate}</span> off and
              work <span className="font-semibold">Sat {form.workDate}</span> instead.
            </div>
          )}

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Reason (optional)
            </Label>
            <Textarea
              value={form.reason}
              onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
              placeholder="Why are you swapping your weekly off?"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submit.isPending}>
              {submit.isPending ? 'Submitting…' : 'Submit'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
