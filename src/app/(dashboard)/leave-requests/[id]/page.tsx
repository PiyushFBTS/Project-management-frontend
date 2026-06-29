/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft, CalendarDays, CheckCircle2, XCircle, Ban, User, Clock, FileText, Users, MessageSquare, Pencil,
} from 'lucide-react';
import { leaveRequestsApi } from '@/lib/api/leave-requests';
import { EditLeaveDialog } from '../_components/edit-leave-dialog';
import { LeaveActionDialog } from '../_components/leave-action-dialog';
import { useAuth } from '@/providers/auth-provider';
import { LeaveRequestStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

// Header badge — collapsed to 3 user-facing buckets (Pending / Approved /
// Rejected). The full RM-then-HR breakdown is shown in the approval
// timeline lower on the page.
type SimpleStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

const SIMPLE_STATUS_CONFIG: Record<SimpleStatus, { label: string; bg: string }> = {
  pending:   { label: 'Pending',   bg: 'bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400' },
  approved:  { label: 'Approved',  bg: 'bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400' },
  rejected:  { label: 'Rejected',  bg: 'bg-red-100 dark:bg-red-900/30 dark:text-red-400' },
  cancelled: { label: 'Cancelled', bg: 'bg-slate-100 dark:bg-slate-900/30 dark:text-slate-400' },
};

function toSimpleStatus(raw: string): SimpleStatus {
  if (raw === 'hr_approved') return 'approved';
  if (raw === 'manager_rejected' || raw === 'hr_rejected') return 'rejected';
  if (raw === 'cancelled') return 'cancelled';
  return 'pending';
}

function StatusBadge({ lr }: { lr: { status: string } }) {
  const c = SIMPLE_STATUS_CONFIG[toSimpleStatus(lr.status)];
  return <Badge className={`${c.bg} border-0 text-xs font-semibold`}>{c.label}</Badge>;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  try { return format(new Date(d + (d.includes('T') ? '' : 'T00:00:00')), 'dd MMM yyyy'); } catch { return d; }
}

function fmtDateTime(d: string | null | undefined) {
  if (!d) return '—';
  try { return format(new Date(d), 'dd MMM yyyy, hh:mm a'); } catch { return d; }
}

export default function LeaveRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';
  const isEmployee = user?._type === 'employee';
  const [editOpen, setEditOpen] = useState(false);
  const [actionDialog, setActionDialog] = useState<{ open: boolean; action: 'approve' | 'reject' }>({
    open: false,
    action: 'approve',
  });

  const leaveId = Number(id);

  const { data: detail, isLoading } = useQuery({
    queryKey: ['leave-request-detail', leaveId, isEmployee],
    queryFn: () =>
      (isEmployee
        ? leaveRequestsApi.getOneForEmployee(leaveId)
        : leaveRequestsApi.getOne(leaveId)
      ).then((r) => r.data.data),
    enabled: !!id,
  });

  // Determine if current user can act. Reject can be triggered in more
  // states than approve — specifically, an admin may reject an already-
  // HR-approved leave (revoke a mistaken approval).
  //
  // Self-approval guard: admins can't approve/reject their own admin-
  // submitted leaves; HR can't approve/reject leaves they themselves
  // submitted. The backend enforces these too (see leave-requests.service
  // `approve` / `adminApprove`), but the UI mirrors the rule so the
  // buttons don't appear in the first place.
  const canAct = (() => {
    if (!detail || !user) return { canApprove: false, canReject: false, canCancel: false, canEdit: false };
    const userId = (user as { id: number }).id;
    const isOwnEmployeeLeave = isEmployee && detail.employeeId === userId;
    const isOwnAdminLeave = isAdmin && detail.adminId != null && detail.adminId === userId;
    const isHrUser = isEmployee && !!(user as { isHr?: boolean }).isHr;
    // Plain owners can edit/cancel ONLY while pending — once RM/HR actions it,
    // it's frozen. Admin + HR can cancel any ACTIVE leave (incl. a fully
    // approved one), since Reject is hidden once approved and cancel is the
    // way to undo it. Editing stays employee-owner + pending only.
    const ACTIVE_CANCELLABLE = ['pending', 'manager_approved', 'hr_approved'];
    const canCancel = (isAdmin || isHrUser)
      ? ACTIVE_CANCELLABLE.includes(detail.status)
      : (isOwnEmployeeLeave && detail.status === 'pending');
    const canEdit = isOwnEmployeeLeave && detail.status === 'pending';

    let canApprove = false;
    let canReject = false;
    if (isAdmin) {
      // Block admin from acting on their own admin-submitted leave.
      if (!isOwnAdminLeave) {
        canApprove = ['pending', 'manager_approved'].includes(detail.status);
        // Reject is hidden once approved — use Cancel to undo an approval.
        canReject = ['pending', 'manager_approved'].includes(detail.status);
      }
    } else if (isEmployee) {
      const isManager = detail.employee?.reportsToId === userId;
      const isHr = !!(user as { isHr?: boolean }).isHr;
      // RM acts on a peer's pending request — and never on their own.
      if (isManager && detail.status === 'pending' && !isOwnEmployeeLeave) {
        canApprove = true; canReject = true;
      }
      // HR acts as the second gate. Block HR from rubber-stamping their
      // own PTO; another HR / RM / admin must step in.
      if (isHr && ['pending', 'manager_approved'].includes(detail.status) && !isOwnEmployeeLeave) {
        canApprove = true; canReject = true;
      }
    }
    return { canApprove, canReject, canCancel, canEdit };
  })();

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['leave-request-detail', leaveId] });
    qc.invalidateQueries({ queryKey: ['leave-requests'] });
    qc.invalidateQueries({ queryKey: ['my-leave-requests'] });
    qc.invalidateQueries({ queryKey: ['pending-approvals'] });
  };

  // Approve / Reject now run through the shared <LeaveActionDialog />, which
  // owns the remarks field (optional on approve, required on reject) and its
  // own mutations. Only cancel stays here — it needs no remarks prompt.
  const cancelMut = useMutation({
    mutationFn: () => leaveRequestsApi.cancelLeave(leaveId),
    onSuccess: () => { toast.success('Cancelled'); invalidateAll(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Leave request not found</p>
        <Button variant="link" onClick={() => router.back()}>Go back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Leave Request</h1>
          <p className="text-xs text-muted-foreground">#{detail.id} · Applied {fmtDate(detail.createdAt)}</p>
        </div>
        <StatusBadge lr={detail as any} />
      </div>

      {/* Employee + Leave Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-violet-600 dark:text-violet-400">
              <User className="h-3 w-3" /> Employee
            </div>
            <div>
              <p className="font-semibold">{detail.employee?.name}</p>
              <p className="text-xs text-muted-foreground">{detail.employee?.empCode} · {detail.employee?.email}</p>
            </div>
            {(() => {
              // Surface the actual filer when it differs from the
              // subject — i.e. an HR / admin filed leave on someone
              // else's behalf.
              const filedById = detail.appliedById ?? null;
              const subjId = detail.adminId ?? detail.employeeId ?? null;
              const subjType = detail.adminId != null ? 'admin' : 'employee';
              const isOnBehalf =
                filedById != null &&
                (filedById !== subjId || detail.appliedByType !== subjType);
              if (!isOnBehalf || !detail.appliedByName) return null;
              return (
                <div className="rounded-md border border-amber-200/40 bg-amber-50/50 dark:bg-amber-500/10 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-amber-700 dark:text-amber-400">
                    Applied By
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                    {detail.appliedByName}
                    <span className="text-muted-foreground ml-1">
                      ({detail.appliedByType === 'admin' ? 'Admin' : 'HR'})
                    </span>
                  </p>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-orange-600 dark:text-orange-400">
              <CalendarDays className="h-3 w-3" /> Leave Details
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground">From</p>
                <p className="text-sm font-mono font-medium">{fmtDate(detail.dateFrom)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">To</p>
                <p className="text-sm font-mono font-medium">{fmtDate(detail.dateTo)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Days</p>
                <p className="text-sm font-bold">
                  {Number(detail.totalDays)}
                  {detail.halfDayKind && (
                    <span className="ml-1 inline-block rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300 align-middle">
                      {detail.halfDayKind === 'first_half' ? 'AM' : 'PM'}
                    </span>
                  )}
                </p>
              </div>
            </div>
            {/* When the request was submitted — full date + time. */}
            <div className="pt-2 border-t border-border/50">
              <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" /> Requested On
              </p>
              <p className="text-sm font-medium">{fmtDateTime(detail.createdAt)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Reason + Remarks */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400">
              <FileText className="h-3 w-3" /> Reason
            </div>
            <p className="text-sm font-medium">{detail.leaveReason?.reasonName ?? '—'}</p>
            {detail.remarks && (
              <div className="mt-2">
                <p className="text-[10px] text-muted-foreground">Employee Remarks</p>
                <p className="text-sm text-muted-foreground italic">&quot;{detail.remarks}&quot;</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approval Timeline */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400">
              <Clock className="h-3 w-3" /> Approval Timeline
            </div>
            {(() => {
              const hrApproverName = (detail as any).hrApproverName as string | undefined;
              // Admin final-approved when there's a recorded approver name but
              // no HR employee id — admins live outside the employees table,
              // so hr_id can't carry them.
              const isFinal = detail.status === 'hr_approved' || detail.status === 'hr_rejected';
              const adminFinal = isFinal && detail.hrId == null && !!hrApproverName;
              const autoWord = detail.status === 'hr_rejected' ? 'Auto-rejected' : 'Auto-approved';
              const showHrRow =
                detail.status === 'manager_approved' ||
                detail.status === 'hr_approved' ||
                detail.status === 'hr_rejected' ||
                !!detail.hrActionAt;

              return (
                <>
                  {/* Manager row */}
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 h-3 w-3 rounded-full shrink-0 ${
                      detail.status === 'manager_rejected' ? 'bg-red-500' :
                      detail.managerActionAt ? 'bg-emerald-500' :
                      isFinal ? 'bg-emerald-500' : 'bg-amber-400'
                    }`} />
                    <div>
                      <p className="text-sm font-medium">Manager: {detail.manager?.name ?? '—'}</p>
                      {detail.managerActionAt ? (
                        <>
                          <p className="text-xs text-muted-foreground">
                            {detail.status === 'manager_rejected' ? 'Rejected' : 'Approved'} on {fmtDateTime(detail.managerActionAt)}
                          </p>
                          {detail.managerRemarks && <p className="text-xs text-muted-foreground mt-0.5 italic">&quot;{detail.managerRemarks}&quot;</p>}
                        </>
                      ) : isFinal ? (
                        // HR (or admin) actioned directly — the manager step was
                        // bypassed, so flag it as auto-approved/-rejected rather
                        // than leaving it stuck on "Pending action".
                        <p className="text-xs text-muted-foreground">{autoWord} (HR actioned directly)</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Pending action</p>
                      )}
                    </div>
                  </div>

                  {/* HR row */}
                  {showHrRow && (
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 h-3 w-3 rounded-full shrink-0 ${
                        detail.status === 'hr_rejected' ? 'bg-red-500' :
                        detail.hrActionAt || adminFinal ? 'bg-emerald-500' : 'bg-amber-400'
                      }`} />
                      <div>
                        <p className="text-sm font-medium">
                          HR: {adminFinal ? '—' : (detail.hr?.name ?? hrApproverName ?? 'Pending')}
                        </p>
                        {adminFinal ? (
                          <p className="text-xs text-muted-foreground">{autoWord}</p>
                        ) : detail.hrActionAt ? (
                          <>
                            <p className="text-xs text-muted-foreground">
                              {detail.status === 'hr_rejected' ? 'Rejected' : 'Approved'} on {fmtDateTime(detail.hrActionAt)}
                            </p>
                            {detail.hrRemarks && <p className="text-xs text-muted-foreground mt-0.5 italic">&quot;{detail.hrRemarks}&quot;</p>}
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">Pending action</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Admin row — only when admin was the final decision-maker */}
                  {adminFinal && (
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 h-3 w-3 rounded-full shrink-0 ${
                        detail.status === 'hr_rejected' ? 'bg-red-500' : 'bg-emerald-500'
                      }`} />
                      <div>
                        <p className="text-sm font-medium">Admin: {hrApproverName}</p>
                        <p className="text-xs text-muted-foreground">
                          {detail.status === 'hr_rejected' ? 'Rejected' : 'Approved'}
                          {detail.hrActionAt ? ` on ${fmtDateTime(detail.hrActionAt)}` : ''}
                        </p>
                        {detail.hrRemarks && <p className="text-xs text-muted-foreground mt-0.5 italic">&quot;{detail.hrRemarks}&quot;</p>}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>

      </div>


      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Watchers */}
        {detail.watchers && detail.watchers.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-pink-600 dark:text-pink-400">
                <Users className="h-3 w-3" /> Watchers
              </div>
              <div className="flex flex-wrap gap-1.5">
                {detail.watchers.map((w: any) => (
                  <Badge key={w.id} variant="outline" className="text-xs">
                    {w.employee?.name ?? `Employee #${w.employeeId}`}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {(canAct.canApprove || canAct.canReject || canAct.canCancel || canAct.canEdit) && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                <MessageSquare className="h-3 w-3" /> Actions
              </div>
              {(canAct.canApprove || canAct.canReject) && (
                <div className="flex gap-2">
                  {canAct.canApprove && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => setActionDialog({ open: true, action: 'approve' })}
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Approve
                    </Button>
                  )}
                  {canAct.canReject && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setActionDialog({ open: true, action: 'reject' })}
                    >
                      <XCircle className="mr-1.5 h-3.5 w-3.5" />
                      {detail.status === 'hr_approved' ? 'Reject (revoke approval)' : 'Reject'}
                    </Button>
                  )}
                </div>
              )}
              {(canAct.canEdit || canAct.canCancel) && (
                <div className="flex flex-wrap gap-2">
                  {canAct.canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditOpen(true)}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit Request
                    </Button>
                  )}
                  {canAct.canCancel && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      disabled={cancelMut.isPending}
                      onClick={() => cancelMut.mutate()}
                    >
                      <Ban className="mr-1.5 h-3.5 w-3.5" />
                      {cancelMut.isPending ? 'Cancelling...' : 'Cancel Request'}
                    </Button>
                  )}
                </div>
              )}
              {canAct.canEdit && (
                <p className="text-[11px] text-muted-foreground">
                  You can edit or cancel this request only while it is pending. Once your manager or HR actions it, it locks.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Edit dialog — owner-only, pending-only. */}
        <EditLeaveDialog open={editOpen} onOpenChange={setEditOpen} leave={detail} />

        {/* Approve / Reject dialog — remarks optional on approve, required on reject. */}
        <LeaveActionDialog
          open={actionDialog.open}
          onOpenChange={(v) => setActionDialog((p) => ({ ...p, open: v }))}
          action={actionDialog.action}
          leaveId={leaveId}
          rejectIsRevoke={detail.status === 'hr_approved'}
        />

      </div>

    </div>
  );
}
