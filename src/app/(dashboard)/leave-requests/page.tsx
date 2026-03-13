'use client';

import { Suspense, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { CalendarDays, Eye, CheckCircle2, XCircle, Ban, Plus, X } from 'lucide-react';
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

const statusConfig: Record<LeaveRequestStatus, { label: string; color: string }> = {
  pending:          { label: 'Pending',           color: 'bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-400' },
  manager_approved: { label: 'Manager Approved',  color: 'bg-blue-500/15 text-blue-600 ring-blue-500/30 dark:text-blue-400' },
  manager_rejected: { label: 'Manager Rejected',  color: 'bg-red-500/15 text-red-600 ring-red-500/30 dark:text-red-400' },
  hr_approved:      { label: 'HR Approved',       color: 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400' },
  hr_rejected:      { label: 'HR Rejected',       color: 'bg-red-500/15 text-red-600 ring-red-500/30 dark:text-red-400' },
  cancelled:        { label: 'Cancelled',         color: 'bg-gray-500/15 text-gray-500 ring-gray-500/30 dark:text-gray-400' },
};

function StatusBadge({ status }: { status: LeaveRequestStatus }) {
  const cfg = statusConfig[status] ?? statusConfig.pending;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

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
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [tab, setTab] = useState<'my-leaves' | 'pending-approvals'>('my-leaves');
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
    if (searchParams.get('apply') === 'true' && isEmployee) {
      setApplyOpen(true);
      // Clean URL
      window.history.replaceState(null, '', '/leave-requests');
    }
  }, [searchParams, isEmployee]);

  // Fetch leave types for the form
  const { data: leaveReasons } = useQuery({
    queryKey: ['leave-types-dropdown'],
    queryFn: () => leaveRequestsApi.getLeaveReasons().then((r) => r.data.data),
    enabled: isEmployee,
  });

  // Fetch colleagues for watcher selection
  const { data: colleagues } = useQuery({
    queryKey: ['colleagues-dropdown'],
    queryFn: () => leaveRequestsApi.getColleagues().then((r) => r.data.data),
    enabled: isEmployee && applyOpen,
  });

  const submitLeaveMutation = useMutation({
    mutationFn: () =>
      leaveRequestsApi.submitLeave({
        leaveReasonId: Number(applyForm.leaveReasonId),
        dateFrom: applyForm.dateFrom,
        dateTo: applyForm.dateTo,
        remarks: applyForm.remarks || undefined,
        watcherIds: applyForm.watcherIds.length > 0 ? applyForm.watcherIds : undefined,
      }),
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

  // Admin: all leave requests
  const { data: adminData, isLoading: adminLoading } = useQuery({
    queryKey: ['leave-requests', search, statusFilter, dateFrom, dateTo],
    queryFn: () =>
      leaveRequestsApi
        .getAll({
          search: search || undefined,
          status: statusFilter !== 'all' ? (statusFilter as LeaveRequestStatus) : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          limit: 100,
          sort: 'createdAt',
          order: 'desc',
        })
        .then((r) => r.data.data),
    enabled: !isEmployee,
  });

  // Employee: my leaves
  const { data: myLeaves, isLoading: myLeavesLoading } = useQuery({
    queryKey: ['my-leave-requests', statusFilter, dateFrom, dateTo],
    queryFn: () =>
      leaveRequestsApi
        .getMyLeaves({
          status: statusFilter !== 'all' ? (statusFilter as LeaveRequestStatus) : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          limit: 100,
          sort: 'createdAt',
          order: 'desc',
        })
        .then((r) => r.data.data),
    enabled: isEmployee && tab === 'my-leaves',
  });

  // Employee: pending approvals (manager/HR)
  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['pending-approvals', statusFilter, dateFrom, dateTo],
    queryFn: () =>
      leaveRequestsApi
        .getPendingApprovals({
          status: statusFilter !== 'all' ? (statusFilter as LeaveRequestStatus) : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          limit: 100,
          sort: 'createdAt',
          order: 'desc',
        })
        .then((r) => r.data.data),
    enabled: isEmployee && tab === 'pending-approvals',
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

  const data = isEmployee ? (tab === 'my-leaves' ? myLeaves : pendingData) : adminData;
  const isLoading = isEmployee ? (tab === 'my-leaves' ? myLeavesLoading : pendingLoading) : adminLoading;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
    queryClient.invalidateQueries({ queryKey: ['my-leave-requests'] });
    queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
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

  // Determine if current employee can act on the selected detail
  const canActOnDetail = (() => {
    if (!isEmployee || !detail) return { canApprove: false, canCancel: false };
    const empId = (user as { id: number })?.id;
    const canCancel = detail.employeeId === empId && detail.status === 'pending';
    const canApprove = tab === 'pending-approvals' && (
      (detail.status === 'pending' && detail.managerId === empId) ||
      (detail.status === 'manager_approved' && (user as { isHr?: boolean })?.isHr)
    );
    return { canApprove, canCancel };
  })();

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
          {isEmployee && (
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

      {/* Employee tabs */}
      {isEmployee && (
        <div className="flex rounded-lg border border-border bg-muted/50 p-1 w-fit">
          <button
            onClick={() => setTab('my-leaves')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
              tab === 'my-leaves'
                ? 'bg-white dark:bg-card shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            My Leaves
          </button>
          <button
            onClick={() => setTab('pending-approvals')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
              tab === 'pending-approvals'
                ? 'bg-white dark:bg-card shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Pending Approvals
          </button>
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
        <div className="w-40">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(statusConfig).map(([k, v]) => (
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
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
        <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-orange-500 via-rose-500 to-violet-500" />
        <Table>
          <TableHeader>
            <TableRow>
              {!isEmployee && <TableHead>Employee</TableHead>}
              {isEmployee && tab === 'pending-approvals' && <TableHead>Employee</TableHead>}
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
                    {[...Array(isEmployee && tab === 'my-leaves' ? 8 : 9)].map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-16" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : (data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isEmployee && tab === 'my-leaves' ? 8 : 9} className="h-32">
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
                  <TableRow key={lr.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setSelected(lr)}>
                    {(!isEmployee || tab === 'pending-approvals') && (
                      <TableCell className="font-medium text-sm">
                        {lr.employee?.empName ?? `#${lr.employeeId}`}
                        <span className="block text-xs text-muted-foreground">{lr.employee?.empCode}</span>
                      </TableCell>
                    )}
                    <TableCell className="text-sm">{lr.leaveReason?.reasonName ?? '-'}</TableCell>
                    <TableCell className="text-xs font-mono">{lr.dateFrom}</TableCell>
                    <TableCell className="text-xs font-mono">{lr.dateTo}</TableCell>
                    <TableCell className="text-center font-semibold">{lr.totalDays}</TableCell>
                    <TableCell><StatusBadge status={lr.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lr.manager?.empName ?? '-'}
                      {lr.managerActionAt && (
                        <span className="block text-[10px] text-muted-foreground/60">
                          {format(new Date(lr.managerActionAt), 'dd MMM yyyy')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lr.hr?.empName ?? '-'}
                      {lr.hrActionAt && (
                        <span className="block text-[10px] text-muted-foreground/60">
                          {format(new Date(lr.hrActionAt), 'dd MMM yyyy')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setSelected(lr); }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {/* Apply for Leave Dialog */}
      {isEmployee && (
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
                  <SelectTrigger  className="w-full">
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
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
                  <StatusBadge status={detail.status} />
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

                {/* Manager decision */}
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 ${
                    detail.status === 'pending' ? 'bg-amber-400' :
                    detail.status === 'manager_rejected' ? 'bg-red-500' : 'bg-emerald-500'
                  }`} />
                  <div>
                    <p className="text-xs font-medium">Manager: {detail.manager?.empName ?? '-'}</p>
                    {detail.managerActionAt ? (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {detail.status === 'manager_rejected' ? 'Rejected' : 'Approved'} on {format(new Date(detail.managerActionAt), 'dd MMM yyyy, HH:mm')}
                        </p>
                        {detail.managerRemarks && <p className="text-xs text-muted-foreground mt-0.5 italic">&quot;{detail.managerRemarks}&quot;</p>}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Pending action</p>
                    )}
                  </div>
                </div>

                {/* HR decision */}
                {(detail.status === 'manager_approved' || detail.status === 'hr_approved' || detail.status === 'hr_rejected') && (
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 ${
                      detail.status === 'manager_approved' ? 'bg-amber-400' :
                      detail.status === 'hr_rejected' ? 'bg-red-500' : 'bg-emerald-500'
                    }`} />
                    <div>
                      <p className="text-xs font-medium">HR: {detail.hr?.empName ?? 'Pending'}</p>
                      {detail.hrActionAt ? (
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

              {/* Employee actions */}
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
