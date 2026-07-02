/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft, CalendarClock, CheckCircle2, XCircle, Ban, User, Clock, FileText, MessageSquare,
} from 'lucide-react';
import { weeklyOffRequestsApi } from '@/lib/api/weekly-off-requests';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { WeeklyOffActionDialog } from '../../_components/weekly-off-action-dialog';

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
function StatusBadge({ w }: { w: { status: string } }) {
  const c = SIMPLE_STATUS_CONFIG[toSimpleStatus(w.status)];
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

export default function WeeklyOffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';
  const isEmployee = user?._type === 'employee';
  const [actionDialog, setActionDialog] = useState<{ open: boolean; action: 'approve' | 'reject' }>({ open: false, action: 'approve' });

  const woId = Number(id);

  const { data: detail, isLoading } = useQuery({
    queryKey: ['weekly-off-request-detail', woId, isEmployee],
    queryFn: () => (isEmployee ? weeklyOffRequestsApi.getOneForEmployee(woId) : weeklyOffRequestsApi.getOne(woId)).then((r) => r.data.data),
    enabled: !!id,
  });

  const canAct = (() => {
    if (!detail || !user) return { canApprove: false, canReject: false, canCancel: false };
    const userId = (user as { id: number }).id;
    const isOwnEmployee = isEmployee && detail.employeeId === userId;
    const isOwnAdmin = isAdmin && detail.adminId != null && detail.adminId === userId;
    const isOwn = isOwnEmployee || isOwnAdmin;
    const canCancel = isOwn && ['pending', 'manager_approved'].includes(detail.status);
    let canApprove = false;
    let canReject = false;
    if (isAdmin) {
      if (!isOwnAdmin) {
        canApprove = ['pending', 'manager_approved'].includes(detail.status);
        canReject = ['pending', 'manager_approved'].includes(detail.status);
      }
    } else if (isEmployee) {
      const isManager = (detail.manager as any)?.id === userId || detail.managerId === userId;
      const isHr = !!(user as { isHr?: boolean }).isHr;
      if (isManager && detail.status === 'pending' && !isOwnEmployee) { canApprove = true; canReject = true; }
      if (isHr && ['pending', 'manager_approved'].includes(detail.status) && !isOwnEmployee) { canApprove = true; canReject = true; }
    }
    return { canApprove, canReject, canCancel };
  })();

  const cancelMut = useMutation({
    mutationFn: () => weeklyOffRequestsApi.cancel(woId),
    onSuccess: () => {
      toast.success('Cancelled');
      qc.invalidateQueries({ queryKey: ['weekly-off-request-detail', woId] });
      qc.invalidateQueries({ queryKey: ['weekly-off-requests'] });
      qc.invalidateQueries({ queryKey: ['my-weekly-off-requests'] });
      qc.invalidateQueries({ queryKey: ['team-weekly-off-requests'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  if (isLoading) {
    return <div className="space-y-4 max-w-3xl mx-auto"><Skeleton className="h-8 w-48" /><Skeleton className="h-40 w-full" /><Skeleton className="h-32 w-full" /></div>;
  }
  if (!detail) {
    return <div className="text-center py-20"><p className="text-muted-foreground">Weekly-off request not found</p><Button variant="link" onClick={() => router.back()}>Go back</Button></div>;
  }

  const isFinal = detail.status === 'hr_approved' || detail.status === 'hr_rejected';
  const hrApproverName = (detail as any).hrApproverName as string | undefined;
  const adminFinal = isFinal && detail.hrId == null && !!hrApproverName;
  const autoWord = detail.status === 'hr_rejected' ? 'Auto-rejected' : 'Auto-approved';
  const showHrRow = detail.status === 'manager_approved' || isFinal || !!detail.hrActionAt;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold flex items-center gap-2"><CalendarClock className="h-4 w-4 text-emerald-600" /> Weekly-Off Request</h1>
          <p className="text-xs text-muted-foreground">#{detail.id} · Applied {fmtDate(detail.createdAt)}</p>
        </div>
        <StatusBadge w={detail as any} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-violet-600 dark:text-violet-400"><User className="h-3 w-3" /> Employee</div>
            <div>
              <p className="font-semibold">{detail.employee?.name ?? detail.admin?.name ?? '—'}</p>
              <p className="text-xs text-muted-foreground">{detail.employee?.empCode ?? (detail.adminId != null ? 'Admin' : '')} {detail.employee?.email ? `· ${detail.employee.email}` : ''}</p>
            </div>
            {detail.appliedByName && detail.appliedById !== (detail.employeeId ?? detail.adminId) && (
              <div className="rounded-md border border-amber-200/40 bg-amber-50/50 dark:bg-amber-500/10 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-amber-700 dark:text-amber-400">Applied By</p>
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">{detail.appliedByName}<span className="text-muted-foreground ml-1">({detail.appliedByType === 'admin' ? 'Admin' : 'HR'})</span></p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400"><CalendarClock className="h-3 w-3" /> The Swap</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground">Day Off (weekday)</p>
                <p className="text-sm font-mono font-medium">{fmtDate(detail.offDate)}</p>
                <p className="text-[10px] text-muted-foreground">{format(new Date(detail.offDate + 'T00:00:00'), 'EEEE')}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Works Saturday</p>
                <p className="text-sm font-mono font-medium">{fmtDate(detail.workDate)}</p>
                <p className="text-[10px] text-muted-foreground">Saturday</p>
              </div>
            </div>
            <div className="pt-2 border-t border-border/50">
              <p className="flex items-center gap-1 text-[10px] text-muted-foreground"><Clock className="h-3 w-3" /> Requested On</p>
              <p className="text-sm font-medium">{fmtDateTime(detail.createdAt)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400"><FileText className="h-3 w-3" /> Reason</div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{detail.reason || '—'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400"><Clock className="h-3 w-3" /> Approval Timeline</div>
            <div className="flex items-start gap-3">
              <div className={`mt-1 h-3 w-3 rounded-full shrink-0 ${detail.status === 'manager_rejected' ? 'bg-red-500' : detail.managerActionAt ? 'bg-emerald-500' : isFinal ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              <div>
                <p className="text-sm font-medium">Manager: {detail.manager?.name ?? '—'}</p>
                {detail.managerActionAt ? (
                  <>
                    <p className="text-xs text-muted-foreground">{detail.status === 'manager_rejected' ? 'Rejected' : 'Approved'} on {fmtDateTime(detail.managerActionAt)}</p>
                    {detail.managerRemarks && <p className="text-xs text-muted-foreground mt-0.5 italic">&quot;{detail.managerRemarks}&quot;</p>}
                  </>
                ) : isFinal ? (
                  <p className="text-xs text-muted-foreground">{autoWord} (HR actioned directly)</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Pending action</p>
                )}
              </div>
            </div>
            {showHrRow && (
              <div className="flex items-start gap-3">
                <div className={`mt-1 h-3 w-3 rounded-full shrink-0 ${detail.status === 'hr_rejected' ? 'bg-red-500' : detail.hrActionAt || adminFinal ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                <div>
                  <p className="text-sm font-medium">HR: {adminFinal ? hrApproverName : (detail.hr?.name ?? hrApproverName ?? 'Pending')}</p>
                  {detail.hrActionAt ? (
                    <>
                      <p className="text-xs text-muted-foreground">{detail.status === 'hr_rejected' ? 'Rejected' : 'Approved'} on {fmtDateTime(detail.hrActionAt)}</p>
                      {detail.hrRemarks && <p className="text-xs text-muted-foreground mt-0.5 italic">&quot;{detail.hrRemarks}&quot;</p>}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Pending action</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(canAct.canApprove || canAct.canReject || canAct.canCancel) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground"><MessageSquare className="h-3 w-3" /> Actions</div>
            {(canAct.canApprove || canAct.canReject) && (
              <div className="flex gap-2">
                {canAct.canApprove && (
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setActionDialog({ open: true, action: 'approve' })}>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Approve
                  </Button>
                )}
                {canAct.canReject && (
                  <Button size="sm" variant="destructive" onClick={() => setActionDialog({ open: true, action: 'reject' })}>
                    <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject
                  </Button>
                )}
              </div>
            )}
            {canAct.canCancel && (
              <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" disabled={cancelMut.isPending} onClick={() => cancelMut.mutate()}>
                <Ban className="mr-1.5 h-3.5 w-3.5" /> {cancelMut.isPending ? 'Cancelling...' : 'Cancel Request'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <WeeklyOffActionDialog
        open={actionDialog.open}
        onOpenChange={(v) => setActionDialog((p) => ({ ...p, open: v }))}
        action={actionDialog.action}
        weeklyOffId={woId}
        rejectIsRevoke={detail.status === 'hr_approved'}
        onSuccess={() => router.back()}
      />
    </div>
  );
}
