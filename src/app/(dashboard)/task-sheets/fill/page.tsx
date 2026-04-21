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
  hoursSpent: '',
  taskDescription: '',
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

/**
 * Build sequential fromTime/toTime based on existing entries.
 * New entry starts after the last entry ends, or at 09:00 if no entries.
 */
function buildTimesFromHours(hours: number, entries: TaskEntry[]): { fromTime: string; toTime: string } {
  let startMinutes = 9 * 60; // default 09:00
  if (entries.length > 0) {
    const lastEnd = entries[entries.length - 1].toTime;
    const [h, m] = lastEnd.split(':').map(Number);
    startMinutes = h * 60 + m;
  }
  const endMinutes = startMinutes + Math.round(hours * 60);
  const fromTime = `${String(Math.floor(startMinutes / 60)).padStart(2, '0')}:${String(startMinutes % 60).padStart(2, '0')}`;
  const toTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
  return { fromTime, toTime };
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
      const hours = parseFloat(data.hoursSpent);
      const { fromTime, toTime } = buildTimesFromHours(hours, sheet?.taskEntries ?? []);
      const isOther = data.projectId === 'other';
      const ticketRef = resolveTicketRef(data.ticketId);
      return taskSheetsApi.addEntry(sheet!.id, {
        ...(isOther
          ? { otherProjectName: data.otherProjectName }
          : { projectId: Number(data.projectId) }),
        fromTime,
        toTime,
        taskDescription: data.taskDescription,
        status: data.status as TaskStatus,
        ...ticketRef,
      });
    },
    onSuccess: () => {
      toast.success('Task entry added');
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
      const hours = parseFloat(data.hoursSpent);
      // Keep the original fromTime, only adjust toTime.
      // MySQL returns time as "HH:MM:SS"; the backend DTO requires "HH:MM".
      const origFromRaw = editingEntry!.fromTime;
      const [fh, fm] = origFromRaw.split(':').map(Number);
      const origFrom = `${String(fh).padStart(2, '0')}:${String(fm).padStart(2, '0')}`;
      const endMinutes = fh * 60 + fm + Math.round(hours * 60);
      const toTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
      const isOther = data.projectId === 'other';
      const ticketRef = resolveTicketRef(data.ticketId);
      return taskSheetsApi.updateEntry(sheet!.id, entryId, {
        ...(isOther
          ? { otherProjectName: data.otherProjectName, projectId: undefined }
          : { projectId: Number(data.projectId), otherProjectName: undefined }),
        fromTime: origFrom,
        toTime,
        taskDescription: data.taskDescription,
        status: data.status as TaskStatus,
        ...ticketRef,
      });
    },
    onSuccess: () => {
      toast.success('Task entry updated');
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
  };

  const openAddForm = () => {
    setEditingEntry(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEditForm = (entry: TaskEntry) => {
    setEditingEntry(entry);
    // Restore Ticket/Activity field from whichever column was saved.
    const ticketRef = entry.ticketId
      ? String(entry.ticketId)
      : (entry.activityType ?? '');
    setForm({
      projectId: entry.projectId ? String(entry.projectId) : 'other',
      otherProjectName: entry.otherProjectName ?? '',
      ticketId: ticketRef,
      hoursSpent: String(Number(entry.durationHours).toFixed(2)),
      taskDescription: entry.taskDescription,
      status: entry.status,
    });
    setFormOpen(true);
  };

  const handleSave = () => {
    const isOther = form.projectId === 'other';
    if (!form.projectId || !form.hoursSpent || !form.taskDescription) {
      toast.error('Please fill all required fields');
      return;
    }
    if (isOther && !form.otherProjectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }
    const hours = parseFloat(form.hoursSpent);
    if (isNaN(hours) || hours <= 0 || hours > 24) {
      toast.error('Hours must be between 0 and 24');
      return;
    }
    if (form.taskDescription.length < 10) {
      toast.error('Description must be at least 10 characters');
      return;
    }
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

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15">
              <Clock className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Hours</p>
              <p className="text-lg font-bold text-foreground">{Number(sheet.totalHours).toFixed(1)}h</p>
            </div>
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
        <Button size="sm" onClick={openAddForm} className="bg-linear-to-r from-violet-500 to-purple-600 text-white hover:opacity-90 shadow-sm shadow-violet-500/25 border-0">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Entry
        </Button>
        {entries.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
            disabled={submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            <Send className="mr-1.5 h-4 w-4" />
            {submitMutation.isPending ? 'Saving...' : sheet.isSubmitted ? 'Update Sheet' : 'Submit Sheet'}
          </Button>
        )}
      </div>

      {/* Entries table */}
      <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
        <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-violet-500 via-purple-500 to-indigo-500" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Project Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-24">Time Taken</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
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
              entries.map((entry, i) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium text-sm">{entry.project?.projectName ?? entry.otherProjectName ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {projectTypeLabels[(entry.project as any)?.projectType] ?? (entry.project as any)?.projectType ?? '—'}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm">{entry.taskDescription}</TableCell>
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit Entry Dialog */}
      <Dialog open={formOpen} onOpenChange={(v) => { if (!v) closeForm(); }}>
        <DialogContent className="max-w-md overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-violet-500 via-purple-500 to-indigo-500" />
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
              <SearchableSelect
                value={form.projectId}
                onValueChange={(v) => setForm((p) => ({ ...p, projectId: v, otherProjectName: v === 'other' ? p.otherProjectName : '', ticketId: '' }))}
                placeholder="Search project..."
                options={[
                  ...(projects ?? []).map((p) => ({ value: String(p.id), label: p.projectName })),
                  { value: 'other', label: 'Other' },
                ]}
              />
              {form.projectId === 'other' && (
                <Input
                  placeholder="Enter project name"
                  value={form.otherProjectName}
                  onChange={(e) => setForm((p) => ({ ...p, otherProjectName: e.target.value }))}
                />
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
                onChange={(e) => setForm((p) => ({ ...p, taskDescription: e.target.value }))}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{form.taskDescription.length}/10 min characters</p>
            </div>

            {/* 5. Time Taken */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Time Taken (hours) <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                step="0.25"
                min="0.25"
                max="24"
                placeholder="e.g. 2.5"
                value={form.hoursSpent}
                onChange={(e) => setForm((p) => ({ ...p, hoursSpent: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Enter time in hours (e.g. 1, 1.5, 2.25)</p>
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
                className="bg-linear-to-r from-violet-500 to-purple-600 text-white hover:opacity-90 shadow-sm shadow-violet-500/25 border-0"
                disabled={isSaving}
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
