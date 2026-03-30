/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ArrowLeft, Loader2, Upload, X, Receipt, Calendar, IndianRupee, FileText, FolderKanban, Tag, AlignLeft } from 'lucide-react';
import { expensesApi, adminExpensesApi } from '@/lib/api/expenses';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EXPENSE_TYPES = [
  'Travel', 'Food', 'Accommodation', 'Transport', 'Office Supplies',
  'Software', 'Hardware', 'Training', 'Communication', 'Other',
];

export default function NewExpensePage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';
  const fileRef = useRef<HTMLInputElement>(null);

  const [dateMode, setDateMode] = useState<'single' | 'week' | 'month'>('single');
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formDateTo, setFormDateTo] = useState('');
  const [formMonth, setFormMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [formType, setFormType] = useState('Travel');
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formProjectId, setFormProjectId] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);

  // Compute effective date(s) based on mode
  const getDateRange = () => {
    if (dateMode === 'single') return { from: formDate, to: formDate };
    if (dateMode === 'week') return { from: formDate, to: formDateTo || formDate };
    // month: first and last day
    const [y, m] = formMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return { from: `${formMonth}-01`, to: `${formMonth}-${String(lastDay).padStart(2, '0')}` };
  };

  const { data: projectsRaw } = useQuery({
    queryKey: ['projects-for-expenses'],
    queryFn: async () => {
      const { api } = await import('@/lib/api/axios-instance');
      const prefix = isAdmin ? '/admin' : '/employee';
      const r = await api.get(`${prefix}/projects`);
      const d = r.data;
      return Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
    },
    enabled: !!user,
  });
  const projects: any[] = Array.isArray(projectsRaw) ? projectsRaw : [];

  const createMut = useMutation({
    mutationFn: async () => {
      const { from, to } = getDateRange();
      const fd = new FormData();
      fd.append('expenseDate', from);
      if (dateMode !== 'single') fd.append('expenseDateTo', to);
      fd.append('expenseType', formType);
      fd.append('amount', formAmount);
      if (formDesc) fd.append('description', formDesc);
      if (formProjectId) fd.append('projectId', formProjectId);
      if (formFile) fd.append('file', formFile);
      return isAdmin ? adminExpensesApi.create(fd) : expensesApi.create(fd);
    },
    onSuccess: (r: any) => {
      toast.success('Expense created');
      const id = r.data?.data?.id ?? r.data?.id;
      router.push(id ? `/expenses/${id}` : '/expenses');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to create expense'),
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <button onClick={() => router.push('/expenses')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-1">
            <ArrowLeft className="h-4 w-4" /> Back to Expenses
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-white" />
            </div>
            New Expense
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/expenses')}>Cancel</Button>
          <Button disabled={!formDate || !formAmount || !formType || createMut.isPending} onClick={() => createMut.mutate()}>
            {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Receipt className="h-4 w-4 mr-1" />}
            Submit Expense
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

              {/* Date inputs based on mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                {dateMode === 'single' && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-2 block">Date</label>
                    <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
                  </div>
                )}
                {dateMode === 'week' && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-2 block">From Date</label>
                      <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-2 block">To Date</label>
                      <Input type="date" value={formDateTo} onChange={(e) => setFormDateTo(e.target.value)} min={formDate} />
                    </div>
                  </>
                )}
                {dateMode === 'month' && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-2 block">Month</label>
                    <Input type="month" value={formMonth} onChange={(e) => setFormMonth(e.target.value)} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                    <FolderKanban className="h-3.5 w-3.5 text-primary" /> Project
                  </label>
                  <Select value={formProjectId || 'none'} onValueChange={(v) => setFormProjectId(v === 'none' ? '' : v)}>
                    <SelectTrigger className='w-full'><SelectValue placeholder="Select project..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {projects.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.projectName}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
                  <Input type="number" placeholder="0.00" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} />
                </div>
              </div>

              <div className="mt-5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                  <AlignLeft className="h-3.5 w-3.5 text-primary" /> Description
                </label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
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

              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${formFile ? 'border-primary/50 bg-primary/5' : 'hover:border-primary/40 hover:bg-muted/30'
                  }`}
                onClick={() => fileRef.current?.click()}
              >
                {formFile ? (
                  <div className="space-y-2">
                    {formFile.type.startsWith('image/') ? (
                      <img src={URL.createObjectURL(formFile)} alt="Preview" className="max-h-32 mx-auto rounded-lg" />
                    ) : (
                      <FileText className="h-12 w-12 mx-auto text-primary" />
                    )}
                    <p className="text-sm font-medium truncate">{formFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(formFile.size / 1024).toFixed(1)} KB</p>
                    <Button size="sm" variant="outline" className="text-red-500" onClick={(e) => { e.stopPropagation(); setFormFile(null); }}>
                      <X className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="h-14 w-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
                      <Upload className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium">Upload receipt</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, DOC, XLS, JPG, PNG</p>
                    <p className="text-xs text-muted-foreground">Max 10MB</p>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => setFormFile(e.target.files?.[0] ?? null)} />
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
