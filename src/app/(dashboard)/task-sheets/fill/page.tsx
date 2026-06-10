/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, subDays } from 'date-fns';
import {
  ArrowLeft, Plus, Trash2, Send, Clock, CalendarDays, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { taskSheetsApi } from '@/lib/api/task-sheets';
import { api } from '@/lib/api/axios-instance';
import { TaskEntry, TaskStatus } from '@/types';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { AxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const statusOptions: { value: string; label: string }[] = [
  { value: 'in_progress', label: 'In Progress' },
  { value: 'finished', label: 'Completed' },
  { value: 'awaiting_response', label: 'Awaiting Response from Client' },
  { value: 'failed', label: 'Failed' },
];

const projectTypeLabels: Record<string, string> = {
  fresh_implement: 'Fresh Implement', migration: 'Migration', change_request: 'Change Request',
  support: 'Support', development: 'Development', consulting: 'Consulting', maintenance: 'Maintenance',
  project: 'Project',
};

const emptyForm = {
  projectId: '',
  otherProjectName: '',
  ticketId: '', // 'meeting' or ticket ID
  fromTime: '',
  toTime: '',
  taskDescription: '',
  blockers: '',
  status: 'in_progress' as string,
};

const ACTIVITY_VALUES = new Set(['internal_meeting', 'client_meeting', 'others']);

/**
 * Split the UI `ticketId` value into backend fields: either a numeric
 * `ticketId` (real project ticket) or a `activityType` string. When empty,
 * both are cleared on update.
 */
function resolveTicketRef(value: string): { ticketId?: number | null; activityType?: string | null } {
  if (!value) return { ticketId: null, activityType: null };
  if (ACTIVITY_VALUES.has(value)) return { ticketId: null, activityType: value };
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return { ticketId: n, activityType: null };
  return { ticketId: null, activityType: null };
}

/// Parse "HH:MM" or "HH:MM:SS" → minutes-since-midnight. Returns null on bad input.
function parseTimeToMinutes(s: string): number | null {
  if (!s) return null;
  const parts = s.split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/// Normalize a "HH:MM:SS" string from MySQL or the date picker to "HH:MM".
function normalizeTime(s: string): string {
  if (!s) return '';
  const [h = '00', m = '00'] = s.split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

/// Split a "HH:MM" 24-hour string into 12-hour parts.
function to12Parts(v: string): { h: string; m: string; ampm: 'AM' | 'PM' } {
  if (!v) return { h: '', m: '', ampm: 'AM' };
  const [hStr, mStr] = v.split(':');
  const h24 = Number(hStr);
  if (!Number.isFinite(h24)) return { h: '', m: mStr ?? '', ampm: 'AM' };
  const ampm: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return { h: String(h12), m: mStr ?? '', ampm };
}

/// Convert typed 12-hour parts to a "HH:MM" 24-hour string, or '' if the
/// input is incomplete / out of range.
function to24(nh: string, nm: string, nAmpm: 'AM' | 'PM'): string {
  const hh = parseInt(nh, 10);
  const mm = parseInt(nm, 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 1 || hh > 12 || mm < 0 || mm > 59) return '';
  let h24 = hh % 12;
  if (nAmpm === 'PM') h24 += 12;
  return `${String(h24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/// 12-hour time picker: typed hour (1-12), typed minute (00-59), AM/PM
/// select. Emits "HH:MM" 24-hour upward so the rest of the form
/// (diffHours, parseTimeToMinutes, the API contract) stays unchanged.
/// Emits an empty string while the input is incomplete or invalid so the
/// existing required-validation kicks in naturally.
function Time12Picker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { h: initH, m: initM, ampm: initAmpm } = to12Parts(value);
  const [h, setH] = useState(initH);
  const [m, setM] = useState(initM);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(initAmpm);

  // Re-sync when the parent value changes (edit-mode prefill, suggestFromTime).
  // Guard: skip when the parent value already matches what the current inputs
  // emit — otherwise typing a minute re-pads "3" → "03" and you can never
  // reach "30" (the hour is unpadded so it wasn't affected).
  useEffect(() => {
    if (to24(h, m, ampm) === value) return;
    const parts = to12Parts(value);
    setH(parts.h);
    setM(parts.m);
    setAmpm(parts.ampm);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (nh: string, nm: string, nAmpm: 'AM' | 'PM') => {
    onChange(to24(nh, nm, nAmpm));
  };

  const wrap = (n: number, min: number, max: number) => {
    const span = max - min + 1;
    return ((((n - min) % span) + span) % span) + min;
  };

  const bumpHour = (delta: 1 | -1) => {
    const current = parseInt(h, 10);
    const next = Number.isFinite(current) ? wrap(current + delta, 1, 12) : (delta === 1 ? 1 : 12);
    const nh = String(next);
    setH(nh);
    emit(nh, m || '00', ampm);
  };

  const bumpMinute = (delta: 1 | -1) => {
    const current = parseInt(m, 10);
    const next = Number.isFinite(current) ? wrap(current + delta, 0, 59) : (delta === 1 ? 0 : 59);
    const nm = String(next).padStart(2, '0');
    setM(nm);
    emit(h || '12', nm, ampm);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="text"
        inputMode="numeric"
        maxLength={2}
        placeholder="HH"
        value={h}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 2);
          setH(v);
          emit(v, m, ampm);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') { e.preventDefault(); bumpHour(1); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); bumpHour(-1); }
        }}
        className="w-12 text-center"
      />
      <span className="text-muted-foreground">:</span>
      <Input
        type="text"
        inputMode="numeric"
        maxLength={2}
        placeholder="MM"
        value={m}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 2);
          setM(v);
          emit(h, v, ampm);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') { e.preventDefault(); bumpMinute(1); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); bumpMinute(-1); }
        }}
        className="w-12 text-center"
      />
      <Select value={ampm} onValueChange={(v) => { const nv = v as 'AM' | 'PM'; setAmpm(nv); emit(h, m, nv); }}>
        <SelectTrigger className="w-18"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

/// Compute hours between two HH:MM strings, rounded to 2 dp. Returns 0 if invalid.
function diffHours(from: string, to: string): number {
  const a = parseTimeToMinutes(from);
  const b = parseTimeToMinutes(to);
  if (a == null || b == null || b <= a) return 0;
  return Math.round(((b - a) / 60) * 100) / 100;
}

/// "11:00" or "11:00:00" → "11:00 AM". Empty / invalid input → "—".
function formatTime12(t: string): string {
  if (!t) return '—';
  const { h, m, ampm } = to12Parts(t);
  if (!h) return '—';
  return `${h}:${m.padStart(2, '0')} ${ampm}`;
}

/// Minutes → "1h 30m" / "45m" / "2h". Used to label the gap rows
/// inserted between consecutive entries so the user can see at a
/// glance which time slots aren't covered.
function formatGapDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/// Suggest a default fromTime for a new entry — picks the last entry's
/// toTime, or 09:00 if the sheet is empty. The user can override.
function suggestFromTime(entries: TaskEntry[]): string {
  if (entries.length === 0) return '09:00';
  return normalizeTime(entries[entries.length - 1].toTime);
}

export default function FillTaskSheetPageWrapper() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-muted-foreground">Loading...</div>}>
      <FillTaskSheetPage />
    </Suspense>
  );
}

function FillTaskSheetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEmployee = user?._type === 'employee';
  const isAdmin = user?._type === 'admin';
  // Both regular employees/HR and admins can fill their own sheet.
  const canFill = isEmployee || isAdmin;

  const dateParam = searchParams.get('date'); // e.g. "2026-03-17"
  const today = new Date().toISOString().split('T')[0];
  const sheetDate = dateParam || today;
  const isToday = sheetDate === today;

  // Get employee's fill days override (default 3)
  // Admin + HR get a 30-day fill window by default; regular employees get 3 days.
  // A per-employee `fillDaysOverride` takes precedence when set.
  const isHr = isEmployee && !!(user as any)?.isHr;
  const defaultFillDays = isAdmin || isHr ? 30 : 3;
  const fillDays = (user as any)?.fillDaysOverride ?? defaultFillDays;

  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TaskEntry | null>(null);
  const [form, setForm] = useState(emptyForm);
  // Snapshot of the form values at the moment we opened the Edit
  // dialog — used to gate the "Update Entry" button until the user
  // actually changes something. Null while adding a new entry (the
  // Add Entry button isn't gated on this).
  const [editInitialForm, setEditInitialForm] =
    useState<typeof emptyForm | null>(null);
  // Per-field validation flags (highlight + inline message). Cleared as
  // each field is fixed, and reset whenever the dialog opens.
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const clearError = (key: string) =>
    setErrors((e) => (e[key] ? { ...e, [key]: false } : e));

  // Tracks whether the user has made any entry-level change since the
  // last submit on a sheet that's already submitted. The "Update Sheet"
  // button is gated on this so a PM can't be spammed with a no-op
  // re-submission (which would otherwise re-create the same approval
  // rows and re-notify). Reset on submit and on date switch.
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Switching to a different day (or to a different user context)
  // discards any dirty flag from the previous sheet.
  useEffect(() => {
    setHasUnsavedChanges(false);
  }, [sheetDate, user?._type]);

  // Sheet for the selected date (auto-created by backend)
  const { data: sheet, isLoading: sheetLoading, refetch, error: sheetError } = useQuery({
    queryKey: ['task-sheet-by-date', sheetDate, user?._type],
    queryFn: () =>
      (isToday
        ? taskSheetsApi.getToday()
        : taskSheetsApi.getByDate(sheetDate)
      ).then((r) => r.data.data),
    enabled: canFill,
    retry: false,
  });

  // Dropdown data
  const { data: projects } = useQuery({
    queryKey: ['employee-projects'],
    queryFn: () => taskSheetsApi.getProjects().then((r) => r.data.data),
  });

  // Tickets for selected project (for ticket selector in form).
  // Admin hits /admin/all-tickets; employee/HR hits /employee/project-tickets.
  const { data: projectTickets } = useQuery({
    queryKey: ['project-tickets-for-sheet', form.projectId, isAdmin],
    queryFn: async () => {
      if (!form.projectId || form.projectId === 'other') return [];
      const endpoint = isAdmin ? '/admin/all-tickets' : '/employee/project-tickets';
      const r = await api.get(endpoint, { params: { projectId: form.projectId, limit: 200 } });
      const body = r.data;
      const list = Array.isArray(body?.data) ? body.data : Array.isArray(body?.data?.data) ? body.data.data : [];
      return list as Array<{ id: number; ticketNumber: string; title: string }>;
    },
    enabled: !!form.projectId && form.projectId !== 'other',
  });

  // Add entry
  const addMutation = useMutation({
    mutationFn: (data: typeof emptyForm) => {
      const isOther = data.projectId === 'other';
      const ticketRef = resolveTicketRef(data.ticketId);
      return taskSheetsApi.addEntry(sheet!.id, {
        ...(isOther
          ? { otherProjectName: data.otherProjectName }
          : { projectId: Number(data.projectId) }),
        fromTime: normalizeTime(data.fromTime),
        toTime: normalizeTime(data.toTime),
        taskDescription: data.taskDescription,
        // Empty string → omit so the backend stays at null.
        ...(data.blockers.trim() ? { blockers: data.blockers.trim() } : {}),
        status: data.status as TaskStatus,
        ...ticketRef,
      });
    },
    onSuccess: () => {
      toast.success('Task entry added');
      setHasUnsavedChanges(true);
      closeForm();
      refetch();
    },
    onError: (err: AxiosError<{ message?: string }>) => {
      toast.error(err?.response?.data?.message ?? 'Failed to add entry');
    },
  });

  // Update entry
  const updateMutation = useMutation({
    mutationFn: ({ entryId, data }: { entryId: number; data: typeof emptyForm }) => {
      const isOther = data.projectId === 'other';
      const ticketRef = resolveTicketRef(data.ticketId);
      return taskSheetsApi.updateEntry(sheet!.id, entryId, {
        ...(isOther
          ? { otherProjectName: data.otherProjectName, projectId: undefined }
          : { projectId: Number(data.projectId), otherProjectName: undefined }),
        fromTime: normalizeTime(data.fromTime),
        toTime: normalizeTime(data.toTime),
        taskDescription: data.taskDescription,
        // Send empty string → backend coerces to null; blanking clears
        // the value from a previously saved entry.
        blockers: data.blockers.trim() || null,
        status: data.status as TaskStatus,
        ...ticketRef,
      });
    },
    onSuccess: () => {
      toast.success('Task entry updated');
      setHasUnsavedChanges(true);
      closeForm();
      refetch();
    },
    onError: (err: AxiosError<{ message?: string }>) => {
      toast.error(err?.response?.data?.message ?? 'Failed to update entry');
    },
  });

  // Delete entry
  const deleteMutation = useMutation({
    mutationFn: (entryId: number) =>
      taskSheetsApi.deleteEntry(sheet!.id, entryId),
    onSuccess: () => {
      toast.success('Task entry removed');
      setHasUnsavedChanges(true);
      refetch();
    },
    onError: (err: AxiosError<{ message?: string }>) => {
      toast.error(err?.response?.data?.message ?? 'Failed to remove entry');
    },
  });

  // Submit sheet
  const submitMutation = useMutation({
    mutationFn: () => taskSheetsApi.submit(sheet!.id),
    onSuccess: () => {
      toast.success('Task sheet submitted successfully!');
      // Re-submission is now committed; the next "Update Sheet" stays
      // disabled until the user makes another entry change.
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ['my-task-sheets'] });
      refetch();
    },
    onError: (err: AxiosError<{ message?: string }>) => {
      toast.error(err?.response?.data?.message ?? 'Failed to submit task sheet');
    },
  });

  // Redirect non-employees (after all hooks)
  useEffect(() => {
    if (!canFill) router.replace('/task-sheets');
  }, [canFill, router]);

  const closeForm = () => {
    setFormOpen(false);
    setEditingEntry(null);
    setForm(emptyForm);
    setEditInitialForm(null);
  };

  const openAddForm = () => {
    setEditingEntry(null);
    setEditInitialForm(null);
    setErrors({});
    // Pre-fill fromTime with the suggested next slot so the user only
    // has to pick an end time (or override the start).
    setForm({
      ...emptyForm,
      fromTime: suggestFromTime(sheet?.taskEntries ?? []),
    });
    setFormOpen(true);
  };

  const openEditForm = (entry: TaskEntry) => {
    setEditingEntry(entry);
    setErrors({});
    // Restore Ticket/Activity field from whichever column was saved.
    const ticketRef = entry.ticketId
      ? String(entry.ticketId)
      : (entry.activityType ?? '');
    const seeded = {
      projectId: entry.projectId ? String(entry.projectId) : 'other',
      otherProjectName: entry.otherProjectName ?? '',
      ticketId: ticketRef,
      fromTime: normalizeTime(entry.fromTime),
      toTime: normalizeTime(entry.toTime),
      taskDescription: entry.taskDescription,
      blockers: entry.blockers ?? '',
      status: entry.status,
    };
    setForm(seeded);
    // Snapshot the seeded values — every field is a primitive string
    // so a shallow key compare against `form` is enough to tell if the
    // user has actually edited anything.
    setEditInitialForm(seeded);
    setFormOpen(true);
  };

  // True when the user has changed at least one field since the Edit
  // dialog opened. Null `editInitialForm` (Add mode or dialog closed)
  // resolves to false — the Add Entry button isn't gated on this.
  const editHasChanges = (() => {
    if (!editInitialForm) return false;
    for (const k of Object.keys(editInitialForm) as Array<
      keyof typeof emptyForm
    >) {
      if (form[k] !== editInitialForm[k]) return true;
    }
    return false;
  })();

  const computedHours = diffHours(form.fromTime, form.toTime);

  const handleSave = () => {
    const isOther = form.projectId === 'other';

    // Collect every missing required field so we can name + highlight each.
    const e: Record<string, boolean> = {};
    const missing: string[] = [];
    if (!form.projectId) { e.project = true; missing.push('Project'); }
    if (isOther && !form.otherProjectName.trim()) { e.otherProjectName = true; missing.push('Project name'); }
    if (!form.taskDescription.trim()) { e.description = true; missing.push('Description'); }
    if (!form.fromTime) { e.fromTime = true; missing.push('Start Time'); }
    if (!form.toTime) { e.toTime = true; missing.push('End Time'); }

    if (missing.length > 0) {
      setErrors(e);
      toast.error(missing.length === 1 ? `${missing[0]} is required` : `Required: ${missing.join(', ')}`);
      return;
    }

    const fromM = parseTimeToMinutes(form.fromTime);
    const toM = parseTimeToMinutes(form.toTime);
    if (fromM == null || toM == null) {
      setErrors({ fromTime: fromM == null, toTime: toM == null });
      toast.error('Invalid time format');
      return;
    }
    if (toM <= fromM) {
      setErrors({ fromTime: true, toTime: true });
      toast.error('End time must be after start time');
      return;
    }
    if (computedHours <= 0 || computedHours > 24) {
      setErrors({ fromTime: true, toTime: true });
      toast.error('Duration must be between 0 and 24 hours');
      return;
    }
    if (form.taskDescription.trim().length < 10) {
      setErrors({ description: true });
      toast.error('Description must be at least 10 characters');
      return;
    }
    setErrors({});
    if (editingEntry) {
      updateMutation.mutate({ entryId: editingEntry.id, data: form });
    } else {
      addMutation.mutate(form);
    }
  };

  const entries = sheet?.taskEntries ?? [];
  const isSaving = addMutation.isPending || updateMutation.isPending;

  if (!canFill) return null;

  if (sheetLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!sheet) {
    const err = sheetError as { response?: { data?: { message?: string } }; message?: string } | undefined;
    const msg = err?.response?.data?.message || err?.message;
    return (
      <div className="space-y-3 p-6 text-center">
        <p className="text-sm font-semibold text-foreground">Could not load today&apos;s task sheet.</p>
        {msg && <p className="text-xs text-red-500">{msg}</p>}
        <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  const dateOptions = Array.from({ length: fillDays }, (_, i) => i).map((daysAgo) => {
    const d = subDays(new Date(), daysAgo);
    const dateStr = format(d, 'yyyy-MM-dd');
    return {
      date: dateStr,
      label: daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : format(d, 'EEE, dd MMM'),
      dayLabel: format(d, 'dd'),
      monthLabel: format(d, 'MMM'),
      isSelected: sheetDate === dateStr,
    };
  });

  return (
    <div className="space-y-4">
      {/* Date selector */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/task-sheets')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">Task Sheet</h1>
          <p className="text-xs text-muted-foreground">{format(new Date(sheet.sheetDate + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <Badge variant={sheet.isSubmitted ? 'default' : 'outline'} className="ml-auto">
          {sheet.isSubmitted ? 'Submitted' : 'Draft'}
        </Badge>
      </div>

      {/* Day pills */}
      <div className="flex gap-2">
        {dateOptions.map((opt) => (
          <button
            key={opt.date}
            onClick={() => router.replace(`/task-sheets/fill?date=${opt.date}`)}
            className={`flex-1 flex flex-col items-center gap-0.5 rounded-xl border-2 py-2 transition-all ${
              opt.isSelected
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            <span className="text-lg font-bold">{opt.dayLabel}</span>
            <span className="text-[10px] uppercase">{opt.monthLabel}</span>
            <span className="text-[10px] font-medium">{opt.label}</span>
          </button>
        ))}
      </div>

      {/* Summary cards (Sprint 3) — Total Hours is the primary stat
          while filling, so it spans wider on tablet+ and carries a
          progress bar against an 8-hour target so the user can see at
          a glance how close they are without doing mental arithmetic. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="md:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15">
                <Clock className="h-5 w-5 text-violet-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Total Hours</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {Number(sheet.totalHours).toFixed(2)}<span className="text-sm font-medium text-muted-foreground">h</span>
                  </p>
                  <p className="text-xs text-muted-foreground">/ 8.00h target</p>
                </div>
              </div>
            </div>
            {(() => {
              // 8-hour day reference. Clamp the bar to 100% so a heroic
              // 11-hour day doesn't blow past the card edge; we add a
              // small "over" indicator beside it instead.
              const target = 8;
              const total = Number(sheet.totalHours) || 0;
              const pct = Math.max(0, Math.min(100, (total / target) * 100));
              const over = total > target;
              const tone = total >= target
                ? 'bg-emerald-500'
                : total >= target * 0.75
                  ? 'bg-violet-500'
                  : 'bg-amber-500';
              return (
                <div className="mt-3 space-y-1">
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${tone} transition-all duration-300`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{Math.round((total / target) * 100)}% of target</span>
                    {over
                      ? <span className="text-emerald-600 font-semibold">+{(total - target).toFixed(2)}h over</span>
                      : <span>{(target - total).toFixed(2)}h to go</span>}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/15">
              <CalendarDays className="h-5 w-5 text-indigo-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Man-Days</p>
              <p className="text-lg font-bold text-foreground">{Number(sheet.manDays).toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15">
              <Plus className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entries</p>
              <p className="text-lg font-bold text-foreground">{entries.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 justify-end">
        <Button size="sm" onClick={openAddForm} className="bg-linear-to-r from-blue-600 to-blue-800 text-white hover:opacity-90 shadow-sm shadow-blue-500/25 border-0">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Entry
        </Button>
        {entries.length > 0 && (() => {
          // "Update Sheet" (re-submit of an already-submitted sheet)
          // stays disabled until the user makes at least one entry
          // change — otherwise repeated clicks would re-fan the same
          // approval rows to the PM with no work to review. First-time
          // "Submit Sheet" is always enabled.
          const isReSubmit = sheet.isSubmitted;
          const reSubmitGated = isReSubmit && !hasUnsavedChanges;
          return (
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
              disabled={submitMutation.isPending || reSubmitGated}
              title={
                reSubmitGated
                  ? 'No changes to update — edit an entry first'
                  : undefined
              }
              onClick={() => submitMutation.mutate()}
            >
              <Send className="mr-1.5 h-4 w-4" />
              {submitMutation.isPending
                ? 'Saving...'
                : isReSubmit
                  ? 'Update Sheet'
                  : 'Submit Sheet'}
            </Button>
          );
        })()}
      </div>

      {/* Entries table */}
      <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
        <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-blue-500 to-blue-700" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead className="w-40">Time</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Project Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Blockers</TableHead>
              <TableHead className="w-24">Time Taken</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Clock className="h-8 w-8 text-muted-foreground/40" />
                    <p>No task entries yet</p>
                    <Button size="sm" variant="outline" onClick={openAddForm} className="mt-1">
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Add your first entry
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              // Sort chronologically so gaps line up visually. Entries
              // without a valid fromTime go last (they can't be placed
              // on the timeline).
              [...entries]
                .sort((a, b) => {
                  const am = parseTimeToMinutes(normalizeTime((a as any).fromTime ?? '')) ?? 1e9;
                  const bm = parseTimeToMinutes(normalizeTime((b as any).fromTime ?? '')) ?? 1e9;
                  return am - bm;
                })
                .flatMap((entry, i, arr) => {
                // "Not submitted" badge — only meaningful on an already-
                // submitted sheet, where it flags rows the user has
                // added or edited since the last submit (i.e. work
                // that won't reach the PM until they click Update
                // Sheet). On a draft sheet every row is obviously
                // unsubmitted; the sheet-level Draft chip covers that.
                const submittedAtMs = sheet.submittedAt
                  ? new Date(sheet.submittedAt).getTime()
                  : 0;
                const updatedAtMs = entry.updatedAt
                  ? new Date(entry.updatedAt).getTime()
                  : 0;
                const needsResubmit =
                  sheet.isSubmitted &&
                  submittedAtMs > 0 &&
                  updatedAtMs > submittedAtMs;

                // Gap detection. Sprint 3 polish — show "Gap · 12:00
                // PM – 1:00 PM (1h)" as its own amber row whenever the
                // previous entry's toTime doesn't meet this entry's
                // fromTime. Saves the user from cross-checking edit
                // dialogs to find unfilled slots.
                const prev = arr[i - 1];
                const prevEndMins = prev
                  ? parseTimeToMinutes(normalizeTime((prev as any).toTime ?? ''))
                  : null;
                const thisStartMins = parseTimeToMinutes(
                  normalizeTime((entry as any).fromTime ?? ''),
                );
                const gapMins =
                  prevEndMins != null && thisStartMins != null && thisStartMins > prevEndMins
                    ? thisStartMins - prevEndMins
                    : 0;
                const gapFrom = gapMins > 0 ? normalizeTime((prev as any).toTime) : '';
                const gapTo = gapMins > 0 ? normalizeTime((entry as any).fromTime) : '';

                const rangeLabel = (() => {
                  const f = normalizeTime((entry as any).fromTime ?? '');
                  const t = normalizeTime((entry as any).toTime ?? '');
                  if (!f || !t) return '—';
                  return `${formatTime12(f)} – ${formatTime12(t)}`;
                })();

                return [
                  gapMins > 0 ? (
                    <TableRow key={`gap-${entry.id}`} className="bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/60">
                      <TableCell />
                      <TableCell colSpan={8} className="py-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                          <span className="font-semibold text-amber-700 dark:text-amber-400">Gap</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="tabular-nums text-amber-700 dark:text-amber-400">
                            {formatTime12(gapFrom)} – {formatTime12(gapTo)}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span className="font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                            {formatGapDuration(gapMins)}
                          </span>
                          <span className="text-muted-foreground italic ml-1">no entry covers this slot</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null,
                <TableRow key={entry.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="text-xs text-foreground/80 tabular-nums whitespace-nowrap">
                    {rangeLabel}
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{entry.project?.projectName ?? entry.otherProjectName ?? '—'}</span>
                      {needsResubmit && (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-400"
                          title="Added or edited since the last submit — not yet sent to the PM"
                        >
                          Not submitted
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {projectTypeLabels[(entry.project as any)?.projectType] ?? (entry.project as any)?.projectType ?? '—'}
                  </TableCell>
                  <TableCell className="max-w-xs text-sm">
                    <div className="truncate" title={entry.taskDescription}>{entry.taskDescription}</div>
                  </TableCell>
                  <TableCell className="max-w-xs text-sm">
                    {entry.blockers ? (
                      <div
                        className="truncate text-amber-700 dark:text-amber-400"
                        title={entry.blockers}
                      >
                        🚧 {entry.blockers}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold">{Number(entry.durationHours).toFixed(2)}h</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">
                      {entry.status?.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => openEditForm(entry)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(entry.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      </div>
                    </TableCell>
                </TableRow>,
                ];
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit Entry Dialog */}
      <Dialog open={formOpen} onOpenChange={(v) => { if (!v) closeForm(); }}>
        <DialogContent className="max-w-md overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-blue-500 to-blue-700" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-violet-500" />
              {editingEntry ? 'Edit Task Entry' : 'Add Task Entry'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* 1. Project (required - searchable) */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Project <span className="text-destructive">*</span></Label>
              <div className={errors.project ? 'rounded-md ring-1 ring-red-500' : ''}>
                <SearchableSelect
                  value={form.projectId}
                  onValueChange={(v) => { setForm((p) => ({ ...p, projectId: v, otherProjectName: v === 'other' ? p.otherProjectName : '', ticketId: '' })); clearError('project'); }}
                  placeholder="Search project..."
                  options={[
                    ...(projects ?? []).map((p) => ({ value: String(p.id), label: p.projectName })),
                    { value: 'other', label: 'Other' },
                  ]}
                />
              </div>
              {errors.project && <p className="text-xs text-red-500">Project is required</p>}
              {form.projectId === 'other' && (
                <>
                  <Input
                    placeholder="Enter project name"
                    value={form.otherProjectName}
                    onChange={(e) => { setForm((p) => ({ ...p, otherProjectName: e.target.value })); clearError('otherProjectName'); }}
                    className={errors.otherProjectName ? 'border-red-500 ring-1 ring-red-500' : ''}
                  />
                  {errors.otherProjectName && <p className="text-xs text-red-500">Project name is required</p>}
                </>
              )}
            </div>

            {/* 2. Project Type (auto from selected project) */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Project Type</Label>
              <Input
                readOnly
                value={(() => {
                  if (!form.projectId || form.projectId === 'other') return '—';
                  const pt = (projects ?? []).find((p: any) => String(p.id) === form.projectId)?.projectType as string | undefined;
                  return pt ? ((projectTypeLabels as Record<string, string>)[pt] ?? pt) : '—';
                })()}
                className="bg-muted/50"
              />
            </div>

            {/* 3. Ticket (searchable select with Meeting on top) */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Ticket / Activity</Label>
              <SearchableSelect
                value={form.ticketId}
                onValueChange={(v) => setForm((p) => ({ ...p, ticketId: v }))}
                placeholder="Search ticket or select activity..."
                options={(() => {
                  const baseOptions = [
                    { value: 'internal_meeting', label: 'Internal Meeting' },
                    { value: 'client_meeting', label: 'Client Meeting' },
                    { value: 'others', label: 'Others' },
                    ...((projectTickets ?? []) as any[]).map((t: any) => ({
                      value: String(t.id),
                      label: `${t.ticketNumber ?? ''} — ${t.title}`,
                    })),
                  ];
                  // When editing, if the saved ticket isn't yet in the fetched list
                  // (different project, or still loading) surface a placeholder entry
                  // so the select displays a label instead of appearing empty.
                  if (
                    form.ticketId &&
                    !baseOptions.some((o) => o.value === form.ticketId) &&
                    !ACTIVITY_VALUES.has(form.ticketId)
                  ) {
                    const fallbackLabel = `Ticket #${form.ticketId}`;
                    baseOptions.push({ value: form.ticketId, label: fallbackLabel });
                  }
                  return baseOptions;
                })()}
              />
            </div>

            {/* 4. Description */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Description <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="What did you work on? (min 10 characters)"
                value={form.taskDescription}
                onChange={(e) => { setForm((p) => ({ ...p, taskDescription: e.target.value })); clearError('description'); }}
                rows={3}
                className={errors.description ? 'border-red-500 ring-1 ring-red-500' : ''}
              />
              <p className={`text-xs ${errors.description ? 'text-red-500' : 'text-muted-foreground'}`}>
                {errors.description && form.taskDescription.trim().length < 10
                  ? `Description must be at least 10 characters (${form.taskDescription.length}/10)`
                  : `${form.taskDescription.length}/10 min characters`}
              </p>
            </div>

            {/* 4b. Blockers (optional) */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Blockers <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                placeholder="What slowed or blocked progress? (optional)"
                value={form.blockers}
                onChange={(e) => setForm((p) => ({ ...p, blockers: e.target.value }))}
                rows={2}
              />
            </div>

            {/* 5. Start / End Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Start Time <span className="text-destructive">*</span></Label>
                <div className={errors.fromTime ? 'rounded-md ring-1 ring-red-500 p-1 -m-1' : ''}>
                  <Time12Picker
                    value={form.fromTime}
                    onChange={(v) => { setForm((p) => ({ ...p, fromTime: v })); clearError('fromTime'); }}
                  />
                </div>
                {errors.fromTime && <p className="text-xs text-red-500">Required</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">End Time <span className="text-destructive">*</span></Label>
                <div className={errors.toTime ? 'rounded-md ring-1 ring-red-500 p-1 -m-1' : ''}>
                  <Time12Picker
                    value={form.toTime}
                    onChange={(v) => { setForm((p) => ({ ...p, toTime: v })); clearError('toTime'); }}
                  />
                </div>
                {errors.toTime && <p className="text-xs text-red-500">Required</p>}
              </div>
            </div>
            {/* Live duration preview — calculated as the user types
                the start/end times. Format as "Xh Ym" so 1.5h reads as
                "1h 30m" without arithmetic. Colour-coded:
                  invalid (0 or > 24h) → red
                  short (< 1h)          → amber
                  normal                → emerald                       */}
            <div className="-mt-1">
              {(() => {
                const valid = computedHours > 0 && computedHours <= 24;
                const h = Math.floor(computedHours);
                const m = Math.round((computedHours - h) * 60);
                const text = !valid
                  ? '—'
                  : h === 0
                    ? `${m} min`
                    : m === 0
                      ? `${h} h`
                      : `${h} h ${m} min`;
                const tone = !valid
                  ? 'bg-red-500/10 text-red-700 dark:text-red-300 ring-red-500/30'
                  : computedHours < 1
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30';
                return (
                  <div className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 ring-1 ${tone}`}>
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Duration</span>
                    <span className="font-bold text-sm tabular-nums">{text}</span>
                  </div>
                );
              })()}
              <span className="text-[10px] text-muted-foreground ml-2">end − start, auto-calculated</span>
            </div>

            {/* 6. Status */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={closeForm}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-linear-to-r from-blue-600 to-blue-800 text-white hover:opacity-90 shadow-sm shadow-blue-500/25 border-0"
                // Same idea as the "Update Sheet" gate: in Edit mode
                // the button stays disabled until the user actually
                // changes a field. Add mode is never gated this way.
                disabled={isSaving || (!!editingEntry && !editHasChanges)}
                title={
                  editingEntry && !editHasChanges
                    ? 'No changes to update'
                    : undefined
                }
                onClick={handleSave}
              >
                {isSaving ? 'Saving...' : editingEntry ? 'Update Entry' : 'Add Entry'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
