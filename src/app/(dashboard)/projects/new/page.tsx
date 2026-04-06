/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, FolderKanban, Loader2, CheckCircle2, User, Calendar, Clock, FileText, Check, X, Paperclip, Upload, File, Trash2, Milestone, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { projectsApi } from '@/lib/api/projects';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { CreateProjectDto } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
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
  });

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
      // Create milestones if any
      if (milestones.length > 0) {
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

  const removeMilestone = (idx: number) => {
    setMilestones((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    console.log("form",form);
    
    if (!form.projectCode.trim() || !form.projectName.trim() || !form.projectType || !form.startDate) {
      toast.error('Please fill in all required fields (Code, Name, Type, Start Date)');
      return;
    }
    if (milestones.length === 0) {
      toast.error('Please add at least one milestone');
      return;
    }
    const pmId = form.projectManagerId && form.projectManagerId !== 'none' ? Number(form.projectManagerId) : null;
    const dto: any = { ...form, projectManagerId: pmId };
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold">New Project</h1>
          <p className="text-sm text-muted-foreground">Fill in the details to create a new project</p>
        </div>
        <div className="flex gap-2">
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

      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-pink-600 dark:text-pink-400 mb-1.5">
            <FolderKanban className="h-3 w-3" /> Project Code
          </div>
          <Input
            value={form.projectCode}
            onChange={(e) => setForm((p) => ({ ...p, projectCode: e.target.value }))}
            placeholder="e.g. PRJ-001"
            className="h-8 text-sm font-mono"
          />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-cyan-600 dark:text-cyan-400 mb-1.5">
            <FileText className="h-3 w-3" /> Project Name
          </div>
          <Input
            value={form.projectName}
            onChange={(e) => setForm((p) => ({ ...p, projectName: e.target.value }))}
            placeholder="e.g. E-commerce Platform"
            className="h-8 text-sm"
          />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-orange-600 dark:text-orange-400 mb-1.5">
            <Clock className="h-3 w-3" /> Status
          </div>
          <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
            <SelectTrigger className="h-8 text-sm w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-violet-600 dark:text-violet-400 mb-1.5">
            <FolderKanban className="h-3 w-3" /> Type
          </div>
          <Select value={form.projectType} onValueChange={(v) => setForm((p) => ({ ...p, projectType: v }))}>
            <SelectTrigger className="h-8 text-sm w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {typeOptions.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400 mb-1.5">
            <User className="h-3 w-3" /> Client
          </div>
          <Input
            value={form.clientName}
            onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))}
            placeholder="e.g. Acme Corp"
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
              ...(managers ?? []).map((m: any) => ({ value: String(m.id), label: m.empName })),
            ]}
            className="h-8 text-sm"
          />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400 mb-1.5">
            <Calendar className="h-3 w-3" /> Start Date
          </div>
          <Input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
            className="h-8 text-sm"
          />
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
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            <File className="h-3 w-3" /> Documents
          </div>
          <div className="flex items-center gap-2">
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

      {/* ── Milestone Dialog ──────────────────────────────────────────── */}
      <Dialog open={milestoneDialogOpen} onOpenChange={setMilestoneDialogOpen}>
        <DialogContent className="sm:max-w-[100vw] md:max-w-[80vw] lg:max-w-[60vw] w-full h-[100vh] md:h-[85vh] max-h-[100vh] md:max-h-[95vh] rounded-none md:rounded-lg flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Milestone className="h-5 w-5 text-violet-600" />
              Project Milestones
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">Add at least one milestone. Received amount can be updated later.</p>

          {/* Add new milestone form */}
          <div className="grid grid-cols-[1fr_80px_120px_auto] gap-2 items-end">
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">Name *</label>
              <Input value={msName} onChange={(e) => setMsName(e.target.value)} placeholder="e.g. Advance" className="h-9" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">Exp % *</label>
              <Input type="number" min="0" max="100" step="0.01" value={msExpectedPct} onChange={(e) => setMsExpectedPct(e.target.value)} placeholder="20" className="h-9" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">Exp Amt *</label>
              <Input type="number" min="0" step="0.01" value={msExpectedAmt} onChange={(e) => setMsExpectedAmt(e.target.value)} placeholder="200000" className="h-9" />
            </div>
            <Button size="sm" className="h-9" onClick={addMilestone}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Milestone list */}
          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            {milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No milestones added yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left">
                    <th className="py-1.5 text-xs text-muted-foreground">Name</th>
                    <th className="py-1.5 text-xs text-muted-foreground text-right">Exp %</th>
                    <th className="py-1.5 text-xs text-muted-foreground text-right">Exp Amt</th>
                    <th className="py-1.5 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {milestones.map((m, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-2 font-medium">{m.name}</td>
                      <td className="py-2 text-right">{m.expectedPercentage}%</td>
                      <td className="py-2 text-right">₹{Number(m.expectedAmount).toLocaleString('en-IN')}</td>
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

          {/* Fixed total + done at bottom */}
          {milestones.length > 0 && (
            <div className="border-t pt-2 shrink-0">
              <div className="flex justify-between text-sm font-semibold">
                <span>Total</span>
                <span>
                  {milestones.reduce((s, m) => s + Number(m.expectedPercentage || 0), 0)}% · ₹{milestones.reduce((s, m) => s + Number(m.expectedAmount || 0), 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}
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
