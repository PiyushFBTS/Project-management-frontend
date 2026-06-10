/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, FolderKanban, Loader2, CheckCircle2, User, Calendar, Clock, FileText, Check, X, Paperclip, Upload, File, Trash2, Milestone, Plus, Layers, Repeat, IndianRupee } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { projectsApi } from '@/lib/api/projects';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { CreateProjectDto, RecurringPeriod } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { capitalizeFirst } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const statusOptions = ['active', 'inactive', 'completed'];
// Type options loaded from API (see useQuery below)

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30',
  inactive: 'bg-slate-500/15 text-slate-500 ring-1 ring-slate-500/30',
  completed: 'bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/30',
};

export default function NewProjectPageWrapper() {
  return <Suspense fallback={null}><NewProjectPage /></Suspense>;
}

function NewProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const [createStatus, setCreateStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [docFiles, setDocFiles] = useState<{ file: File; category: string }[]>([]);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [docCategory, setDocCategory] = useState('other');

  // Milestones
  const [milestones, setMilestones] = useState<Array<{ name: string; expectedPercentage: string; expectedAmount: string }>>([]);
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [msName, setMsName] = useState('');
  const [msExpectedPct, setMsExpectedPct] = useState('');
  const [msExpectedAmt, setMsExpectedAmt] = useState('');

  const typeFromUrl = searchParams.get('type') ?? '';

  const groupFromUrl = searchParams.get('groupId') ?? 'none';

  const [form, setForm] = useState({
    projectCode: '',
    projectName: '',
    projectType: typeFromUrl,
    clientName: '',
    status: 'active',
    startDate: '',
    endDate: '',
    description: '',
    projectManagerId: 'none',
    groupId: groupFromUrl,
    // Sprint 2 — Total project cost (₹) for non-recurring projects.
    // Required at submit-time when the chosen type isn't recurring;
    // milestones below derive their amounts from this number.
    projectBudget: '',
  });

  // Per-field validation: which required fields are currently flagged
  // (highlighted red + inline "Required"). Cleared as the user fixes each.
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const clearError = (key: string) =>
    setErrors((e) => (e[key] ? { ...e, [key]: false } : e));

  // Inline "create group" dialog state
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCode, setNewGroupCode] = useState('');
  const [newGroupClient, setNewGroupClient] = useState('');

  const { data: managers } = useQuery({
    queryKey: ['project-managers'],
    queryFn: () => projectsApi.getManagers().then((r) => r.data.data),
  });

  const { data: projectTypesRaw } = useQuery({
    queryKey: ['project-types'],
    queryFn: () => projectsApi.getProjectTypes().then((r: any) => r.data?.data ?? r.data ?? []),
  });
  const typeOptions: { value: string; label: string }[] = ((projectTypesRaw ?? []) as any[]).map((t: any) => ({
    value: t.value ?? t.slug ?? t.name?.toLowerCase().replace(/\s+/g, '_') ?? '',
    label: t.label ?? t.name ?? '',
  }));
  // Selected project type's `isRecurring` flag — switches the form's
  // lower section between Milestones (default) and Recurring billing rows.
  const selectedTypeIsRecurring = ((projectTypesRaw ?? []) as any[])
    .some((t: any) => (t.value ?? t.slug ?? '') === form.projectType && t.isRecurring === true);

  // Recurring billing setup (only used when the selected type is recurring).
  const _today = new Date();
  const defaultStartMonth = `${_today.getFullYear()}-${String(_today.getMonth() + 1).padStart(2, '0')}-01`;
  const [recurringForm, setRecurringForm] = useState<{
    period: RecurringPeriod;
    startMonth: string;
    months: string;
    expectedAmount: string;
  }>({
    period: 'monthly',
    startMonth: defaultStartMonth,
    months: '12',
    expectedAmount: '',
  });

  // Period-specific copy + start-month snapping. Keep these helpers
  // co-located with the form so the labels stay in sync with the
  // backend's cadence enum.
  const PERIOD_OPTIONS: { value: RecurringPeriod; label: string }[] = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'half_yearly', label: 'Half-Yearly' },
    { value: 'yearly', label: 'Yearly' },
  ];
  const PERIOD_NOUN: Record<RecurringPeriod, string> = {
    monthly: 'month',
    quarterly: 'quarter',
    half_yearly: 'half-year',
    yearly: 'year',
  };
  // Snap a YYYY-MM-01 start to the nearest valid boundary for the
  // chosen cadence so the user can't submit a 400 (quarterly →
  // Jan/Apr/Jul/Oct, half-yearly → Jan/Jul, yearly → Jan).
  const snapStartMonth = (start: string, period: RecurringPeriod): string => {
    if (!start) return start;
    const [yStr, mStr] = start.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return start;
    let snapped = m;
    if (period === 'quarterly') snapped = [1, 4, 7, 10][Math.floor((m - 1) / 3)];
    else if (period === 'half_yearly') snapped = m <= 6 ? 1 : 7;
    else if (period === 'yearly') snapped = 1;
    const mm = String(snapped).padStart(2, '0');
    return `${y}-${mm}-01`;
  };

  const { data: groupsRaw } = useQuery({
    queryKey: ['project-groups'],
    queryFn: () => projectsApi.getGroups().then((r: any) => r.data?.data ?? r.data ?? []),
  });
  const groups: any[] = (groupsRaw ?? []) as any[];

  const createGroupMutation = useMutation({
    mutationFn: (dto: { name: string; code?: string; clientName?: string }) => projectsApi.createGroup(dto),
    onSuccess: async (res: any) => {
      const g = res.data?.data ?? res.data;
      await qc.invalidateQueries({ queryKey: ['project-groups'] });
      if (g?.id) setForm((p) => ({ ...p, groupId: String(g.id) }));
      setGroupDialogOpen(false);
      setNewGroupName(''); setNewGroupCode(''); setNewGroupClient('');
      toast.success('Group created');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create group'),
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateProjectDto) => projectsApi.create(dto),
    onMutate: () => setCreateStatus('loading'),
    onSuccess: async (res) => {
      const newId = res.data.data.id;
      // Upload documents if any
      if (docFiles.length > 0) {
        for (const { file, category } of docFiles) {
          try { await projectsApi.uploadDocument(newId, file, category); } catch { /* ignore individual errors */ }
        }
      }
      // Bulk-create either recurring rows (for recurring types) or milestones.
      if (selectedTypeIsRecurring) {
        try {
          await projectsApi.bulkCreateRecurrings(newId, {
            period: recurringForm.period,
            startMonth: recurringForm.startMonth,
            months: Number(recurringForm.months) || 12,
            expectedAmount: Number(recurringForm.expectedAmount),
          });
        } catch { /* ignore — user can fix from project detail */ }
      } else if (milestones.length > 0) {
        try {
          await projectsApi.bulkCreateMilestones(
            newId,
            milestones.map((m) => ({ name: m.name, expectedPercentage: Number(m.expectedPercentage), expectedAmount: Number(m.expectedAmount) })),
          );
        } catch { /* ignore */ }
      }
      qc.invalidateQueries({ queryKey: ['projects'] });
      setCreateStatus('success');
      setTimeout(() => router.push(`/projects/${newId}`), 1500);
    },
    onError: (e: any) => {
      setCreateStatus('idle');
      toast.error(e?.response?.data?.message ?? 'Failed to create project');
    },
  });

  // Bidirectional helpers for the milestone % ↔ ₹ binding. Both depend
  // on `form.projectBudget` so the caller can compute against the live
  // value (no need to pass it through every call site).
  const budgetNum = Number(form.projectBudget) || 0;
  const pctToAmount = (pctStr: string): string => {
    const p = Number(pctStr);
    if (!Number.isFinite(p) || budgetNum <= 0) return '';
    return ((budgetNum * p) / 100).toFixed(2);
  };
  const amountToPct = (amtStr: string): string => {
    const a = Number(amtStr);
    if (!Number.isFinite(a) || budgetNum <= 0) return '';
    return ((a / budgetNum) * 100).toFixed(2);
  };

  // Add-form linked editors. Typing into either field recomputes the
  // other so the user sees both immediately.
  const onMsPctChange = (v: string) => {
    setMsExpectedPct(v);
    if (v && budgetNum > 0) setMsExpectedAmt(pctToAmount(v));
  };
  const onMsAmtChange = (v: string) => {
    setMsExpectedAmt(v);
    if (v && budgetNum > 0) setMsExpectedPct(amountToPct(v));
  };

  const addMilestone = () => {
    if (!msName.trim() || !msExpectedPct.trim() || !msExpectedAmt.trim() || Number(msExpectedAmt) <= 0) {
      toast.error('Enter milestone name, expected percentage and amount');
      return;
    }
    setMilestones((prev) => [...prev, { name: msName.trim(), expectedPercentage: msExpectedPct.trim(), expectedAmount: msExpectedAmt.trim() }]);
    setMsName('');
    setMsExpectedPct('');
    setMsExpectedAmt('');
  };

  // Edit-in-place for an existing milestone in the list. Same
  // bidirectional rule — typing into either field recomputes the other.
  const updateMilestonePct = (idx: number, v: string) => {
    setMilestones((prev) => prev.map((m, i) =>
      i === idx
        ? {
            ...m,
            expectedPercentage: v,
            expectedAmount: v && budgetNum > 0 ? pctToAmount(v) : m.expectedAmount,
          }
        : m,
    ));
  };
  const updateMilestoneAmt = (idx: number, v: string) => {
    setMilestones((prev) => prev.map((m, i) =>
      i === idx
        ? {
            ...m,
            expectedAmount: v,
            expectedPercentage: v && budgetNum > 0 ? amountToPct(v) : m.expectedPercentage,
          }
        : m,
    ));
  };

  const removeMilestone = (idx: number) => {
    setMilestones((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    // Collect each missing required field so we can name it + highlight it.
    const missing: { key: string; label: string }[] = [];
    if (!form.projectCode.trim()) missing.push({ key: 'projectCode', label: 'Project Code' });
    if (!form.projectName.trim()) missing.push({ key: 'projectName', label: 'Project Name' });
    if (!form.projectType) missing.push({ key: 'projectType', label: 'Type' });
    if (!form.startDate) missing.push({ key: 'startDate', label: 'Start Date' });

    // Recurring-type projects require Start Month + Monthly Amount instead
    // of milestones. Non-recurring still require at least one milestone.
    if (selectedTypeIsRecurring) {
      if (!recurringForm.startMonth) missing.push({ key: 'recurringStartMonth', label: 'Start Month' });
      const amt = Number(recurringForm.expectedAmount);
      if (!recurringForm.expectedAmount || !Number.isFinite(amt) || amt <= 0) {
        missing.push({ key: 'recurringAmount', label: `${PERIOD_NOUN[recurringForm.period].replace(/^./, c => c.toUpperCase())} Amount` });
      }
    } else {
      // Project Cost is required for non-recurring projects — milestones
      // can't size themselves without it.
      const budget = Number(form.projectBudget);
      if (!form.projectBudget || !Number.isFinite(budget) || budget <= 0) {
        missing.push({ key: 'projectBudget', label: 'Project Cost' });
      }
    }

    if (missing.length > 0) {
      setErrors(Object.fromEntries(missing.map((m) => [m.key, true])));
      const names = missing.map((m) => m.label).join(', ');
      toast.error(missing.length === 1 ? `${names} is required` : `Required: ${names}`);
      return;
    }
    setErrors({});
    if (!selectedTypeIsRecurring && milestones.length === 0) {
      toast.error('Please add at least one milestone');
      return;
    }
    const pmId = form.projectManagerId && form.projectManagerId !== 'none' ? Number(form.projectManagerId) : null;
    const groupId = form.groupId && form.groupId !== 'none' ? Number(form.groupId) : null;
    const dto: any = { ...form, projectManagerId: pmId, groupId };
    // Stamp the cadence on the project itself so the detail page can
    // render it even before the first bulk-create call lands.
    if (selectedTypeIsRecurring) dto.recurringPeriod = recurringForm.period;
    // Coerce projectBudget to number for non-recurring; recurring types
    // skip it (the existing column stays NULL so reports can tell them
    // apart from milestone-style projects).
    if (selectedTypeIsRecurring) {
      dto.projectBudget = null;
    } else {
      dto.projectBudget = Number(form.projectBudget);
    }
    createMutation.mutate(dto);
  };

  useEffect(() => {
    if (createStatus === 'success') {
      const t = setTimeout(() => router.push('/projects'), 3000);
      return () => clearTimeout(t);
    }
  }, [createStatus, router]);

  if (createStatus !== 'idle') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        {createStatus === 'loading' ? (
          <>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-500/10 mb-4">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
            </div>
            <p className="text-lg font-semibold">Creating Project…</p>
            <p className="text-sm text-muted-foreground mt-1">Please wait while your project is being set up.</p>
          </>
        ) : (
          <>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 mb-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">Project Created!</p>
            <p className="text-sm text-muted-foreground mt-1">Redirecting to project detail…</p>
          </>
        )}
      </div>
    );
  }

  return (
    // Full-bleed form, edge-to-edge on every breakpoint.
    <div className="w-full space-y-4 sm:space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────
          < lg : back + title only (Milestones / Cancel / Create move to
                  a bottom action bar so the top stays uncluttered)
          ≥ lg : back + title + Milestones + Cancel + Create inline.    */}
      <div className="flex items-start gap-2 lg:items-center lg:gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0 -ml-2 lg:ml-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-xl font-bold truncate">New Project</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Fill in the details to create a new project</p>
        </div>
        <div className="hidden lg:flex gap-2 shrink-0">
          {selectedTypeIsRecurring ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30 px-2.5 py-1 text-xs font-semibold">
              <Repeat className="h-3 w-3" /> Recurring
            </span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMilestoneDialogOpen(true)}
              className="relative"
            >
              <Milestone className="mr-1 h-3.5 w-3.5" />
              Milestones
              {milestones.length > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white px-1">
                  {milestones.length}
                </span>
              )}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <X className="mr-1 h-3.5 w-3.5" /> Cancel
          </Button>
          <Button
            size="sm"
            disabled={createMutation.isPending}
            onClick={handleSave}
            className="bg-linear-to-r from-emerald-500 to-teal-600 text-white hover:opacity-90 border-0"
          >
            {createMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
            Create
          </Button>
        </div>
      </div>

      {/* Info Cards — 1/2/3 cols across breakpoints. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-pink-600 dark:text-pink-400 mb-1.5">
            <FolderKanban className="h-3 w-3" /> Project Code <span className="text-red-500">*</span>
          </div>
          <Input
            value={form.projectCode}
            onChange={(e) => { setForm((p) => ({ ...p, projectCode: e.target.value })); clearError('projectCode'); }}
            placeholder="Enter Project Code"
            className={`h-8 text-sm font-mono ${errors.projectCode ? 'border-red-500 ring-1 ring-red-500' : ''}`}
          />
          {errors.projectCode && <p className="text-[10px] text-red-500 mt-1">Project Code is required</p>}
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-cyan-600 dark:text-cyan-400 mb-1.5">
            <FileText className="h-3 w-3" /> Project Name <span className="text-red-500">*</span>
          </div>
          <Input
            value={form.projectName}
            onChange={(e) => { setForm((p) => ({ ...p, projectName: capitalizeFirst(e.target.value) })); clearError('projectName'); }}
            placeholder="Enter Project Name"
            className={`h-8 text-sm ${errors.projectName ? 'border-red-500 ring-1 ring-red-500' : ''}`}
          />
          {errors.projectName && <p className="text-[10px] text-red-500 mt-1">Project Name is required</p>}
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-orange-600 dark:text-orange-400 mb-1.5">
            <Clock className="h-3 w-3" /> Status
          </div>
          {/* Searchable so the field is consistent with Manager / Group /
              Type below; ignore the clear (`''`) — Status is required
              and defaults to 'active'. */}
          <SearchableSelect
            value={form.status}
            onValueChange={(v) => { if (v) setForm((p) => ({ ...p, status: v })); }}
            placeholder="Search status..."
            options={statusOptions.map((s) => ({
              value: s,
              label: s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' '),
            }))}
            className="text-sm"
          />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-violet-600 dark:text-violet-400 mb-1.5">
            <FolderKanban className="h-3 w-3" /> Type <span className="text-red-500">*</span>
          </div>
          {/* Red ring wrapper on error — SearchableSelect's inner button
              owns its own border class so we tint it from the outside. */}
          <div className={errors.projectType ? 'rounded-md ring-1 ring-red-500' : ''}>
            <SearchableSelect
              value={form.projectType}
              onValueChange={(v) => { setForm((p) => ({ ...p, projectType: v })); clearError('projectType'); }}
              placeholder="Search type..."
              options={typeOptions}
              className="text-sm"
            />
          </div>
          {errors.projectType && <p className="text-[10px] text-red-500 mt-1">Type is required</p>}
        </div>

        {/* Project Cost (₹) — Sprint 2. Required for non-recurring
            project types (Fresh Implement, Migration, Change Request,
            Consulting, etc.); milestones below derive their ₹ amounts
            from this number. Recurring types skip it entirely. */}
        {!!form.projectType && !selectedTypeIsRecurring && (
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-fuchsia-600 dark:text-fuchsia-400 mb-1.5">
              <IndianRupee className="h-3 w-3" /> Project Cost <span className="text-red-500">*</span>
            </div>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.projectBudget}
              onChange={(e) => { setForm((p) => ({ ...p, projectBudget: e.target.value })); clearError('projectBudget'); }}
              placeholder="e.g. 500000"
              className={`h-8 text-sm tabular-nums ${errors.projectBudget ? 'border-red-500 ring-1 ring-red-500' : ''}`}
            />
            {errors.projectBudget && (
              <p className="text-[10px] text-red-500 mt-1">Project Cost is required for non-recurring projects</p>
            )}
          </div>
        )}

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400 mb-1.5">
            <User className="h-3 w-3" /> Client
          </div>
          <Input
            value={form.clientName}
            onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))}
            placeholder="Enter Client Name"
            className="h-8 text-sm"
          />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5">
            <User className="h-3 w-3" /> Project Manager
          </div>
          <SearchableSelect
            value={form.projectManagerId}
            onValueChange={(v) => setForm((p) => ({ ...p, projectManagerId: v }))}
            placeholder="Search manager..."
            options={[
              { value: 'none', label: 'None' },
              ...(managers ?? []).map((m: any) => ({ value: String(m.id), label: m.name })),
            ]}
            className="h-8 text-sm"
          />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-teal-600 dark:text-teal-400">
              <Layers className="h-3 w-3" /> Project Group
            </div>
            <button
              type="button"
              onClick={() => setGroupDialogOpen(true)}
              className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 hover:underline inline-flex items-center gap-0.5"
            >
              <Plus className="h-3 w-3" /> New
            </button>
          </div>
          <SearchableSelect
            value={form.groupId}
            onValueChange={(v) => setForm((p) => ({ ...p, groupId: v }))}
            placeholder="Search group..."
            options={[
              { value: 'none', label: 'No group (standalone)' },
              ...groups.map((g: any) => ({ value: String(g.id), label: g.name })),
            ]}
            className="h-8 text-sm"
          />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400 mb-1.5">
            <Calendar className="h-3 w-3" /> Start Date <span className="text-red-500">*</span>
          </div>
          <Input
            type="date"
            value={form.startDate}
            onChange={(e) => { setForm((p) => ({ ...p, startDate: e.target.value })); clearError('startDate'); }}
            className={`h-8 text-sm ${errors.startDate ? 'border-red-500 ring-1 ring-red-500' : ''}`}
          />
          {errors.startDate && <p className="text-[10px] text-red-500 mt-1">Start Date is required</p>}
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-rose-600 dark:text-rose-400 mb-1.5">
            <Calendar className="h-3 w-3" /> End Date
          </div>
          <Input
            type="date"
            value={form.endDate}
            onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
            className="h-8 text-sm"
          />
        </div>

      </div>

      {/* Recurring Setup (only for recurring project types) */}
      {selectedTypeIsRecurring && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-500/5 p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400 mb-3">
            <Repeat className="h-3 w-3" /> Recurring Setup
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Cadence selector. Changing it snaps the Start Month to the
                nearest valid period boundary so the user can't submit an
                invalid combination (e.g. quarterly + May start). */}
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">
                Period <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={recurringForm.period}
                onValueChange={(v) => {
                  if (!v) return;
                  const next = v as RecurringPeriod;
                  setRecurringForm((p) => ({
                    ...p,
                    period: next,
                    startMonth: snapStartMonth(p.startMonth, next),
                  }));
                }}
                placeholder="Period…"
                options={PERIOD_OPTIONS}
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Bill every {PERIOD_NOUN[recurringForm.period]}.</p>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">
                Start {recurringForm.period === 'yearly' ? 'Year' : recurringForm.period === 'monthly' ? 'Month' : 'Period'} <span className="text-red-500">*</span>
              </label>
              <Input
                type="month"
                value={recurringForm.startMonth ? recurringForm.startMonth.slice(0, 7) : ''}
                onChange={(e) => {
                  const v = e.target.value;
                  const snapped = v ? snapStartMonth(`${v}-01`, recurringForm.period) : '';
                  setRecurringForm((p) => ({ ...p, startMonth: snapped }));
                  clearError('recurringStartMonth');
                }}
                className={`h-8 text-sm ${errors.recurringStartMonth ? 'border-red-500 ring-1 ring-red-500' : ''}`}
              />
              {errors.recurringStartMonth && (
                <p className="text-[10px] text-red-500 mt-1">Start is required</p>
              )}
              {recurringForm.period !== 'monthly' && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {recurringForm.period === 'quarterly' && 'Snaps to Jan / Apr / Jul / Oct.'}
                  {recurringForm.period === 'half_yearly' && 'Snaps to Jan or Jul.'}
                  {recurringForm.period === 'yearly' && 'Snaps to January.'}
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">
                Number of Periods
              </label>
              <Input
                type="number"
                min={1}
                max={60}
                value={recurringForm.months}
                onChange={(e) => setRecurringForm((p) => ({ ...p, months: e.target.value }))}
                placeholder="12"
                className="h-8 text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {`How many ${PERIOD_NOUN[recurringForm.period]}s to pre-create (1–60).`}
              </p>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">
                Amount per {PERIOD_NOUN[recurringForm.period].replace(/^./, c => c.toUpperCase())} <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={recurringForm.expectedAmount}
                onChange={(e) => {
                  setRecurringForm((p) => ({ ...p, expectedAmount: e.target.value }));
                  clearError('recurringAmount');
                }}
                placeholder="0.00"
                className={`h-8 text-sm ${errors.recurringAmount ? 'border-red-500 ring-1 ring-red-500' : ''}`}
              />
              {errors.recurringAmount && (
                <p className="text-[10px] text-red-500 mt-1">Amount is required</p>
              )}
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            One billable row per {PERIOD_NOUN[recurringForm.period]} will be created.
            You can mark each one as received from the project detail page.
          </p>
        </div>
      )}

      {/* Description */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
          <FileText className="h-3 w-3" /> Description
        </div>
        <RichTextEditor
          value={form.description}
          onChange={(html) => setForm((p) => ({ ...p, description: html }))}
          placeholder="Brief project description..."
          minHeight="150px"
        />
      </div>

      {/* Documents */}
      <div className="rounded-xl border bg-card p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            <File className="h-3 w-3" /> Documents
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Select value={docCategory} onValueChange={setDocCategory}>
              <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="project_plan">Project Plan</SelectItem>
                <SelectItem value="frd">FRD</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <input
              ref={docInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setDocFiles((prev) => [...prev, { file: f, category: docCategory }]);
                e.target.value = '';
              }}
            />
            <Button size="sm" variant="outline" onClick={() => docInputRef.current?.click()}>
              <Upload className="mr-1.5 h-3.5 w-3.5" /> Add File
            </Button>
          </div>
        </div>

        {docFiles.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No documents added yet. Add files to upload with the project.</p>
        ) : (
          <div className="space-y-2">
            {docFiles.map((d, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                  <Paperclip className="h-4 w-4 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.file.name}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="capitalize rounded bg-violet-500/10 px-1.5 py-0.5 text-violet-600 dark:text-violet-400">{d.category.replace('_', ' ')}</span>
                    <span>{(d.file.size / 1024).toFixed(0)} KB</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-500 hover:text-red-600 shrink-0"
                  onClick={() => setDocFiles((prev) => prev.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom action bar (mobile / tablet only) ─────────────────
          Row 1: Milestones (or Recurring badge) — full width.
          Row 2: Cancel + Create — split 50 / 50.                       */}
      <div className="space-y-2 pt-1 lg:hidden">
        {selectedTypeIsRecurring ? (
          <span className="flex w-full items-center justify-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30 px-2.5 py-2 text-xs font-semibold">
            <Repeat className="h-3.5 w-3.5" /> Recurring
          </span>
        ) : (
          <Button
            variant="outline"
            onClick={() => setMilestoneDialogOpen(true)}
            className="relative w-full h-10"
          >
            <Milestone className="mr-1 h-3.5 w-3.5" />
            Milestones
            {milestones.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white px-1">
                {milestones.length}
              </span>
            )}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => router.back()} className="w-full h-10">
            <X className="mr-1 h-3.5 w-3.5" /> Cancel
          </Button>
          <Button
            disabled={createMutation.isPending}
            onClick={handleSave}
            className="w-full h-10 bg-linear-to-r from-emerald-500 to-teal-600 text-white hover:opacity-90 border-0"
          >
            {createMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
            Create
          </Button>
        </div>
      </div>

      {/* ── New Group Dialog ──────────────────────────────────────────── */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-teal-600" /> New Project Group
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            A primary name (e.g. &quot;BTW&quot;) that groups several typed projects under it.
          </p>
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">Name *</label>
              <Input value={newGroupName} onChange={(e) => setNewGroupName(capitalizeFirst(e.target.value))} placeholder="e.g. BTW" className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">Code</label>
                <Input value={newGroupCode} onChange={(e) => setNewGroupCode(e.target.value)} placeholder="optional" className="h-9 font-mono" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">Client</label>
                <Input value={newGroupClient} onChange={(e) => setNewGroupClient(e.target.value)} placeholder="optional" className="h-9" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!newGroupName.trim() || createGroupMutation.isPending}
              onClick={() => createGroupMutation.mutate({
                name: newGroupName.trim(),
                code: newGroupCode.trim() || undefined,
                clientName: newGroupClient.trim() || undefined,
              })}
            >
              {createGroupMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Milestone Dialog ──────────────────────────────────────────── */}
      <Dialog open={milestoneDialogOpen} onOpenChange={setMilestoneDialogOpen}>
        <DialogContent className="sm:max-w-[100vw] md:max-w-[80vw] lg:max-w-[60vw] w-full h-[100vh] md:h-[85vh] max-h-[100vh] md:max-h-[95vh] rounded-none md:rounded-lg flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Milestone className="h-5 w-5 text-violet-600" />
              Project Milestones
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Add at least one milestone. Typing % auto-fills ₹ from the Project Cost, and vice versa.
          </p>
          {budgetNum <= 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 -mt-1">
              Set a Project Cost above to enable the % ↔ ₹ auto-calculation.
            </p>
          )}

          {/* Add new milestone form — bidirectional % ↔ ₹. */}
          <div className="grid grid-cols-[1fr_90px_140px_auto] gap-2 items-end">
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">Name *</label>
              <Input value={msName} onChange={(e) => setMsName(e.target.value)} placeholder="Enter Milestone Name" className="h-9" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">Exp % *</label>
              <Input type="number" min="0" max="100" step="0.01" value={msExpectedPct} onChange={(e) => onMsPctChange(e.target.value)} placeholder="e.g. 20" className="h-9" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">Exp ₹ *</label>
              <Input type="number" min="0" step="0.01" value={msExpectedAmt} onChange={(e) => onMsAmtChange(e.target.value)} placeholder="e.g. 100000" className="h-9 tabular-nums" />
            </div>
            <Button size="sm" className="h-9" onClick={addMilestone}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Milestone list — % and ₹ are both editable. Linked just like
              the add form, so an admin can rebalance after the fact. */}
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            {milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No milestones added yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left">
                    <th className="py-1.5 text-xs text-muted-foreground">Name</th>
                    <th className="py-1.5 text-xs text-muted-foreground text-right w-24">Exp %</th>
                    <th className="py-1.5 text-xs text-muted-foreground text-right w-36">Exp ₹</th>
                    <th className="py-1.5 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {milestones.map((m, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-2 font-medium">{m.name}</td>
                      <td className="py-2 text-right">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={m.expectedPercentage}
                          onChange={(e) => updateMilestonePct(idx, e.target.value)}
                          className="h-7 text-sm text-right tabular-nums"
                        />
                      </td>
                      <td className="py-2 text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={m.expectedAmount}
                          onChange={(e) => updateMilestoneAmt(idx, e.target.value)}
                          className="h-7 text-sm text-right tabular-nums"
                        />
                      </td>
                      <td className="py-2 text-center">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 hover:text-red-600" onClick={() => removeMilestone(idx)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Running totals + sum-mismatch warning. Save still works
              even when the sum doesn't match — the admin may rebalance
              in stages — but the colour signal flags drift. */}
          {milestones.length > 0 && (() => {
            const sumPct = milestones.reduce((s, m) => s + (Number(m.expectedPercentage) || 0), 0);
            const sumAmt = milestones.reduce((s, m) => s + (Number(m.expectedAmount) || 0), 0);
            const delta = budgetNum > 0 ? sumAmt - budgetNum : 0;
            const tone = budgetNum <= 0
              ? 'text-muted-foreground'
              : Math.abs(delta) < 0.005
                ? 'text-emerald-600 dark:text-emerald-400'
                : delta > 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-amber-600 dark:text-amber-400';
            return (
              <div className="border-t pt-2 shrink-0">
                <div className="flex flex-wrap justify-between items-center gap-2 text-sm font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {sumPct.toFixed(2)}% · ₹{sumAmt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    {budgetNum > 0 && (
                      <> <span className="text-muted-foreground font-normal">of</span> ₹{budgetNum.toLocaleString('en-IN')}</>
                    )}
                  </span>
                </div>
                {budgetNum > 0 && (
                  <p className={`text-[11px] font-medium mt-1 ${tone}`}>
                    {Math.abs(delta) < 0.005
                      ? '✓ Milestones match the project cost exactly.'
                      : delta > 0
                        ? `Over budget by ₹${delta.toLocaleString('en-IN', { maximumFractionDigits: 2 })} — review allocations.`
                        : `₹${Math.abs(delta).toLocaleString('en-IN', { maximumFractionDigits: 2 })} unallocated — sum is below the project cost.`}
                  </p>
                )}
              </div>
            );
          })()}
          <div className="flex justify-end pt-2 border-t shrink-0">
            <Button onClick={() => setMilestoneDialogOpen(false)}>
              Done ({milestones.length} milestone{milestones.length !== 1 ? 's' : ''})
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
