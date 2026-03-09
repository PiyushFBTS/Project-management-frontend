/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronRight,
  MessageSquare, Calendar, Clock, User, Target, Zap, History,
} from 'lucide-react';
import { projectPlanningApi } from '@/lib/api/project-planning';
import { projectsApi } from '@/lib/api/projects';
import { employeesApi } from '@/lib/api/employees';
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
  const qc = useQueryClient();

  // Dialogs
  const [phaseOpen, setPhaseOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<ProjectPhase | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [defaultPhaseId, setDefaultPhaseId] = useState<number | undefined>();
  const [detailTask, setDetailTask] = useState<ProjectTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [commentText, setCommentText] = useState('');

  // History dialog
  const [historyTaskId, setHistoryTaskId] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Collapsible phases
  const [expandedPhases, setExpandedPhases] = useState<Record<number, boolean>>({});
  const [unphasedExpanded, setUnphasedExpanded] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getOne(projectId).then((r) => r.data.data),
  });

  const { data: summary } = useQuery({
    queryKey: ['planning-summary', projectId],
    queryFn: () => projectPlanningApi.getSummary(projectId).then((r) => r.data.data),
  });

  const { data: phases, isLoading: phasesLoading } = useQuery({
    queryKey: ['planning-phases', projectId],
    queryFn: () => projectPlanningApi.getPhases(projectId).then((r) => r.data.data),
  });

  const { data: tasksData, isLoading: tasksLoading, error: tasksError } = useQuery({
    queryKey: ['planning-tasks', projectId, statusFilter, priorityFilter],
    queryFn: async () => {
      const r = await projectPlanningApi.getTasks(projectId, {
        limit: 100,
        ...(statusFilter !== 'all' ? { status: statusFilter as ProjectTaskStatus } : {}),
        ...(priorityFilter !== 'all' ? { priority: priorityFilter as TaskPriority } : {}),
      });
      const d: any = r.data?.data;
      return (Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []) as ProjectTask[];
    },
  });

  const { data: employees, error: employeesError } = useQuery({
    queryKey: ['all-employees'],
    queryFn: async () => {
      const r = await employeesApi.getAll({ isActive: true, limit: 100 });
      const d: any = r.data?.data;
      return (Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []) as Employee[];
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
    mutationFn: (dto: CreatePhaseDto) => projectPlanningApi.createPhase(projectId, dto),
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
      projectPlanningApi.updatePhase(projectId, id, dto),
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
    mutationFn: (phaseId: number) => projectPlanningApi.deletePhase(projectId, phaseId),
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
        await projectPlanningApi.createPhase(projectId, { ...phase, status: 'not_started' });
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

  const createTaskMut = useMutation({
    mutationFn: (dto: CreateTaskDto) => projectPlanningApi.createTask(projectId, dto),
    onSuccess: async () => {
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
      projectPlanningApi.updateTask(projectId, id, dto),
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
    mutationFn: (taskId: number) => projectPlanningApi.deleteTask(projectId, taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning-tasks', projectId] });
      qc.invalidateQueries({ queryKey: ['planning-summary', projectId] });
      toast.success('Task deleted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const openCreateTask = (phaseId?: number) => {
    setEditingTask(null);
    setDefaultPhaseId(phaseId);
    taskForm.reset({
      title: '',
      description: '',
      priority: 'medium',
      status: 'todo',
      phaseId: phaseId ? String(phaseId) : '__none__',
      assigneeId: '__none__',
      dueDate: '',
      estimatedHours: '',
    });
    setTaskOpen(true);
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
    queryFn: () => projectPlanningApi.getTask(projectId, detailTask!.id).then((r) => r.data.data),
    enabled: !!detailTask,
  });

  const addCommentMut = useMutation({
    mutationFn: (content: string) =>
      projectPlanningApi.addComment(projectId, detailTask!.id, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-detail', detailTask?.id] });
      setCommentText('');
      toast.success('Comment added');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  // ── Task history ────────────────────────────────────────────────────
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['task-history', historyTaskId],
    queryFn: () => projectPlanningApi.getHistory(projectId, historyTaskId!).then((r) => r.data.data),
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
        <div className="relative px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Target className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                {project?.projectName ?? 'Project'} — Planning
              </h1>
              <div className="flex items-center gap-3 text-sm text-white/60">
                <span>Project planning & tasks</span>
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
          <div className="flex gap-2">
            {phaseList.length === 0 && (
              <Button
                size="sm"
                onClick={() => quickSetupMut.mutate()}
                disabled={quickSetupMut.isPending}
                className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-0"
              >
                {quickSetupMut.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Zap className="mr-1.5 h-4 w-4" />}
                Quick Setup
              </Button>
            )}
            <Button size="sm" className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-0" onClick={openCreatePhase}>
              <Plus className="mr-1.5 h-4 w-4" /> Phase
            </Button>
            <Button
              size="sm"
              className="bg-white text-violet-700 hover:bg-white/90 border-0 shadow-lg font-semibold"
              onClick={() => openCreateTask()}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Task
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
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
          <SelectTrigger className="w-36">
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
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => togglePhase(phase.id)}
                >
                  <div className="flex items-center gap-3">
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <span className="font-medium text-foreground">{phase.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">({phaseTasks.length} tasks)</span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${phaseStatusColors[phase.status]}`}>
                      {phaseStatusLabels[phase.status]}
                    </span>
                    {phase.startDate && (
                      <span className="text-xs text-muted-foreground">
                        {phase.startDate} — {phase.endDate ?? '...'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCreateTask(phase.id)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
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
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={taskForm.control} name="dueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
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
      <Dialog open={detailOpen} onOpenChange={(v) => { setDetailOpen(v); if (!v) setDetailTask(null); }}>
        <DialogContent className="max-w-xl flex flex-col max-h-[80vh] overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-violet-500 via-purple-500 to-fuchsia-500" />
          <DialogHeader>
            <DialogTitle>Task Detail</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : taskDetail ? (
            <>
              {/* Scrollable content */}
              <div className="space-y-4 flex-1 overflow-y-auto min-h-0 pr-1">
                <div>
                  <div className="flex items-center gap-2">
                    {taskDetail.ticketNumber && (
                      <span className="text-xs font-mono font-semibold text-violet-600 dark:text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded">{taskDetail.ticketNumber}</span>
                    )}
                    <h3 className="text-lg font-semibold">{taskDetail.title}</h3>
                  </div>
                  {taskDetail.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{taskDetail.description}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[taskDetail.status]}`}>
                    {statusLabels[taskDetail.status]}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[taskDetail.priority]}`}>
                    {priorityLabels[taskDetail.priority]}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    {taskDetail.status === 'closed' && taskDetail.assignedAdmin?.name
                      ? `Admin: ${taskDetail.assignedAdmin.name}`
                      : taskDetail.assignee?.empName ?? 'Unassigned'}
                  </div>
                  {taskDetail.dueDate && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {taskDetail.dueDate}
                    </div>
                  )}
                  {taskDetail.estimatedHours && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {taskDetail.estimatedHours}h estimated
                    </div>
                  )}
                  {taskDetail.phase && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Target className="h-3.5 w-3.5" />
                      {taskDetail.phase.name}
                    </div>
                  )}
                </div>

                {/* Comments list */}
                {/* History button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => { setHistoryTaskId(taskDetail.id); setHistoryOpen(true); }}
                >
                  <History className="h-4 w-4 mr-1.5" />
                  View History
                </Button>

                <div className="border-t pt-3">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4" />
                    Comments ({taskDetail.comments?.length ?? 0})
                  </h4>
                  <div className="space-y-2">
                    {(taskDetail.comments ?? []).map((c: ProjectTaskComment) => (
                      <div key={c.id} className="rounded-md border p-2.5 text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-foreground">{(c as any).authorName ?? c.authorType}</span>
                          <Badge variant="outline" className="text-[10px] capitalize">{c.authorType}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(c.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-foreground">{c.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Fixed comment input at bottom */}
              <div className="border-t pt-3 flex gap-2 shrink-0">
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  rows={2}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  className="self-end"
                  disabled={!commentText.trim() || addCommentMut.isPending}
                  onClick={() => addCommentMut.mutate(commentText.trim())}
                >
                  {addCommentMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
                </Button>
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
              {t.status === 'closed' && t.assignedAdmin?.name
                ? `Admin: ${t.assignedAdmin.name}`
                : t.assignee?.empName ?? <span className="italic text-muted-foreground/50">Unassigned</span>}
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
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-red-500 hover:text-red-600"
                  onClick={() => onDelete(t)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
