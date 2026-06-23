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
    // Auto-refetch when the user tabs back to this page. Important
    // for the PM-reassign cascade: when an admin reassigns a project
    // to a new PM, the new PM's tab won't get pushed an update — but
    // the moment they switch to the approvals tab, this triggers a
    // refetch and the newly-cascaded rows appear.
    refetchOnWindowFocus: true,
    // Treat anything older than 10s as stale so brief tab switches
    // also reload — the default `staleTime: 0` would refetch on every
    // remount which is fine here but excessive on rapid filter toggles.
    staleTime: 10_000,
  });

  // Reset selection whenever the visible list changes (filter switch, refetch).
  const rows = data ?? [];
  const visibleIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allChecked = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  // Group per-entry rows by (sheetId, projectId) so the PM sees one card
  // per "Aditya · Thirdwave Coffee on Jun 3" with every entry stacked
  // inside — same pattern as the Flutter inbox.
  const groups = useMemo(() => {
    type G = {
      key: string;
      sheetId: number;
      projectId: number | null;
      projectName: string;
      employeeName: string;
      sheetDate?: string;
      submittedAt?: string | null;
      rows: TaskSheetApproval[];
    };
    const map = new Map<string, G>();
    const order: string[] = [];
    for (const r of rows) {
      // For real projects, group by projectId. For "Other" entries
      // (projectId is null) we also key on the user-typed
      // `otherProjectName`, so two different typed names on the same
      // sheet land in separate cards instead of merging into a single
      // "No project" bucket.
      const otherName = r.taskEntry?.otherProjectName?.trim() ?? '';
      const projectKey =
        r.projectId !== null
          ? `p${r.projectId}`
          : `o:${otherName.toLowerCase()}`;
      const key = `${r.taskSheetId}:${projectKey}`;
      let g = map.get(key);
      if (!g) {
        // Label rules:
        //   real project          → "Project Name"
        //   other + typed name    → "Other — <name>"
        //   other, nothing typed  → "Other" (was "No project")
        const label = r.project?.projectName
          ?? (r.projectId !== null
            ? `Project #${r.projectId}`
            : otherName
              ? `Other — ${otherName}`
              : 'Other');
        g = {
          key,
          sheetId: r.taskSheetId,
          projectId: r.projectId,
          projectName: label,
          employeeName:
            r.taskSheet?.employee?.name ??
            `Employee #${r.taskSheet?.employeeId ?? '?'}`,
          sheetDate: r.taskSheet?.sheetDate,
          submittedAt: r.taskSheet?.submittedAt,
          rows: [],
        };
        map.set(key, g);
        order.push(key);
      }
      g.rows.push(r);
    }
    return order.map((k) => map.get(k)!);
  }, [rows]);

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
    <div className="w-full space-y-4">
      {/* Gradient Header — tighter padding on phones, wraps if both
          rows can't sit side-by-side. */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-blue-600 to-blue-800" />
        <div className="relative px-4 py-4 sm:px-6 sm:py-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <ClipboardCheck className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-white truncate">My Approvals</h1>
              <p className="text-xs sm:text-sm text-white/60 truncate">
                Task sheets waiting on your decision
              </p>
            </div>
          </div>
          {filter === 'pending' && selected.size > 0 && (
            <Button
              size="sm"
              className="bg-white text-blue-700 hover:bg-white/90 shadow-lg shrink-0"
              disabled={approveBulk.isPending}
              onClick={() => approveBulk.mutate([...selected])}
            >
              <Check className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Approve Selected ({selected.size})</span>
              <span className="sm:hidden">Approve ({selected.size})</span>
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

      {filter === 'pending' ? (
        // ── Grouped card layout for Pending ───────────────────────────
        // Mirrors the Flutter PM inbox: one card per (employee + project
        // + sheet) with every entry stacked inside. Each entry keeps its
        // own checkbox + Reject / Approve actions.
        <PendingGroups
          groups={groups}
          isLoading={isLoading}
          allChecked={allChecked}
          onToggleAll={toggleAll}
          selected={selected}
          onToggleRow={toggleRow}
          approveOne={approveOne}
          rejectOne={rejectOne}
          openReject={openReject}
          router={router}
        />
      ) : (
      <>
      {/* ── Mobile / tablet card list for Approved & Rejected ─────────
          The desktop table has 8 columns — too wide for phones. Below
          md (< 768 px) we render the same data as a stacked card list. */}
      <div className="md:hidden space-y-2">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-3">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-48" />
            </div>
          ))
        ) : rows.length === 0 ? (
          <div className="rounded-xl border bg-card py-10 text-center">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-blue-500/10 mb-3">
              <ClipboardCheck className="h-6 w-6 text-blue-500" />
            </div>
            <p className="text-sm font-medium">No {filter} approvals</p>
            <p className="text-xs text-muted-foreground mt-1">No sheets have been {filter} yet.</p>
          </div>
        ) : (
          rows.map((row) => {
            const sheet = row.taskSheet;
            const entry = row.taskEntry;
            const otherName = entry?.otherProjectName?.trim() ?? '';
            const projectLabel = row.project
              ? row.project.projectName
              : row.projectId !== null
                ? `Project #${row.projectId}`
                : otherName
                  ? `Other — ${otherName}`
                  : 'Other';
            const rawAct = (entry?.activityType ?? '').toLowerCase();
            const activityLabel =
              rawAct === 'internal_meeting' ? 'Internal Meeting'
              : rawAct === 'client_meeting' ? 'Client Meeting'
              : 'Other';
            const desc = entry?.taskDescription?.trim() ?? '';
            const preview = desc.length > 80 ? `${desc.slice(0, 80).replace(/\s+/g, ' ').trim()}…` : desc;
            const hrs = entry?.durationHours !== undefined && entry?.durationHours !== null
              ? `${Number(entry.durationHours).toFixed(2)}h`
              : '—';
            return (
              <div
                key={row.id}
                role={sheet?.id ? 'button' : undefined}
                tabIndex={sheet?.id ? 0 : undefined}
                onClick={sheet?.id ? () => router.push(`/task-sheets/${sheet.id}`) : undefined}
                onKeyDown={sheet?.id ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/task-sheets/${sheet.id}`); }
                } : undefined}
                className={`rounded-xl border bg-card p-3 shadow-sm ${sheet?.id ? 'cursor-pointer hover:border-primary/40 hover:shadow-md transition-all' : ''}`}
              >
                {/* Row 1: employee + status pill */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold truncate">
                    {sheet?.employee?.name ?? `Employee #${sheet?.employeeId ?? '—'}`}
                  </span>
                  {statusPill(row.status)}
                </div>
                {/* Row 2: project line + sheet date */}
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    {row.project
                      ? <FolderKanban className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      : <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                    <span className={`text-xs truncate ${row.project ? '' : 'italic text-muted-foreground'}`}>
                      {projectLabel}
                    </span>
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {sheet?.sheetDate?.slice(0, 10) ?? '—'}
                  </span>
                </div>
                {/* Picked approver — only when the submitter chose one
                    for this entry. Helps the PM see the row is also in
                    the approver's queue (Sprint 1: runs alongside). */}
                {row.taskApprover && (
                  <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-violet-700 dark:text-violet-300 bg-violet-500/10 px-1.5 py-0.5 rounded">
                    <span className="font-medium">Approver:</span>
                    <span className="truncate">{row.taskApprover.name}</span>
                  </div>
                )}
                {/* Row 3: entry label + title */}
                <div className="mt-2 flex items-center gap-2 flex-wrap">
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
                    <span className="text-xs font-medium truncate">{entry.ticket.title}</span>
                  )}
                </div>
                {preview && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{preview}</p>
                )}
                {/* Row 4: hours + round */}
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Round #{row.round}</span>
                  <span className="font-semibold tabular-nums">{hrs}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="hidden md:block rounded-lg border bg-card overflow-x-auto shadow-sm">
        <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-blue-500 to-blue-700" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Sheet Date</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Entry</TableHead>
              <TableHead>Hours</TableHead>
              {/* Round is only useful for closed rows (signals "this was a
                  resubmit"). */}
              <TableHead>Round</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-56 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
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
                      {`No sheets have been ${filter} yet.`}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const sheet = row.taskSheet;
                const entry = row.taskEntry;
                const otherName = entry?.otherProjectName?.trim() ?? '';
                const projectLabel = row.project
                  ? row.project.projectName
                  : row.projectId !== null
                    ? `Project #${row.projectId}`
                    : otherName
                      ? `Other — ${otherName}`
                      : 'Other';
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
                    className={sheet?.id ? 'cursor-pointer hover:bg-muted/40' : undefined}
                    onClick={
                      sheet?.id
                        ? () => router.push(`/task-sheets/${sheet.id}`)
                        : undefined
                    }
                  >
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
                        {row.taskApprover && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-violet-700 dark:text-violet-300 bg-violet-500/10 px-1.5 py-0.5 rounded self-start">
                            <span className="font-medium">Approver:</span>
                            <span>{row.taskApprover.name}</span>
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry?.durationHours !== undefined && entry?.durationHours !== null
                        ? `${Number(entry.durationHours).toFixed(2)}h`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        #{row.round}
                      </span>
                    </TableCell>
                    <TableCell>{statusPill(row.status)}</TableCell>
                    <TableCell />
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      </>
      )}

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

// ── Pending grouped layout ─────────────────────────────────────────────────
//
// One card per (employee + project + sheet) — mirrors the Flutter inbox.
// Approve / Reject buttons sit on each entry row inside the card so the
// PM can decide entry-by-entry without scrolling past a repeated header.

type PendingGroup = {
  key: string;
  sheetId: number;
  projectId: number | null;
  projectName: string;
  employeeName: string;
  sheetDate?: string;
  submittedAt?: string | null;
  rows: TaskSheetApproval[];
};

function PendingGroups({
  groups,
  isLoading,
  allChecked,
  onToggleAll,
  selected,
  onToggleRow,
  approveOne,
  rejectOne,
  openReject,
  router,
}: {
  groups: PendingGroup[];
  isLoading: boolean;
  allChecked: boolean;
  onToggleAll: () => void;
  selected: Set<number>;
  onToggleRow: (id: number) => void;
  approveOne: { mutate: (id: number) => void; isPending: boolean };
  rejectOne: { isPending: boolean };
  openReject: (row: TaskSheetApproval) => void;
  router: ReturnType<typeof useRouter>;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-lg border bg-card shadow-sm overflow-hidden"
          >
            <div className="h-1.5 bg-linear-to-r from-blue-500 to-blue-700" />
            <div className="p-4 space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-blue-500 to-blue-700" />
        <div className="flex flex-col items-center justify-center text-center py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 mb-3">
            <ClipboardCheck className="h-6 w-6 text-blue-500" />
          </div>
          <p className="text-sm font-medium text-foreground">
            No pending approvals
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Nothing is waiting on your decision right now.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Bulk select-all bar — applies to every visible entry across groups. */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30">
        <input
          type="checkbox"
          className="h-4 w-4 cursor-pointer rounded border-input accent-blue-600"
          checked={allChecked}
          onChange={onToggleAll}
          aria-label="Select all"
        />
        <span className="text-xs text-muted-foreground">
          Select all ({groups.reduce((s, g) => s + g.rows.length, 0)} {groups.reduce((s, g) => s + g.rows.length, 0) === 1 ? 'entry' : 'entries'} across {groups.length} {groups.length === 1 ? 'sheet' : 'sheets'})
        </span>
      </div>

      {groups.map((g) => {
        const entryCount = g.rows.length;
        const totalH = g.rows.reduce(
          (s, r) => s + Number(r.taskEntry?.durationHours ?? 0),
          0,
        );
        const hasProject = g.projectId !== null;
        const sheetDateDisplay = g.sheetDate?.slice(0, 10) ?? '—';
        return (
          <div
            key={g.key}
            className="rounded-lg border bg-card shadow-sm overflow-hidden"
          >
            <div className="h-1.5 bg-linear-to-r from-blue-500 to-blue-700" />

            {/* Header strip: employee + date + status pill */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-blue-500/5 border-b">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/15">
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                    {g.employeeName
                      .split(' ')
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join('')
                      .toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {g.employeeName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {sheetDateDisplay}
                  </p>
                </div>
              </div>
              <span className="rounded-full px-2 py-0.5 text-xs font-medium ring-1 bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-400">
                Pending
              </span>
            </div>

            {/* Project line + entry/hour count + (optional) submitted at */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b">
              <span className="inline-flex items-center gap-1.5">
                {hasProject ? (
                  <FolderKanban className="h-3.5 w-3.5 text-blue-500" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                )}
                <span
                  className={`text-sm font-medium ${hasProject ? '' : 'italic text-muted-foreground'}`}
                >
                  {g.projectName}
                </span>
              </span>
              <div className="flex items-center gap-3">
                {g.submittedAt && (
                  <span className="text-xs text-muted-foreground">
                    Submitted {format(new Date(g.submittedAt), 'MMM d, HH:mm')}
                  </span>
                )}
                <span className="text-xs font-semibold text-muted-foreground">
                  {entryCount} {entryCount === 1 ? 'entry' : 'entries'} · {totalH.toFixed(2)}h
                </span>
              </div>
            </div>

            {/* Per-entry rows */}
            <div className="divide-y">
              {g.rows.map((row) => {
                const entry = row.taskEntry;
                const rawAct = (entry?.activityType ?? '').toLowerCase();
                const activityLabel =
                  rawAct === 'internal_meeting'
                    ? 'Internal Meeting'
                    : rawAct === 'client_meeting'
                    ? 'Client Meeting'
                    : 'Other';
                const desc = entry?.taskDescription?.trim() ?? '';
                const preview =
                  desc.length > 80
                    ? `${desc.slice(0, 80).replace(/\s+/g, ' ').trim()}…`
                    : desc;
                const hrs =
                  entry?.durationHours !== undefined &&
                  entry?.durationHours !== null
                    ? `${Number(entry.durationHours).toFixed(2)}h`
                    : '—';
                return (
                  <div
                    key={row.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 hover:bg-muted/30"
                  >
                    {/* Top section: checkbox + content */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        className="h-4 w-4 mt-0.5 cursor-pointer rounded border-input accent-blue-600 shrink-0"
                        checked={selected.has(row.id)}
                        onChange={() => onToggleRow(row.id)}
                        aria-label={`Select approval #${row.id}`}
                      />
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
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
                            <span className="text-sm font-medium truncate">
                              {entry.ticket.title}
                            </span>
                          )}
                          {row.round > 1 && (
                            <span className="text-[10px] font-semibold text-violet-700 dark:text-violet-300 bg-violet-500/10 px-1.5 py-0.5 rounded">
                              Re-submitted
                            </span>
                          )}
                        </div>
                        {preview && (
                          <span className="text-xs text-muted-foreground truncate">
                            {preview}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Trailing cluster: hours + action buttons.
                        Phones: full-width row below the content (offset
                        to align with the text, not the checkbox).
                        sm+   : sits at the row's right edge.            */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 pl-7 sm:pl-0">
                      <span className="text-sm font-semibold tabular-nums shrink-0">
                        {hrs}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-rose-500/40 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                          disabled={rejectOne.isPending || approveOne.isPending}
                          onClick={() => openReject(row)}
                        >
                          <X className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Reject</span>
                        </Button>
                        <Button
                          size="sm"
                          className="bg-emerald-600 text-white hover:bg-emerald-700"
                          disabled={rejectOne.isPending || approveOne.isPending}
                          onClick={() => approveOne.mutate(row.id)}
                        >
                          <Check className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Approve</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer: View sheet */}
            <div className="px-4 py-2 border-t">
              <Button
                size="sm"
                variant="ghost"
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-500/10 px-2"
                onClick={() => router.push(`/task-sheets/${g.sheetId}`)}
              >
                View sheet
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
