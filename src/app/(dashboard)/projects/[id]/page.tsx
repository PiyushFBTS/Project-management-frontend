/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, FolderKanban, Calendar, User, ClipboardList, Clock, FileText, Pencil, Loader2, X, Check,
  Upload, Trash2, Download, File, UserPlus, Users, Milestone, Plus,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { projectsApi } from '@/lib/api/projects';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextEditor, RichTextDisplay } from '@/components/ui/rich-text-editor';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30',
  completed: 'bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/30',
  on_hold: 'bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/30',
  cancelled: 'bg-red-500/15 text-red-600 ring-1 ring-red-500/30',
};

const statusOptions = ['active', 'completed', 'on_hold', 'cancelled'];
const typeOptions = [
  { value: 'fresh_implement', label: 'Fresh Implement' },
  { value: 'migration', label: 'Migration' },
  { value: 'change_request', label: 'Change Request' },
  { value: 'support', label: 'Support' },
  { value: 'development', label: 'Development' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'maintenance', label: 'Maintenance' },
];

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';
  const isClient = user?._type === 'client';
  const isEmployee = user?._type === 'employee';
  const isHr = isEmployee && !!(user as any)?.isHr;
  // canEditDocs computed after project loads (below)

  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [uploadCategory, setUploadCategory] = useState('other');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project-detail', id, user?._type],
    queryFn: () => {
      if (isAdmin) return projectsApi.getOne(Number(id)).then((r) => r.data.data);
      if (isClient) return projectsApi.clientGetProject().then((r) => r.data?.data ?? r.data);
      return projectsApi.employeeGetOne(Number(id)).then((r) => r.data.data);
    },
  });

  const isPm = isEmployee && !!project && project.projectManagerId === (user as any)?.id;
  const canEditDocs = isAdmin || isHr || isPm;

  // Managers list for the dropdown (admin only)
  const { data: managers } = useQuery({
    queryKey: ['project-managers'],
    queryFn: () => projectsApi.getManagers().then((r) => r.data.data),
    enabled: isAdmin && editMode,
  });

  const updateMut = useMutation({
    mutationFn: (dto: any) => projectsApi.update(Number(id), dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-detail', id] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project updated');
      setEditMode(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update'),
  });

  // ── Milestones (visible to admin, HR, super admin) ──
  const canViewMilestones = isAdmin || isHr;
  const { data: milestones = [], isLoading: milestonesLoading } = useQuery({
    queryKey: ['project-milestones', id],
    queryFn: () => projectsApi.getMilestones(Number(id)).then((r: any) => r.data?.data ?? r.data ?? []),
    enabled: !!project && canViewMilestones,
  });

  const [msDialogOpen, setMsDialogOpen] = useState(false);
  const [msName, setMsName] = useState('');
  const [msExpectedPct, setMsExpectedPct] = useState('');
  const [msExpectedAmt, setMsExpectedAmt] = useState('');
  const [editingMsId, setEditingMsId] = useState<number | null>(null);
  const [editRecvPct, setEditRecvPct] = useState('');
  const [editRecvAmt, setEditRecvAmt] = useState('');

  const createMsMut = useMutation({
    mutationFn: () => projectsApi.createMilestone(Number(id), {
      name: msName.trim(),
      expectedPercentage: Number(msExpectedPct),
      expectedAmount: Number(msExpectedAmt),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-milestones', id] });
      setMsName('');
      setMsExpectedPct('');
      setMsExpectedAmt('');
      setMsDialogOpen(false);
      toast.success('Milestone added');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const updateMsMut = useMutation({
    mutationFn: ({ msId, dto }: { msId: number; dto: any }) => projectsApi.updateMilestone(Number(id), msId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-milestones', id] });
      setEditingMsId(null);
      toast.success('Milestone updated');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const deleteMsMut = useMutation({
    mutationFn: (msId: number) => projectsApi.deleteMilestone(Number(id), msId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-milestones', id] });
      toast.success('Milestone deleted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  // ── Documents (visible to all roles) ──
  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ['project-documents', id],
    queryFn: () => {
      if (isAdmin) return projectsApi.getDocuments(Number(id)).then((r: any) => r.data?.data ?? r.data);
      if (isClient) return projectsApi.clientGetDocuments(Number(id)).then((r: any) => r.data?.data ?? r.data);
      return projectsApi.employeeGetDocuments(Number(id)).then((r: any) => r.data?.data ?? r.data);
    },
    enabled: !!project,
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) =>
      isAdmin
        ? projectsApi.uploadDocument(Number(id), file, uploadCategory)
        : projectsApi.employeeUploadDocument(Number(id), file, uploadCategory),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-documents', id] });
      toast.success('Document uploaded');
      setUploadCategory('other');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Upload failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (docId: number) =>
      isAdmin
        ? projectsApi.deleteDocument(Number(id), docId)
        : projectsApi.employeeDeleteDocument(Number(id), docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-documents', id] });
      toast.success('Document deleted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Delete failed'),
  });

  // ── Client Users ──
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [clientForm, setClientForm] = useState({ fullName: '', email: '', password: '', mobileNumber: '' });

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['project-clients', id],
    queryFn: () => projectsApi.getClients(Number(id)).then((r: any) => r.data?.data ?? r.data),
    enabled: !!project && isAdmin,
  });

  const createClientMut = useMutation({
    mutationFn: () => projectsApi.createClient(Number(id), clientForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-clients', id] });
      toast.success('Client added');
      setClientDialogOpen(false);
      setClientForm({ fullName: '', email: '', password: '', mobileNumber: '' });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to add client'),
  });

  const deleteClientMut = useMutation({
    mutationFn: (clientId: number) => projectsApi.deleteClient(Number(id), clientId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-clients', id] });
      toast.success('Client removed');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to remove'),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMut.mutate(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startEdit = () => {
    console.log("project",project);
    
    if (!project) return;
    setForm({
      projectName: project.projectName,
      projectType: project.projectType,
      clientName: project.clientName ?? '',
      status: project.status,
      startDate: project.startDate?.slice(0, 10) ?? '',
      endDate: project.endDate?.slice(0, 10) ?? '',
      description: project.description ?? '',
      projectManagerId: project.projectManagerId?.toString() ?? 'none',
    });
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setForm({});
  };

  const saveEdit = () => {
    updateMut.mutate({
      projectName: form.projectName,
      projectType: form.projectType,
      clientName: form.clientName,
      status: form.status,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      description: form.description || undefined,
      projectManagerId: form.projectManagerId && form.projectManagerId !== 'none' ? Number(form.projectManagerId) : null,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!project) return <p className="text-muted-foreground">Project not found.</p>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            {!editMode ? (
              <>
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-xs font-mono font-semibold text-violet-600 dark:text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded">
                    {project.projectCode}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[project.status] ?? ''}`}>
                    {project.status}
                  </span>
                </div>
                <h1 className="text-lg sm:text-xl font-bold truncate">{project.projectName}</h1>
              </>
            ) : (
              <>
                <h1 className="text-lg sm:text-xl font-bold">Edit Project</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">Update the project details below</p>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap pl-11 sm:pl-0">
          {!editMode ? (
            <>
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={startEdit}>
                  <Pencil className="h-3.5 w-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
              )}
              {canViewMilestones && (
                <Button variant="outline" size="sm" onClick={() => setMsDialogOpen(true)}>
                  <Milestone className="h-3.5 w-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Milestones</span>
                  {(milestones as any[]).length > 0 && (
                    <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white px-1">
                      {(milestones as any[]).length}
                    </span>
                  )}
                </Button>
              )}
              <Button
                size="sm"
                className="bg-linear-to-r from-violet-500 to-purple-600 text-white hover:opacity-90 border-0"
                onClick={() => router.push(`/projects/${id}/planning`)}
              >
                <ClipboardList className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Planning</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={cancelEdit}>
                <X className="mr-1 h-3.5 w-3.5" /> Cancel
              </Button>
              <Button size="sm" disabled={updateMut.isPending} onClick={saveEdit}
                className="bg-linear-to-r from-emerald-500 to-teal-600 text-white hover:opacity-90 border-0"
              >
                {updateMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {/* Project Code — only shown in edit mode as card, in view mode it's in header */}
        {editMode && (
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-pink-600 dark:text-pink-400 mb-1.5">
              <FolderKanban className="h-3 w-3" /> Project Code
            </div>
            <p className="text-sm font-medium font-mono text-muted-foreground">{project.projectCode}</p>
          </div>
        )}

        {/* Project Name */}
        {editMode ? (
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-cyan-600 dark:text-cyan-400 mb-1.5">
              <FileText className="h-3 w-3" /> Project Name
            </div>
            <Input value={form.projectName} onChange={(e) => setForm((p) => ({ ...p, projectName: e.target.value }))} className="h-8 text-sm" />
          </div>
        ) : null}

        {/* Status */}
        {editMode ? (
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-orange-600 dark:text-orange-400 mb-1.5">
              <Clock className="h-3 w-3" /> Status
            </div>
            <Select value={form.status}  onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
              <SelectTrigger className="h-8 text-sm Edit Project w-full"><SelectValue /></SelectTrigger>
              <SelectContent className="Edit Project">
                {statusOptions.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-violet-600 dark:text-violet-400 mb-1.5">
            <FolderKanban className="h-3 w-3" /> Type
          </div>
          {!editMode ? (
            <p className="text-sm font-medium">{typeOptions.find((t) => t.value === project.projectType)?.label ?? project.projectType}</p>
          ) : (
            <Select value={form.projectType} onValueChange={(v) => setForm((p) => ({ ...p, projectType: v }))}>
              <SelectTrigger className="h-8 text-sm  w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {typeOptions.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400 mb-1.5">
            <User className="h-3 w-3" /> Client
          </div>
          {!editMode ? (
            <p className="text-sm font-medium">{project.clientName || '—'}</p>
          ) : (
            <Input value={form.clientName} onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))} className="h-8 text-sm" />
          )}
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5">
            <User className="h-3 w-3" /> Project Manager
          </div>
          {!editMode ? (
            <p className="text-sm font-medium">{project.projectManager?.empName ?? '—'}</p>
          ) : (
            <Select value={form.projectManagerId} onValueChange={(v) => setForm((p) => ({ ...p, projectManagerId: v }))}>
              <SelectTrigger className="h-8 text-sm  w-full"><SelectValue placeholder="Select manager" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(managers ?? []).map((m: any) => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.empName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400 mb-1.5">
            <Calendar className="h-3 w-3" /> Start Date
          </div>
          {!editMode ? (
            <p className="text-sm font-medium">{formatDate(project.startDate)}</p>
          ) : (
            <Input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} className="h-8 text-sm" />
          )}
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-rose-600 dark:text-rose-400 mb-1.5">
            <Calendar className="h-3 w-3" /> End Date
          </div>
          {!editMode ? (
            <p className="text-sm font-medium">{formatDate(project.endDate)}</p>
          ) : (
            <Input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} className="h-8 text-sm" />
          )}
        </div>

        {!editMode && (
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-indigo-600 dark:text-indigo-400 mb-1.5">
              <Clock className="h-3 w-3" /> Created
            </div>
            <p className="text-sm font-medium">{formatDate(project.createdAt)}</p>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
          <FileText className="h-3 w-3" /> Description
        </div>
        {!editMode ? (
          <RichTextDisplay html={project.description} />
        ) : (
          <RichTextEditor
            value={form.description}
            onChange={(html) => setForm((p) => ({ ...p, description: html }))}
            placeholder="Project description..."
            minHeight="150px"
          />
        )}
      </div>

      {/* ── Milestones Dialog (admin, HR, super admin) ─────────────── */}
      <Dialog open={msDialogOpen} onOpenChange={setMsDialogOpen} >
        <DialogContent className="sm:max-w-[100vw] md:max-w-[80vw] lg:max-w-[60vw] w-full h-[100vh] md:h-[85vh] max-h-[100vh] md:max-h-[95vh] rounded-none md:rounded-lg flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Milestone className="h-5 w-5 text-violet-600" /> Project Milestones
            </DialogTitle>
          </DialogHeader>

          {/* Add new milestone form */}
          <div className="border-b pb-3 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 items-end">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">Name</label>
                <Input value={msName} onChange={(e) => setMsName(e.target.value)} placeholder="e.g. Advance" className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">Exp %</label>
                <Input type="number" min="0" max="100" step="0.01" value={msExpectedPct} onChange={(e) => setMsExpectedPct(e.target.value)} placeholder="20" className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">Exp Amt</label>
                <Input type="number" min="0" step="0.01" value={msExpectedAmt} onChange={(e) => setMsExpectedAmt(e.target.value)} placeholder="200000" className="h-8 text-sm" />
              </div>
              <div className="hidden md:block"><label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">Recv %</label><Input disabled placeholder="—" className="h-8 text-sm bg-muted/50" /></div>
              <div className="hidden md:block"><label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">Recv Amt</label><Input disabled placeholder="—" className="h-8 text-sm bg-muted/50" /></div>
              <div>
                <Button size="sm" className="h-8 w-full md:w-auto" disabled={!msName.trim() || !msExpectedPct || !msExpectedAmt || Number(msExpectedAmt) <= 0 || createMsMut.isPending} onClick={() => createMsMut.mutate()}>
                  {createMsMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="h-3.5 w-3.5 mr-1" /><span className="md:hidden">Add</span></>}
                </Button>
              </div>
            </div>
          </div>

          {/* Milestone list */}
          <div className="flex-1 overflow-y-auto -mx-6 px-4 sm:px-6">
            {milestonesLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (milestones as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No milestones yet. Add one above.</p>
            ) : (
              <>
                {/* Mobile: card layout */}
                <div className="md:hidden space-y-3">
                  {(milestones as any[]).map((ms: any) => (
                    <div key={ms.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm">{ms.name}</p>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => deleteMsMut.mutate(ms.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div><span className="text-muted-foreground">Exp %:</span> <span className="font-medium">{Number(ms.expectedPercentage ?? 0)}%</span></div>
                        <div><span className="text-muted-foreground">Exp Amt:</span> <span className="font-medium">₹{Number(ms.expectedAmount ?? 0).toLocaleString('en-IN')}</span></div>
                        {editingMsId === ms.id ? (
                          <>
                            <div className="col-span-2 grid grid-cols-2 gap-2 pt-1">
                              <div>
                                <label className="text-[10px] text-muted-foreground">Recv %</label>
                                <Input type="number" min="0" max="100" step="0.01" value={editRecvPct} onChange={(e) => setEditRecvPct(e.target.value)} className="h-7 text-xs" />
                              </div>
                              <div>
                                <label className="text-[10px] text-muted-foreground">Recv Amt</label>
                                <Input type="number" min="0" step="0.01" value={editRecvAmt} onChange={(e) => setEditRecvAmt(e.target.value)} className="h-7 text-xs" />
                              </div>
                            </div>
                            <div className="col-span-2 flex gap-2 pt-1">
                              <Button size="sm" className="h-7 flex-1 text-xs" onClick={() => updateMsMut.mutate({ msId: ms.id, dto: { receivedPercentage: Number(editRecvPct), receivedAmount: Number(editRecvAmt) } })}>
                                <Check className="h-3 w-3 mr-1" /> Save
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingMsId(null)}>Cancel</Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="cursor-pointer hover:text-violet-600" onClick={() => { setEditingMsId(ms.id); setEditRecvPct(String(ms.receivedPercentage ?? 0)); setEditRecvAmt(String(ms.receivedAmount ?? 0)); }}>
                              <span className="text-muted-foreground">Recv %:</span> <span className="font-medium">{Number(ms.receivedPercentage ?? 0)}%</span> <Pencil className="inline h-2.5 w-2.5 text-muted-foreground" />
                            </div>
                            <div className="cursor-pointer hover:text-violet-600" onClick={() => { setEditingMsId(ms.id); setEditRecvPct(String(ms.receivedPercentage ?? 0)); setEditRecvAmt(String(ms.receivedAmount ?? 0)); }}>
                              <span className="text-muted-foreground">Recv Amt:</span> <span className="font-medium">₹{Number(ms.receivedAmount ?? 0).toLocaleString('en-IN')}</span> <Pencil className="inline h-2.5 w-2.5 text-muted-foreground" />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: table layout */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b text-left">
                        <th className="py-2 pr-2 text-xs text-muted-foreground font-semibold">Name</th>
                        <th className="py-2 pr-2 text-xs text-muted-foreground font-semibold text-right">Exp %</th>
                        <th className="py-2 pr-2 text-xs text-muted-foreground font-semibold text-right">Exp Amt</th>
                        <th className="py-2 pr-2 text-xs text-muted-foreground font-semibold text-right">Recv %</th>
                        <th className="py-2 pr-2 text-xs text-muted-foreground font-semibold text-right">Recv Amt</th>
                        <th className="py-2 w-20 text-xs text-muted-foreground font-semibold text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(milestones as any[]).map((ms: any) => (
                        <tr key={ms.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2 pr-2 font-medium">{ms.name}</td>
                          <td className="py-2 pr-2 text-right">{Number(ms.expectedPercentage ?? 0)}%</td>
                          <td className="py-2 pr-2 text-right">₹{Number(ms.expectedAmount ?? 0).toLocaleString('en-IN')}</td>
                          {editingMsId === ms.id ? (
                            <>
                              <td className="py-2 pr-1"><Input type="number" min="0" max="100" step="0.01" value={editRecvPct} onChange={(e) => setEditRecvPct(e.target.value)} className="h-7 text-xs w-20 text-right ml-auto" /></td>
                              <td className="py-2 pr-1"><Input type="number" min="0" step="0.01" value={editRecvAmt} onChange={(e) => setEditRecvAmt(e.target.value)} className="h-7 text-xs w-28 text-right ml-auto" /></td>
                              <td className="py-2 text-center">
                                <div className="flex justify-center gap-0.5">
                                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => updateMsMut.mutate({ msId: ms.id, dto: { receivedPercentage: Number(editRecvPct), receivedAmount: Number(editRecvAmt) } })}><Check className="h-3 w-3 text-emerald-600" /></Button>
                                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingMsId(null)}><X className="h-3 w-3" /></Button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-2 pr-2 text-right cursor-pointer hover:text-violet-600 transition-colors" onClick={() => { setEditingMsId(ms.id); setEditRecvPct(String(ms.receivedPercentage ?? 0)); setEditRecvAmt(String(ms.receivedAmount ?? 0)); }}>
                                {Number(ms.receivedPercentage ?? 0)}% <Pencil className="inline h-2.5 w-2.5 ml-1 text-muted-foreground" />
                              </td>
                              <td className="py-2 pr-2 text-right cursor-pointer hover:text-violet-600 transition-colors" onClick={() => { setEditingMsId(ms.id); setEditRecvPct(String(ms.receivedPercentage ?? 0)); setEditRecvAmt(String(ms.receivedAmount ?? 0)); }}>
                                ₹{Number(ms.receivedAmount ?? 0).toLocaleString('en-IN')} <Pencil className="inline h-2.5 w-2.5 ml-1 text-muted-foreground" />
                              </td>
                              <td className="py-2 text-center">
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 hover:text-red-600" onClick={() => deleteMsMut.mutate(ms.id)}><Trash2 className="h-3 w-3" /></Button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Fixed totals at bottom */}
          {(milestones as any[]).length > 0 && (
            <div className="border-t pt-2 shrink-0">
              {/* Mobile totals */}
              <div className="md:hidden grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-semibold px-1">
                <div>Exp: {(milestones as any[]).reduce((s: number, m: any) => s + Number(m.expectedPercentage ?? 0), 0)}% / ₹{(milestones as any[]).reduce((s: number, m: any) => s + Number(m.expectedAmount ?? 0), 0).toLocaleString('en-IN')}</div>
                <div>Recv: {(milestones as any[]).reduce((s: number, m: any) => s + Number(m.receivedPercentage ?? 0), 0)}% / ₹{(milestones as any[]).reduce((s: number, m: any) => s + Number(m.receivedAmount ?? 0), 0).toLocaleString('en-IN')}</div>
              </div>
              {/* Desktop totals */}
              <div className="hidden md:grid grid-cols-[1fr_80px_120px_80px_120px_80px] gap-2 text-sm font-semibold px-1">
                <span>Total</span>
                <span className="text-right">{(milestones as any[]).reduce((s: number, m: any) => s + Number(m.expectedPercentage ?? 0), 0)}%</span>
                <span className="text-right">₹{(milestones as any[]).reduce((s: number, m: any) => s + Number(m.expectedAmount ?? 0), 0).toLocaleString('en-IN')}</span>
                <span className="text-right">{(milestones as any[]).reduce((s: number, m: any) => s + Number(m.receivedPercentage ?? 0), 0)}%</span>
                <span className="text-right">₹{(milestones as any[]).reduce((s: number, m: any) => s + Number(m.receivedAmount ?? 0), 0).toLocaleString('en-IN')}</span>
                <span></span>
              </div>
            </div>
          )}
          <div className="flex justify-end pt-2 border-t shrink-0">
            <Button onClick={() => setMsDialogOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Documents (visible to all, editable by admin/HR/PM) ────── */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            <File className="h-3 w-3" /> Documents
          </div>
          {canEditDocs && (
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger className="h-7 text-xs w-24 sm:w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="project_plan">Project Plan</SelectItem>
                  <SelectItem value="frd">FRD</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv"
                onChange={handleFileSelect}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={uploadMut.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                Upload
              </Button>
            </div>
          )}
        </div>

        {docsLoading ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : !(documents as any[])?.length ? (
          <p className="text-xs text-muted-foreground text-center py-6">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {(documents as any[]).map((doc: any) => (
              <div key={doc.id} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/30 transition-colors">
                <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.originalName}</p>
                  <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] text-muted-foreground flex-wrap">
                    <Badge variant="outline" className="text-[10px] capitalize">{doc.category?.replace('_', ' ')}</Badge>
                    <span>{(doc.fileSize / 1024).toFixed(0)} KB</span>
                    <span className="hidden sm:inline">by {doc.uploadedByName}</span>
                    <span className="hidden sm:inline">{new Date(doc.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' })}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <a href={`${process.env.NEXT_PUBLIC_API_URL ?? ''}${doc.filePath}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Download">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                  {canEditDocs && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:text-red-600"
                      title="Delete"
                      disabled={deleteMut.isPending}
                      onClick={() => { if (confirm(`Delete "${doc.originalName}"?`)) deleteMut.mutate(doc.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Client Users (admin only) ──────────────────────────────── */}
      {isAdmin && (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              <Users className="h-3 w-3" /> Client Users
            </div>
            <Button variant="outline" size="sm" onClick={() => setClientDialogOpen(true)}>
              <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Add Client
            </Button>
          </div>

          {clientsLoading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : !(clients as any[])?.length ? (
            <p className="text-xs text-muted-foreground text-center py-6">No client users added yet.</p>
          ) : (
            <div className="space-y-2">
              {(clients as any[]).map((c: any) => (
                <div key={c.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="h-9 w-9 rounded-full bg-linear-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {c.fullName?.charAt(0).toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{c.fullName}</p>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${c.isActive ? 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30' : 'bg-red-500/15 text-red-500 ring-red-500/30'}`}>
                    {c.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 shrink-0"
                    disabled={deleteClientMut.isPending}
                    onClick={() => { if (confirm(`Remove client "${c.fullName}"?`)) deleteClientMut.mutate(c.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Add Client Dialog ──────────────────────────────────────── */}
      <Dialog open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-blue-500" /> Add Client User
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">Full Name *</Label>
              <Input value={clientForm.fullName} onChange={(e) => setClientForm((p) => ({ ...p, fullName: e.target.value }))} placeholder="John Doe" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Email *</Label>
              <Input type="email" value={clientForm.email} onChange={(e) => setClientForm((p) => ({ ...p, email: e.target.value }))} placeholder="john@client.com" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Password *</Label>
              <Input type="password" value={clientForm.password} onChange={(e) => setClientForm((p) => ({ ...p, password: e.target.value }))} placeholder="Min 6 characters" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Phone</Label>
              <Input value={clientForm.mobileNumber} onChange={(e) => setClientForm((p) => ({ ...p, mobileNumber: e.target.value }))} placeholder="+91 9876543210" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClientDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!clientForm.fullName || !clientForm.email || !clientForm.password || createClientMut.isPending}
              onClick={() => createClientMut.mutate()}
            >
              {createClientMut.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Add Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
