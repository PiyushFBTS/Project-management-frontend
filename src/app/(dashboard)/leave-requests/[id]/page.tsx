/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft, CalendarDays, CheckCircle2, XCircle, Ban, User, Clock, FileText, Users, MessageSquare,
} from 'lucide-react';
import { leaveRequestsApi } from '@/lib/api/leave-requests';
import { useAuth } from '@/providers/auth-provider';
import { LeaveRequestStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400' },
  manager_approved: { label: 'Manager Approved', color: 'text-blue-700', bg: 'bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' },
  manager_rejected: { label: 'Manager Rejected', color: 'text-red-700', bg: 'bg-red-100 dark:bg-red-900/30 dark:text-red-400' },
  hr_approved: { label: 'HR Approved', color: 'text-emerald-700', bg: 'bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400' },
  hr_rejected: { label: 'HR Rejected', color: 'text-red-700', bg: 'bg-red-100 dark:bg-red-900/30 dark:text-red-400' },
  cancelled: { label: 'Cancelled', color: 'text-slate-700', bg: 'bg-slate-100 dark:bg-slate-900/30 dark:text-slate-400' },
};

function StatusBadge({ lr }: { lr: { status: string; hrId?: number | null; hrApproverName?: string | null } }) {
  const c = statusConfig[lr.status] ?? { label: lr.status, bg: 'bg-slate-100' };
  // Admins live outside the employees table — when the final-action row has
  // no hr_id but a stamped hr_approver_name, an admin took the action.
  const adminFinal =
    (lr.status === 'hr_approved' || lr.status === 'hr_rejected') &&
    lr.hrId == null &&
    !!lr.hrApproverName;
  let label = c.label;
  if (adminFinal && lr.status === 'hr_approved') label = 'Admin Approved';
  if (adminFinal && lr.status === 'hr_rejected') label = 'Admin Rejected';
  return <Badge className={`${c.bg} border-0 text-xs font-semibold`}>{label}</Badge>;
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
  const [actionRemarks, setActionRemarks] = useState('');

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
  const canAct = (() => {
    if (!detail || !user) return { canApprove: false, canReject: false, canCancel: false };
    const isOwn = isEmployee && detail.employeeId === (user as any).id;
    const canCancel = isOwn && !['cancelled', 'hr_approved', 'hr_rejected', 'manager_rejected'].includes(detail.status);

    let canApprove = false;
    let canReject = false;
    if (isAdmin) {
      canApprove = ['pending', 'manager_approved'].includes(detail.status);
      // Admin can also reject an already-approved leave to revoke it.
      canReject = ['pending', 'manager_approved', 'hr_approved'].includes(detail.status);
    } else if (isEmployee) {
      const isManager = detail.employee?.reportsToId === (user as any).id;
      const isHr = !!(user as any).isHr;
      if (isManager && detail.status === 'pending') { canApprove = true; canReject = true; }
      if (isHr && ['pending', 'manager_approved'].includes(detail.status)) { canApprove = true; canReject = true; }
    }
    return { canApprove, canReject, canCancel };
  })();

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['leave-request-detail', leaveId] });
    qc.invalidateQueries({ queryKey: ['leave-requests'] });
    qc.invalidateQueries({ queryKey: ['my-leave-requests'] });
    qc.invalidateQueries({ queryKey: ['pending-approvals'] });
  };

  const approveMut = useMutation({
    mutationFn: () => leaveRequestsApi.approveLeave(leaveId, actionRemarks || undefined),
    onSuccess: () => { toast.success('Approved'); invalidateAll(); setActionRemarks(''); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const rejectMut = useMutation({
    mutationFn: () => leaveRequestsApi.rejectLeave(leaveId, actionRemarks || undefined),
    onSuccess: () => { toast.success('Rejected'); invalidateAll(); setActionRemarks(''); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

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
              <p className="font-semibold">{detail.employee?.empName}</p>
              <p className="text-xs text-muted-foreground">{detail.employee?.empCode} · {detail.employee?.email}</p>
            </div>
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
                <p className="text-sm font-bold">{detail.totalDays}</p>
              </div>
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
                      adminFinal ? 'bg-emerald-500' : 'bg-amber-400'
                    }`} />
                    <div>
                      <p className="text-sm font-medium">Manager: {detail.manager?.empName ?? '—'}</p>
                      {detail.managerActionAt ? (
                        <>
                          <p className="text-xs text-muted-foreground">
                            {detail.status === 'manager_rejected' ? 'Rejected' : 'Approved'} on {fmtDateTime(detail.managerActionAt)}
                          </p>
                          {detail.managerRemarks && <p className="text-xs text-muted-foreground mt-0.5 italic">&quot;{detail.managerRemarks}&quot;</p>}
                        </>
                      ) : adminFinal ? (
                        <p className="text-xs text-muted-foreground">{autoWord}</p>
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
                          HR: {adminFinal ? '—' : (detail.hr?.empName ?? hrApproverName ?? 'Pending')}
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
                    {w.employee?.empName ?? `Employee #${w.employeeId}`}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {(canAct.canApprove || canAct.canReject || canAct.canCancel) && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                <MessageSquare className="h-3 w-3" /> Actions
              </div>
              {(canAct.canApprove || canAct.canReject) && (
                <>
                  <Textarea
                    placeholder="Remarks (optional)"
                    value={actionRemarks}
                    onChange={(e) => setActionRemarks(e.target.value)}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    {canAct.canApprove && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={approveMut.isPending || rejectMut.isPending}
                        onClick={() => approveMut.mutate()}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        {approveMut.isPending ? 'Processing...' : 'Approve'}
                      </Button>
                    )}
                    {canAct.canReject && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={approveMut.isPending || rejectMut.isPending}
                        onClick={() => rejectMut.mutate()}
                      >
                        <XCircle className="mr-1.5 h-3.5 w-3.5" />
                        {rejectMut.isPending
                          ? 'Processing...'
                          : detail.status === 'hr_approved'
                            ? 'Reject (revoke approval)'
                            : 'Reject'}
                      </Button>
                    )}
                  </div>
                </>
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
            </CardContent>
          </Card>
        )}

      </div>

    </div>
  );
}
