'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Check, X, ClipboardCheck, FolderKanban, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { pmTaskApprovalsApi } from '@/lib/api/task-sheets';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { TaskSheetApproval, TaskSheetApprovalRowStatus } from '@/types';

type Filter = TaskSheetApprovalRowStatus;

const FILTER_TABS: Array<{ key: Filter; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

function statusPill(s: TaskSheetApprovalRowStatus) {
  const tone =
    s === 'approved'
      ? 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400'
      : s === 'rejected'
      ? 'bg-rose-500/15 text-rose-600 ring-rose-500/30 dark:text-rose-400'
      : 'bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-400';
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${tone}`}>
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

export default function TaskApprovalsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('pending');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rejectTarget, setRejectTarget] = useState<TaskSheetApproval | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['pm-task-approvals', filter],
    queryFn: () => pmTaskApprovalsApi.list(filter).then((r) => r.data.data),
  });

  // Reset selection whenever the visible list changes (filter switch, refetch).
  const rows = data ?? [];
  const visibleIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allChecked = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const approveOne = useMutation({
    mutationFn: (id: number) => pmTaskApprovalsApi.approve(id).then((r) => r.data.data),
    onSuccess: () => {
      toast.success('Approved');
      qc.invalidateQueries({ queryKey: ['pm-task-approvals'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Approve failed'),
  });

  const rejectOne = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      pmTaskApprovalsApi.reject(id, notes).then((r) => r.data.data),
    onSuccess: () => {
      toast.success('Rejected');
      qc.invalidateQueries({ queryKey: ['pm-task-approvals'] });
      setRejectTarget(null);
      setRejectNotes('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Reject failed'),
  });

  // Bulk approve runs sequentially so a partial failure leaves the rest
  // intact rather than aborting the whole batch.
  const approveBulk = useMutation({
    mutationFn: async (ids: number[]) => {
      const results = { ok: 0, fail: 0 };
      for (const id of ids) {
        try {
          await pmTaskApprovalsApi.approve(id);
          results.ok++;
        } catch {
          results.fail++;
        }
      }
      return results;
    },
    onSuccess: ({ ok, fail }) => {
      if (ok > 0) toast.success(`Approved ${ok} sheet${ok === 1 ? '' : 's'}`);
      if (fail > 0) toast.error(`${fail} could not be approved`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['pm-task-approvals'] });
    },
  });

  const toggleRow = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(allChecked ? new Set() : new Set(visibleIds));

  const openReject = (row: TaskSheetApproval) => {
    setRejectTarget(row);
    setRejectNotes('');
  };

  const submitReject = () => {
    if (!rejectTarget) return;
    const trimmed = rejectNotes.trim();
    if (!trimmed) {
      toast.error('A rejection reason is required');
      return;
    }
    rejectOne.mutate({ id: rejectTarget.id, notes: trimmed });
  };

  return (
    <div className="space-y-4">
      {/* Gradient Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-blue-600 to-blue-800" />
        <div className="relative px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <ClipboardCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">My Approvals</h1>
              <p className="text-sm text-white/60">
                Task sheets waiting on your decision
              </p>
            </div>
          </div>
          {filter === 'pending' && selected.size > 0 && (
            <Button
              size="sm"
              className="bg-white text-blue-700 hover:bg-white/90 shadow-lg"
              disabled={approveBulk.isPending}
              onClick={() => approveBulk.mutate([...selected])}
            >
              <Check className="mr-1.5 h-4 w-4" />
              Approve Selected ({selected.size})
            </Button>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-1 p-0.5 bg-muted rounded-lg w-fit">
        {FILTER_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setFilter(t.key);
              setSelected(new Set());
            }}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === t.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
        <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-blue-500 to-blue-700" />
        <Table>
          <TableHeader>
            <TableRow>
              {filter === 'pending' && (
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer rounded border-input accent-blue-600"
                    checked={allChecked}
                    onChange={toggleAll}
                    aria-label="Select all"
                    disabled={rows.length === 0}
                  />
                </TableHead>
              )}
              <TableHead>Employee</TableHead>
              <TableHead>Sheet Date</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Entry</TableHead>
              <TableHead>Hours</TableHead>
              {/* Round is only useful for closed rows (signals "this was a
                  resubmit"). On Pending it's noise — hide it there. */}
              {filter !== 'pending' && <TableHead>Round</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead className="w-56 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {/* Pending: checkbox + 7 cells = 8. Closed: 7 cells + Round = 8. */}
                  {[...Array(8)].map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-40">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 mb-3">
                      <ClipboardCheck className="h-6 w-6 text-blue-500" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      No {filter} approvals
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {filter === 'pending'
                        ? 'Nothing is waiting on your decision right now.'
                        : `No sheets have been ${filter} yet.`}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const sheet = row.taskSheet;
                const entry = row.taskEntry;
                const projectLabel = row.project
                  ? row.project.projectName
                  : row.projectId === null
                  ? 'No project'
                  : `Project #${row.projectId}`;
                const isPending = row.status === 'pending';
                // Entry label: ticket number if present, else a short
                // activity tag ("Internal Meeting" / "Other" / etc.).
                const rawAct = (entry?.activityType ?? '').toLowerCase();
                const activityLabel =
                  rawAct === 'internal_meeting'
                    ? 'Internal Meeting'
                    : rawAct === 'client_meeting'
                    ? 'Client Meeting'
                    : 'Other';
                const entryDesc = entry?.taskDescription?.trim() ?? '';
                const entryPreview =
                  entryDesc.length > 60
                    ? `${entryDesc.slice(0, 60).replace(/\s+/g, ' ').trim()}…`
                    : entryDesc;
                return (
                  <TableRow
                    key={row.id}
                    // Whole-row click opens the sheet preview — replaces
                    // the dedicated eye button. Interactive cells
                    // (checkbox, approve/reject) stop propagation so
                    // they don't double-trigger navigation.
                    className={sheet?.id ? 'cursor-pointer hover:bg-muted/40' : undefined}
                    onClick={
                      sheet?.id
                        ? () => router.push(`/task-sheets/${sheet.id}`)
                        : undefined
                    }
                  >
                    {filter === 'pending' && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer rounded border-input accent-blue-600"
                          checked={selected.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                          aria-label={`Select approval #${row.id}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">
                      {sheet?.employee?.name ?? `Employee #${sheet?.employeeId ?? '—'}`}
                    </TableCell>
                    <TableCell>{sheet?.sheetDate?.slice(0, 10) ?? '—'}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        {row.project ? (
                          <FolderKanban className="h-3.5 w-3.5 text-blue-500" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        )}
                        <span className={row.project ? '' : 'italic text-muted-foreground'}>
                          {projectLabel}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[26rem]">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          {entry?.ticket?.ticketNumber ? (
                            <span className="font-mono text-[10px] text-blue-700 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                              {entry.ticket.ticketNumber}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">
                              {activityLabel}
                            </span>
                          )}
                          {entry?.ticket?.title && (
                            <span className="text-sm truncate">
                              {entry.ticket.title}
                            </span>
                          )}
                        </div>
                        {entryPreview && (
                          <span className="text-xs text-muted-foreground truncate">
                            {entryPreview}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry?.durationHours !== undefined && entry?.durationHours !== null
                        ? `${Number(entry.durationHours).toFixed(2)}h`
                        : '—'}
                    </TableCell>
                    {filter !== 'pending' && (
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          #{row.round}
                        </span>
                      </TableCell>
                    )}
                    <TableCell>{statusPill(row.status)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        {isPending && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-rose-500/40 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                              onClick={() => openReject(row)}
                            >
                              <X className="mr-1 h-4 w-4" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              className="bg-emerald-600 text-white hover:bg-emerald-700"
                              disabled={approveOne.isPending}
                              onClick={() => approveOne.mutate(row.id)}
                            >
                              <Check className="mr-1 h-4 w-4" />
                              Approve
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Reject dialog — notes required (backend also rejects empty). */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(v) => {
          if (!v) {
            setRejectTarget(null);
            setRejectNotes('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject task sheet</DialogTitle>
            <DialogDescription>
              The employee will be asked to revise this slice and re-submit. A
              reason is required and will be sent to them in the notification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Reason
            </label>
            <Textarea
              autoFocus
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="What needs to change before re-submission?"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setRejectNotes('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={rejectOne.isPending || !rejectNotes.trim()}
              onClick={submitReject}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
