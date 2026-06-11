/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, XCircle } from 'lucide-react';
import { wfhRequestsApi } from '@/lib/api/wfh-requests';
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
  wfhId: number;
  /**
   * Optional helper text under the title — e.g. "Reject (revoke
   * approval)" when an admin is reversing a previously-approved WFH.
   */
  rejectIsRevoke?: boolean;
  /**
   * Called after the mutation succeeds. Lets the caller navigate
   * away (detail page) or just toast + invalidate (list).
   */
  onSuccess?: () => void;
}

/**
 * Confirmation dialog for WFH Approve / Reject. Two shapes in one
 * component:
 *
 *   - **Approve** → remarks textarea is **optional**; one big green
 *     "Approve" button. Empty remarks are sent as null.
 *   - **Reject**  → remarks textarea is **required**; one big red
 *     "Reject" button that stays disabled until the user types
 *     something.
 *
 * Used by the WFH detail page's action card and the inline icon
 * buttons in the WFH list tab, so both surfaces enforce the same
 * "rejections must have a reason" rule.
 */
export function WfhActionDialog({
  open, onOpenChange, action, wfhId, rejectIsRevoke, onSuccess,
}: Props) {
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState('');

  // Reset the textarea every time the dialog opens so a stale value
  // from the previous reject doesn't leak into the next approve.
  useEffect(() => {
    if (open) setRemarks('');
  }, [open, action, wfhId]);

  const isApprove = action === 'approve';
  const rejectRequired = !isApprove && remarks.trim().length === 0;

  const mutation = useMutation({
    mutationFn: () => {
      const trimmed = remarks.trim();
      const payload = trimmed.length > 0 ? trimmed : undefined;
      return isApprove
        ? wfhRequestsApi.approve(wfhId, payload)
        : wfhRequestsApi.reject(wfhId, payload);
    },
    onSuccess: () => {
      toast.success(isApprove ? 'WFH request approved' : 'WFH request rejected');
      queryClient.invalidateQueries({ queryKey: ['wfh-request-detail', wfhId] });
      queryClient.invalidateQueries({ queryKey: ['wfh-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-wfh-requests'] });
      queryClient.invalidateQueries({ queryKey: ['team-wfh-requests'] });
      queryClient.invalidateQueries({ queryKey: ['wfh-on-today'] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message;
      toast.error(typeof msg === 'string'
        ? msg
        : `Failed to ${isApprove ? 'approve' : 'reject'} WFH request`);
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
    ? 'Approve WFH Request'
    : rejectIsRevoke
      ? 'Reject (revoke approval)'
      : 'Reject WFH Request';

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
              : 'A reason is required so the employee understands why their WFH was rejected.'}
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
                ? 'e.g. "Approved — keep dialing into stand-ups."'
                : 'Explain why this WFH is being rejected…'}
              rows={3}
              maxLength={1000}
            />
            {!isApprove && rejectRequired && (
              <p className="text-[11px] text-red-500 mt-1">Rejection reason can't be empty.</p>
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
