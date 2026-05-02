'use client';

import { Suspense, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, addMonths, subMonths, getDay } from 'date-fns';
import { CalendarDays, Eye, CheckCircle2, XCircle, Ban, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { leaveRequestsApi } from '@/lib/api/leave-requests';
import { LeaveRequest, LeaveRequestStatus } from '@/types';
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
type Tab = 'my-leaves' | 'team-leaves' | 'calendar';
type AdminTab = 'my-leaves' | 'team-leaves' | 'calendar';

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
  const [actionRemarks, setActionRemarks] = useState('');
  const [acting, setActing] = useState(false);

  // ── Apply for Leave dialog ──
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({
    leaveReasonId: '',
    dateFrom: '',
    dateTo: '',
    remarks: '',
    watcherIds: [] as number[],
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
      const payload = {
        leaveReasonId: Number(applyForm.leaveReasonId),
        dateFrom: applyForm.dateFrom,
        dateTo: applyForm.dateTo,
        remarks: applyForm.remarks || undefined,
        watcherIds: applyForm.watcherIds.length > 0 ? applyForm.watcherIds : undefined,
      };
      return isAdmin
        ? leaveRequestsApi.submitAdminLeave(payload)
        : leaveRequestsApi.submitLeave(payload);
    },
    onSuccess: () => {
      toast.success('Leave request submitted successfully');
      setApplyOpen(false);
      setApplyForm({ leaveReasonId: '', dateFrom: '', dateTo: '', remarks: '', watcherIds: [] });
      invalidateAll();
    },
    onError: () => {
      toast.error('Failed to submit leave request');
    },
  });

  const handleSubmitLeave = () => {
    if (!applyForm.leaveReasonId || !applyForm.dateFrom || !applyForm.dateTo) {
      toast.error('Please fill all required fields');
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

  // HR (employee + isHr): team leaves — every employee's leaves.
  // Plain employees no longer see this tab so the query is HR-only.
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
    enabled: isHr && tab === 'team-leaves',
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

  const handleApprove = async (id: number) => {
    setActing(true);
    try {
      await leaveRequestsApi.approveLeave(id, actionRemarks || undefined);
      toast.success('Leave request approved');
      setSelected(null);
      setActionRemarks('');
      invalidateAll();
    } catch {
      toast.error('Failed to approve leave request');
    } finally {
      setActing(false);
    }
  };

  const handleReject = async (id: number) => {
    setActing(true);
    try {
      await leaveRequestsApi.rejectLeave(id, actionRemarks || undefined);
      toast.success('Leave request rejected');
      setSelected(null);
      setActionRemarks('');
      invalidateAll();
    } catch {
      toast.error('Failed to reject leave request');
    } finally {
      setActing(false);
    }
  };

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

  return (
    <div className="space-y-4">
      {/* Gradient Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-orange-600 via-rose-600 to-violet-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoNnptMC0zMHY2aC02VjRoNnptMCAzMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <CalendarDays className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Leave Requests</h1>
              <p className="text-sm text-white/60">Leave requests & approvals</p>
            </div>
          </div>
          {(isEmployee || isAdmin) && (
            <Button
              onClick={() => setApplyOpen(true)}
              className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-0 shadow-lg"
              size="sm"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Apply for Leave
            </Button>
          )}
        </div>
      </div>

      {/* Employee tabs.
          Plain employees → 2 tabs: Leave + Calendar.
          HR employees    → 3 tabs: My Leaves + Team Leaves + Calendar. */}
      {isEmployee && (
        <div className="flex rounded-lg border border-border bg-muted/50 p-1 w-fit">
          {((isHr
            ? ['my-leaves', 'team-leaves', 'calendar']
            : ['my-leaves', 'calendar']) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t !== 'team-leaves') setTeamEmployeeId(''); }}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                tab === t
                  ? 'bg-white dark:bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'my-leaves'
                ? (isHr ? 'My Leaves' : 'Leave')
                : t === 'team-leaves'
                  ? 'Team Leaves'
                  : 'Calendar'}
            </button>
          ))}
        </div>
      )}

      {/* Admin tabs — My Leaves / Team Leaves / Calendar */}
      {isAdmin && (
        <div className="flex rounded-lg border border-border bg-muted/50 p-1 w-fit">
          {(['my-leaves', 'team-leaves', 'calendar'] as AdminTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setAdminTab(t)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                adminTab === t
                  ? 'bg-white dark:bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'my-leaves' ? 'My Leaves' : t === 'team-leaves' ? 'Team Leaves' : 'Calendar'}
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
          <div className="w-56">
            <SearchableSelect
              placeholder="Filter by employee"
              value={teamEmployeeId}
              onValueChange={setTeamEmployeeId}
              options={(colleagues ?? []).map((c) => ({
                value: String(c.id),
                label: `${c.empName} (${c.empCode})`,
              }))}
            />
          </div>
        )}
        <div className="w-44">
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
        <div className="flex gap-2 items-center">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
          <span className="text-muted-foreground text-sm">to</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
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

      {/* Calendar View */}
      {((isEmployee && tab === 'calendar') || (isAdmin && adminTab === 'calendar')) && (() => {
        const allLeaves: LeaveRequest[] = isAdmin ? (data ?? []) : [...(myLeaves ?? []), ...(teamData ?? [])];
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
        const empMap: Record<string, { name: string; code: string; leaves: LeaveRequest[] }> = {};
        approvedLeaves.forEach((l) => {
          const isAdminLeave = l.adminId != null;
          const groupKey = isAdminLeave ? `adm_${l.adminId}` : `emp_${l.employeeId}`;
          const adminRel = (l as { admin?: { name?: string } }).admin;
          const empRel = (l as { employee?: { empName?: string; empCode?: string } }).employee;
          const name = isAdminLeave
            ? (adminRel?.name ?? `Admin #${l.adminId}`)
            : (empRel?.empName ?? `Employee #${l.employeeId}`);
          const code = isAdminLeave ? 'Admin' : (empRel?.empCode ?? '');
          if (!empMap[groupKey]) empMap[groupKey] = { name, code, leaves: [] };
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
                        const leave = emp.leaves.find((l) => {
                          const from = new Date(l.dateFrom + 'T00:00:00');
                          const to = new Date(l.dateTo + 'T00:00:00');
                          return isWithinInterval(d, { start: from, end: to });
                        });
                        const reasonName = leave?.leaveReason?.reasonName ?? 'Other';
                        const color = leave ? leaveColors[reasonName] : '';

                        // Check prev/next day for same leave (for connected bar)
                        const prevDay = dayIdx > 0 ? days[dayIdx - 1] : null;
                        const nextDay = dayIdx < days.length - 1 ? days[dayIdx + 1] : null;
                        const prevHasLeave = prevDay && leave && emp.leaves.some((l) => {
                          const from = new Date(l.dateFrom + 'T00:00:00');
                          const to = new Date(l.dateTo + 'T00:00:00');
                          return isWithinInterval(prevDay, { start: from, end: to }) && (l.leaveReason?.reasonName ?? 'Other') === reasonName;
                        });
                        const nextHasLeave = nextDay && leave && emp.leaves.some((l) => {
                          const from = new Date(l.dateFrom + 'T00:00:00');
                          const to = new Date(l.dateTo + 'T00:00:00');
                          return isWithinInterval(nextDay, { start: from, end: to }) && (l.leaveReason?.reasonName ?? 'Other') === reasonName;
                        });

                        const lightColor = leave ? (leaveColorsLight[reasonName] ?? 'bg-gray-200') : '';

                        return (
                          <td key={d.toISOString()} className="px-0 py-1 text-center relative">
                            {leave ? (
                              <div className="relative flex items-center justify-center h-6">
                                {/* Light connecting line behind */}
                                {prevHasLeave && <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-3 w-1/2 ${lightColor}`} />}
                                {nextHasLeave && <div className={`absolute right-0 top-1/2 -translate-y-1/2 h-3 w-1/2 ${lightColor}`} />}
                                {/* Full color circle on top */}
                                <div className={`relative z-10 h-6 w-6 rounded-full ${color} flex items-center justify-center text-white text-[10px] font-bold cursor-default`} title={`${reasonName} (${leave.status})`}>
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

      {/* Table */}
      {((isEmployee && tab !== 'calendar') || (isAdmin && adminTab !== 'calendar')) && <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
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
              <TableHead className="w-16">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(showEmployeeCol ? 10 : 9)].map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-16" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : (data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={showEmployeeCol ? 10 : 9} className="h-32">
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
                          : lr.employee?.empName ?? `#${lr.employeeId ?? '?'}`}
                        <span className="block text-xs text-muted-foreground">
                          {lr.adminId != null ? 'Admin' : lr.employee?.empCode}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="text-sm">{lr.leaveReason?.reasonName ?? '-'}</TableCell>
                    <TableCell className="text-xs font-mono">{lr.dateFrom}</TableCell>
                    <TableCell className="text-xs font-mono">{lr.dateTo}</TableCell>
                    <TableCell className="text-center font-semibold">{lr.totalDays}</TableCell>
                    <TableCell><StatusBadge lr={lr as any} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lr.manager?.empName ?? '-'}
                      {lr.managerActionAt && (
                        <span className="block text-[10px] text-muted-foreground/60">
                          {format(new Date(lr.managerActionAt), 'dd MMM yyyy')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {(lr as any).hrApproverName ?? lr.hr?.empName ?? '-'}
                      {lr.hrActionAt && (
                        <span className="block text-[10px] text-muted-foreground/60">
                          {format(new Date(lr.hrActionAt), 'dd MMM yyyy')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); router.push(`/leave-requests/${lr.id}`); }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>}

      {/* Apply for Leave Dialog — open for both employee and admin */}
      {(isEmployee || isAdmin) && (
        <Dialog open={applyOpen} onOpenChange={(v) => { if (!v) { setApplyOpen(false); setApplyForm({ leaveReasonId: '', dateFrom: '', dateTo: '', remarks: '', watcherIds: [] }); } }}>
          <DialogContent className="max-w-md overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-orange-500 via-rose-500 to-violet-500" />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-orange-500" />
                Apply for Leave
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Leave Type */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Leave Type <span className="text-destructive">*</span></Label>
                <Select value={applyForm.leaveReasonId} onValueChange={(v) => setApplyForm((p) => ({ ...p, leaveReasonId: v }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {(leaveReasons ?? []).map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>{r.reasonName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">From Date <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    value={applyForm.dateFrom}
                    onChange={(e) => setApplyForm((p) => ({ ...p, dateFrom: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">To Date <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    value={applyForm.dateTo}
                    onChange={(e) => setApplyForm((p) => ({ ...p, dateTo: e.target.value }))}
                  />
                </div>
              </div>

              {/* Calculated days */}
              {applyForm.dateFrom && applyForm.dateTo && applyForm.dateFrom <= applyForm.dateTo && (
                <div className="rounded-md bg-orange-50 dark:bg-orange-500/10 px-3 py-2 text-sm text-orange-700 dark:text-orange-400">
                  Total days: <span className="font-semibold">
                    {Math.ceil((new Date(applyForm.dateTo).getTime() - new Date(applyForm.dateFrom).getTime()) / 86400000) + 1}
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
                          {col?.empName ?? `#${wId}`}
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
                        <span>{c.empName}</span>
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
                  onClick={() => setApplyOpen(false)}
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
      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) { setSelected(null); setActionRemarks(''); } }}>
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
                  <p className="font-medium">{detail.employee?.empName} ({detail.employee?.empCode})</p>
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
                  <p className="font-semibold">{detail.totalDays}</p>
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
                          <p className="text-xs font-medium">Manager: {detail.manager?.empName ?? '—'}</p>
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
                              HR: {adminFinal ? '—' : (detail.hr?.empName ?? hrApproverName ?? 'Pending')}
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
                        {w.employee?.empName ?? `Employee #${w.employeeId}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {isEmployee && (canActOnDetail.canApprove || canActOnDetail.canCancel) && (
                <div className="border-t pt-3 space-y-3">
                  {canActOnDetail.canApprove && (
                    <>
                      <Textarea
                        placeholder="Remarks (optional)"
                        value={actionRemarks}
                        onChange={(e) => setActionRemarks(e.target.value)}
                        className="text-sm"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={acting}
                          onClick={() => handleApprove(detail.id)}
                        >
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                          {acting ? 'Processing...' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={acting}
                          onClick={() => handleReject(detail.id)}
                        >
                          <XCircle className="mr-1.5 h-3.5 w-3.5" />
                          {acting ? 'Processing...' : 'Reject'}
                        </Button>
                      </div>
                    </>
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
