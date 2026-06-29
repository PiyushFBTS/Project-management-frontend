/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, XCircle } from 'lucide-react';
import { leaveRequestsApi } from '@/lib/api/leave-requests';
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
  leaveId: number;
  /** Helper text when an admin rejects an already-approved leave. */
  rejectIsRevoke?: boolean;
  /** Called after the mutation succeeds (e.g. navigate back). */
  onSuccess?: () => void;
}

/**
 * Confirmation dialog for Leave Approve / Reject — mirror of the WFH
 * action dialog:
 *   - **Approve** → remarks optional; green "Approve" button.
 *   - **Reject**  → remarks REQUIRED; red "Reject" button stays disabled
 *     until a reason is typed.
 */
export function LeaveActionDialog({
  open, onOpenChange, action, leaveId, rejectIsRevoke, onSuccess,
}: Props) {
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState('');

  // Reset the textarea each time the dialog opens so a stale reject reason
  // doesn't leak into the next approve.
  useEffect(() => {
    if (open) setRemarks('');
  }, [open, action, leaveId]);

  const isApprove = action === 'approve';
  const rejectRequired = !isApprove && remarks.trim().length === 0;

  const mutation = useMutation({
    mutationFn: () => {
      const trimmed = remarks.trim();
      const payload = trimmed.length > 0 ? trimmed : undefined;
      return isApprove
        ? leaveRequestsApi.approveLeave(leaveId, payload)
        : leaveRequestsApi.rejectLeave(leaveId, payload);
    },
    onSuccess: () => {
      toast.success(isApprove ? 'Leave request approved' : 'Leave request rejected');
      queryClient.invalidateQueries({ queryKey: ['leave-request-detail', leaveId] });
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['leave-tab-pending'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-pending-leaves'] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message;
      toast.error(typeof msg === 'string'
        ? msg
        : `Failed to ${isApprove ? 'approve' : 'reject'} leave request`);
    },
  });

  const handleSubmit = () => {
    if (rejectRequired) {
      toast.error('Rejection reason is required');
      return;
    }
    mutation.mutate();
  };

  const title = isApprove
    ? 'Approve Leave Request'
    : rejectIsRevoke
      ? 'Reject (revoke approval)'
      : 'Reject Leave Request';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isApprove
              ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              : <XCircle className="h-4 w-4 text-red-600" />}
            {title}
          </DialogTitle>
          <DialogDescription>
            {isApprove
              ? 'Add an optional note for the employee before approving.'
              : 'A reason is required so the employee understands why their leave was rejected.'}
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
              placeholder={isApprove
                ? 'e.g. "Approved — enjoy your time off."'
                : 'Explain why this leave is being rejected…'}
              rows={3}
              maxLength={1000}
            />
            {!isApprove && rejectRequired && (
              <p className="text-[11px] text-red-500 mt-1">Rejection reason can&apos;t be empty.</p>
            )}
          </div>
          <div className="flex justify-end pt-1">
            {isApprove ? (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={mutation.isPending}
                onClick={handleSubmit}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                {mutation.isPending ? 'Approving…' : 'Approve'}
              </Button>
            ) : (
              <Button
                variant="destructive"
                disabled={mutation.isPending || rejectRequired}
                onClick={handleSubmit}
              >
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
