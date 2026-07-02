/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, XCircle } from 'lucide-react';
import { weeklyOffRequestsApi } from '@/lib/api/weekly-off-requests';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

type Action = 'approve' | 'reject';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  action: Action;
  weeklyOffId: number;
  rejectIsRevoke?: boolean;
  onSuccess?: () => void;
}

/**
 * Approve / Reject confirmation for a weekly-off request. Remarks optional on
 * approve, required on reject — mirrors the leave / WFH action dialogs.
 */
export function WeeklyOffActionDialog({
  open, onOpenChange, action, weeklyOffId, rejectIsRevoke, onSuccess,
}: Props) {
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState('');

  useEffect(() => { if (open) setRemarks(''); }, [open, action, weeklyOffId]);

  const isApprove = action === 'approve';
  const rejectRequired = !isApprove && remarks.trim().length === 0;

  const mutation = useMutation({
    mutationFn: () => {
      const payload = remarks.trim() || undefined;
      return isApprove
        ? weeklyOffRequestsApi.approve(weeklyOffId, payload)
        : weeklyOffRequestsApi.reject(weeklyOffId, payload);
    },
    onSuccess: () => {
      toast.success(isApprove ? 'Weekly-off approved' : 'Weekly-off rejected');
      queryClient.invalidateQueries({ queryKey: ['weekly-off-request-detail', weeklyOffId] });
      queryClient.invalidateQueries({ queryKey: ['weekly-off-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-weekly-off-requests'] });
      queryClient.invalidateQueries({ queryKey: ['team-weekly-off-requests'] });
      queryClient.invalidateQueries({ queryKey: ['weekoff-tab-pending'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-pending-leaves'] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message;
      toast.error(typeof msg === 'string' ? msg : `Failed to ${isApprove ? 'approve' : 'reject'} weekly-off`);
    },
  });

  const handleSubmit = () => {
    if (rejectRequired) { toast.error('Rejection reason is required'); return; }
    mutation.mutate();
  };

  const title = isApprove
    ? 'Approve Weekly-Off'
    : rejectIsRevoke ? 'Reject (revoke approval)' : 'Reject Weekly-Off';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isApprove ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
            {title}
          </DialogTitle>
          <DialogDescription>
            {isApprove
              ? 'Add an optional note before approving.'
              : 'A reason is required so the employee understands why it was rejected.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              {isApprove ? 'Remarks (optional)' : 'Reason for rejection *'}
            </Label>
            <Textarea
              autoFocus
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={isApprove ? 'e.g. "Approved."' : 'Explain why this is being rejected…'}
              rows={3}
              maxLength={1000}
            />
            {!isApprove && rejectRequired && (
              <p className="text-[11px] text-red-500 mt-1">Rejection reason can&apos;t be empty.</p>
            )}
          </div>
          <div className="flex justify-end pt-1">
            {isApprove ? (
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={mutation.isPending} onClick={handleSubmit}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                {mutation.isPending ? 'Approving…' : 'Approve'}
              </Button>
            ) : (
              <Button variant="destructive" disabled={mutation.isPending || rejectRequired} onClick={handleSubmit}>
                <XCircle className="mr-1.5 h-4 w-4" />
                {mutation.isPending ? 'Rejecting…' : 'Reject'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
