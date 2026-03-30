/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2, ChevronRight, Paperclip, X, Calendar, Clock,
  User, Layers, Flag, FolderKanban, FileText, Image as ImageIcon,
} from 'lucide-react';
import { projectPlanningApi, employeePlanningApi, clientPlanningApi, adminTicketsApi, projectTicketsApi, clientTicketsApi } from '@/lib/api/project-planning';
import { employeesApi } from '@/lib/api/employees';
import { useAuth } from '@/providers/auth-provider';
import { CreateTaskDto } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import Link from 'next/link';

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return <ImageIcon className="h-4 w-4 text-pink-500" />;
  if (ext === 'pdf') return <FileText className="h-4 w-4 text-red-500" />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileText className="h-4 w-4 text-green-500" />;
  return <Paperclip className="h-4 w-4 text-muted-foreground" />;
}

export default function NewTaskPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';
  const isClient = user?._type === 'client';
  const projectId = Number(params.id);

  const planApi = isAdmin ? projectPlanningApi : isClient ? clientPlanningApi : employeePlanningApi;
  const ticketAttApi = isAdmin ? adminTicketsApi : isClient ? clientTicketsApi : projectTicketsApi;

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [phaseId, setPhaseId] = useState('__none__');
  const [assigneeId, setAssigneeId] = useState('__none__');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('todo');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: project } = useQuery({
    queryKey: ['project-detail', projectId],
    queryFn: async () => {
      try {
        const r = isAdmin
          ? await (await import('@/lib/api/projects')).projectsApi.getOne(projectId)
          : await (await import('@/lib/api/projects')).projectsApi.employeeGetOne(projectId);
        return (r.data as any)?.data ?? r.data;
      } catch { return null; }
    },
  });

  const { data: phases = [] } = useQuery({
    queryKey: ['project-phases', projectId],
    queryFn: () => planApi.getPhases(projectId).then((r) => r.data?.data ?? []),
  });

  const { data: empList = [] } = useQuery({
    queryKey: ['project-employees', projectId],
    queryFn: async () => {
      try {
        const fn = isAdmin ? employeesApi.getAll : employeesApi.employeeGetAll;
        const r = await fn({ limit: 100 });
        const d: any = r.data;
        return Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
      } catch { return []; }
    },
    enabled: !isClient,
  });

  // Create mutation
  const createMut = useMutation({
    mutationFn: async (dto: CreateTaskDto) => {
      const res = await planApi.createTask(projectId, dto);
      const newTaskId = (res?.data as any)?.data?.id ?? (res?.data as any)?.id;
      // Upload attachments
      if (newTaskId && files.length > 0 && (ticketAttApi as any).uploadAttachment) {
        for (const f of files) {
          try { await (ticketAttApi as any).uploadAttachment(newTaskId, f); } catch { /* skip */ }
        }
      }
      return { newTaskId };
    },
    onSuccess: ({ newTaskId }) => {
      qc.invalidateQueries({ queryKey: ['project-tasks'] });
      qc.invalidateQueries({ queryKey: ['project-tickets-all'] });
      toast.success('Task created');
      if (newTaskId) {
        router.push(`/full-tickets/${newTaskId}`);
      } else {
        router.push(`/projects/${projectId}/planning`);
      }
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create task'),
  });

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    const dto: CreateTaskDto = {
      title: title.trim(),
      description: description || undefined,
      priority: priority as any,
      status: status as any,
      dueDate: dueDate || undefined,
      estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
      phaseId: phaseId && phaseId !== '__none__' ? Number(phaseId) : undefined,
      assigneeId: assigneeId && assigneeId !== '__none__' ? Number(assigneeId) : undefined,
    };
    createMut.mutate(dto);
  };

  const projectName = (project as any)?.projectName ?? (project as any)?.project_name ?? `Project #${projectId}`;

  return (
    <div className="min-h-full">
      {/* Breadcrumb */}
      <div className="px-6 pt-4 pb-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link href="/projects">Projects</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator><ChevronRight className="h-3.5 w-3.5" /></BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link href={`/projects/${projectId}/planning`}>{projectName}</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator><ChevronRight className="h-3.5 w-3.5" /></BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage className="font-semibold">New Task</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Main layout */}
      <div className="px-6 pb-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT PANEL (2/3) */}
        <div className="lg:col-span-2 space-y-5">

          {/* Title */}
          <div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title…"
              className="text-xl font-bold border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-violet-500 h-auto py-2"
            />
          </div>

          {/* Description */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
              <FileText className="h-3 w-3" /> Description
            </div>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Describe the task…"
              minHeight="180px"
            />
          </div>

          {/* Attachments */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                Attachments
                {files.length > 0 && (
                  <span className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 rounded-full px-1.5 py-0.5">{files.length}</span>
                )}
              </div>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="h-3 w-3 mr-1" /> Add Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv"
                onChange={(e) => {
                  if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                  e.target.value = '';
                }}
              />
            </div>
            {files.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No attachments yet. Click &quot;Add Files&quot; to attach documents.</p>
            ) : (
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                    {fileIcon(f.name)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.name}</p>
                      <p className="text-[10px] text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR (1/3) */}
        <div className="space-y-4">

          {/* Status + Priority */}
          <div className="rounded-xl border bg-card p-4 space-y-4">
            {!isClient && (
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <FolderKanban className="h-3 w-3" /> Status
                </label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                <Flag className="h-3 w-3" /> Priority
              </label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Details */}
          <div className="rounded-xl border bg-card p-4 space-y-4">
            {!isClient && (
              <>
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Layers className="h-3 w-3" /> Phase
                  </label>
                  <Select value={phaseId} onValueChange={setPhaseId}>
                    <SelectTrigger className="w-full h-9"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {(phases as any[]).map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                    <User className="h-3 w-3" /> Assignee
                  </label>
                  <Select value={assigneeId} onValueChange={setAssigneeId}>
                    <SelectTrigger className="w-full h-9"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Unassigned</SelectItem>
                      {(empList as any[])
                        .filter((e: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === e.id && (x._type || 'emp') === (e._type || 'emp')) === i)
                        .filter((e: any) => !e._type || e._type === 'employee')
                        .map((e: any) => (
                        <SelectItem key={`emp-${e.id}`} value={String(e.id)}>{e.empName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Due Date
              </label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9" />
            </div>
            {!isClient && (
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Estimated Hours
                </label>
                <Input type="number" step="0.5" min="0" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} className="h-9" placeholder="0" />
              </div>
            )}
          </div>

          {/* Create button */}
          <Button
            className="w-full bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold py-5"
            disabled={!title.trim() || createMut.isPending}
            onClick={handleSubmit}
          >
            {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create Task
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push(`/projects/${projectId}/planning`)}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
