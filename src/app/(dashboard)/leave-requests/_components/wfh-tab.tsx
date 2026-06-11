/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { CalendarDays, Eye, CheckCircle2, XCircle } from 'lucide-react';
import { wfhRequestsApi } from '@/lib/api/wfh-requests';
import { useAuth } from '@/providers/auth-provider';
import { WfhRequest, WfhRequestStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { WfhActionDialog } from './wfh-action-dialog';

type SimpleStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

const SIMPLE_STATUS_CONFIG: Record<SimpleStatus, { label: string; color: string }> = {
  pending:   { label: 'Pending',   color: 'bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-400' },
  approved:  { label: 'Approved',  color: 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400' },
  rejected:  { label: 'Rejected',  color: 'bg-red-500/15 text-red-600 ring-red-500/30 dark:text-red-400' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500/15 text-gray-500 ring-gray-500/30 dark:text-gray-400' },
};

/** Same collapse rules as the Leave page so the visual stays consistent. */
function toSimpleStatus(raw: WfhRequestStatus): SimpleStatus {
  if (raw === 'hr_approved') return 'approved';
  if (raw === 'manager_rejected' || raw === 'hr_rejected') return 'rejected';
  if (raw === 'cancelled') return 'cancelled';
  return 'pending';
}

function StatusBadge({ w }: { w: { status: WfhRequestStatus } }) {
  const simple = toSimpleStatus(w.status);
  const cfg = SIMPLE_STATUS_CONFIG[simple];
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

interface Props {
  /**
   * 'my' fetches /employee/wfh-requests for the current user; 'team'
   * fetches /employee/wfh-requests/team (RM / HR) when employee, or
   * /wfh-requests (all) when admin.
   */
  scope: 'my' | 'team';
  statusFilter: SimpleStatus | 'all';
  /** Optional employee filter on the team view. */
  teamEmployeeId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function WfhTab({ scope, statusFilter, teamEmployeeId, dateFrom, dateTo }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const isEmployee = user?._type === 'employee';
  const isAdmin = user?._type === 'admin';
  const isHr = isEmployee && !!(user as { isHr?: boolean })?.isHr;
  const userId = (user as { id?: number })?.id;

  // Action confirmation dialog state — drives `<WfhActionDialog />`.
  // `target.row` is carried alongside so the dialog knows whether the
  // rejection is "revoking" an HR-approved row (admin-only edge case)
  // and can swap its title accordingly.
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    action: 'approve' | 'reject';
    row: WfhRequest | null;
  }>({ open: false, action: 'approve', row: null });

  // ── Fetch ─────────────────────────────────────────────────────────
  // 'my'  → my own history (works for employee + admin)
  // 'team' employee→ team (RM/HR scope), admin→ all
  const { data: myData, isLoading: myLoading } = useQuery({
    queryKey: ['my-wfh-requests', dateFrom, dateTo],
    queryFn: () =>
      wfhRequestsApi
        .getMyRequests({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          limit: 100,
          sort: 'createdAt',
          order: 'desc',
        })
        .then((r) => r.data.data),
    // Plain employees on 'my' tab + HR on My Leave clone. Admins use
    // submitAdmin to file their own WFH so they hit the same admin
    // endpoint; we still want their own history on 'my'. Easiest: for
    // admins on 'my', filter the company-wide list client-side.
    enabled: scope === 'my' && isEmployee,
  });

  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['team-wfh-requests', teamEmployeeId, dateFrom, dateTo],
    queryFn: () =>
      wfhRequestsApi
        .getTeamRequests({
          employeeId: teamEmployeeId ? Number(teamEmployeeId) : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          limit: 100,
          sort: 'createdAt',
          order: 'desc',
        })
        .then((r) => r.data.data),
    enabled: scope === 'team' && isEmployee,
  });

  // Admins get the company-wide list and we filter client-side.
  const { data: adminData, isLoading: adminLoading } = useQuery({
    queryKey: ['wfh-requests', dateFrom, dateTo],
    queryFn: () =>
      wfhRequestsApi
        .getAll({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          limit: 100,
          sort: 'createdAt',
          order: 'desc',
        })
        .then((r) => r.data.data),
    enabled: isAdmin,
  });

  // ── Pick the right slice ──────────────────────────────────────────
  const rawData = (() => {
    if (isAdmin) {
      if (scope === 'my') {
        return (adminData ?? []).filter((w) => w.adminId != null && w.adminId === userId);
      }
      return adminData;
    }
    return scope === 'my' ? myData : teamData;
  })();

  const data = statusFilter === 'all'
    ? rawData
    : (rawData ?? []).filter((w) => toSimpleStatus(w.status) === statusFilter);

  const isLoading = isAdmin
    ? adminLoading
    : scope === 'my' ? myLoading : teamLoading;

  // ── Row actions ───────────────────────────────────────────────────
  // Mirror the leave page's inline approve/reject controls so HR /
  // admin can act on a row without drilling into detail.
  const showEmployeeCol = scope !== 'my';
  const showActionsCol = isAdmin || isHr;
  const canActOnRow = (w: WfhRequest) => {
    if (!showActionsCol) return { canApprove: false, canReject: false };
    const isOwnAdmin = isAdmin && w.adminId != null && w.adminId === userId;
    const isOwnEmployee = !isAdmin && w.employeeId != null && w.employeeId === userId;
    if (isOwnAdmin || isOwnEmployee) return { canApprove: false, canReject: false };
    if (isAdmin) {
      return {
        canApprove: ['pending', 'manager_approved'].includes(w.status),
        canReject: ['pending', 'manager_approved', 'hr_approved'].includes(w.status),
      };
    }
    const actionable = ['pending', 'manager_approved'].includes(w.status);
    return { canApprove: actionable, canReject: actionable };
  };

  // Inline icons now open the shared confirmation dialog instead of
  // firing the mutation immediately — keeps the "rejections must have
  // a reason" rule consistent between the list and the detail page.
  const openAction = (row: WfhRequest, action: 'approve' | 'reject') =>
    setActionDialog({ open: true, action, row });

  // ── Render ────────────────────────────────────────────────────────
  const baseCols = showEmployeeCol ? 8 : 7;
  const cols = baseCols + (showActionsCol ? 2 : 1);

  return (
    <>
    <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
      <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-cyan-500 via-blue-500 to-indigo-500" />
      <Table>
        <TableHeader>
          <TableRow>
            {showEmployeeCol && <TableHead>Employee</TableHead>}
            <TableHead>Reason</TableHead>
            <TableHead>From</TableHead>
            <TableHead>To</TableHead>
            <TableHead>Days</TableHead>
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
                <TableRow key={i}>
                  {[...Array(cols)].map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-16" /></TableCell>
                  ))}
                </TableRow>
              ))
            : (data ?? []).length === 0
              ? (
                <TableRow>
                  <TableCell colSpan={cols} className="h-32">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 mb-3">
                        <CalendarDays className="h-6 w-6 text-blue-500" />
                      </div>
                      <p className="text-sm font-medium text-foreground">No WFH requests found</p>
                      <p className="text-xs text-muted-foreground mt-1">Adjust your filters or date range</p>
                    </div>
                  </TableCell>
                </TableRow>
              )
              : (data ?? []).map((w) => (
                <TableRow
                  key={w.id}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => router.push(`/leave-requests/wfh/${w.id}`)}
                >
                  {showEmployeeCol && (
                    <TableCell className="font-medium text-sm">
                      {w.adminId != null
                        ? (w as { admin?: { name?: string } }).admin?.name ?? `Admin #${w.adminId}`
                        : w.employee?.name ?? `#${w.employeeId ?? '?'}`}
                      <span className="block text-xs text-muted-foreground">
                        {w.adminId != null ? 'Admin' : w.employee?.empCode}
                      </span>
                      {(() => {
                        const filedById = w.appliedById ?? null;
                        const subjId = w.adminId ?? w.employeeId ?? null;
                        const subjType = w.adminId != null ? 'admin' : 'employee';
                        const isOnBehalf =
                          filedById != null && (filedById !== subjId || w.appliedByType !== subjType);
                        if (!isOnBehalf || !w.appliedByName) return null;
                        return (
                          <span className="block text-[10px] italic text-muted-foreground/80 mt-0.5">
                            Applied by {w.appliedByName}
                            {w.appliedByType === 'admin' ? ' (Admin)' : ' (HR)'}
                          </span>
                        );
                      })()}
                    </TableCell>
                  )}
                  <TableCell className="text-sm max-w-[260px] truncate" title={w.reason}>
                    {w.reason || '—'}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{w.dateFrom}</TableCell>
                  <TableCell className="text-xs font-mono">{w.dateTo}</TableCell>
                  <TableCell className="text-center font-semibold">{w.totalDays}</TableCell>
                  <TableCell><StatusBadge w={w} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {w.manager?.name ?? '-'}
                    {w.managerActionAt && (
                      <span className="block text-[10px] text-muted-foreground/60">
                        {format(new Date(w.managerActionAt), 'dd MMM yyyy')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {(w as any).hrApproverName ?? w.hr?.name ?? '-'}
                    {w.hrActionAt && (
                      <span className="block text-[10px] text-muted-foreground/60">
                        {format(new Date(w.hrActionAt), 'dd MMM yyyy')}
                      </span>
                    )}
                  </TableCell>
                  {showActionsCol && (() => {
                    const { canApprove, canReject } = canActOnRow(w);
                    if (!canApprove && !canReject) {
                      return <TableCell className="text-xs text-muted-foreground/60">—</TableCell>;
                    }
                    return (
                      <TableCell>
                        <div className="flex gap-1">
                          {canApprove && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                              title="Approve"
                              onClick={(e) => { e.stopPropagation(); openAction(w, 'approve'); }}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          {canReject && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-600 hover:bg-red-500/10 hover:text-red-700"
                              title="Reject"
                              onClick={(e) => { e.stopPropagation(); openAction(w, 'reject'); }}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    );
                  })()}
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); router.push(`/leave-requests/wfh/${w.id}`); }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>

    {/* Shared approve / reject confirmation dialog. Only renders the
        textarea/button shape — invalidation + toast live inside the
        dialog so the list refreshes the moment the mutation settles. */}
    {actionDialog.row && (
      <WfhActionDialog
        open={actionDialog.open}
        onOpenChange={(v) => setActionDialog((p) => ({ ...p, open: v }))}
        action={actionDialog.action}
        wfhId={actionDialog.row.id}
        rejectIsRevoke={actionDialog.row.status === 'hr_approved'}
      />
    )}
    </>
  );
}
