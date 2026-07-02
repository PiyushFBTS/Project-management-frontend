'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { CalendarClock, Eye, CheckCircle2, XCircle } from 'lucide-react';
import { weeklyOffRequestsApi } from '@/lib/api/weekly-off-requests';
import { useAuth } from '@/providers/auth-provider';
import { WeeklyOffRequest, WeeklyOffRequestStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { WeeklyOffActionDialog } from './weekly-off-action-dialog';

type SimpleStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

const SIMPLE_STATUS_CONFIG: Record<SimpleStatus, { label: string; color: string }> = {
  pending:   { label: 'Pending',   color: 'bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-400' },
  approved:  { label: 'Approved',  color: 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400' },
  rejected:  { label: 'Rejected',  color: 'bg-red-500/15 text-red-600 ring-red-500/30 dark:text-red-400' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500/15 text-gray-500 ring-gray-500/30 dark:text-gray-400' },
};

function toSimpleStatus(raw: WeeklyOffRequestStatus): SimpleStatus {
  if (raw === 'hr_approved') return 'approved';
  if (raw === 'manager_rejected' || raw === 'hr_rejected') return 'rejected';
  if (raw === 'cancelled') return 'cancelled';
  return 'pending';
}

function StatusBadge({ w }: { w: { status: WeeklyOffRequestStatus } }) {
  const cfg = SIMPLE_STATUS_CONFIG[toSimpleStatus(w.status)];
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cfg.color}`}>{cfg.label}</span>;
}

interface Props {
  scope: 'my' | 'team';
  statusFilter: SimpleStatus | 'all';
  teamEmployeeId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function WeeklyOffTab({ scope, statusFilter, teamEmployeeId, dateFrom, dateTo }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const isEmployee = user?._type === 'employee';
  const isAdmin = user?._type === 'admin';
  const isHr = isEmployee && !!(user as { isHr?: boolean })?.isHr;
  const userId = (user as { id?: number })?.id;

  const [actionDialog, setActionDialog] = useState<{ open: boolean; action: 'approve' | 'reject'; row: WeeklyOffRequest | null }>(
    { open: false, action: 'approve', row: null },
  );

  const { data: myData, isLoading: myLoading } = useQuery({
    queryKey: ['my-weekly-off-requests', dateFrom, dateTo],
    queryFn: () => weeklyOffRequestsApi.getMyRequests({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, limit: 100, sort: 'createdAt', order: 'desc' }).then((r) => r.data.data),
    enabled: scope === 'my' && isEmployee,
  });

  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['team-weekly-off-requests', teamEmployeeId, dateFrom, dateTo],
    queryFn: () => weeklyOffRequestsApi.getTeamRequests({ employeeId: teamEmployeeId ? Number(teamEmployeeId) : undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, limit: 100, sort: 'createdAt', order: 'desc' }).then((r) => r.data.data),
    enabled: scope === 'team' && isEmployee,
  });

  const { data: adminData, isLoading: adminLoading } = useQuery({
    queryKey: ['weekly-off-requests', dateFrom, dateTo],
    queryFn: () => weeklyOffRequestsApi.getAll({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, limit: 100, sort: 'createdAt', order: 'desc' }).then((r) => r.data.data),
    enabled: isAdmin,
  });

  const rawData = (() => {
    if (isAdmin) {
      if (scope === 'my') return (adminData ?? []).filter((w) => w.adminId != null && w.adminId === userId);
      return adminData;
    }
    return scope === 'my' ? myData : teamData;
  })();

  const data = statusFilter === 'all' ? rawData : (rawData ?? []).filter((w) => toSimpleStatus(w.status) === statusFilter);
  const isLoading = isAdmin ? adminLoading : scope === 'my' ? myLoading : teamLoading;

  const showEmployeeCol = scope !== 'my';
  const showActionsCol = isAdmin || isHr;
  const canActOnRow = (w: WeeklyOffRequest) => {
    if (!showActionsCol) return { canApprove: false, canReject: false };
    const isOwnAdmin = isAdmin && w.adminId != null && w.adminId === userId;
    const isOwnEmployee = !isAdmin && w.employeeId != null && w.employeeId === userId;
    if (isOwnAdmin || isOwnEmployee) return { canApprove: false, canReject: false };
    const actionable = ['pending', 'manager_approved'].includes(w.status);
    if (isAdmin) return { canApprove: actionable, canReject: actionable || w.status === 'hr_approved' };
    return { canApprove: actionable, canReject: actionable };
  };

  const openAction = (row: WeeklyOffRequest, action: 'approve' | 'reject') => setActionDialog({ open: true, action, row });

  const baseCols = showEmployeeCol ? 7 : 6;
  const cols = baseCols + (showActionsCol ? 2 : 1);

  return (
    <>
      <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
        <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-teal-500 via-emerald-500 to-green-500" />
        <Table>
          <TableHeader>
            <TableRow>
              {showEmployeeCol && <TableHead>Employee</TableHead>}
              <TableHead>Day Off</TableHead>
              <TableHead>Works Saturday</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>HR</TableHead>
              {showActionsCol && <TableHead className="w-28">Actions</TableHead>}
              <TableHead className="w-16">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? [...Array(5)].map((_, i) => (
                  <TableRow key={i}>{[...Array(cols)].map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-16" /></TableCell>)}</TableRow>
                ))
              : (data ?? []).length === 0
                ? (
                  <TableRow>
                    <TableCell colSpan={cols} className="h-32">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 mb-3">
                          <CalendarClock className="h-6 w-6 text-emerald-500" />
                        </div>
                        <p className="text-sm font-medium text-foreground">No weekly-off requests found</p>
                        <p className="text-xs text-muted-foreground mt-1">Adjust your filters or date range</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )
                : (data ?? []).map((w) => (
                  <TableRow key={w.id} className="cursor-pointer hover:bg-accent/50" onClick={() => router.push(`/leave-requests/weekly-off/${w.id}`)}>
                    {showEmployeeCol && (
                      <TableCell className="font-medium text-sm">
                        {w.adminId != null ? w.admin?.name ?? `Admin #${w.adminId}` : w.employee?.name ?? `#${w.employeeId ?? '?'}`}
                        <span className="block text-xs text-muted-foreground">{w.adminId != null ? 'Admin' : w.employee?.empCode}</span>
                        {(() => {
                          const filedById = w.appliedById ?? null;
                          const subjId = w.adminId ?? w.employeeId ?? null;
                          const subjType = w.adminId != null ? 'admin' : 'employee';
                          const isOnBehalf = filedById != null && (filedById !== subjId || w.appliedByType !== subjType);
                          if (!isOnBehalf || !w.appliedByName) return null;
                          return <span className="block text-[10px] italic text-muted-foreground/80 mt-0.5">Applied by {w.appliedByName}{w.appliedByType === 'admin' ? ' (Admin)' : ' (HR)'}</span>;
                        })()}
                      </TableCell>
                    )}
                    <TableCell className="text-xs font-mono">{w.offDate}</TableCell>
                    <TableCell className="text-xs font-mono">{w.workDate}</TableCell>
                    <TableCell><StatusBadge w={w} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {w.manager?.name ?? '-'}
                      {w.managerActionAt && <span className="block text-[10px] text-muted-foreground/60">{format(new Date(w.managerActionAt), 'dd MMM yyyy')}</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {w.hrApproverName ?? w.hr?.name ?? '-'}
                      {w.hrActionAt && <span className="block text-[10px] text-muted-foreground/60">{format(new Date(w.hrActionAt), 'dd MMM yyyy')}</span>}
                    </TableCell>
                    {showActionsCol && (() => {
                      const { canApprove, canReject } = canActOnRow(w);
                      if (!canApprove && !canReject) return <TableCell className="text-xs text-muted-foreground/60">—</TableCell>;
                      return (
                        <TableCell>
                          <div className="flex gap-1">
                            {canApprove && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700" title="Approve" onClick={(e) => { e.stopPropagation(); openAction(w, 'approve'); }}>
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            )}
                            {canReject && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:bg-red-500/10 hover:text-red-700" title="Reject" onClick={(e) => { e.stopPropagation(); openAction(w, 'reject'); }}>
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      );
                    })()}
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); router.push(`/leave-requests/weekly-off/${w.id}`); }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {actionDialog.row && (
        <WeeklyOffActionDialog
          open={actionDialog.open}
          onOpenChange={(v) => setActionDialog((p) => ({ ...p, open: v }))}
          action={actionDialog.action}
          weeklyOffId={actionDialog.row.id}
          rejectIsRevoke={actionDialog.row.status === 'hr_approved'}
        />
      )}
    </>
  );
}
