/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { leaveRequestsApi } from '@/lib/api/leave-requests';
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
  /** The leave request being edited (must be the caller's own, still pending). */
  leave: any;
}

type HalfKind = 'full' | 'first_half' | 'second_half';

/**
 * Edit dialog for an employee's OWN pending leave request. Mirrors the
 * apply form's field set (leave type, dates, half-day, remarks) and
 * submits to the employee-only PATCH endpoint, which rejects the edit if
 * the request has already been actioned by RM/HR.
 */
export function EditLeaveDialog({ open, onOpenChange, leave }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    leaveReasonId: '',
    dateFrom: '',
    dateTo: '',
    remarks: '',
    halfDayKind: 'full' as HalfKind,
  });

  // Leave types for the dropdown (active only).
  const { data: leaveReasons } = useQuery({
    queryKey: ['leave-reasons-dropdown'],
    queryFn: () => leaveRequestsApi.getLeaveReasons().then((r) => r.data.data),
    enabled: open,
  });

  // Seed the form from the request whenever the dialog opens.
  useEffect(() => {
    if (!open || !leave) return;
    setForm({
      leaveReasonId: String(leave.leaveReasonId ?? leave.leaveReason?.id ?? ''),
      dateFrom: (leave.dateFrom ?? '').slice(0, 10),
      dateTo: (leave.dateTo ?? '').slice(0, 10),
      remarks: leave.remarks ?? '',
      halfDayKind: (leave.halfDayKind ?? 'full') as HalfKind,
    });
  }, [open, leave]);

  const isSingleDay = !!form.dateFrom && form.dateFrom === form.dateTo;

  const save = useMutation({
    mutationFn: () => {
      // Half-day only applies to a single-day request; clamp otherwise.
      const halfDayKind =
        isSingleDay && form.halfDayKind !== 'full' ? form.halfDayKind : undefined;
      return leaveRequestsApi.updateLeave(leave.id, {
        leaveReasonId: Number(form.leaveReasonId),
        dateFrom: form.dateFrom,
        dateTo: form.dateTo,
        remarks: form.remarks.trim() || undefined,
        halfDayKind,
      });
    },
    onSuccess: () => {
      toast.success('Leave request updated');
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['leave-request-detail', leave.id] });
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-leave-requests'] });
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message;
      toast.error(typeof msg === 'string' ? msg : 'Failed to update leave request');
    },
  });

  const handleSave = () => {
    if (!form.leaveReasonId) { toast.error('Pick a leave type'); return; }
    if (!form.dateFrom || !form.dateTo) { toast.error('Pick a date range'); return; }
    if (form.dateFrom > form.dateTo) { toast.error('End date must be on or after start date'); return; }
    save.mutate();
  };

  const halfOptions: { v: HalfKind; label: string }[] = [
    { v: 'full', label: 'Full day' },
    { v: 'first_half', label: 'First half (AM)' },
    { v: 'second_half', label: 'Second half (PM)' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Leave Request</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Leave Type <span className="text-red-500">*</span>
            </Label>
            <SearchableSelect
              placeholder="Select a reason"
              value={form.leaveReasonId}
              onValueChange={(v) => setForm((p) => ({ ...p, leaveReasonId: v }))}
              options={(leaveReasons ?? []).map((r: any) => ({ value: String(r.id), label: r.reasonName }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                From <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={form.dateFrom}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    dateFrom: e.target.value,
                    halfDayKind: e.target.value !== p.dateTo ? 'full' : p.halfDayKind,
                  }))
                }
              />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                To <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={form.dateTo}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    dateTo: e.target.value,
                    halfDayKind: e.target.value !== p.dateFrom ? 'full' : p.halfDayKind,
                  }))
                }
              />
            </div>
          </div>

          {/* Half-day options — only meaningful for a single-day request. */}
          {isSingleDay && (
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Duration
              </Label>
              <div className="flex flex-wrap gap-2">
                {halfOptions.map((opt) => {
                  const selected = form.halfDayKind === opt.v;
                  return (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, halfDayKind: opt.v }))}
                      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                        selected
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'hover:bg-accent/50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Remarks
            </Label>
            <Textarea
              value={form.remarks}
              onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
              placeholder="Any details for your manager / HR…"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
