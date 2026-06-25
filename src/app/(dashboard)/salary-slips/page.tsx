/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Wallet, Loader2, FileSpreadsheet, Plus, Send, Eye, FileDown,
  Trash2, Edit3, ShieldAlert, X, Search, Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/providers/auth-provider';
import { employeesApi } from '@/lib/api/employees';
import {
  salarySlipsApi,
  downloadSalarySlipPdf,
  previewSalarySlipPdfById,
  downloadSalarySlipsXlsx,
  type SalarySlip,
} from '@/lib/api/salary-slips';

/**
 * Admin hub for the Salary Slip feature. Lives at /salary-slips
 * (separate from the per-employee tab) so HR can:
 *   - filter by month + status across the whole company
 *   - bulk-generate draft slips for any set of employees (carry-over
 *     from each person's previous slip)
 *   - export the filtered list as .xlsx
 *   - jump into individual slip edit / preview / publish / delete
 *
 * Plain employees (no admin / HR / accounts flag) get a permission
 * screen with a link back to their own slips. Backend still enforces;
 * this gate is just UX.
 */
export default function SalarySlipsHubPage() {
  const { user } = useAuth();
  const isManager =
    !!user &&
    user._type !== 'client' &&
    (user._type === 'admin' ||
      (user as any).isAdmin ||
      (user as any).isHr ||
      (user as any).isAccounts);

  if (!user) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isManager) {
    return (
      <Card>
        <CardContent className="px-6 py-10 text-center space-y-3">
          <div className="mx-auto h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-sm font-medium">This hub is for admin / HR / accounts.</p>
          <p className="text-xs text-muted-foreground">
            Your published slips are visible from your profile page.
          </p>
          <Link href="/profile" className="inline-block">
            <Button variant="outline" size="sm">Go to profile</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return <SalarySlipsHubContent />;
}

function SalarySlipsHubContent() {
  const qc = useQueryClient();
  const router = useRouter();
  const [month, setMonth] = useState<string>(defaultMonth());
  // Tri-state: '' = all, 'true' = published only, 'false' = drafts only.
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Multi-select for bulk publish / withdraw / delete.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<null | 'publish' | 'unpublish' | 'delete'>(null);
  // Delete confirmation modal target — either one slip (row trash icon)
  // or the whole current selection (bulk bar). `null` = modal closed.
  const [deleteTarget, setDeleteTarget] = useState<
    null | { kind: 'single'; slip: SalarySlip } | { kind: 'bulk'; count: number }
  >(null);

  // ── List slips for the selected filters ─────────────────────────────────
  const slipsQ = useQuery({
    queryKey: ['salary-slips-hub', month, statusFilter],
    queryFn: async () => {
      const r = await salarySlipsApi.listByFilters({
        month: month || undefined,
        isPublished:
          statusFilter === ''
            ? undefined
            : statusFilter === 'true',
      });
      const list: SalarySlip[] = r.data?.data ?? r.data ?? [];
      return Array.isArray(list) ? list : [];
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────
  const publishMut = useMutation({
    mutationFn: (id: number) => salarySlipsApi.publish(id),
    onSuccess: () => {
      toast.success('Slip published — employee notified.');
      qc.invalidateQueries({ queryKey: ['salary-slips-hub'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Publish failed'),
  });
  const unpublishMut = useMutation({
    mutationFn: (id: number) => salarySlipsApi.unpublish(id),
    onSuccess: () => {
      toast.success('Slip unpublished — employee can no longer see it.');
      qc.invalidateQueries({ queryKey: ['salary-slips-hub'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Unpublish failed'),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => salarySlipsApi.remove(id),
    onSuccess: () => {
      toast.success('Slip deleted.');
      qc.invalidateQueries({ queryKey: ['salary-slips-hub'] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? 'Delete failed'),
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadSalarySlipsXlsx({
        month: month || undefined,
        isPublished: statusFilter === '' ? undefined : statusFilter === 'true',
      });
    } catch (e: any) {
      toast.error('Export failed — try a narrower filter.');
    } finally {
      setExporting(false);
    }
  };

  // ── Selection + bulk actions ─────────────────────────────────────────────
  const slips = slipsQ.data ?? [];
  // Drop any selected ids that are no longer in the current result set
  // (e.g. after a filter change) so bulk actions never touch hidden rows.
  useEffect(() => {
    setSelectedIds((prev) => {
      const visible = new Set(slips.map((s) => s.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [slips]);

  const allSelected = slips.length > 0 && slips.every((s) => selectedIds.has(s.id));
  const someSelected = selectedIds.size > 0;

  const toggleOne = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelectedIds((prev) =>
      prev.size === slips.length ? new Set() : new Set(slips.map((s) => s.id)),
    );

  /**
   * Run a publish / unpublish / delete across the selected slips.
   *
   * Publish and unpublish are status-aware: we only call the endpoint
   * for slips that actually need the change (publish → drafts only,
   * withdraw → published only). Slips already in the target state are
   * counted as "already …" and reported, rather than firing a no-op
   * call that would otherwise read as a misleading success/failure.
   * Delete applies to the whole selection (admin-only; 403s for others).
   */
  const runBulk = async (action: 'publish' | 'unpublish' | 'delete') => {
    const selected = slips.filter((s) => selectedIds.has(s.id));
    if (selected.length === 0) return;

    // Partition into rows that need the action vs. ones already there.
    let targets = selected;
    let alreadyCount = 0;
    if (action === 'publish') {
      targets = selected.filter((s) => !s.isPublished);
      alreadyCount = selected.length - targets.length;
    } else if (action === 'unpublish') {
      targets = selected.filter((s) => s.isPublished);
      alreadyCount = selected.length - targets.length;
    }

    // Nothing to do — everything is already in the desired state.
    if (targets.length === 0) {
      toast.info(
        action === 'publish'
          ? `All ${selected.length} selected slip${selected.length > 1 ? 's are' : ' is'} already published.`
          : `All ${selected.length} selected slip${selected.length > 1 ? 's are' : ' is'} already in draft.`,
      );
      return;
    }

    const verb =
      action === 'publish' ? salarySlipsApi.publish
      : action === 'unpublish' ? salarySlipsApi.unpublish
      : salarySlipsApi.remove;

    setBulkBusy(action);
    try {
      const results = await Promise.allSettled(targets.map((s) => verb(s.id)));
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - ok;
      const forbidden = results.some(
        (r) => r.status === 'rejected' && (r.reason as any)?.response?.status === 403,
      );
      const label =
        action === 'publish' ? 'Published'
        : action === 'unpublish' ? 'Withdrawn to draft'
        : 'Deleted';

      if (ok > 0) {
        const extras = [
          failed > 0 ? `${failed} failed` : null,
          alreadyCount > 0
            ? `${alreadyCount} already ${action === 'publish' ? 'published' : 'draft'}`
            : null,
        ].filter(Boolean);
        toast.success(
          `${label} ${ok} slip${ok > 1 ? 's' : ''}` +
            (extras.length ? ` · ${extras.join(' · ')}` : '') +
            (action === 'publish' ? ' — employees notified.' : '.'),
        );
      } else {
        toast.error(
          forbidden
            ? `You don't have permission to ${action === 'unpublish' ? 'withdraw' : action} one or more of the selected slips.`
            : `Could not ${action === 'unpublish' ? 'withdraw' : action} the selected slips.`,
        );
      }
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ['salary-slips-hub'] });
    } finally {
      setBulkBusy(null);
    }
  };

  // Shared bits so the desktop table and the mobile card list stay in
  // sync (one source of truth for the status pill + row actions).
  const statusBadge = (slip: SalarySlip) =>
    slip.isPublished ? (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">Published</Badge>
    ) : (
      <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-400/50">Draft</Badge>
    );

  const renderActions = (slip: SalarySlip) => (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="sm"
        title="Preview PDF"
        onClick={async () => {
          try {
            await previewSalarySlipPdfById({ slipId: slip.id, asManager: true });
          } catch (e: any) {
            toast.error(e?.message ?? 'Preview failed');
          }
        }}
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        title="Download PDF"
        onClick={() => downloadSalarySlipPdf({ slipId: slip.id, asManager: true })}
      >
        <FileDown className="h-4 w-4" />
      </Button>
      <Link
        href={`/employees/${slip.employeeId}/salary-slips/${slip.id}/edit?targetType=admin`}
        title="Edit"
      >
        <Button variant="ghost" size="sm"><Edit3 className="h-4 w-4" /></Button>
      </Link>
      {slip.isPublished ? (
        <Button
          variant="ghost"
          size="sm"
          title="Unpublish"
          disabled={unpublishMut.isPending}
          onClick={() => unpublishMut.mutate(slip.id)}
        >
          <Undo2 className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          title="Publish + notify employee"
          disabled={publishMut.isPending}
          onClick={() => publishMut.mutate(slip.id)}
        >
          <Send className="h-4 w-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        title="Delete (admin only)"
        disabled={deleteMut.isPending}
        onClick={() => setDeleteTarget({ kind: 'single', slip })}
      >
        <Trash2 className="h-4 w-4 text-rose-500" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header — stacks on phones, row from sm up. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-pink-500/15 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-pink-600 dark:text-pink-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold">Salary Slips</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Bulk-generate, publish, and export payslips for your team.
            </p>
          </div>
        </div>
        <div className="flex flex-col xs:flex-row gap-2 sm:ml-auto">
          <Button variant="outline" className="w-full xs:w-auto" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1.5 h-4 w-4" />}
            Export Excel
          </Button>
          <Button className="w-full xs:w-auto" onClick={() => setBulkOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Bulk Generate
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Slip Month" hint="Leave blank to view every month.">
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </Field>
          <Field label="Status">
            <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Published only</SelectItem>
                <SelectItem value="false">Drafts only</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      {/* Bulk action bar — appears once one or more slips are ticked.
          Stacks the label above the buttons on phones; row from sm up.
          Buttons wrap and stay tappable at every width. */}
      {someSelected && (
        <div className="flex flex-col gap-2 rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2 sm:flex-row sm:items-center">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button
              size="sm"
              variant="outline"
              disabled={!!bulkBusy}
              onClick={() => runBulk('publish')}
            >
              {bulkBusy === 'publish' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
              Publish
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!!bulkBusy}
              onClick={() => runBulk('unpublish')}
            >
              {bulkBusy === 'unpublish' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Undo2 className="mr-1.5 h-4 w-4" />}
              <span className="hidden xs:inline">Withdraw to Draft</span>
              <span className="xs:hidden">Withdraw</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-rose-600 hover:text-rose-700"
              disabled={!!bulkBusy}
              onClick={() => setDeleteTarget({ kind: 'bulk', count: selectedIds.size })}
            >
              {bulkBusy === 'delete' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
              Delete
            </Button>
            <Button size="sm" variant="ghost" disabled={!!bulkBusy} onClick={() => setSelectedIds(new Set())}>
              <X className="mr-1.5 h-4 w-4" /> Clear
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {slipsQ.isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (slipsQ.data ?? []).length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No slips match the current filters.{' '}
              <button
                className="text-blue-600 hover:underline"
                onClick={() => setBulkOpen(true)}
              >
                Bulk-generate
              </button>{' '}
              to start.
            </div>
          ) : (
            <>
              {/* ── Mobile / small screens: card list (below md) ── */}
              <div className="md:hidden">
                <div className="flex items-center gap-2 border-b px-4 py-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={toggleAll}
                    aria-label="Select all slips"
                  />
                  Select all
                </div>
                <ul className="divide-y">
                  {slips.map((slip) => (
                    <li
                      key={slip.id}
                      className={`p-4 ${selectedIds.has(slip.id) ? 'bg-muted/40' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 shrink-0"
                          checked={selectedIds.has(slip.id)}
                          onChange={() => toggleOne(slip.id)}
                          aria-label={`Select slip ${slip.slipMonth}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{slip.employee?.name ?? `#${slip.employeeId}`}</p>
                              {slip.employee?.empCode && (
                                <p className="text-[10px] text-muted-foreground truncate">{slip.employee.empCode}</p>
                              )}
                            </div>
                            {statusBadge(slip)}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            <span className="font-mono">{slip.slipMonth}</span>
                            <span>{slip.department || '—'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end">{renderActions(slip)}</div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* ── md and up: full table (scrolls horizontally if cramped) ── */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={allSelected}
                          // Indeterminate state when some-but-not-all are ticked.
                          ref={(el) => {
                            if (el) el.indeterminate = someSelected && !allSelected;
                          }}
                          onChange={toggleAll}
                          aria-label="Select all slips"
                        />
                      </TableHead>
                      <TableHead>Month</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slips.map((slip) => (
                      <TableRow key={slip.id} data-state={selectedIds.has(slip.id) ? 'selected' : undefined}>
                        <TableCell>
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={selectedIds.has(slip.id)}
                            onChange={() => toggleOne(slip.id)}
                            aria-label={`Select slip ${slip.slipMonth}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{slip.slipMonth}</TableCell>
                        <TableCell>
                          <div className="font-medium">{slip.employee?.name ?? `#${slip.employeeId}`}</div>
                          {slip.employee?.empCode && (
                            <div className="text-[10px] text-muted-foreground">{slip.employee.empCode}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{slip.department || '—'}</TableCell>
                        <TableCell>{statusBadge(slip)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end">{renderActions(slip)}</div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Bulk-create modal */}
      <BulkGenerateModal
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        defaultMonth={month}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['salary-slips-hub'] });
        }}
      />

      {/* Delete confirmation modal — replaces the native confirm() for
          both the per-row trash icon and the bulk Delete action. */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/15">
                <Trash2 className="h-4 w-4 text-rose-600" />
              </span>
              Delete salary slip{deleteTarget?.kind === 'bulk' && deleteTarget.count > 1 ? 's' : ''}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleteTarget?.kind === 'single' ? (
              <>
                Delete the slip for{' '}
                <span className="font-medium text-foreground">
                  {deleteTarget.slip.employee?.name ?? `#${deleteTarget.slip.employeeId}`}
                </span>{' '}
                ({deleteTarget.slip.slipMonth})? This can&apos;t be undone.
              </>
            ) : deleteTarget?.kind === 'bulk' ? (
              <>
                Delete <span className="font-medium text-foreground">{deleteTarget.count}</span>{' '}
                selected salary slip{deleteTarget.count > 1 ? 's' : ''}? This can&apos;t be undone.
              </>
            ) : null}
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={deleteMut.isPending || bulkBusy === 'delete'}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending || bulkBusy === 'delete'}
              onClick={async () => {
                if (!deleteTarget) return;
                if (deleteTarget.kind === 'single') {
                  deleteMut.mutate(deleteTarget.slip.id);
                  setDeleteTarget(null);
                } else {
                  await runBulk('delete');
                  setDeleteTarget(null);
                }
              }}
            >
              {(deleteMut.isPending || bulkBusy === 'delete') ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-4 w-4" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Bulk-generate modal ─────────────────────────────────────────────────────

function BulkGenerateModal(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultMonth: string;
  onCreated: () => void;
}) {
  const { open, onOpenChange, defaultMonth, onCreated } = props;
  const { user } = useAuth();
  // Admins read the admin directory; HR / Accounts are `_type === 'employee'`
  // and must use /employee/employees (the admin route 403s for them, which is
  // why the picker showed "No employees match").
  const isAdmin = user?._type === 'admin';
  const [slipMonth, setSlipMonth] = useState(defaultMonth || defaultMonthFallback());
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Cap at 100 (backend pagination max). If the roster grows beyond, the
  // server-side `search` narrows it.
  const empQ = useQuery({
    queryKey: ['hub-employees', isAdmin, search],
    enabled: open,
    queryFn: async () => {
      const r = isAdmin
        ? await employeesApi.getAll({ search, isActive: true, limit: 100 })
        : await employeesApi.employeeGetAll({ search, isActive: true, limit: 100 });
      const body: any = r.data?.data ?? r.data;
      const list = Array.isArray(body) ? body : (body?.data ?? []);
      return Array.isArray(list) ? list : [];
    },
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      const r = await salarySlipsApi.bulkCreate({
        slipMonth,
        employeeIds: Array.from(selectedIds),
      });
      return r.data?.data ?? r.data;
    },
    onSuccess: (data: any) => {
      const created = data?.created?.length ?? 0;
      const skipped = data?.skipped?.length ?? 0;
      const failed = data?.failed?.length ?? 0;
      const parts = [
        `${created} created`,
        skipped > 0 ? `${skipped} already existed` : null,
        failed > 0 ? `${failed} failed` : null,
      ].filter(Boolean);
      toast.success(parts.join(' · '));
      onCreated();
      onOpenChange(false);
      setSelectedIds(new Set());
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message ?? 'Bulk generate failed');
    },
  });

  const toggle = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = empQ.data ?? [];
  const allShownIds = filtered.map((e: any) => e.id);
  const allShownSelected =
    allShownIds.length > 0 && allShownIds.every((id) => selectedIds.has(id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk-generate salary slips</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Slip Month *">
            <Input
              type="month"
              value={slipMonth}
              onChange={(e) => setSlipMonth(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Each selected employee gets a draft seeded from their previous slip.
              Employees that already have a slip for this month are skipped.
            </p>
          </Field>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search employees by name or code…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (allShownSelected) {
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      allShownIds.forEach((id) => next.delete(id));
                      return next;
                    });
                  } else {
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      allShownIds.forEach((id) => next.add(id));
                      return next;
                    });
                  }
                }}
              >
                {allShownSelected ? 'Clear page' : 'Select page'}
              </Button>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-md border">
              {empQ.isLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No employees match.</div>
              ) : (
                <ul className="divide-y">
                  {filtered.map((emp: any) => (
                    <li
                      key={emp.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40 cursor-pointer"
                      onClick={() => toggle(emp.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(emp.id)}
                        onChange={() => toggle(emp.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{emp.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {emp.empCode ? `${emp.empCode} · ` : ''}{emp.email}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {selectedIds.size} selected
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitMut.isPending}>
            <X className="mr-1.5 h-4 w-4" /> Cancel
          </Button>
          <Button
            onClick={() => submitMut.mutate()}
            disabled={submitMut.isPending || selectedIds.size === 0 || !slipMonth}
          >
            {submitMut.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
            Generate {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Small helpers ───────────────────────────────────────────────────────────

function Field(props: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{props.label}</p>
      {props.children}
      {props.hint && <p className="text-[10px] text-muted-foreground mt-1">{props.hint}</p>}
    </div>
  );
}

function defaultMonth(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
}

function defaultMonthFallback(): string {
  return defaultMonth();
}
