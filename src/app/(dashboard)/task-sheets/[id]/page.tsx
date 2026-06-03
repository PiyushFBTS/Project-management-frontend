'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  X,
  XCircle,
  AlertCircle,
  RefreshCcw,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { taskSheetsApi, pmTaskApprovalsApi } from '@/lib/api/task-sheets';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type {
  TaskSheetApproval,
  TaskSheetApprovalRowStatus,
  TaskSheetOverallApprovalStatus,
} from '@/types';

const ROW_STATUS_CLASS: Record<TaskSheetApprovalRowStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-400',
  approved: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-400',
  rejected: 'bg-red-500/15 text-red-700 ring-red-500/30 dark:text-red-400',
};

export default function TaskSheetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isEmployee = user?._type === 'employee';
  const callerUserId = (user as { id?: number } | null)?.id ?? null;
  const isHr = isEmployee && !!(user as { isHr?: boolean } | null)?.isHr;

  // PM-rejection dialog state (used in PM view only).
  const [rejectTarget, setRejectTarget] = useState<TaskSheetApproval | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');

  const { data: sheet, isLoading } = useQuery({
    queryKey: ['task-sheet', id, isEmployee],
    queryFn: () =>
      (isEmployee
        ? taskSheetsApi.getById(Number(id))
        : taskSheetsApi.adminGetOne(Number(id))
      ).then((r) => r.data.data),
  });

  const { data: approvals } = useQuery({
    queryKey: ['task-sheet-approvals', id],
    // Approval reads sit on /task-sheets/:id/approvals (employee path).
    // Admins on this page get the same data because the route is open
    // to any authenticated user; if the request returns 4xx we just
    // fall back to no banner.
    queryFn: () =>
      taskSheetsApi
        .getApprovals(Number(id))
        .then((r) => r.data.data)
        .catch(() => [] as TaskSheetApproval[]),
    enabled: !!sheet,
  });

  // Latest-round approval per entry — that's the "current" decision
  // for each entry now that the schema is per-entry rather than
  // per-project.
  const latestByEntry = useMemo(() => {
    const map = new Map<number, TaskSheetApproval>();
    for (const a of approvals ?? []) {
      const cur = map.get(a.taskEntryId);
      if (!cur || a.round > cur.round) map.set(a.taskEntryId, a);
    }
    return map;
  }, [approvals]);

  // ── View mode ─────────────────────────────────────────────────────────
  // PM view is the scoped read a project manager gets when they click
  // "View sheet" from /task-approvals. We hide the headline stat cards,
  // the approval-history table, and any entries the PM isn't responsible
  // for — they only see their own slice plus inline approve / reject
  // controls. Owner / HR / admin keep the full read.
  const isOwner = !!sheet && callerUserId === sheet.employeeId;
  const isPmView = !!sheet && isEmployee && !isOwner && !isHr;

  // The set of entry ids where the caller is the snapshot PM on the
  // current round. PM view filters entries down to these only.
  const pmEntryIds = useMemo(() => {
    if (!isPmView || !callerUserId) return null;
    const ids = new Set<number>();
    for (const [entryId, a] of latestByEntry) {
      if (a.pmId === callerUserId) ids.add(entryId);
    }
    return ids;
  }, [isPmView, callerUserId, latestByEntry]);

  const approveOne = useMutation({
    mutationFn: (approvalId: number) =>
      pmTaskApprovalsApi.approve(approvalId).then((r) => r.data.data),
    onSuccess: () => {
      toast.success('Approved');
      qc.invalidateQueries({ queryKey: ['task-sheet-approvals', id] });
      qc.invalidateQueries({ queryKey: ['task-sheet', id, isEmployee] });
      qc.invalidateQueries({ queryKey: ['pm-task-approvals'] });
      qc.invalidateQueries({ queryKey: ['sidebar-pending-approvals'] });
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Approve failed';
      toast.error(msg);
    },
  });

  const rejectOne = useMutation({
    mutationFn: ({ approvalId, notes }: { approvalId: number; notes: string }) =>
      pmTaskApprovalsApi.reject(approvalId, notes).then((r) => r.data.data),
    onSuccess: () => {
      toast.success('Rejected');
      setRejectTarget(null);
      setRejectNotes('');
      qc.invalidateQueries({ queryKey: ['task-sheet-approvals', id] });
      qc.invalidateQueries({ queryKey: ['task-sheet', id, isEmployee] });
      qc.invalidateQueries({ queryKey: ['pm-task-approvals'] });
      qc.invalidateQueries({ queryKey: ['sidebar-pending-approvals'] });
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Reject failed';
      toast.error(msg);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!sheet) return <p className="text-slate-500">Sheet not found.</p>;

  const overall: TaskSheetOverallApprovalStatus =
    sheet.overallApprovalStatus ?? 'no_approvals';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold text-foreground">
          {isPmView ? 'Review' : 'Task Sheet'}
          {(!isEmployee || isPmView) && (
            <> — {sheet.employee?.name ?? `#${sheet.employeeId}`}</>
          )}
        </h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${sheet.isSubmitted ? 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 ring-amber-500/30'}`}>
          {sheet.isSubmitted ? 'Submitted' : 'Draft'}
        </span>
      </div>

      {/* Overall PM-approval banner — hidden when the sheet hasn't been
          submitted yet (no_approvals). Tone matches the aggregate state. */}
      {overall !== 'no_approvals' && (
        <OverallApprovalBanner
          status={overall}
          isOwner={isOwner}
          sheetDate={sheet.sheetDate}
        />
      )}

      {/* Headline stat cards — hidden in PM view (the PM doesn't need
          the sheet-wide totals; they're acting on their slice only). */}
      {!isPmView && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Date', value: sheet.sheetDate?.slice(0, 10) },
            { label: 'Total Hours', value: `${Number(sheet.totalHours).toFixed(1)}h` },
            { label: 'Man-Days', value: Number(sheet.manDays).toFixed(2) },
            { label: 'Submitted At', value: sheet.submittedAt ? format(new Date(sheet.submittedAt), 'MMM d, HH:mm') : '—' },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-semibold text-foreground">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            {isPmView ? 'Your segments' : 'Task Entries'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(() => {
            const entries = sheet.taskEntries ?? [];
            if (entries.length === 0) {
              return (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No entries
                </p>
              );
            }

            // Group entries by project (or "Other" for entries with no
            // project link). Track projectId alongside the name so we
            // can look up the right approval row even when two projects
            // share a display name.
            const groups = new Map<
              string,
              { name: string; projectId: number | null; entries: typeof entries; total: number }
            >();
            for (const e of entries) {
              const pid = e.project?.id ?? null;
              const otherName = e.otherProjectName?.trim() ?? '';
              const key = pid !== null ? `p:${pid}` : `o:${otherName.toLowerCase()}`;
              // "Other — <typed name>" when the user filled the Other
              // field; bare "Other" when they didn't; project name for
              // real projects.
              const name = e.project?.projectName
                ?? (otherName ? `Other — ${otherName}` : 'Other');
              if (!groups.has(key)) {
                groups.set(key, { name, projectId: pid, entries: [], total: 0 });
              }
              const g = groups.get(key)!;
              g.entries.push(e);
              g.total += Number(e.durationHours ?? 0);
            }

            // PM view filter: drop entries this PM isn't the snapshot
            // PM for, then re-collapse empty groups. Per-entry now —
            // a project may have some entries this PM owns and others
            // assigned to a different PM.
            const filteredGroups = (isPmView
              ? [...groups.values()]
                  .map((g) => ({
                    ...g,
                    entries: g.entries.filter((e) => pmEntryIds?.has(e.id)),
                  }))
                  .filter((g) => g.entries.length > 0)
                  .map((g) => ({
                    ...g,
                    total: g.entries.reduce(
                      (sum, e) => sum + Number(e.durationHours ?? 0),
                      0,
                    ),
                  }))
              : [...groups.values()]);

            if (filteredGroups.length === 0) {
              return (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No entries assigned to you on this sheet.
                </p>
              );
            }

            // Per-entry approval flag — whether to render the
            // approval column at all. Hidden when the sheet has no
            // approval rows yet (never submitted).
            const showApprovalCol = (approvals?.length ?? 0) > 0;

            return (
              <div className="divide-y">
                {filteredGroups.map((g) => {
                  return (
                    <div key={`${g.projectId ?? 'null'}:${g.name}`}>
                      {/* Project header — name + group totals. Per-entry
                          status pills live on the rows now, so no
                          project-level pill or button here. */}
                      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-blue-500/5 border-b">
                        <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                          {g.name}
                        </p>
                        <p className="text-xs font-semibold text-muted-foreground">
                          {g.entries.length} entr{g.entries.length === 1 ? 'y' : 'ies'} · {g.total.toFixed(2)}h
                        </p>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            <TableHead>Ticket / Activity</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Blockers</TableHead>
                            <TableHead className="text-right w-20">Hours</TableHead>
                            <TableHead className="w-32">Status</TableHead>
                            {showApprovalCol && (
                              <TableHead className="w-36">Approval</TableHead>
                            )}
                            {isPmView && (
                              <TableHead className="w-56 text-right">
                                Actions
                              </TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {g.entries.map((e, i) => {
                            const ticketNo = e.ticket?.ticketNumber ?? null;
                            const ticketTitle = e.ticket?.title ?? null;
                            const rawAct = (e.activityType ?? '').toLowerCase().trim();
                            const activityLabel = rawAct === 'internal_meeting'
                              ? 'Internal Meeting'
                              : rawAct === 'client_meeting'
                                ? 'Client Meeting'
                                : 'Other';
                            const approval = latestByEntry.get(e.id);
                            const canDecide =
                              isPmView &&
                              !!approval &&
                              approval.status === 'pending' &&
                              approval.pmId === callerUserId;
                            return (
                              <TableRow key={e.id}>
                                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                <TableCell>
                                  {ticketNo ? (
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="font-mono text-[10px] text-blue-700 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded shrink-0">
                                        {ticketNo}
                                      </span>
                                      {ticketTitle && (
                                        <span className="text-sm truncate">{ticketTitle}</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">
                                      {activityLabel}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground max-w-md">
                                  <ExpandableDesc text={e.taskDescription ?? ''} />
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground max-w-xs">
                                  {e.blockers ? (
                                    <div
                                      className="truncate text-amber-700 dark:text-amber-400"
                                      title={e.blockers}
                                    >
                                      🚧 {e.blockers}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground/50">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {Number(e.durationHours).toFixed(2)}h
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="capitalize text-xs">
                                    {e.status?.replace('_', ' ')}
                                  </Badge>
                                </TableCell>
                                {showApprovalCol && (
                                  <TableCell>
                                    {approval ? (
                                      <ProjectApprovalPill approval={approval} />
                                    ) : (
                                      <span className="text-muted-foreground/50 text-xs">
                                        —
                                      </span>
                                    )}
                                  </TableCell>
                                )}
                                {isPmView && (
                                  <TableCell className="text-right">
                                    {canDecide && approval ? (
                                      <div className="flex justify-end gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="border-rose-500/40 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                                          disabled={
                                            rejectOne.isPending ||
                                            approveOne.isPending
                                          }
                                          onClick={() => {
                                            setRejectTarget(approval);
                                            setRejectNotes('');
                                          }}
                                        >
                                          <X className="mr-1 h-4 w-4" />
                                          Reject
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="bg-emerald-600 text-white hover:bg-emerald-700"
                                          disabled={
                                            rejectOne.isPending ||
                                            approveOne.isPending
                                          }
                                          onClick={() =>
                                            approveOne.mutate(approval.id)
                                          }
                                        >
                                          <Check className="mr-1 h-4 w-4" />
                                          Approve
                                        </Button>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground/50 text-xs">
                                        —
                                      </span>
                                    )}
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Approval audit log — every round, newest first. Folded when
          there are no decisions yet (only pending rows). Hidden in PM
          view since the PM only cares about their own slice. */}
      {!isPmView && (approvals?.length ?? 0) > 0 && (
        <ApprovalHistoryCard approvals={approvals!} />
      )}

      {/* Reject dialog — required notes, mirrors /task-approvals. */}
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
            <DialogTitle>Reject this segment</DialogTitle>
            <DialogDescription>
              The employee will be asked to revise these entries and
              re-submit. A reason is required and will be sent in the
              notification.
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
              onClick={() => {
                if (!rejectTarget) return;
                rejectOne.mutate({
                  approvalId: rejectTarget.id,
                  notes: rejectNotes.trim(),
                });
              }}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Overall banner — top-of-page summary + resubmit CTA on rejection
// ─────────────────────────────────────────────────────────────────────
function OverallApprovalBanner({
  status,
  isOwner,
  sheetDate,
}: {
  status: TaskSheetOverallApprovalStatus;
  isOwner: boolean;
  sheetDate: string;
}) {
  const router = useRouter();
  const palette = {
    approved: {
      icon: <CheckCircle2 className="h-5 w-5" />,
      tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
      title: 'Fully approved',
      body: 'All project managers have approved this sheet.',
    },
    partial: {
      icon: <Clock className="h-5 w-5" />,
      tone: 'border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-300',
      title: 'Partially approved',
      body: 'Some PMs have approved their segment; others are still reviewing.',
    },
    pending: {
      icon: <Clock className="h-5 w-5" />,
      tone: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300',
      title: 'Awaiting approval',
      body: 'Project managers will review their respective segments.',
    },
    rejected: {
      icon: <XCircle className="h-5 w-5" />,
      tone: 'border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-300',
      title: 'Changes requested',
      body: 'At least one segment was rejected. Edit the affected entries and re-submit — approved segments will stay locked.',
    },
    no_approvals: {
      icon: <AlertCircle className="h-5 w-5" />,
      tone: 'border-slate-500/40 bg-slate-500/10 text-slate-800 dark:text-slate-300',
      title: 'No approvals yet',
      body: 'Submit the sheet to route segments to the respective project managers.',
    },
  }[status];

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${palette.tone}`}
    >
      <div className="mt-0.5">{palette.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{palette.title}</p>
        <p className="text-xs opacity-90 mt-0.5">{palette.body}</p>
      </div>
      {/* Resubmit CTA — only when the owner can act on a rejection. */}
      {status === 'rejected' && isOwner && (
        <Button
          size="sm"
          onClick={() =>
            router.push(`/task-sheets/fill?date=${sheetDate.slice(0, 10)}`)
          }
          className="bg-red-600 text-white hover:bg-red-700"
        >
          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit & Resubmit
        </Button>
      )}
      {status === 'partial' && isOwner && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            router.push(`/task-sheets/fill?date=${sheetDate.slice(0, 10)}`)
          }
        >
          <RefreshCcw className="mr-1 h-3.5 w-3.5" /> Continue editing
        </Button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Per-project pill on the group header
// ─────────────────────────────────────────────────────────────────────
function ProjectApprovalPill({ approval }: { approval: TaskSheetApproval }) {
  return (
    <span
      title={
        approval.notes ??
        (approval.decidedBy
          ? `${approval.status} by ${approval.decidedBy.name}`
          : approval.status)
      }
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${ROW_STATUS_CLASS[approval.status]}`}
    >
      {approval.status.toUpperCase()}
      {approval.round > 1 && (
        <span className="opacity-70">· round {approval.round}</span>
      )}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Audit log — every row, every round
// ─────────────────────────────────────────────────────────────────────
function ApprovalHistoryCard({ approvals }: { approvals: TaskSheetApproval[] }) {
  // Sort: project rows first (by project name asc), then null-project;
  // within a project sort by entry id ascending, then newest round first.
  const sorted = [...approvals].sort((a, b) => {
    const ak = a.project?.projectName ?? '';
    const bk = b.project?.projectName ?? '';
    if (ak !== bk) return (ak || 'Z').localeCompare(bk || 'Z');
    if (a.taskEntryId !== b.taskEntryId) return a.taskEntryId - b.taskEntryId;
    return b.round - a.round;
  });
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          Approval history ({sorted.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project / Entry</TableHead>
              <TableHead className="w-16 text-center">Round</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead>Decided by</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((a) => {
              const entry = a.taskEntry;
              const ticketNo = entry?.ticket?.ticketNumber ?? null;
              const desc = (entry?.taskDescription ?? '').trim();
              const preview =
                desc.length > 50
                  ? `${desc.slice(0, 50).replace(/\s+/g, ' ').trim()}…`
                  : desc;
              const otherName = entry?.otherProjectName?.trim() ?? '';
              return (
                <TableRow key={a.id}>
                  <TableCell className="text-sm">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-medium">
                        {a.project?.projectName ?? (
                          <span className="text-muted-foreground italic">
                            {otherName ? `Other — ${otherName}` : 'Other'}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                        {ticketNo && (
                          <span className="font-mono text-[10px] text-blue-700 dark:text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded">
                            {ticketNo}
                          </span>
                        )}
                        {preview || '—'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-xs">
                    {a.round}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${ROW_STATUS_CLASS[a.status]}`}
                    >
                      {a.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {a.decidedBy?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.decidedAt
                      ? format(new Date(a.decidedAt), 'MMM d, HH:mm')
                      : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-sm">
                    {a.notes ? (
                      <span className="italic">&quot;{a.notes}&quot;</span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/// Task description cell: shows the first 40 chars with "…See more" when the
/// description exceeds 40 characters or spans multiple lines. Expands to the
/// full text with line breaks preserved exactly as the user entered them.
function ExpandableDesc({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const trimmed = (text ?? '').trim();
  if (!trimmed) return <span>—</span>;

  const needsToggle = trimmed.length > 40 || trimmed.includes('\n');
  if (!needsToggle) return <span>{trimmed}</span>;

  if (expanded) {
    return (
      <span>
        <span className="whitespace-pre-line wrap-break-word">{trimmed}</span>{' '}
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          See less
        </button>
      </span>
    );
  }

  const preview = trimmed.slice(0, 40).replace(/\s+/g, ' ').trimEnd();
  return (
    <span>
      <span>{preview}… </span>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        See more
      </button>
    </span>
  );
}
