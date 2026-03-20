/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, FolderKanban, Calendar, User, ClipboardList, Clock, FileText, Pencil, Loader2, X, Check,
  Upload, Trash2, Download, File,
} from 'lucide-react';
import { projectsApi } from '@/lib/api/projects';
import { employeesApi } from '@/lib/api/employees';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
const typeOptions = ['service', 'product', 'internal', 'rd'];

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
  const isHr = user?._type === 'employee' && !!(user as any)?.isHr;
  const canAccessDocs = isAdmin || isHr;

  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [uploadCategory, setUploadCategory] = useState('other');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project-detail', id, isAdmin],
    queryFn: () =>
      (isAdmin
        ? projectsApi.getOne(Number(id))
        : projectsApi.employeeGetOne(Number(id))
      ).then((r) => r.data.data),
  });

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

  // ── Documents ──
  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ['project-documents', id],
    queryFn: () =>
      (isAdmin
        ? projectsApi.getDocuments(Number(id))
        : projectsApi.employeeGetDocuments(Number(id))
      ).then((r: any) => r.data?.data ?? r.data),
    enabled: !!project && canAccessDocs,
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMut.mutate(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startEdit = () => {
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
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-mono font-semibold text-violet-600 dark:text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded">
              {project.projectCode}
            </span>
            {!editMode ? (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[project.status] ?? ''}`}>
                {project.status}
              </span>
            ) : (
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger className="h-6 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          {!editMode ? (
            <h1 className="text-xl font-bold">{project.projectName}</h1>
          ) : (
            <Input
              value={form.projectName}
              onChange={(e) => setForm((p) => ({ ...p, projectName: e.target.value }))}
              className="text-xl font-bold h-9"
            />
          )}
        </div>
        <div className="flex gap-2">
          {!editMode ? (
            <>
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={startEdit}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
              <Button
                size="sm"
                className="bg-linear-to-r from-violet-500 to-purple-600 text-white hover:opacity-90 border-0"
                onClick={() => router.push(`/projects/${id}/planning`)}
              >
                <ClipboardList className="mr-1.5 h-4 w-4" />
                Planning
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-violet-600 dark:text-violet-400 mb-1.5">
            <FolderKanban className="h-3 w-3" /> Type
          </div>
          {!editMode ? (
            <p className="text-sm font-medium capitalize">{project.projectType}</p>
          ) : (
            <Select value={form.projectType} onValueChange={(v) => setForm((p) => ({ ...p, projectType: v }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {typeOptions.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
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
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select manager" /></SelectTrigger>
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

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-indigo-600 dark:text-indigo-400 mb-1.5">
            <Clock className="h-3 w-3" /> Created
          </div>
          <p className="text-sm font-medium">{formatDate(project.createdAt)}</p>
        </div>
      </div>

      {/* Description */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
          <FileText className="h-3 w-3" /> Description
        </div>
        {!editMode ? (
          <p className="text-sm text-muted-foreground leading-relaxed">{project.description || 'No description'}</p>
        ) : (
          <Textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            rows={3}
            placeholder="Project description..."
          />
        )}
      </div>

      {/* ── Documents (admin + HR only) ────────────────────────────── */}
      {canAccessDocs && <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            <File className="h-3 w-3" /> Documents
          </div>
          <div className="flex items-center gap-2">
            <Select value={uploadCategory} onValueChange={setUploadCategory}>
              <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
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
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] capitalize">{doc.category?.replace('_', ' ')}</Badge>
                    <span>{(doc.fileSize / 1024).toFixed(0)} KB</span>
                    <span>by {doc.uploadedByName}</span>
                    <span>{new Date(doc.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' })}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <a href={`${process.env.NEXT_PUBLIC_API_URL ?? ''}${doc.filePath}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Download">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </a>
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>}
    </div>
  );
}
