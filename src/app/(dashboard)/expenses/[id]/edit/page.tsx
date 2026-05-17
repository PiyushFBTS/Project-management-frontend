/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useRef, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  ArrowLeft, Loader2, Upload, X, Receipt, Calendar, IndianRupee,
  FileText, FolderKanban, Tag, AlignLeft, Download,
} from 'lucide-react';
import { expensesApi, adminExpensesApi } from '@/lib/api/expenses';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';

const EXPENSE_TYPES = [
  'Travel', 'Food', 'Accommodation', 'Transport', 'Office Supplies',
  'Software', 'Hardware', 'Training', 'Communication', 'Other',
];

/**
 * Edit screen for pending expenses. Mirrors `/expenses/new` but prefills
 * from the existing record and calls `update` instead of `create`. The
 * backend enforces:
 *   • the requester is the originator (employeeId or submitterAdminId)
 *   • the expense is still `pending`
 * so this page should only be reachable via the Edit button on the
 * detail page, which gates on the same two checks.
 */
export default function EditExpensePage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';
  const expenseId = Number(params.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:8000';

  const [dateMode, setDateMode] = useState<'single' | 'week' | 'month'>('single');
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formDateTo, setFormDateTo] = useState('');
  const [formMonth, setFormMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [formType, setFormType] = useState('Travel');
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formProjectId, setFormProjectId] = useState('');
  // New file picked by the user (replaces the existing attachment).
  // `null` means "keep the existing attachment as-is".
  const [formFile, setFormFile] = useState<File | null>(null);
  // User pressed "Delete attachment" — we'll send `removeAttachment=true`
  // on save so the backend unlinks the file and nulls the columns.
  const [removeExistingAttachment, setRemoveExistingAttachment] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Fetch the existing expense to prefill the form.
  const { data: expense, isLoading: loadingExpense } = useQuery({
    queryKey: ['expense-detail', expenseId],
    queryFn: async () => {
      const api = isAdmin ? adminExpensesApi : expensesApi;
      const r = await api.getOne(expenseId);
      return r.data?.data ?? r.data;
    },
    enabled: !!user && !!expenseId,
  });

  // Hydrate form from fetched expense. Detect the original date mode
  // from the from/to span — full-month spans are flagged as 'month'.
  useEffect(() => {
    if (!expense || hydrated) return;
    const e = expense as any;
    if (e.expenseDateTo) {
      const from = new Date(e.expenseDate + 'T00:00:00');
      const to = new Date(e.expenseDateTo + 'T00:00:00');
      const firstOfMonth = new Date(from.getFullYear(), from.getMonth(), 1);
      const lastOfMonth = new Date(from.getFullYear(), from.getMonth() + 1, 0);
      const isMonthSpan =
        from.getDate() === firstOfMonth.getDate() &&
        to.getFullYear() === lastOfMonth.getFullYear() &&
        to.getMonth() === lastOfMonth.getMonth() &&
        to.getDate() === lastOfMonth.getDate();
      if (isMonthSpan) {
        setDateMode('month');
        setFormMonth(format(from, 'yyyy-MM'));
      } else {
        setDateMode('week');
        setFormDate(e.expenseDate);
        setFormDateTo(e.expenseDateTo);
      }
    } else {
      setDateMode('single');
      setFormDate(e.expenseDate);
    }
    setFormType(EXPENSE_TYPES.includes(e.expenseType) ? e.expenseType : 'Other');
    setFormAmount(String(Number(e.amount ?? 0)));
    setFormDesc(e.description ?? '');
    setFormProjectId(e.projectId ? String(e.projectId) : '');
    setHydrated(true);
  }, [expense, hydrated]);

  // Bail out of the form if the expense isn't editable any more (status
  // moved to approved / rejected). The detail page is the safe landing.
  useEffect(() => {
    if (expense && expense.status && expense.status !== 'pending') {
      toast.error('This expense is no longer editable');
      router.replace(`/expenses/${expenseId}`);
    }
  }, [expense, expenseId, router]);

  const getDateRange = () => {
    if (dateMode === 'single') return { from: formDate, to: formDate };
    if (dateMode === 'week') return { from: formDate, to: formDateTo || formDate };
    const [y, m] = formMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return { from: `${formMonth}-01`, to: `${formMonth}-${String(lastDay).padStart(2, '0')}` };
  };

  const { data: projectsRaw } = useQuery({
    queryKey: ['projects-for-expenses', isAdmin],
    queryFn: async () => {
      const { api } = await import('@/lib/api/axios-instance');
      // Admin → `/projects/all-active` (mounted at `/projects`, not `/admin`)
      // Employee → `/employee/projects/all-active`
      const path = isAdmin ? '/projects/all-active' : '/employee/projects/all-active';
      const r = await api.get(path);
      const d = r.data;
      if (Array.isArray(d)) return d;
      if (Array.isArray(d?.data)) return d.data;
      if (Array.isArray(d?.data?.data)) return d.data.data;
      return [];
    },
    enabled: !!user,
  });
  const projects: any[] = Array.isArray(projectsRaw) ? projectsRaw : [];

  const projectOptions = [
    { value: 'none', label: 'None' },
    ...projects.map((p: any) => ({
      value: String(p.id),
      label: p.projectCode ? `${p.projectCode} · ${p.projectName}` : p.projectName,
    })),
  ];

  const updateMut = useMutation({
    mutationFn: async () => {
      const { from, to } = getDateRange();
      const fd = new FormData();
      fd.append('expenseDate', from);
      if (dateMode !== 'single') fd.append('expenseDateTo', to);
      fd.append('expenseType', formType);
      fd.append('amount', formAmount);
      // Always send description so an explicit clear takes effect.
      fd.append('description', formDesc);
      if (formProjectId) fd.append('projectId', formProjectId);
      if (formFile) {
        fd.append('file', formFile);
      } else if (removeExistingAttachment) {
        fd.append('removeAttachment', 'true');
      }
      return isAdmin ? adminExpensesApi.update(expenseId, fd) : expensesApi.update(expenseId, fd);
    },
    onSuccess: () => {
      // Drop the cached detail + list so the detail page re-fetches and
      // shows the updated attachment / fields. Without this, the user
      // sees the stale doc after Save → /expenses/[id] reload.
      qc.invalidateQueries({ queryKey: ['expense-detail', expenseId] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense updated');
      router.push(`/expenses/${expenseId}`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to update expense'),
  });

  const e = expense as any;
  // Hide the saved attachment once the user pressed "Delete attachment"
  // so the UI flips to the empty-state uploader and we save with
  // `removeAttachment=true`. The pending deletion is reversible until save.
  const existingAttachment = !removeExistingAttachment && e?.attachmentPath
    ? (() => {
        const name = (e.attachmentName ?? 'Attachment') as string;
        const url = `${apiBase}${e.attachmentPath}` as string;
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(e.attachmentPath as string);
        return { name, url, isImage };
      })()
    : null;

  if (loadingExpense || !hydrated) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <button onClick={() => router.push(`/expenses/${expenseId}`)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-1">
            <ArrowLeft className="h-4 w-4" /> Back to Expense
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-white" />
            </div>
            Edit Expense
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/expenses/${expenseId}`)}>Cancel</Button>
          <Button disabled={!formDate || !formAmount || !formType || updateMut.isPending} onClick={() => updateMut.mutate()}>
            {updateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Receipt className="h-4 w-4 mr-1" />}
            Update Expense
          </Button>
        </div>
      </div>

      {/* Form grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Primary fields */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5">Expense Information</h3>

              {/* Date mode selector */}
              <div className="mb-5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Calendar className="h-3.5 w-3.5 text-primary" /> Period <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-1 p-0.5 bg-muted rounded-lg w-fit">
                  {(['single', 'week', 'month'] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setDateMode(m)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${dateMode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                      {m === 'single' ? 'Single Day' : m === 'week' ? 'Date Range' : 'Full Month'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                {dateMode === 'single' && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-2 block">Date</label>
                    <Input type="date" value={formDate} onChange={(ev) => setFormDate(ev.target.value)} />
                  </div>
                )}
                {dateMode === 'week' && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-2 block">From Date</label>
                      <Input type="date" value={formDate} onChange={(ev) => setFormDate(ev.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-2 block">To Date</label>
                      <Input type="date" value={formDateTo} onChange={(ev) => setFormDateTo(ev.target.value)} min={formDate} />
                    </div>
                  </>
                )}
                {dateMode === 'month' && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-2 block">Month</label>
                    <Input type="month" value={formMonth} onChange={(ev) => setFormMonth(ev.target.value)} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                    <FolderKanban className="h-3.5 w-3.5 text-primary" /> Project
                  </label>
                  <SearchableSelect
                    value={formProjectId || 'none'}
                    onValueChange={(v) => setFormProjectId(v === 'none' ? '' : v)}
                    options={projectOptions}
                    placeholder="Search projects..."
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                    <Tag className="h-3.5 w-3.5 text-primary" /> Expense Type <span className="text-red-500">*</span>
                  </label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger className='w-full'><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXPENSE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                    <IndianRupee className="h-3.5 w-3.5 text-primary" /> Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <Input type="number" placeholder="0.00" value={formAmount} onChange={(ev) => setFormAmount(ev.target.value)} />
                </div>
              </div>

              <div className="mt-5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                  <AlignLeft className="h-3.5 w-3.5 text-primary" /> Description
                </label>
                <textarea
                  value={formDesc}
                  onChange={(ev) => setFormDesc(ev.target.value)}
                  placeholder="What was the expense for? Add details here..."
                  rows={4}
                  className="w-full rounded-md border px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none transition-colors"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Attachment & Preview */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5">
                <FileText className="h-3.5 w-3.5 inline mr-1 text-primary" /> Receipt / Proof
              </h3>

              {/* If a new file was picked, show its preview (image) or a
                  filename pill — clicking the dashed area lets the user
                  re-pick. */}
              {formFile ? (
                <div
                  className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all border-primary/50 bg-primary/5"
                  onClick={() => fileRef.current?.click()}
                >
                  <div className="space-y-2">
                    {formFile.type.startsWith('image/') ? (
                      <img src={URL.createObjectURL(formFile)} alt="Preview" className="max-h-40 mx-auto rounded-lg" />
                    ) : (
                      <FileText className="h-12 w-12 mx-auto text-primary" />
                    )}
                    <p className="text-sm font-medium truncate">{formFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(formFile.size / 1024).toFixed(1)} KB · New file (will replace)</p>
                    <Button size="sm" variant="outline" className="text-red-500" onClick={(ev) => { ev.stopPropagation(); setFormFile(null); }}>
                      <X className="h-3 w-3 mr-1" /> Cancel replacement
                    </Button>
                  </div>
                </div>
              ) : existingAttachment ? (
                // Show the saved attachment with role-appropriate preview:
                //   • image → inline preview + click-to-zoom
                //   • pdf / doc / xls / etc → file card with Download button
                // A separate "Replace" button opens the file picker so the
                // image preview itself can be clicked to enlarge without
                // accidentally triggering a re-upload.
                <div className="space-y-3">
                  {existingAttachment.isImage ? (
                    <a href={existingAttachment.url} target="_blank" rel="noreferrer" className="block">
                      <img
                        src={existingAttachment.url}
                        alt={existingAttachment.name}
                        className="max-h-56 mx-auto rounded-lg border shadow-sm hover:shadow-md transition-shadow"
                      />
                    </a>
                  ) : (
                    <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{existingAttachment.name}</p>
                        <p className="text-xs text-muted-foreground">Current attachment</p>
                      </div>
                      <a
                        href={existingAttachment.url}
                        target="_blank"
                        rel="noreferrer"
                        download={existingAttachment.name}
                        className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-1.5" /> Replace
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => setRemoveExistingAttachment(true)}
                    >
                      <X className="h-4 w-4 mr-1.5" /> Delete
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all hover:border-primary/40 hover:bg-muted/30"
                    onClick={() => fileRef.current?.click()}
                  >
                    <div className="h-14 w-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
                      <Upload className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium">Upload receipt</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, DOC, XLS, JPG, PNG</p>
                    <p className="text-xs text-muted-foreground">Max 10MB</p>
                  </div>
                  {removeExistingAttachment && (
                    <div className="mt-3 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      <span>Existing attachment will be removed on save.</span>
                      <button
                        type="button"
                        className="font-semibold underline"
                        onClick={() => setRemoveExistingAttachment(false)}
                      >
                        Undo
                      </button>
                    </div>
                  )}
                </>
              )}
              <input ref={fileRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx" onChange={(ev) => setFormFile(ev.target.files?.[0] ?? null)} />
            </CardContent>
          </Card>

          {/* Amount preview */}
          {formAmount && (
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-br from-primary/10 via-purple-500/10 to-indigo-500/10 p-5 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Expense Amount</p>
                <p className="text-3xl font-bold text-primary">₹{Number(formAmount || 0).toLocaleString('en-IN')}</p>
                {formType && <p className="text-xs text-muted-foreground mt-1">{formType} · {formDate ? format(new Date(formDate + 'T00:00:00'), 'dd MMM yyyy') : ''}</p>}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
