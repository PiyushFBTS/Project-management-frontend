/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronRight,
  MessageSquare, Calendar, Clock, User, Target, Zap, History, Paperclip, X,
  UserRoundPlus, FileText, Image as ImageIcon, Download,
} from 'lucide-react';
import { projectPlanningApi, employeePlanningApi, clientPlanningApi, clientTicketsApi, adminTicketsApi, projectTicketsApi } from '@/lib/api/project-planning';
import { projectsApi } from '@/lib/api/projects';
import { employeesApi } from '@/lib/api/employees';
import { useAuth } from '@/providers/auth-provider';
import {
  ProjectPhase, ProjectTask, ProjectTaskComment, ProjectTaskHistory,
  CreatePhaseDto, CreateTaskDto, UpdateTaskDto,
  Employee, ProjectTaskStatus, TaskPriority,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { SearchableSelect } from '@/components/ui/searchable-select';

// ── Schemas ──────────────────────────────────────────────────────────────────

const phaseSchema = z.object({
  name: z.string().min(1, 'Required'),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
});

const taskSchema = z.object({
  title: z.string().min(1, 'Required'),
  description: z.string().optional(),
  phaseId: z.string().optional(),
  assigneeId: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['todo', 'in_progress', 'in_review', 'done', 'closed']).optional(),
  dueDate: z.string().optional(),
  estimatedHours: z.string().optional(),
});

type PhaseForm = z.infer<typeof phaseSchema>;
type TaskForm = z.infer<typeof taskSchema>;

// ── Color maps ───────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  todo: 'bg-slate-500/15 text-slate-600 ring-1 ring-slate-500/30 dark:text-slate-400',
  in_progress: 'bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/30 dark:text-blue-400',
  in_review: 'bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/30 dark:text-amber-400',
  done: 'bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30 dark:text-emerald-400',
  closed: 'bg-purple-500/15 text-purple-600 ring-1 ring-purple-500/30 dark:text-purple-400',
};

const priorityColors: Record<string, string> = {
  low: 'bg-slate-500/15 text-slate-600 ring-1 ring-slate-500/30 dark:text-slate-400',
  medium: 'bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/30 dark:text-blue-400',
  high: 'bg-orange-500/15 text-orange-600 ring-1 ring-orange-500/30 dark:text-orange-400',
  critical: 'bg-red-500/15 text-red-600 ring-1 ring-red-500/30 dark:text-red-400',
};

const phaseStatusColors: Record<string, string> = {
  not_started: 'bg-slate-500/15 text-slate-600 ring-1 ring-slate-500/30 dark:text-slate-400',
  in_progress: 'bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/30 dark:text-blue-400',
  completed: 'bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30 dark:text-emerald-400',
};

const statusLabels: Record<string, string> = {
  todo: 'To Do', in_progress: 'In Progress', in_review: 'In Review', done: 'Done', closed: 'Closed',
};
const priorityLabels: Record<string, string> = {
  low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical',
};
const phaseStatusLabels: Record<string, string> = {
  not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed',
};

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectPlanningPage() {
  const params = useParams();
  const projectId = Number(params.id);
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';
  const isClient = user?._type === 'client';

  // Pick the correct API based on user role
  const planApi = isAdmin ? projectPlanningApi : isClient ? clientPlanningApi : employeePlanningApi;

  // Dialogs
  const [phaseOpen, setPhaseOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<ProjectPhase | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [defaultPhaseId, setDefaultPhaseId] = useState<number | undefined>();
  const [detailTask, setDetailTask] = useState<ProjectTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [taskFiles, setTaskFiles] = useState<File[]>([]);
  const taskFileInputRef = useRef<HTMLInputElement>(null);

  // History dialog
  const [historyTaskId, setHistoryTaskId] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Excel import
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [excelImporting, setExcelImporting] = useState(false);
  const [excelResults, setExcelResults] = useState<Array<{ index: number; title: string; ticketNumber?: string; taskId?: number; success: boolean; error?: string }> | null>(null);

  // Collapsible phases
  const [expandedPhases, setExpandedPhases] = useState<Record<number, boolean>>({});
  const [unphasedExpanded, setUnphasedExpanded] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: project } = useQuery({
    queryKey: ['project', projectId, user?._type],
    queryFn: async () => {
      if (isAdmin) return projectsApi.getOne(projectId).then((r) => r.data.data);
      if (isClient) return projectsApi.clientGetProject().then((r) => r.data?.data ?? r.data);
      // Employee: get from the project list
      const r = await projectsApi.employeeGetAll();
      const list = r.data.data as any[];
      return (Array.isArray(list) ? list : []).find((p: any) => p.id === projectId) ?? null;
    },
  });

  const { data: summary } = useQuery({
    queryKey: ['planning-summary', projectId],
    queryFn: () => planApi.getSummary(projectId).then((r) => r.data.data),
  });

  const { data: phases, isLoading: phasesLoading } = useQuery({
    queryKey: ['planning-phases', projectId],
    queryFn: () => planApi.getPhases(projectId).then((r) => r.data.data),
  });

  const { data: tasksData, isLoading: tasksLoading, error: tasksError } = useQuery({
    queryKey: ['planning-tasks', projectId, statusFilter, priorityFilter],
    queryFn: async () => {
      const r = await planApi.getTasks(projectId, {
        limit: 100,
        ...(statusFilter !== 'all' ? { status: statusFilter as ProjectTaskStatus } : {}),
        ...(priorityFilter !== 'all' ? { priority: priorityFilter as TaskPriority } : {}),
      });
      const d: any = r.data?.data;
      return (Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []) as ProjectTask[];
    },
  });

  const { data: employees, error: employeesError } = useQuery({
    queryKey: ['all-employees', user?._type],
    queryFn: async () => {
      if (isClient) {
        const r = await clientTicketsApi.getEmployees();
        const d: any = r.data?.data ?? r.data;
        return (Array.isArray(d) ? d : []) as Employee[];
      }
      const fn = isAdmin ? employeesApi.getAll : employeesApi.employeeGetAll;
      const r = await fn({ isActive: true, limit: 100 });
      const d: any = r.data?.data;
      const list = (Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []) as any[];
      return list as Employee[];
    },
  });

  // Surface query errors so they are visible
  if (tasksError) console.error('Tasks query failed:', tasksError);
  if (employeesError) console.error('Employees query failed:', employeesError);

  const tasks = tasksData ?? [];
  const phaseList = phases ?? [];
  const employeeList = employees ?? [];

  // Group tasks by phase
  const tasksByPhase: Record<number | 'none', ProjectTask[]> = { none: [] };
  phaseList.forEach((p) => (tasksByPhase[p.id] = []));
  tasks.forEach((t) => {
    const key = t.phaseId ?? 'none';
    if (!tasksByPhase[key]) tasksByPhase[key] = [];
    tasksByPhase[key].push(t);
  });

  // ── Phase mutations ──────────────────────────────────────────────────────

  const phaseForm = useForm<PhaseForm>({ resolver: zodResolver(phaseSchema) });

  const createPhaseMut = useMutation({
    mutationFn: (dto: CreatePhaseDto) => planApi.createPhase(projectId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning-phases', projectId] });
      qc.invalidateQueries({ queryKey: ['planning-summary', projectId] });
      toast.success('Phase created');
      setPhaseOpen(false);
      phaseForm.reset();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const updatePhaseMut = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<CreatePhaseDto> }) =>
      planApi.updatePhase(projectId, id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning-phases', projectId] });
      qc.invalidateQueries({ queryKey: ['planning-summary', projectId] });
      toast.success('Phase updated');
      setPhaseOpen(false);
      setEditingPhase(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const deletePhaseMut = useMutation({
    mutationFn: (phaseId: number) => planApi.deletePhase(projectId, phaseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning-phases', projectId] });
      qc.invalidateQueries({ queryKey: ['planning-tasks', projectId] });
      qc.invalidateQueries({ queryKey: ['planning-summary', projectId] });
      toast.success('Phase deleted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const defaultPhases = [
    { name: 'Requirements & Analysis', description: 'Gather and document project requirements, scope, and objectives.' },
    { name: 'Design & Architecture', description: 'Create system design, UI mockups, and technical architecture.' },
    { name: 'Development', description: 'Implement features, write code, and build the solution.' },
    { name: 'Testing & QA', description: 'Perform testing, bug fixes, and quality assurance.' },
    { name: 'Deployment & Go-Live', description: 'Deploy to production, conduct UAT, and launch.' },
  ];

  const quickSetupMut = useMutation({
    mutationFn: async () => {
      for (const phase of defaultPhases) {
        await planApi.createPhase(projectId, { ...phase, status: 'not_started' });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning-phases', projectId] });
      qc.invalidateQueries({ queryKey: ['planning-summary', projectId] });
      toast.success('5 default phases created');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create phases'),
  });

  const openCreatePhase = () => {
    setEditingPhase(null);
    phaseForm.reset({ status: 'not_started' });
    setPhaseOpen(true);
  };

  const openEditPhase = (p: ProjectPhase) => {
    setEditingPhase(p);
    phaseForm.reset({
      name: p.name,
      description: p.description ?? '',
      startDate: p.startDate ?? '',
      endDate: p.endDate ?? '',
      status: p.status,
    });
    setPhaseOpen(true);
  };

  const onPhaseSubmit = (values: PhaseForm) => {
    const dto: CreatePhaseDto = { ...values };
    if (editingPhase) {
      updatePhaseMut.mutate({ id: editingPhase.id, dto });
    } else {
      createPhaseMut.mutate(dto);
    }
  };

  // ── Task mutations ───────────────────────────────────────────────────────

  const taskForm = useForm<TaskForm>({ resolver: zodResolver(taskSchema) });

  // Pick the right ticket API for attachment uploads
  const ticketAttApi = isAdmin ? adminTicketsApi : isClient ? clientTicketsApi : projectTicketsApi;

  const createTaskMut = useMutation({
    mutationFn: (dto: CreateTaskDto) => planApi.createTask(projectId, dto),
    onSuccess: async (res: any) => {
      // Upload attachments if any
      const newTaskId = res?.data?.data?.id ?? res?.data?.id;
      if (newTaskId && taskFiles.length > 0 && ticketAttApi.uploadAttachment) {
        for (const f of taskFiles) {
          try { await ticketAttApi.uploadAttachment(newTaskId, f); } catch { /* ignore individual upload errors */ }
        }
        setTaskFiles([]);
      }
      await qc.refetchQueries({ queryKey: ['planning-tasks', projectId] });
      await qc.refetchQueries({ queryKey: ['planning-summary', projectId] });
      qc.invalidateQueries({ queryKey: ['task-history'] });
      toast.success('Task created');
      setTaskOpen(false);
      taskForm.reset();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const updateTaskMut = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: UpdateTaskDto }) =>
      planApi.updateTask(projectId, id, dto),
    onSuccess: async () => {
      await qc.refetchQueries({ queryKey: ['planning-tasks', projectId] });
      await qc.refetchQueries({ queryKey: ['planning-summary', projectId] });
      qc.invalidateQueries({ queryKey: ['task-history'] });
      toast.success('Task updated');
      setTaskOpen(false);
      setEditingTask(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const deleteTaskMut = useMutation({
    mutationFn: (taskId: number) => planApi.deleteTask(projectId, taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning-tasks', projectId] });
      qc.invalidateQueries({ queryKey: ['planning-summary', projectId] });
      toast.success('Task deleted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const openCreateTask = () => {
    router.push(`/projects/${projectId}/planning/new-task`);
  };

  // ── Excel import handler ──────────────────────────────────────────────
  const handleExcelImport = async (file: File) => {
    setExcelImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

      if (rawRows.length === 0) {
        toast.error('Excel file is empty or has no data rows');
        setExcelImporting(false);
        return;
      }

      // Map Excel columns to API fields (case-insensitive header matching)
      const rows = rawRows.map((r) => {
        const get = (keys: string[]) => {
          for (const k of keys) {
            const match = Object.keys(r).find((h) => h.toLowerCase().trim() === k.toLowerCase());
            if (match && r[match] !== '') return r[match];
          }
          return undefined;
        };
        const dueRaw = get(['due date', 'duedate', 'due_date', 'deadline']);
        let dueDate: string | undefined;
        if (dueRaw instanceof Date) dueDate = dueRaw.toISOString().split('T')[0];
        else if (typeof dueRaw === 'string' && dueRaw) dueDate = dueRaw;
        else if (typeof dueRaw === 'number') {
          // Excel serial date
          const d = new Date((dueRaw - 25569) * 86400 * 1000);
          if (!isNaN(d.getTime())) dueDate = d.toISOString().split('T')[0];
        }

        const estRaw = get(['estimated hours', 'estimatedhours', 'estimated_hours', 'est. hours', 'hours']);
        return {
          title: String(get(['title', 'task', 'task name', 'name']) ?? '').trim(),
          description: String(get(['description', 'desc', 'details']) ?? '').trim() || undefined,
          status: String(get(['status']) ?? '').trim() || undefined,
          priority: String(get(['priority']) ?? '').trim() || undefined,
          phase: String(get(['phase']) ?? '').trim() || undefined,
          dueDate,
          estimatedHours: estRaw ? Number(estRaw) : undefined,
        };
      }).filter((r) => r.title);

      if (rows.length === 0) {
        toast.error('No valid rows found. Make sure the "Title" column has data.');
        setExcelImporting(false);
        return;
      }

      const resp = await (planApi as any).bulkCreateTasks(projectId, rows);
      const results = resp.data?.data ?? resp.data ?? [];
      setExcelResults(Array.isArray(results) ? results : []);
      qc.invalidateQueries({ queryKey: ['project-tasks'] });
      qc.invalidateQueries({ queryKey: ['project-tickets-all'] });

      const successCount = (Array.isArray(results) ? results : []).filter((r: any) => r.success).length;
      toast.success(`${successCount}/${rows.length} tasks created`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to import Excel');
    } finally {
      setExcelImporting(false);
    }
  };

  const openEditTask = (t: ProjectTask) => {
    setEditingTask(t);
    taskForm.reset({
      title: t.title,
      description: t.description ?? '',
      phaseId: t.phaseId ? String(t.phaseId) : '__none__',
      assigneeId: t.assigneeId ? String(t.assigneeId) : '__none__',
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate ?? '',
      estimatedHours: t.estimatedHours ? String(t.estimatedHours) : '',
    });
    setTaskOpen(true);
  };

  const onTaskSubmit = (values: TaskForm) => {
    const dto: CreateTaskDto = {
      title: values.title,
      description: values.description || undefined,
      phaseId: values.phaseId && values.phaseId !== '__none__' ? Number(values.phaseId) : undefined,
      assigneeId: values.assigneeId && values.assigneeId !== '__none__' ? Number(values.assigneeId) : undefined,
      priority: values.priority as TaskPriority,
      status: values.status as ProjectTaskStatus,
      dueDate: values.dueDate || undefined,
      estimatedHours: values.estimatedHours ? Number(values.estimatedHours) : undefined,
    };
    if (editingTask) {
      updateTaskMut.mutate({ id: editingTask.id, dto });
    } else {
      createTaskMut.mutate(dto);
    }
  };

  // ── Task detail + comments ───────────────────────────────────────────────

  const { data: taskDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['task-detail', detailTask?.id],
    queryFn: () => planApi.getTask(projectId, detailTask!.id).then((r) => r.data.data),
    enabled: !!detailTask,
  });

  const addCommentMut = useMutation({
    mutationFn: (content: string) =>
      planApi.addComment(projectId, detailTask!.id, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-detail', detailTask?.id] });
      setCommentText('');
      toast.success('Comment added');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  // ── Detail: Status change ──
  const [detailReassignValue, setDetailReassignValue] = useState('');
  const detailAttachRef = useRef<HTMLInputElement>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';

  const updateDetailStatusMut = useMutation({
    mutationFn: ({ taskId, status }: { taskId: number; status: string }) =>
      ticketAttApi.updateStatus(taskId, status as ProjectTaskStatus),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-detail', detailTask?.id] });
      qc.invalidateQueries({ queryKey: ['planning-tasks', projectId] });
      qc.invalidateQueries({ queryKey: ['planning-summary', projectId] });
      toast.success('Status updated');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const reassignDetailMut = useMutation({
    mutationFn: ({ taskId, target }: { taskId: number; target: string }) => {
      const [type, ...rest] = target.split('-');
      const id = Number(rest.join('-'));
      if (type === 'client' && ticketAttApi.reassignAny) return ticketAttApi.reassignAny(taskId, { clientId: id });
      if (type === 'admin' && ticketAttApi.reassignAny) return ticketAttApi.reassignAny(taskId, { adminId: id });
      if (ticketAttApi.reassignAny) return ticketAttApi.reassignAny(taskId, { employeeId: id });
      return ticketAttApi.reassign(taskId, id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-detail', detailTask?.id] });
      qc.invalidateQueries({ queryKey: ['planning-tasks', projectId] });
      toast.success('Reassigned');
      setDetailReassignValue('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  // Detail attachments
  const { data: detailAttachments } = useQuery({
    queryKey: ['task-attachments-plan', detailTask?.id],
    queryFn: () => ticketAttApi.getAttachments!(detailTask!.id).then((r: any) => r.data?.data ?? r.data ?? []),
    enabled: !!detailTask && detailOpen && !!ticketAttApi.getAttachments,
  });

  const uploadDetailAttMut = useMutation({
    mutationFn: (file: File) => ticketAttApi.uploadAttachment!(detailTask!.id, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-attachments-plan', detailTask?.id] });
      toast.success('File uploaded');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Upload failed'),
  });

  const deleteDetailAttMut = useMutation({
    mutationFn: (attId: number) => ticketAttApi.deleteAttachment!(detailTask!.id, attId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-attachments-plan', detailTask?.id] });
      toast.success('Deleted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  // Reassign options for detail dialog
  const reassignOpts = (() => {
    const all = employees ?? [];
    const deduped = all.filter((e: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === e.id && x._type === e._type) === i);
    const empOpts = deduped.filter((e: any) => !e._type || e._type === 'employee').map((e: any) => ({ value: `emp-${e.id}`, label: e.empName }));
    const adminOpts = deduped.filter((e: any) => e._type === 'admin').map((a: any) => ({ value: `admin-${a.id}`, label: `${a.empName} (Admin)` }));
    const clientOpts = deduped.filter((e: any) => e._type === 'client').map((c: any) => ({ value: `client-${c.id}`, label: `${c.empName} (Client)` }));
    return [...empOpts, ...adminOpts, ...clientOpts];
  })();

  // ── Task history ────────────────────────────────────────────────────
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['task-history', historyTaskId],
    queryFn: () => planApi.getHistory(projectId, historyTaskId!).then((r) => r.data.data),
    enabled: !!historyTaskId && historyOpen,
  });

  const openDetail = (t: ProjectTask) => {
    setDetailTask(t);
    setDetailOpen(true);
    setCommentText('');
  };

  // ── Toggle phase ─────────────────────────────────────────────────────────

  const togglePhase = (phaseId: number) => {
    setExpandedPhases((prev) => ({ ...prev, [phaseId]: prev[phaseId] === undefined ? false : !prev[phaseId] }));
  };

  const isPhaseExpanded = (phaseId: number) => expandedPhases[phaseId] !== false;

  const isLoading = phasesLoading || tasksLoading;
  const isPhasePending = createPhaseMut.isPending || updatePhaseMut.isPending;
  const isTaskPending = createTaskMut.isPending || updateTaskMut.isPending;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Gradient Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-violet-600 via-purple-600 to-fuchsia-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoNnptMC0zMHY2aC02VjRoNnptMCAzMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shrink-0">
              <Target className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-white truncate">
                {project?.projectName ?? 'Project'} — Planning
              </h1>
              <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-white/60 flex-wrap">
                <span className="hidden sm:inline">Project planning & tasks</span>
                {summary && (
                  <>
                    <span>{summary.totalTasks} tasks</span>
                    <span>{summary.doneTasks} done</span>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-24 rounded-full bg-white/20">
                        <div
                          className="h-1.5 rounded-full bg-white transition-all"
                          style={{ width: `${summary.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-white">{summary.progress}%</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-1.5 sm:gap-2 flex-wrap">
            {!isClient && phaseList.length === 0 && (
              <Button
                size="sm"
                onClick={() => quickSetupMut.mutate()}
                disabled={quickSetupMut.isPending}
                className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-0 text-xs sm:text-sm"
              >
                {quickSetupMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5" /> : <Zap className="h-3.5 w-3.5 sm:mr-1.5" />}
                <span className="hidden sm:inline">Quick Setup</span>
              </Button>
            )}
            {!isClient && (
              <Button size="sm" className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-0 text-xs sm:text-sm" onClick={openCreatePhase}>
                <Plus className="h-3.5 w-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Phase</span>
              </Button>
            )}
            {!isClient && (
              <>
                <Button
                  size="sm"
                  className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-0 text-xs sm:text-sm"
                  onClick={() => excelInputRef.current?.click()}
                  disabled={excelImporting}
                >
                  {excelImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5" /> : <FileText className="h-3.5 w-3.5 sm:mr-1.5" />}
                  <span className="hidden sm:inline">Import Excel</span>
                </Button>
                <input
                  ref={excelInputRef}
                  type="file"
                  className="hidden"
                  accept=".xls,.xlsx,.csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleExcelImport(f);
                    e.target.value = '';
                  }}
                />
              </>
            )}
            <Button
              size="sm"
              className="bg-white text-violet-700 hover:bg-white/90 border-0 shadow-lg font-semibold text-xs sm:text-sm"
              onClick={() => openCreateTask()}
            >
              <Plus className="h-3.5 w-3.5 sm:mr-1.5" /> <span className="hidden xs:inline">Task</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-28 sm:w-36 text-xs sm:text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="in_review">In Review</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-28 sm:w-36 text-xs sm:text-sm">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {/* Phase sections */}
          {phaseList.map((phase) => {
            const phaseTasks = tasksByPhase[phase.id] ?? [];
            const expanded = isPhaseExpanded(phase.id);
            return (
              <div key={phase.id} className="rounded-lg border bg-card overflow-hidden shadow-sm">
                <div className="h-1.5 bg-linear-to-r from-violet-500 via-purple-500 to-fuchsia-500" />
                <div
                  className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 cursor-pointer hover:bg-accent/50 transition-colors gap-2"
                  onClick={() => togglePhase(phase.id)}
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0">
                      <span className="font-medium text-foreground text-sm sm:text-base truncate block">{phase.name}</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] sm:text-xs text-muted-foreground">({phaseTasks.length} tasks)</span>
                        <span className={`rounded-full px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium ${phaseStatusColors[phase.status]}`}>
                          {phaseStatusLabels[phase.status]}
                        </span>
                        {phase.startDate && (
                          <span className="text-[10px] text-muted-foreground hidden sm:inline">
                            {phase.startDate} — {phase.endDate ?? '...'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCreateTask()}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    {!isClient && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditPhase(phase)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-600"
                          onClick={() => { if (confirm(`Delete phase "${phase.name}"?`)) deletePhaseMut.mutate(phase.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {expanded && (
                  <TaskTable tasks={phaseTasks} onEdit={openEditTask} onDelete={(t) => { if (confirm(`Delete "${t.title}"?`)) deleteTaskMut.mutate(t.id); }} onDetail={openDetail} />
                )}
              </div>
            );
          })}

          {/* Unphased tasks */}
          {tasksByPhase.none.length > 0 && (
            <div className="rounded-lg border bg-card overflow-hidden shadow-sm">
              <div className="h-1.5 bg-linear-to-r from-slate-400 via-slate-500 to-slate-600" />
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setUnphasedExpanded(!unphasedExpanded)}
              >
                <div className="flex items-center gap-3">
                  {unphasedExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium text-foreground">Unphased Tasks</span>
                  <span className="text-xs text-muted-foreground">({tasksByPhase.none.length} tasks)</span>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openCreateTask(); }}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {unphasedExpanded && (
                <TaskTable tasks={tasksByPhase.none} onEdit={openEditTask} onDelete={(t) => { if (confirm(`Delete "${t.title}"?`)) deleteTaskMut.mutate(t.id); }} onDetail={openDetail} />
              )}
            </div>
          )}

          {/* Empty state */}
          {phaseList.length === 0 && tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Target className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-lg font-medium text-muted-foreground">No planning yet</p>
              <p className="text-sm text-muted-foreground/60">Create phases and tasks to plan this project.</p>
            </div>
          )}
        </>
      )}

      {/* ── Phase Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={phaseOpen} onOpenChange={setPhaseOpen}>
        <DialogContent className="max-w-md overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-violet-500 via-purple-500 to-fuchsia-500" />
          <DialogHeader>
            <DialogTitle>{editingPhase ? 'Edit Phase' : 'New Phase'}</DialogTitle>
          </DialogHeader>
          <Form {...phaseForm}>
            <form onSubmit={phaseForm.handleSubmit(onPhaseSubmit)} className="space-y-3">
              <FormField control={phaseForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phase Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={phaseForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={phaseForm.control} name="startDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={phaseForm.control} name="endDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={phaseForm.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="not_started">Not Started</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPhaseOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isPhasePending}>
                  {isPhasePending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingPhase ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Task Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent className="max-w-lg overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-violet-500 via-purple-500 to-fuchsia-500" />
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'New Task'}</DialogTitle>
          </DialogHeader>
          <Form {...taskForm}>
            <form onSubmit={taskForm.handleSubmit(onTaskSubmit)} className="space-y-3">
              <FormField control={taskForm.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={taskForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {!isClient && (
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={taskForm.control} name="phaseId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phase</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="None" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {phaseList.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={taskForm.control} name="assigneeId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assignee</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Unassigned" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">Unassigned</SelectItem>
                          {employeeList.map((e: Employee) => (
                            <SelectItem key={e.id} value={String(e.id)}>{e.empName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <FormField control={taskForm.control} name="priority" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={taskForm.control} name="dueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              {!isClient && (
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={taskForm.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="in_review">In Review</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={taskForm.control} name="estimatedHours" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Est. Hours</FormLabel>
                      <FormControl><Input type="number" step="0.5" min="0" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              )}
              {/* ── Attachments (create mode only) ── */}
              {!editingTask && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Attachments</label>
                  <input
                    ref={taskFileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv"
                    onChange={(e) => {
                      if (e.target.files) setTaskFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                      e.target.value = '';
                    }}
                  />
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {taskFiles.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-md bg-violet-500/10 px-2 py-1 text-xs text-violet-700 dark:text-violet-300">
                        <Paperclip className="h-3 w-3" />
                        {f.name.length > 25 ? f.name.slice(0, 22) + '...' : f.name}
                        <button type="button" onClick={() => setTaskFiles((prev) => prev.filter((_, j) => j !== i))}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => taskFileInputRef.current?.click()}
                  >
                    <Paperclip className="h-3 w-3 mr-1" /> Add Files
                  </Button>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTaskOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isTaskPending}>
                  {isTaskPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingTask ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Task Detail Dialog ─────────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={(v) => { setDetailOpen(v); if (!v) { setDetailTask(null); setDetailReassignValue(''); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden gap-0 p-0">
          <DialogTitle className="sr-only">Task Detail</DialogTitle>
          {/* Gradient header */}
          <div className="bg-linear-to-r from-violet-600 via-purple-600 to-indigo-600 px-5 py-4 text-white rounded-t-lg">
            {detailLoading ? (
              <Skeleton className="h-6 w-3/4 bg-white/20" />
            ) : taskDetail ? (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {taskDetail.ticketNumber && (
                    <span className="text-xs font-mono font-semibold bg-white/20 px-2 py-0.5 rounded">{taskDetail.ticketNumber}</span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium bg-white/20`}>{statusLabels[taskDetail.status]}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium bg-white/20`}>{priorityLabels[taskDetail.priority]}</span>
                </div>
                <h2 className="text-lg font-bold">{taskDetail.title}</h2>
              </div>
            ) : null}
          </div>

          {detailLoading ? (
            <div className="p-5 space-y-3"><Skeleton className="h-20 w-full" /></div>
          ) : taskDetail ? (
            <>
              <div className="space-y-4 flex-1 overflow-y-auto min-h-0 p-5">
                {taskDetail.description && (
                  <p className="text-sm text-muted-foreground">{taskDetail.description}</p>
                )}

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1"><User className="h-3 w-3" /> Assignee</p>
                    <p className="text-sm font-medium truncate">{taskDetail.assignee?.empName ?? (taskDetail as any).assignedAdmin?.name ?? (taskDetail as any).assignedClient?.fullName ?? 'Unassigned'}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1"><Calendar className="h-3 w-3" /> Due Date</p>
                    <p className="text-sm font-medium">{taskDetail.dueDate ? new Date(taskDetail.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—'}</p>
                  </div>
                  {taskDetail.estimatedHours && (
                    <div className="rounded-lg border p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1"><Clock className="h-3 w-3" /> Est. Hours</p>
                      <p className="text-sm font-medium">{taskDetail.estimatedHours}h</p>
                    </div>
                  )}
                  {taskDetail.phase && (
                    <div className="rounded-lg border p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1"><Target className="h-3 w-3" /> Phase</p>
                      <p className="text-sm font-medium">{taskDetail.phase.name}</p>
                    </div>
                  )}
                </div>

                {/* Status + Reassign (admin & employee only) */}
                {!isClient && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Change Status</label>
                      <Select
                        value={taskDetail.status}
                        onValueChange={(v) => updateDetailStatusMut.mutate({ taskId: taskDetail.id, status: v })}
                      >
                        <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="in_review">In Review</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Reassign</label>
                      <SearchableSelect
                        options={reassignOpts}
                        value={detailReassignValue}
                        onValueChange={(v) => {
                          setDetailReassignValue(v);
                          reassignDetailMut.mutate({ taskId: taskDetail.id, target: v });
                        }}
                        placeholder="Select..."
                      />
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setHistoryTaskId(taskDetail.id); setHistoryOpen(true); }}>
                    <History className="h-3.5 w-3.5 mr-1.5" /> View History
                  </Button>
                </div>

                {/* Attachments */}
                {'getAttachments' in ticketAttApi && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Paperclip className="h-3.5 w-3.5" /> Attachments ({(detailAttachments as any[])?.length ?? 0})
                      </h4>
                      <div>
                        <input ref={detailAttachRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDetailAttMut.mutate(f); e.target.value = ''; }} />
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => detailAttachRef.current?.click()} disabled={uploadDetailAttMut.isPending}>
                          {uploadDetailAttMut.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Paperclip className="h-3 w-3 mr-1" />} Upload
                        </Button>
                      </div>
                    </div>
                    {(detailAttachments as any[])?.length > 0 ? (
                      <div className="space-y-1.5">
                        {(detailAttachments as any[]).map((att: any) => {
                          const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(att.originalName);
                          return (
                            <div key={att.id} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                              {isImg ? <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" /> : <FileText className="h-4 w-4 text-violet-500 shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <a href={`${apiBase}${att.filePath}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium hover:text-violet-600 truncate block">{att.originalName}</a>
                                <p className="text-[10px] text-muted-foreground">{(att.fileSize / 1024).toFixed(1)} KB · {att.uploadedByName}</p>
                              </div>
                              <a href={`${apiBase}${att.filePath}`} download={att.originalName} className="shrink-0 text-muted-foreground hover:text-foreground"><Download className="h-3.5 w-3.5" /></a>
                              {!isClient && (
                                <button className="shrink-0 text-muted-foreground hover:text-red-500" onClick={() => { if (confirm('Delete?')) deleteDetailAttMut.mutate(att.id); }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-2">No attachments yet.</p>
                    )}
                  </div>
                )}

                {/* Comments */}
                <div className="border-t pt-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" /> Comments ({taskDetail.comments?.length ?? 0})
                  </h4>
                  {(taskDetail.comments ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">No comments yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {[...(taskDetail.comments ?? [])].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((c: ProjectTaskComment) => (
                        <div key={c.id} className="rounded-lg border p-2.5 text-sm">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium">{(c as any).authorName ?? c.authorType}</span>
                            <Badge variant="outline" className="text-[10px] capitalize">{c.authorType}</Badge>
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {new Date(c.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' })}
                            </span>
                          </div>
                          <p className="text-foreground text-sm">{c.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Fixed comment input */}
              <div className="border-t px-5 py-3 shrink-0">
                <div className="flex flex-col gap-2">
                  <Textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    rows={2}
                  />
                  <Button
                    className="w-full bg-linear-to-r from-violet-500 to-purple-600 text-white hover:opacity-90 border-0"
                    disabled={!commentText.trim() || addCommentMut.isPending}
                    onClick={() => addCommentMut.mutate(commentText.trim())}
                  >
                    {addCommentMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <MessageSquare className="h-4 w-4 mr-1.5" />}
                    Add Comment
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── History Dialog ────────────────────────────────────────────── */}
      <Dialog open={historyOpen} onOpenChange={(open) => { if (!open) { setHistoryOpen(false); setHistoryTaskId(null); } }}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-violet-500" />
              Ticket History
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 pr-1">
            {historyLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : !historyData?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">No history recorded yet.</p>
            ) : (
              <div className="relative pl-6">
                <div className="absolute left-2.5 top-2 bottom-2 w-px bg-border" />
                {(historyData ?? []).map((h: ProjectTaskHistory) => (
                  <div key={h.id} className="relative mb-4 last:mb-0">
                    <div className={`absolute -left-3.5 top-1.5 h-3 w-3 rounded-full border-2 border-background ${
                      h.action === 'created' ? 'bg-emerald-500' :
                      h.action === 'closed' ? 'bg-purple-500' :
                      h.action === 'assigned' || h.action === 'reassigned' ? 'bg-blue-500' :
                      h.action === 'status_changed' ? 'bg-amber-500' :
                      h.action === 'priority_changed' ? 'bg-orange-500' :
                      'bg-slate-400'
                    }`} />
                    <div className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold capitalize">
                          {h.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {new Date(h.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{h.details}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        by <span className="font-medium text-foreground">{h.performedByName}</span>
                        <span className="ml-1 capitalize">({h.performedByType})</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Excel Import Results Dialog ──────────────────────────────── */}
      <Dialog open={!!excelResults} onOpenChange={(open) => { if (!open) setExcelResults(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-violet-600" />
              Excel Import Results
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            {excelResults?.filter((r) => r.success).length ?? 0} of {excelResults?.length ?? 0} tasks created successfully
          </p>
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-left">
                  <th className="py-2 pr-2 w-8 text-xs text-muted-foreground">#</th>
                  <th className="py-2 pr-2 text-xs text-muted-foreground">Ticket</th>
                  <th className="py-2 pr-2 text-xs text-muted-foreground">Title</th>
                  <th className="py-2 w-8 text-xs text-muted-foreground text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {(excelResults ?? []).map((r) => (
                  <tr key={r.index} className="border-b last:border-0">
                    <td className="py-2 pr-2 text-xs text-muted-foreground">{r.index}</td>
                    <td className="py-2 pr-2">
                      {r.ticketNumber ? (
                        <button
                          onClick={() => { setExcelResults(null); router.push(`/full-tickets/${r.taskId}`); }}
                          className="text-xs font-mono font-semibold text-violet-600 hover:underline"
                        >
                          {r.ticketNumber}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-sm truncate max-w-[200px]">{r.title}</td>
                    <td className="py-2 text-center">
                      {r.success ? (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
                          <svg className="h-3 w-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      ) : (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/15" title={r.error}>
                          <X className="h-3 w-3 text-red-600" />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end pt-3 border-t">
            <Button onClick={() => setExcelResults(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── TaskTable sub-component ──────────────────────────────────────────────────

function TaskTable({
  tasks,
  onEdit,
  onDelete,
  onDetail,
}: {
  tasks: ProjectTask[];
  onEdit: (t: ProjectTask) => void;
  onDelete: (t: ProjectTask) => void;
  onDetail: (t: ProjectTask) => void;
}) {
  if (tasks.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-muted-foreground">No tasks in this section.</div>
    );
  }

  return (
    <>
      {/* Mobile: card layout */}
      <div className="md:hidden space-y-2 p-3">
        {tasks.map((t) => (
          <div
            key={t.id}
            className="rounded-lg border p-3 cursor-pointer hover:ring-1 hover:ring-violet-500/30 transition-all"
            onClick={() => onDetail(t)}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="min-w-0">
                <span className="text-[10px] font-mono font-semibold text-violet-600 dark:text-violet-400">{t.ticketNumber ?? '—'}</span>
                <p className="text-sm font-semibold truncate">{t.title}</p>
              </div>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${priorityColors[t.priority]}`}>
                {priorityLabels[t.priority]}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusColors[t.status]}`}>{statusLabels[t.status]}</span>
              <span>{t.assignee?.empName ?? 'Unassigned'}</span>
              {t.dueDate && <span>{t.dueDate}</span>}
            </div>
            <div className="flex gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => onEdit(t)}>
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-red-500" onClick={() => onDelete(t)}>
                <Trash2 className="h-3 w-3 mr-1" /> Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table layout */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((t) => (
              <TableRow key={t.id} className="cursor-pointer hover:bg-accent/50" onClick={() => onDetail(t)}>
                <TableCell className="text-xs font-mono text-violet-600 dark:text-violet-400 whitespace-nowrap">{t.ticketNumber ?? '—'}</TableCell>
                <TableCell className="font-medium">{t.title}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {t.assignee?.empName ?? t.assignedAdmin?.name ?? <span className="italic text-muted-foreground/50">Unassigned</span>}
                </TableCell>
                <TableCell>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[t.priority]}`}>
                    {priorityLabels[t.priority]}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[t.status]}`}>
                    {statusLabels[t.status]}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{t.dueDate ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => onDelete(t)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
