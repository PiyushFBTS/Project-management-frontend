/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Suspense, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, addMonths, subMonths, getDay } from 'date-fns';
import { CalendarDays, Eye, CheckCircle2, XCircle, Ban, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { leaveRequestsApi } from '@/lib/api/leave-requests';
import { wfhRequestsApi } from '@/lib/api/wfh-requests';
import { LeaveRequest, LeaveRequestStatus } from '@/types';
import { ApplyWfhDialog } from './_components/apply-wfh-dialog';
import { LeaveActionDialog } from './_components/leave-action-dialog';
import { WfhTab } from './_components/wfh-tab';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { SearchableSelect } from '@/components/ui/searchable-select';

// Simplified, user-facing status — collapses RM/HR steps into 3 buckets
// (Pending / Approved / Rejected). The full RM-then-HR breakdown is shown
// in the leave-detail timeline; the list/filter only shows these.
type SimpleStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

const SIMPLE_STATUS_CONFIG: Record<SimpleStatus, { label: string; color: string }> = {
  pending:   { label: 'Pending',   color: 'bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-400' },
  approved:  { label: 'Approved',  color: 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400' },
  rejected:  { label: 'Rejected',  color: 'bg-red-500/15 text-red-600 ring-red-500/30 dark:text-red-400' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500/15 text-gray-500 ring-gray-500/30 dark:text-gray-400' },
};

/**
 * Map a raw backend leave status to its simplified bucket:
 *  - pending / manager_approved → pending  (still needs HR action)
 *  - hr_approved                → approved (RM + HR both approved)
 *  - manager_rejected / hr_rejected → rejected
 *  - cancelled                  → cancelled
 */
function toSimpleStatus(raw: LeaveRequestStatus): SimpleStatus {
  if (raw === 'hr_approved') return 'approved';
  if (raw === 'manager_rejected' || raw === 'hr_rejected') return 'rejected';
  if (raw === 'cancelled') return 'cancelled';
  return 'pending';
}

/**
 * Tiny AM/PM pill rendered next to the day count when the request is
 * a half-day. Returns null for full-day requests so the caller can
 * inline it without a wrapper conditional.
 */
function HalfDayPill({ kind }: { kind?: 'first_half' | 'second_half' | null }) {
  if (!kind) return null;
  const label = kind === 'first_half' ? 'AM' : 'PM';
  return (
    <span className="ml-1 inline-block rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300 align-middle">
      {label}
    </span>
  );
}

function StatusBadge({ lr }: { lr: { status: LeaveRequestStatus } }) {
  const simple = toSimpleStatus(lr.status);
  const cfg = SIMPLE_STATUS_CONFIG[simple];
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// Plain (non-HR) employees see a 2-tab layout: Leave (their own) +
// Calendar (their own data only). HR + admin get a 3-tab layout: My
// Leaves (own) + Team Leaves (everyone) + Calendar (everyone).
// `my-wfh` and `team-wfh` were added 2026-06-11 (Sprint 2 of the WFH
// feature). Same surface as the Leave tabs — same filter strip,
// same status pills — but powered by `wfhRequestsApi` via the
// `<WfhTab />` component. Calendar stays a single tab that overlays
// both event sources.
type Tab = 'my-leaves' | 'team-leaves' | 'my-wfh' | 'team-wfh' | 'calendar';
type AdminTab = 'my-leaves' | 'team-leaves' | 'my-wfh' | 'team-wfh' | 'calendar';

export default function LeaveRequestsPage() {
  return (
    <Suspense fallback={<div className="flex h-40 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
      <LeaveRequestsContent />
    </Suspense>
  );
}

function LeaveRequestsContent() {
  const { user } = useAuth();
  const isEmployee = user?._type === 'employee';
  const isAdmin = user?._type === 'admin';
  // HR employees get the same 3-tab layout as admins (My / Team / Cal).
  const isHr = isEmployee && !!(user as { isHr?: boolean })?.isHr;

  // Detect reporting-manager status by pinging the team-leaves endpoint
  // with limit=1. Backend returns non-empty whenever the caller has at
  // least one direct report's leave on file. We only need this for plain
  // employees — admins and HR always see the Team tab.
  const { data: rmPing } = useQuery({
    queryKey: ['team-leaves-ping', (user as { id?: number })?.id],
    queryFn: () =>
      leaveRequestsApi
        .getTeamLeaves({ limit: 1 })
        .then((r) => (r.data.data ?? []) as LeaveRequest[]),
    enabled: !!user && isEmployee && !isHr,
  });
  const isRm = isEmployee && !isHr && (rmPing?.length ?? 0) > 0;
  // Single permission gate: who is allowed to see the Team Leaves tab.
  const canSeeTeam = isAdmin || isHr || isRm;

  // Pending-action counts for the Team tab badges — same semantics as the
  // sidebar badge: requests awaiting THIS user's action. Employees hit the
  // pending-approvals endpoint; admins (final gate) count company-wide
  // pending + manager_approved. Only fetched for users who see Team tabs.
  const pendingTotal = (r: any) =>
    r.data?.meta?.total ?? (Array.isArray(r.data?.data) ? r.data.data.length : 0);
  const countPending = async (mod: typeof leaveRequestsApi | typeof wfhRequestsApi) => {
    if (isEmployee) return pendingTotal(await mod.getPendingApprovals({ limit: 1 }));
    const [p, m] = await Promise.all([
      mod.getAll({ status: 'pending' as LeaveRequestStatus, limit: 1 }),
      mod.getAll({ status: 'manager_approved' as LeaveRequestStatus, limit: 1 }),
    ]);
    return pendingTotal(p) + pendingTotal(m);
  };
  const { data: teamLeavePending = 0 } = useQuery({
    queryKey: ['leave-tab-pending', isAdmin, isEmployee],
    queryFn: () => countPending(leaveRequestsApi),
    enabled: !!user && canSeeTeam,
    staleTime: 30_000,
  });
  const { data: teamWfhPending = 0 } = useQuery({
    queryKey: ['wfh-tab-pending', isAdmin, isEmployee],
    queryFn: () => countPending(wfhRequestsApi),
    enabled: !!user && canSeeTeam,
    staleTime: 30_000,
  });
  const tabBadge = (t: string) =>
    t === 'team-leaves' ? teamLeavePending : t === 'team-wfh' ? teamWfhPending : 0;

  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [tab, setTab] = useState<Tab>('my-leaves');
  // Admin landing tab is "team-leaves"; HR also defaults there. Plain
  // employees never see this and stay on "my-leaves" (renamed "Leave"
  // in the chip strip).
  const [adminTab, setAdminTab] = useState<AdminTab>('team-leaves');
  const [calMonth, setCalMonth] = useState(() => new Date());
  const [teamEmployeeId, setTeamEmployeeId] = useState<string>('');
  const [acting, setActing] = useState(false);
  const [actionDialog, setActionDialog] = useState<{ open: boolean; action: 'approve' | 'reject'; leaveId: number; isRevoke: boolean }>({
    open: false, action: 'approve', leaveId: 0, isRevoke: false,
  });

  // ── Apply for WFH dialog (Sprint 2) ──
  // Same self / on-behalf shape as the Leave dialog. Hosted as a
  // separate component so the inline Leave form stays untouched.
  const [applyWfhOpen, setApplyWfhOpen] = useState(false);
  const [applyWfhMode, setApplyWfhMode] = useState<'self' | 'on-behalf'>('self');

  // ── Apply for Leave dialog ──
  const [applyOpen, setApplyOpen] = useState(false);
  // 'self'      → caller is filing their own leave
  // 'on-behalf' → HR / admin is filing for another employee (extra
  //               Employee dropdown shows up; payload carries
  //               onBehalfOfEmployeeId).
  const [applyMode, setApplyMode] = useState<'self' | 'on-behalf'>('self');
  const [applyForm, setApplyForm] = useState({
    leaveReasonId: '',
    dateFrom: '',
    dateTo: '',
    remarks: '',
    watcherIds: [] as number[],
    onBehalfOfEmployeeId: '' as string,
    // 'full' = full day(s); maps to undefined on the wire.
    // 'first_half' / 'second_half' map straight through.
    halfDayKind: 'full' as 'full' | 'first_half' | 'second_half',
  });

  // Auto-open apply dialog from dashboard link (?apply=true)
  useEffect(() => {
    if (searchParams.get('apply') === 'true' && (isEmployee || isAdmin)) {
      setApplyOpen(true);
      window.history.replaceState(null, '', '/leave-requests');
    }
  }, [searchParams, isEmployee, isAdmin]);

  // Fetch leave types for the form. Admin and employee use different
  // endpoints — same shape, different guards. Wait for `user` to resolve
  // before firing: otherwise `isAdmin` may be briefly false during auth
  // bootstrap and the query would silently 401 against the employee
  // endpoint (admin token can't read /employee/leave-types).
  const { data: leaveReasons } = useQuery({
    queryKey: ['leave-types-dropdown', isAdmin ? 'admin' : 'emp'],
    queryFn: () =>
      (isAdmin
        ? leaveRequestsApi.getAdminLeaveTypes()
        : leaveRequestsApi.getLeaveReasons()
      ).then((r) => r.data.data),
    enabled: applyOpen && !!user,
  });

  // Fetch colleagues for watcher selection + team employee filter
  const { data: colleagues } = useQuery({
    queryKey: ['colleagues-dropdown', isAdmin ? 'admin' : 'emp'],
    queryFn: () =>
      (isAdmin
        ? leaveRequestsApi.getAdminColleagues()
        : leaveRequestsApi.getColleagues()
      ).then((r) => r.data.data),
    enabled:
      !!user && (applyOpen || (isEmployee && tab === 'team-leaves')),
  });

  const submitLeaveMutation = useMutation({
    mutationFn: () => {
      // Defensive: half-day on a multi-day range gets a 400 from the
      // server. Clamp here so a stale `halfDayKind` from a user who
      // toggled dates after selecting AM/PM doesn't slip through.
      const isSingleDay =
        applyForm.dateFrom !== '' && applyForm.dateFrom === applyForm.dateTo;
      const halfDayKind =
        isSingleDay && applyForm.halfDayKind !== 'full'
          ? applyForm.halfDayKind
          : undefined;
      const payload = {
        leaveReasonId: Number(applyForm.leaveReasonId),
        dateFrom: applyForm.dateFrom,
        dateTo: applyForm.dateTo,
        remarks: applyForm.remarks || undefined,
        watcherIds: applyForm.watcherIds.length > 0 ? applyForm.watcherIds : undefined,
        onBehalfOfEmployeeId:
          applyMode === 'on-behalf' && applyForm.onBehalfOfEmployeeId
            ? Number(applyForm.onBehalfOfEmployeeId)
            : undefined,
        halfDayKind,
      };
      return isAdmin
        ? leaveRequestsApi.submitAdminLeave(payload)
        : leaveRequestsApi.submitLeave(payload);
    },
    onSuccess: () => {
      toast.success('Leave request submitted successfully');
      setApplyOpen(false);
      setApplyMode('self');
      setApplyForm({ leaveReasonId: '', dateFrom: '', dateTo: '', remarks: '', watcherIds: [], onBehalfOfEmployeeId: '', halfDayKind: 'full' });
      invalidateAll();
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message;
      toast.error(typeof msg === 'string' ? msg : 'Failed to submit leave request');
    },
  });

  const handleSubmitLeave = () => {
    if (!applyForm.leaveReasonId || !applyForm.dateFrom || !applyForm.dateTo) {
      toast.error('Please fill all required fields');
      return;
    }
    if (applyMode === 'on-behalf' && !applyForm.onBehalfOfEmployeeId) {
      toast.error('Please select an employee');
      return;
    }
    if (applyForm.dateFrom > applyForm.dateTo) {
      toast.error('End date must be after start date');
      return;
    }
    submitLeaveMutation.mutate();
  };

  const toggleWatcher = (id: number) => {
    setApplyForm((prev) => ({
      ...prev,
      watcherIds: prev.watcherIds.includes(id)
        ? prev.watcherIds.filter((w) => w !== id)
        : [...prev.watcherIds, id],
    }));
  };

  // Admin: all leave requests. Status is filtered client-side now (the
  // simplified Pending bucket spans 2 raw statuses, so a single backend
  // status filter no longer maps cleanly).
  const { data: adminData, isLoading: adminLoading } = useQuery({
    queryKey: ['leave-requests', search, dateFrom, dateTo],
    queryFn: () =>
      leaveRequestsApi
        .getAll({
          search: search || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          limit: 100,
          sort: 'createdAt',
          order: 'desc',
        })
        .then((r) => r.data.data),
    enabled: !isEmployee,
  });

  // Employee: my leaves. Loaded for plain employees on their only list
  // tab and for HR on the My-Leaves tab.
  const { data: myLeaves, isLoading: myLeavesLoading } = useQuery({
    queryKey: ['my-leave-requests', dateFrom, dateTo],
    queryFn: () =>
      leaveRequestsApi
        .getMyLeaves({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          limit: 100,
          sort: 'createdAt',
          order: 'desc',
        })
        .then((r) => r.data.data),
    enabled: isEmployee && tab === 'my-leaves',
  });

  // Team leaves — visible to HR (all employee leaves) and to reporting
  // managers (just their reports' leaves). Plain employees without any
  // direct reports never reach this branch because `canSeeTeam` is false.
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['team-leave-requests', teamEmployeeId, dateFrom, dateTo],
    queryFn: () =>
      leaveRequestsApi
        .getTeamLeaves({
          employeeId: teamEmployeeId ? Number(teamEmployeeId) : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          limit: 100,
          sort: 'createdAt',
          order: 'desc',
        })
        .then((r) => r.data.data),
    enabled: canSeeTeam && tab === 'team-leaves' && isEmployee,
  });

  // ── WFH calendar overlay (Sprint 2) ──
  // Fetch the same WFH slice the WFH list would render — but only
  // when the Calendar tab is active — so the calendar grid can
  // paint WFH days as a distinct blue marker next to the Leave
  // colors. Admins reuse the company-wide list; employees combine
  // my-wfh + team-wfh.
  const onCalendar =
    (isEmployee && tab === 'calendar') || (isAdmin && adminTab === 'calendar');

  const { data: wfhMine } = useQuery({
    queryKey: ['calendar-my-wfh', dateFrom, dateTo],
    queryFn: () =>
      wfhRequestsApi
        .getMyRequests({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, limit: 100 })
        .then((r) => r.data.data),
    enabled: onCalendar && isEmployee,
  });
  const { data: wfhTeam } = useQuery({
    queryKey: ['calendar-team-wfh', dateFrom, dateTo],
    queryFn: () =>
      wfhRequestsApi
        .getTeamRequests({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, limit: 100 })
        .then((r) => r.data.data),
    enabled: onCalendar && isEmployee && canSeeTeam,
  });
  const { data: wfhAll } = useQuery({
    queryKey: ['calendar-all-wfh', dateFrom, dateTo],
    queryFn: () =>
      wfhRequestsApi
        .getAll({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, limit: 100 })
        .then((r) => r.data.data),
    enabled: onCalendar && isAdmin,
  });

  // Detail
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['leave-request-detail', selected?.id, isEmployee],
    queryFn: () =>
      (isEmployee
        ? leaveRequestsApi.getOneForEmployee(selected!.id)
        : leaveRequestsApi.getOne(selected!.id)
      ).then((r) => r.data.data),
    enabled: !!selected,
  });

  // Admin: narrow the company-wide list to either "team" (everyone) or
  // "my" (only leaves submitted by the current admin — adminId match).
  const currentAdminId = isAdmin ? (user as { id: number })?.id : null;
  const adminFiltered = !isAdmin
    ? adminData
    : adminTab === 'my-leaves'
        ? adminData?.filter((lr) => lr.adminId != null && lr.adminId === currentAdminId)
        : adminData;

  const rawData = isEmployee
    ? (tab === 'my-leaves' ? myLeaves : teamData)
    : adminFiltered;

  // Apply the simplified status filter client-side. `statusFilter` is one
  // of: 'all' | 'pending' | 'approved' | 'rejected' | 'cancelled'.
  const data = statusFilter === 'all'
    ? rawData
    : rawData?.filter((lr) => toSimpleStatus(lr.status) === statusFilter);

  const isLoading = isEmployee
    ? (tab === 'my-leaves' ? myLeavesLoading : teamLoading)
    : adminLoading;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
    queryClient.invalidateQueries({ queryKey: ['my-leave-requests'] });
    queryClient.invalidateQueries({ queryKey: ['team-leave-requests'] });
    queryClient.invalidateQueries({ queryKey: ['leave-request-detail'] });
  };

  const handleCancel = async (id: number) => {
    setActing(true);
    try {
      await leaveRequestsApi.cancelLeave(id);
      toast.success('Leave request cancelled');
      setSelected(null);
      invalidateAll();
    } catch {
      toast.error('Failed to cancel leave request');
    } finally {
      setActing(false);
    }
  };

  // Approve / Reject run through <LeaveActionDialog /> (remarks optional on
  // approve, required on reject) — same UX as the WFH action dialog.

  // Determine if current employee can act on the selected detail.
  // HR / RM cannot approve a leave they themselves submitted — another
  // HR / RM / admin has to act on it instead.
  const canActOnDetail = (() => {
    if (!isEmployee || !detail) return { canApprove: false, canCancel: false };
    const empId = (user as { id: number })?.id;
    const isHr = (user as { isHr?: boolean })?.isHr ?? false;
    const isOwn = detail.employeeId === empId;

    const CANCELLABLE_STATUSES: LeaveRequestStatus[] = ['pending', 'manager_approved'];
    const canCancel = isOwn && CANCELLABLE_STATUSES.includes(detail.status);

    // RM can approve/reject pending requests — but never their own.
    const isRmAction = !isOwn && detail.managerId === empId && detail.status === 'pending';
    // HR can approve/reject at any stage — but never their own.
    const HR_ACTIONABLE: LeaveRequestStatus[] = ['pending', 'manager_approved'];
    const isHrAction = !isOwn && isHr && HR_ACTIONABLE.includes(detail.status);

    const canApprove = isRmAction || isHrAction;

    return { canApprove, canCancel };
  })();

  // Hide the employee column on the "My Leaves" tab — every row is the
  // viewer themselves, so the column is dead weight. Applies to both
  // employee and admin "My Leaves".
  const onMyLeavesTab =
    (isEmployee && tab === 'my-leaves') || (isAdmin && adminTab === 'my-leaves');
  const showEmployeeCol = !onMyLeavesTab;

  // Admin + HR get inline Approve / Reject icons in the list table so
  // they can action a pending leave straight from the notification-landing
  // page without drilling into the detail. Plain employees + the
  // viewer's own leaves are excluded from this column.
  const userId = (user as { id?: number })?.id;
  const showActionsCol = isAdmin || isHr;
  const canActOnRow = (lr: LeaveRequest): { canApprove: boolean; canReject: boolean } => {
    if (!showActionsCol) return { canApprove: false, canReject: false };
    const isOwnAdminLeave = isAdmin && lr.adminId != null && lr.adminId === userId;
    const isOwnEmployeeLeave = !isAdmin && lr.employeeId != null && lr.employeeId === userId;
    if (isOwnAdminLeave || isOwnEmployeeLeave) return { canApprove: false, canReject: false };
    if (isAdmin) {
      const actionable = ['pending', 'manager_approved'].includes(lr.status);
      // Reject is hidden once approved — an approved leave is undone via
      // Cancel on the detail page, not rejected from the list.
      return { canApprove: actionable, canReject: actionable };
    }
    // HR employee — same status gate.
    const actionable = ['pending', 'manager_approved'].includes(lr.status);
    return { canApprove: actionable, canReject: actionable };
  };

  return (
    <div className="space-y-4">
      {/* Gradient Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-orange-600 via-rose-600 to-violet-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoNnptMC0zMHY2aC02VjRoNnptMCAzMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative px-4 py-4 sm:px-6 sm:py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <CalendarDays className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-white truncate">Leave Requests</h1>
              <p className="text-xs sm:text-sm text-white/60 truncate">Leave requests & approvals</p>
            </div>
          </div>
          {(isEmployee || isAdmin) && (() => {
            // Team Leaves / Team WFH tabs → file on someone's behalf.
            // Anywhere else → file own request.
            const onTeamTab =
              (isEmployee && (tab === 'team-leaves' || tab === 'team-wfh')) ||
              (isAdmin && (adminTab === 'team-leaves' || adminTab === 'team-wfh'));
            return (
              <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-2">
                <Button
                  onClick={() => {
                    setApplyMode(onTeamTab ? 'on-behalf' : 'self');
                    setApplyOpen(true);
                  }}
                  className="w-full sm:w-auto shrink-0 bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-0 shadow-lg"
                  size="sm"
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  {onTeamTab ? 'Apply Leave on Behalf' : 'Apply for Leave'}
                </Button>
                <Button
                  onClick={() => {
                    setApplyWfhMode(onTeamTab ? 'on-behalf' : 'self');
                    setApplyWfhOpen(true);
                  }}
                  className="w-full sm:w-auto shrink-0 bg-white/15 backdrop-blur-sm text-white hover:bg-white/25 border border-white/30 shadow-lg"
                  size="sm"
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  {onTeamTab ? 'Apply WFH on Behalf' : 'Apply for WFH'}
                </Button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Employee tabs.
          Plain employees → 3 tabs: My Leave + My WFH + Calendar.
          HR + Reporting Managers → 5 tabs adding Team Leaves + Team WFH. */}
      {isEmployee && (
        <div className="flex rounded-lg border border-border bg-muted/50 p-1 w-fit max-w-full overflow-x-auto scrollbar-hide">
          {((canSeeTeam
            ? ['my-leaves', 'team-leaves', 'my-wfh', 'team-wfh', 'calendar']
            : ['my-leaves', 'my-wfh', 'calendar']) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t !== 'team-leaves' && t !== 'team-wfh') setTeamEmployeeId(''); }}
              className={`inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                tab === t
                  ? 'bg-white dark:bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'my-leaves' ? 'My Leave'
                : t === 'team-leaves' ? 'Team Leaves'
                : t === 'my-wfh' ? 'My WFH'
                : t === 'team-wfh' ? 'Team WFH'
                : 'Calendar'}
              {tabBadge(t) > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-white">
                  {tabBadge(t) > 99 ? '99+' : tabBadge(t)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Admin tabs — My Leave / Team Leaves / My WFH / Team WFH / Calendar */}
      {isAdmin && (
        <div className="flex rounded-lg border border-border bg-muted/50 p-1 w-fit max-w-full overflow-x-auto scrollbar-hide">
          {(['my-leaves', 'team-leaves', 'my-wfh', 'team-wfh', 'calendar'] as AdminTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setAdminTab(t)}
              className={`inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                adminTab === t
                  ? 'bg-white dark:bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'my-leaves' ? 'My Leave'
                : t === 'team-leaves' ? 'Team Leaves'
                : t === 'my-wfh' ? 'My WFH'
                : t === 'team-wfh' ? 'Team WFH'
                : 'Calendar'}
              {tabBadge(t) > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-white">
                  {tabBadge(t) > 99 ? '99+' : tabBadge(t)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-end">
        {!isEmployee && (
          <div className="w-full sm:max-w-xs">
            <Input
              placeholder="Search employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
        {isEmployee && tab === 'team-leaves' && (
          <div className="w-full sm:w-56">
            <SearchableSelect
              placeholder="Filter by employee"
              value={teamEmployeeId}
              onValueChange={setTeamEmployeeId}
              options={(colleagues ?? []).map((c) => ({
                value: String(c.id),
                label: `${c.name} (${c.empCode})`,
              }))}
            />
          </div>
        )}
        <div className="w-full sm:w-44">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {(Object.entries(SIMPLE_STATUS_CONFIG) as [SimpleStatus, { label: string }][]).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-full sm:w-auto gap-2 items-center">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="flex-1 sm:w-36" />
          <span className="text-muted-foreground text-sm shrink-0">to</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="flex-1 sm:w-36" />
        </div>
        {(statusFilter !== 'all' || dateFrom || dateTo || search || teamEmployeeId) && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { setStatusFilter('all'); setDateFrom(''); setDateTo(''); setSearch(''); setTeamEmployeeId(''); }}
          >
            <X className="h-3 w-3 mr-1" /> Clear Filters
          </Button>
        )}
      </div>

      {/* WFH tabs — render the dedicated WFH table. The Leave table
          below gates itself off so the two never paint together. */}
      {((isEmployee && (tab === 'my-wfh' || tab === 'team-wfh')) ||
        (isAdmin && (adminTab === 'my-wfh' || adminTab === 'team-wfh'))) && (
        <WfhTab
          scope={
            (isEmployee && tab === 'my-wfh') || (isAdmin && adminTab === 'my-wfh')
              ? 'my'
              : 'team'
          }
          statusFilter={statusFilter as any}
          teamEmployeeId={teamEmployeeId}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      )}

      {/* Calendar View */}
      {((isEmployee && tab === 'calendar') || (isAdmin && adminTab === 'calendar')) && (() => {
        const allLeaves: LeaveRequest[] = isAdmin ? (data ?? []) : [...(myLeaves ?? []), ...(teamData ?? [])];
        // Merge WFH events so the grid shows both. WFH gets a single
        // shared color (we don't bucket by "WFH type" since there is
        // none). Status filter mirrors Leave.
        const allWfh = isAdmin ? (wfhAll ?? []) : [...(wfhMine ?? []), ...(wfhTeam ?? [])];
        const activeWfh = allWfh.filter((w) => ['hr_approved', 'manager_approved', 'pending'].includes(w.status));
        const monthStart = startOfMonth(calMonth);
        const monthEnd = endOfMonth(calMonth);
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

        // Only approved/manager_approved leaves
        const approvedLeaves = allLeaves.filter((l) => ['hr_approved', 'manager_approved', 'pending'].includes(l.status));

        // Group by applicant. A leave row carries either employeeId (the
        // employee submitted it) or adminId (an admin submitted it via
        // the admin "Apply for Leave" flow); the corresponding side
        // relation will be populated. Resolving both means admin-
        // submitted leaves don't render as "Employee #null" rows.
        const empMap: Record<string, { name: string; code: string; leaves: LeaveRequest[]; wfh: typeof activeWfh }> = {};
        // Same grouping for WFH so we can paint a per-employee row
        // even when they have only WFH (no leave) this month.
        const groupKeyForWfh = (w: typeof activeWfh[number]) =>
          w.adminId != null ? `adm_${w.adminId}` : `emp_${w.employeeId}`;
        activeWfh.forEach((w) => {
          const key = groupKeyForWfh(w);
          const adminRel = (w as { admin?: { name?: string } }).admin;
          const empRel = (w as { employee?: { name?: string; empCode?: string } }).employee;
          const name = w.adminId != null
            ? (adminRel?.name ?? `Admin #${w.adminId}`)
            : (empRel?.name ?? `Employee #${w.employeeId}`);
          const code = w.adminId != null ? 'Admin' : (empRel?.empCode ?? '');
          if (!empMap[key]) empMap[key] = { name, code, leaves: [], wfh: [] };
          empMap[key].wfh.push(w);
        });
        approvedLeaves.forEach((l) => {
          const isAdminLeave = l.adminId != null;
          const groupKey = isAdminLeave ? `adm_${l.adminId}` : `emp_${l.employeeId}`;
          const adminRel = (l as { admin?: { name?: string } }).admin;
          const empRel = (l as { employee?: { name?: string; empCode?: string } }).employee;
          const name = isAdminLeave
            ? (adminRel?.name ?? `Admin #${l.adminId}`)
            : (empRel?.name ?? `Employee #${l.employeeId}`);
          const code = isAdminLeave ? 'Admin' : (empRel?.empCode ?? '');
          if (!empMap[groupKey]) empMap[groupKey] = { name, code, leaves: [], wfh: [] };
          empMap[groupKey].leaves.push(l);
        });
        const employees = Object.entries(empMap);

        // Color per leave type (full + light pairs)
        const leaveColors: Record<string, string> = {};
        const leaveColorsLight: Record<string, string> = {};
        const colorPalette = [
          'bg-violet-500', 'bg-orange-500', 'bg-emerald-500', 'bg-blue-500',
          'bg-pink-500', 'bg-amber-500', 'bg-cyan-500', 'bg-red-500', 'bg-indigo-500',
        ];
        const colorPaletteLight = [
          'bg-violet-200', 'bg-orange-200', 'bg-emerald-200', 'bg-blue-200',
          'bg-pink-200', 'bg-amber-200', 'bg-cyan-200', 'bg-red-200', 'bg-indigo-200',
        ];
        let ci = 0;
        approvedLeaves.forEach((l) => {
          const reasonName = l.leaveReason?.reasonName ?? 'Other';
          if (!leaveColors[reasonName]) {
            const idx = ci++ % colorPalette.length;
            leaveColors[reasonName] = colorPalette[idx];
            leaveColorsLight[reasonName] = colorPaletteLight[idx];
          }
        });

        return (
          <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
            <div className="h-1.5 bg-linear-to-r from-orange-500 via-rose-500 to-violet-500" />
            {/* Month nav */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCalMonth(subMonths(calMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <h3 className="text-sm font-bold">{format(calMonth, 'MMMM yyyy')}</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCalMonth(addMonths(calMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 px-4 py-2 border-b bg-muted/30">
              {Object.entries(leaveColors).map(([name, color]) => (
                <div key={name} className="flex items-center gap-1.5">
                  <span className={`h-3 w-3 rounded-full ${color}`} />
                  <span className="text-[10px] font-medium text-muted-foreground">{name}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-cyan-500" />
                <span className="text-[10px] font-medium text-muted-foreground">WFH (applied)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-blue-200" />
                <span className="text-[10px] font-medium text-muted-foreground">Saturday (WFH)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-200" />
                <span className="text-[10px] font-medium text-muted-foreground">Sunday (Off)</span>
              </div>
            </div>
            {/* Grid */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[700px]">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="sticky left-0 bg-card z-10 px-3 py-2 text-left font-semibold text-muted-foreground w-36">Employee</th>
                    {days.map((d) => {
                      const isSun = getDay(d) === 0;
                      const isSat = getDay(d) === 6;
                      return (
                        <th key={d.toISOString()} className={`px-0.5 py-1 text-center font-medium w-8 ${isSun ? 'bg-red-50 dark:bg-red-900/20 text-red-400' : isSat ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-400' : ''}`}>
                          <div className="text-[9px]">{dayNames[getDay(d)]}</div>
                          <div className="text-xs">{format(d, 'd')}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {employees.length === 0 ? (
                    <tr><td colSpan={days.length + 1} className="text-center text-muted-foreground py-8">No leaves found for this month</td></tr>
                  ) : employees.map(([empId, emp]) => (
                    <tr key={empId} className="border-b hover:bg-muted/20">
                      <td className="sticky left-0 bg-card z-10 px-3 py-2 font-medium whitespace-nowrap">
                        <div>{emp.name}</div>
                      </td>
                      {days.map((d, dayIdx) => {
                        const isSun = getDay(d) === 0;
                        const isSat = getDay(d) === 6;
                        const isWeekend = isSat || isSun;

                        // Weekends are never painted as leave / WFH —
                        // a Fri-to-Mon leave should highlight only
                        // Friday and Monday, with Sat/Sun rendering
                        // their normal weekend background.
                        const leave = isWeekend ? null : emp.leaves.find((l) => {
                          const from = new Date(l.dateFrom + 'T00:00:00');
                          const to = new Date(l.dateTo + 'T00:00:00');
                          return isWithinInterval(d, { start: from, end: to });
                        });
                        const wfh = isWeekend || leave ? null : emp.wfh.find((w) => {
                          const from = new Date(w.dateFrom + 'T00:00:00');
                          const to = new Date(w.dateTo + 'T00:00:00');
                          return isWithinInterval(d, { start: from, end: to });
                        });
                        const reasonName = leave?.leaveReason?.reasonName ?? 'Other';
                        const color = leave ? leaveColors[reasonName] : '';

                        // Connecting bar — only joins adjacent weekday
                        // cells so the line never crosses Sat/Sun. Same
                        // for WFH (Sprint 3 follow-up): a Mon-Tue WFH
                        // gets a single connecting bar between them.
                        const prevDay = dayIdx > 0 ? days[dayIdx - 1] : null;
                        const nextDay = dayIdx < days.length - 1 ? days[dayIdx + 1] : null;
                        const prevIsWeekday = prevDay && getDay(prevDay) !== 0 && getDay(prevDay) !== 6;
                        const nextIsWeekday = nextDay && getDay(nextDay) !== 0 && getDay(nextDay) !== 6;

                        const prevHasLeave = prevIsWeekday && leave && emp.leaves.some((l) => {
                          const from = new Date(l.dateFrom + 'T00:00:00');
                          const to = new Date(l.dateTo + 'T00:00:00');
                          return isWithinInterval(prevDay!, { start: from, end: to }) && (l.leaveReason?.reasonName ?? 'Other') === reasonName;
                        });
                        const nextHasLeave = nextIsWeekday && leave && emp.leaves.some((l) => {
                          const from = new Date(l.dateFrom + 'T00:00:00');
                          const to = new Date(l.dateTo + 'T00:00:00');
                          return isWithinInterval(nextDay!, { start: from, end: to }) && (l.leaveReason?.reasonName ?? 'Other') === reasonName;
                        });

                        const prevHasWfh = prevIsWeekday && wfh && emp.wfh.some((w) => {
                          const from = new Date(w.dateFrom + 'T00:00:00');
                          const to = new Date(w.dateTo + 'T00:00:00');
                          return isWithinInterval(prevDay!, { start: from, end: to });
                        });
                        const nextHasWfh = nextIsWeekday && wfh && emp.wfh.some((w) => {
                          const from = new Date(w.dateFrom + 'T00:00:00');
                          const to = new Date(w.dateTo + 'T00:00:00');
                          return isWithinInterval(nextDay!, { start: from, end: to });
                        });

                        const lightColor = leave ? (leaveColorsLight[reasonName] ?? 'bg-gray-200') : '';

                        return (
                          <td key={d.toISOString()} className="px-0 py-1 text-center relative">
                            {leave ? (
                              <div className="relative flex items-center justify-center h-6">
                                {prevHasLeave && <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-3 w-1/2 ${lightColor}`} />}
                                {nextHasLeave && <div className={`absolute right-0 top-1/2 -translate-y-1/2 h-3 w-1/2 ${lightColor}`} />}
                                <div className={`relative z-10 h-6 w-6 rounded-full ${color} flex items-center justify-center text-white text-[10px] font-bold cursor-default`} title={`${reasonName} (${leave.status})`}>
                                  {format(d, 'd')}
                                </div>
                              </div>
                            ) : wfh ? (
                              <div className="relative flex items-center justify-center h-6">
                                {/* Same connecting-bar treatment Leave
                                    has — a light cyan strip behind the
                                    circle on either side when the
                                    adjacent weekday is also WFH. */}
                                {prevHasWfh && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-3 w-1/2 bg-cyan-200" />}
                                {nextHasWfh && <div className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-1/2 bg-cyan-200" />}
                                <div
                                  className="relative z-10 h-6 w-6 rounded-full bg-cyan-500 flex items-center justify-center text-white text-[10px] font-bold cursor-default"
                                  title={`WFH (${wfh.status})`}
                                >
                                  {format(d, 'd')}
                                </div>
                              </div>
                            ) : isSun ? (
                              <div className="h-6 bg-red-100 dark:bg-red-900/30 rounded-full mx-0.5 flex items-center justify-center text-red-400 text-[10px] font-medium" title="Sunday - Off">
                                {format(d, 'd')}
                              </div>
                            ) : isSat ? (
                              <div className="h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full mx-0.5 flex items-center justify-center text-blue-400 text-[10px] font-medium" title="Saturday - WFH">
                                {format(d, 'd')}
                              </div>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Table — Leave list. Suppressed on WFH and Calendar tabs. */}
      {((isEmployee && tab !== 'calendar' && tab !== 'my-wfh' && tab !== 'team-wfh') ||
        (isAdmin && adminTab !== 'calendar' && adminTab !== 'my-wfh' && adminTab !== 'team-wfh')) && <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
        <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-orange-500 via-rose-500 to-violet-500" />
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
            {(() => {
              const baseCols = showEmployeeCol ? 9 : 8;
              const cols = baseCols + (showActionsCol ? 2 : 1);
              return isLoading
              ? [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(cols)].map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-16" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : (data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={cols} className="h-32">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10 mb-3">
                          <CalendarDays className="h-6 w-6 text-orange-500" />
                        </div>
                        <p className="text-sm font-medium text-foreground">No leave requests found</p>
                        <p className="text-xs text-muted-foreground mt-1">Adjust your filters or date range</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              : (data ?? []).map((lr) => (
                  <TableRow key={lr.id} className="cursor-pointer hover:bg-accent/50" onClick={() => router.push(`/leave-requests/${lr.id}`)}>
                    {showEmployeeCol && (
                      <TableCell className="font-medium text-sm">
                        {lr.adminId != null
                          ? (lr as { admin?: { name?: string } }).admin?.name ?? `Admin #${lr.adminId}`
                          : lr.employee?.name ?? `#${lr.employeeId ?? '?'}`}
                        <span className="block text-xs text-muted-foreground">
                          {lr.adminId != null ? 'Admin' : lr.employee?.empCode}
                        </span>
                        {/* Surface the actual filer when it differs from
                            the subject — i.e. an HR / admin filed leave
                            on someone else's behalf. */}
                        {(() => {
                          const filedById = lr.appliedById ?? null;
                          const subjId = lr.adminId ?? lr.employeeId ?? null;
                          const subjType = lr.adminId != null ? 'admin' : 'employee';
                          const isOnBehalf =
                            filedById != null &&
                            (filedById !== subjId || lr.appliedByType !== subjType);
                          if (!isOnBehalf || !lr.appliedByName) return null;
                          return (
                            <span className="block text-[10px] italic text-muted-foreground/80 mt-0.5">
                              Applied by {lr.appliedByName}
                              {lr.appliedByType === 'admin' ? ' (Admin)' : ' (HR)'}
                            </span>
                          );
                        })()}
                      </TableCell>
                    )}
                    <TableCell className="text-sm">{lr.leaveReason?.reasonName ?? '-'}</TableCell>
                    <TableCell className="text-xs font-mono">{lr.dateFrom}</TableCell>
                    <TableCell className="text-xs font-mono">{lr.dateTo}</TableCell>
                    <TableCell className="text-center font-semibold">
                      {Number(lr.totalDays)}
                      <HalfDayPill kind={lr.halfDayKind} />
                    </TableCell>
                    <TableCell><StatusBadge lr={lr as any} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lr.manager?.name ?? '-'}
                      {lr.managerActionAt && (
                        <span className="block text-[10px] text-muted-foreground/60">
                          {format(new Date(lr.managerActionAt), 'dd MMM yyyy')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {(lr as any).hrApproverName ?? lr.hr?.name ?? '-'}
                      {lr.hrActionAt && (
                        <span className="block text-[10px] text-muted-foreground/60">
                          {format(new Date(lr.hrActionAt), 'dd MMM yyyy')}
                        </span>
                      )}
                    </TableCell>
                    {showActionsCol && (() => {
                      const { canApprove, canReject } = canActOnRow(lr);
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
                                onClick={(e) => { e.stopPropagation(); setActionDialog({ open: true, action: 'approve', leaveId: lr.id, isRevoke: lr.status === 'hr_approved' }); }}
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
                                onClick={(e) => { e.stopPropagation(); setActionDialog({ open: true, action: 'reject', leaveId: lr.id, isRevoke: lr.status === 'hr_approved' }); }}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      );
                    })()}
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); router.push(`/leave-requests/${lr.id}`); }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ));
            })()}
          </TableBody>
        </Table>
      </div>}

      {/* Apply for WFH Dialog — extracted component, same audience as
          the Leave dialog. Sits before Leave so it's mounted alongside
          rather than replacing it. */}
      {(isEmployee || isAdmin) && (
        <ApplyWfhDialog
          open={applyWfhOpen}
          onOpenChange={setApplyWfhOpen}
          mode={applyWfhMode}
          isAdmin={isAdmin}
        />
      )}

      {/* Approve / Reject dialog — remarks optional on approve, required on reject. */}
      <LeaveActionDialog
        open={actionDialog.open}
        onOpenChange={(v) => setActionDialog((p) => ({ ...p, open: v }))}
        action={actionDialog.action}
        leaveId={actionDialog.leaveId}
        rejectIsRevoke={actionDialog.isRevoke}
        onSuccess={() => setSelected(null)}
      />

      {/* Apply for Leave Dialog — open for both employee and admin */}
      {(isEmployee || isAdmin) && (
        <Dialog open={applyOpen} onOpenChange={(v) => { if (!v) { setApplyOpen(false); setApplyMode('self'); setApplyForm({ leaveReasonId: '', dateFrom: '', dateTo: '', remarks: '', watcherIds: [], onBehalfOfEmployeeId: '', halfDayKind: 'full' }); } }}>
          <DialogContent className="max-w-md overflow-hidden py-8">
            <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-orange-500 via-rose-500 to-violet-500" />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-orange-500" />
                {applyMode === 'on-behalf' ? 'Apply Leave on Behalf' : 'Apply for Leave'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Employee picker — only when filing on someone else's behalf */}
              {applyMode === 'on-behalf' && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Employee <span className="text-destructive">*</span></Label>
                  <SearchableSelect
                    placeholder="Select employee"
                    value={applyForm.onBehalfOfEmployeeId}
                    onValueChange={(v) => setApplyForm((p) => ({ ...p, onBehalfOfEmployeeId: v }))}
                    options={(colleagues ?? []).map((c) => ({
                      value: String(c.id),
                      label: `${c.name} (${c.empCode})`,
                    }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    The leave will be filed for this employee; you stay on the audit trail.
                  </p>
                </div>
              )}

              {/* Leave Type */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Leave Type <span className="text-destructive">*</span></Label>
                <SearchableSelect
                  placeholder="Select a reason"
                  value={applyForm.leaveReasonId}
                  onValueChange={(v) => setApplyForm((p) => ({ ...p, leaveReasonId: v }))}
                  options={(leaveReasons ?? []).map((r) => ({
                    value: String(r.id),
                    label: r.reasonName,
                  }))}
                />
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">From Date <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    value={applyForm.dateFrom}
                    onChange={(e) =>
                      setApplyForm((p) => ({
                        ...p,
                        dateFrom: e.target.value,
                        halfDayKind: e.target.value !== p.dateTo ? 'full' : p.halfDayKind,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">To Date <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    value={applyForm.dateTo}
                    onChange={(e) =>
                      setApplyForm((p) => ({
                        ...p,
                        dateTo: e.target.value,
                        // Half-day is single-day-only. If the user
                        // widens the range, snap back to full day so
                        // the picker can't ride along in an invalid
                        // state.
                        halfDayKind: e.target.value !== p.dateFrom ? 'full' : p.halfDayKind,
                      }))
                    }
                  />
                </div>
              </div>

              {/* Half-day picker — always rendered so users can see
                  the option exists. Full day is always selectable;
                  AM/PM are disabled when the request isn't a single
                  day (no dates picked, or multi-day span). A small
                  helper note explains why. */}
              {(() => {
                const isSingleDay =
                  applyForm.dateFrom !== '' &&
                  applyForm.dateFrom === applyForm.dateTo;
                return (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Duration</Label>
                    <div className="flex flex-wrap gap-2">
                      {([
                        { v: 'full', label: 'Full day', singleOnly: false },
                        { v: 'first_half', label: 'First half (AM)', singleOnly: true },
                        { v: 'second_half', label: 'Second half (PM)', singleOnly: true },
                      ] as const).map((opt) => {
                        const disabled = opt.singleOnly && !isSingleDay;
                        const selected = applyForm.halfDayKind === opt.v;
                        return (
                          <label
                            key={opt.v}
                            title={
                              disabled
                                ? 'Half-day is only available for single-day requests (pick the same From + To date)'
                                : undefined
                            }
                            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                              disabled
                                ? 'cursor-not-allowed bg-muted/50 text-muted-foreground/60 border-muted'
                                : selected
                                  ? 'cursor-pointer bg-orange-500 border-orange-500 text-white'
                                  : 'cursor-pointer bg-background hover:bg-muted'
                            }`}
                          >
                            <input
                              type="radio"
                              name="halfDayKind"
                              value={opt.v}
                              disabled={disabled}
                              checked={selected}
                              onChange={() =>
                                setApplyForm((p) => ({ ...p, halfDayKind: opt.v }))
                              }
                              className="sr-only"
                            />
                            {opt.label}
                          </label>
                        );
                      })}
                    </div>
                    {!isSingleDay && (
                      <p className="text-[11px] text-muted-foreground">
                        Half-day is available only on single-day requests — set the same From and To date.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Calculated days — collapses to 0.5 for half-day. */}
              {applyForm.dateFrom && applyForm.dateTo && applyForm.dateFrom <= applyForm.dateTo && (
                <div className="rounded-md bg-orange-50 dark:bg-orange-500/10 px-3 py-2 text-sm text-orange-700 dark:text-orange-400">
                  Total days: <span className="font-semibold">
                    {applyForm.halfDayKind !== 'full' &&
                    applyForm.dateFrom === applyForm.dateTo
                      ? '0.5'
                      : Math.ceil(
                          (new Date(applyForm.dateTo).getTime() -
                            new Date(applyForm.dateFrom).getTime()) /
                            86400000,
                        ) + 1}
                  </span>
                </div>
              )}

              {/* Remarks */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Remarks</Label>
                <Textarea
                  placeholder="Reason or additional details (optional)"
                  value={applyForm.remarks}
                  onChange={(e) => setApplyForm((p) => ({ ...p, remarks: e.target.value }))}
                  rows={3}
                />
              </div>

              {/* Watchers / CC */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">CC / Watchers</Label>
                <p className="text-xs text-muted-foreground">These colleagues will be able to see your leave request</p>
                {applyForm.watcherIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {applyForm.watcherIds.map((wId) => {
                      const col = colleagues?.find((c) => c.id === wId);
                      return (
                        <Badge key={wId} variant="secondary" className="gap-1 text-xs pr-1">
                          {col?.name ?? `#${wId}`}
                          <button onClick={() => toggleWatcher(wId)} className="ml-0.5 hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
                <div className="max-h-32 overflow-y-auto rounded-md border divide-y">
                  {(colleagues ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground px-3 py-2">No colleagues found</p>
                  ) : (
                    (colleagues ?? []).map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={applyForm.watcherIds.includes(c.id)}
                          onChange={() => toggleWatcher(c.id)}
                          className="rounded border-gray-300"
                        />
                        <span>{c.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{c.empCode}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setApplyOpen(false);
                    setApplyMode('self');
                    setApplyForm({ leaveReasonId: '', dateFrom: '', dateTo: '', remarks: '', watcherIds: [], onBehalfOfEmployeeId: '', halfDayKind: 'full' });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-linear-to-r from-orange-500 to-rose-600 text-white hover:opacity-90 shadow-sm shadow-orange-500/25 border-0"
                  disabled={submitLeaveMutation.isPending}
                  onClick={handleSubmitLeave}
                >
                  {submitLeaveMutation.isPending ? 'Submitting...' : 'Submit Leave Request'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null); }}>
        <DialogContent className="max-w-lg overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-orange-500 via-rose-500 to-violet-500" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-orange-500" />
              Leave Request Details
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-3 py-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
            </div>
          ) : detail ? (
            <div className="space-y-4 text-sm">
              {/* Employee info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground text-xs">Employee</p>
                  <p className="font-medium">{detail.employee?.name} ({detail.employee?.empCode})</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <StatusBadge lr={detail as any} />
                </div>
              </div>

              {/* Leave details */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-muted-foreground text-xs">From</p>
                  <p className="font-mono">{detail.dateFrom}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">To</p>
                  <p className="font-mono">{detail.dateTo}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Total Days</p>
                  <p className="font-semibold">
                    {Number(detail.totalDays)}
                    <HalfDayPill kind={detail.halfDayKind} />
                  </p>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground text-xs">Reason</p>
                <p>{detail.leaveReason?.reasonName}</p>
              </div>

              {detail.remarks && (
                <div>
                  <p className="text-muted-foreground text-xs">Employee Remarks</p>
                  <p className="text-muted-foreground">{detail.remarks}</p>
                </div>
              )}

              {/* Approval timeline */}
              <div className="border-t pt-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Approval Timeline</p>

                {/* Level 1: Reporting Manager */}
                {(() => {
                  const hrApproverName = (detail as any).hrApproverName as string | undefined;
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
                        <div className={`mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 ${
                          detail.status === 'manager_rejected' ? 'bg-red-500' :
                          detail.managerActionAt ? 'bg-emerald-500' :
                          adminFinal ? 'bg-emerald-500' : 'bg-amber-400'
                        }`} />
                        <div>
                          <p className="text-xs font-medium">Manager: {detail.manager?.name ?? '—'}</p>
                          {detail.managerActionAt ? (
                            <>
                              <p className="text-xs text-muted-foreground">
                                {detail.status === 'manager_rejected' ? 'Rejected' : 'Approved'} on {format(new Date(detail.managerActionAt!), 'dd MMM yyyy, HH:mm')}
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
                          <div className={`mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 ${
                            detail.status === 'hr_rejected' ? 'bg-red-500' :
                            detail.hrActionAt || adminFinal ? 'bg-emerald-500' : 'bg-amber-400'
                          }`} />
                          <div>
                            <p className="text-xs font-medium">
                              HR: {adminFinal ? '—' : (detail.hr?.name ?? hrApproverName ?? 'Pending')}
                            </p>
                            {adminFinal ? (
                              <p className="text-xs text-muted-foreground">{autoWord}</p>
                            ) : detail.hrActionAt ? (
                              <>
                                <p className="text-xs text-muted-foreground">
                                  {detail.status === 'hr_rejected' ? 'Rejected' : 'Approved'} on {format(new Date(detail.hrActionAt), 'dd MMM yyyy, HH:mm')}
                                </p>
                                {detail.hrRemarks && <p className="text-xs text-muted-foreground mt-0.5 italic">&quot;{detail.hrRemarks}&quot;</p>}
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground">Pending action</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Admin row — only when an admin was the final decision-maker */}
                      {adminFinal && (
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 ${
                            detail.status === 'hr_rejected' ? 'bg-red-500' : 'bg-emerald-500'
                          }`} />
                          <div>
                            <p className="text-xs font-medium">Admin: {hrApproverName}</p>
                            <p className="text-xs text-muted-foreground">
                              {detail.status === 'hr_rejected' ? 'Rejected' : 'Approved'}
                              {detail.hrActionAt ? ` on ${format(new Date(detail.hrActionAt), 'dd MMM yyyy, HH:mm')}` : ''}
                            </p>
                            {detail.hrRemarks && <p className="text-xs text-muted-foreground mt-0.5 italic">&quot;{detail.hrRemarks}&quot;</p>}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Watchers */}
              {detail.watchers && detail.watchers.length > 0 && (
                <div className="border-t pt-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Watchers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.watchers.map((w) => (
                      <Badge key={w.id} variant="outline" className="text-xs">
                        {w.employee?.name ?? `Employee #${w.employeeId}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {isEmployee && (canActOnDetail.canApprove || canActOnDetail.canCancel) && (
                <div className="border-t pt-3 space-y-3">
                  {canActOnDetail.canApprove && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => setActionDialog({ open: true, action: 'approve', leaveId: detail.id, isRevoke: detail.status === 'hr_approved' })}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setActionDialog({ open: true, action: 'reject', leaveId: detail.id, isRevoke: detail.status === 'hr_approved' })}
                      >
                        <XCircle className="mr-1.5 h-3.5 w-3.5" />
                        {detail.status === 'hr_approved' ? 'Reject (revoke approval)' : 'Reject'}
                      </Button>
                    </div>
                  )}
                  {canActOnDetail.canCancel && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      disabled={acting}
                      onClick={() => handleCancel(detail.id)}
                    >
                      <Ban className="mr-1.5 h-3.5 w-3.5" />
                      {acting ? 'Cancelling...' : 'Cancel Request'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
