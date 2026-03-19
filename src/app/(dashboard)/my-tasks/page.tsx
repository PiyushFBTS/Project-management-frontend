/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2, MessageSquare, Calendar, Clock, User, Target, ListTodo, Search, X, FolderKanban, UserRoundPlus, History,
} from 'lucide-react';
import { myTasksApi } from '@/lib/api/project-planning';
import { employeesApi } from '@/lib/api/employees';
import { taskSheetsApi } from '@/lib/api/task-sheets';
import {
  ProjectTask, ProjectTaskComment, ProjectTaskHistory, ProjectTaskStatus, TaskPriority,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { MentionTextarea, MentionEmployee, renderMentions, buildMentionContent } from '@/components/ui/mention-textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCommentTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' });
}

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

const statusLabels: Record<string, string> = {
  todo: 'To Do', in_progress: 'In Progress', in_review: 'In Review', done: 'Done', closed: 'Closed',
};
const priorityLabels: Record<string, string> = {
  low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical',
};

export default function MyTasksPage() {
  const qc = useQueryClient();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');

  // Search
  const [search, setSearch] = useState('');

  // Projects dropdown
  const { data: projectsList } = useQuery({
    queryKey: ['employee-projects'],
    queryFn: () => taskSheetsApi.getProjects().then((r) => r.data.data),
  });

  // Detail dialog
  const [detailTask, setDetailTask] = useState<ProjectTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [taggedMentions, setTaggedMentions] = useState<MentionEmployee[]>([]);
  const [reassignTo, setReassignTo] = useState<string>('');


  // History dialog
  const [historyTaskId, setHistoryTaskId] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // ── Query ────────────────────────────────────────────────────────────────

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['my-tasks', search, statusFilter, priorityFilter, projectFilter],
    queryFn: async (): Promise<ProjectTask[]> => {
      const r = await myTasksApi.getAll({
        limit: 100,
        ...(search ? { search } : {}),
        ...(statusFilter !== 'all' ? { status: statusFilter as ProjectTaskStatus } : {}),
        ...(priorityFilter !== 'all' ? { priority: priorityFilter as TaskPriority } : {}),
        ...(projectFilter !== 'all' ? { projectId: Number(projectFilter) } : {}),
      });
      const body = r.data;
      if (Array.isArray(body?.data)) return body.data;
      if (Array.isArray((body?.data as any)?.data)) return (body.data as any).data;
      return [];
    },
  });

  const tasks = tasksData ?? [];

  // ── Inline status update ─────────────────────────────────────────────────

  const updateStatusMut = useMutation({
    mutationFn: ({ taskId, status }: { taskId: number; status: ProjectTaskStatus }) =>
      myTasksApi.updateStatus(taskId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['my-task-detail', detailTask?.id] });
      qc.invalidateQueries({ queryKey: ['task-history'] });
      toast.success('Status updated');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update status'),
  });

  const handleStatusChange = (taskId: number, newStatus: string) => {
    updateStatusMut.mutate({ taskId, status: newStatus as ProjectTaskStatus });
  };

  // ── Task detail ──────────────────────────────────────────────────────────

  const { data: taskDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['my-task-detail', detailTask?.id],
    queryFn: () => myTasksApi.getOne(detailTask!.id).then((r) => r.data.data),
    enabled: !!detailTask,
  });

  const addCommentMut = useMutation({
    mutationFn: (content: string) => myTasksApi.addComment(detailTask!.id, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-task-detail', detailTask?.id] });
      setCommentText('');
      setTaggedMentions([]);
      toast.success('Comment added');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  // ── Task history ────────────────────────────────────────────────────
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['task-history', historyTaskId],
    queryFn: () => myTasksApi.getHistory(historyTaskId!).then((r) => r.data.data),
    enabled: !!historyTaskId && historyOpen,
  });

  // ── Employees list for reassign ─────────────────────────────────────
  const { data: companyEmployees } = useQuery({
    queryKey: ['company-employees-list'],
    queryFn: () => employeesApi.employeeGetAll({ limit: 100, isActive: true }).then((r) => r.data.data),
  });

  const reassignMut = useMutation({
    mutationFn: ({ taskId, assigneeId }: { taskId: number; assigneeId: number }) =>
      myTasksApi.reassign(taskId, assigneeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['my-task-detail', detailTask?.id] });
      qc.invalidateQueries({ queryKey: ['task-history'] });
      toast.success('Task reassigned successfully');
      setDetailOpen(false);
      setDetailTask(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to reassign'),
  });

  const openDetail = (t: ProjectTask) => {
    setDetailTask(t);
    setDetailOpen(true);
    setCommentText('');
    setTaggedMentions([]);
    setReassignTo(t.assigneeId ? String(t.assigneeId) : '');
  };

  // ── Search helpers ──────────────────────────────────────────────────────

  const isSearchMode = search.length >= 1;

  return (
    <div className="space-y-4">
      {/* Gradient Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-teal-600 via-cyan-600 to-blue-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoNnptMC0zMHY2aC02VjRoNnptMCAzMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative px-6 py-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <ListTodo className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">My Tasks</h1>
            <p className="text-sm text-white/60">Track your assigned tasks</p>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      {!isLoading && tasks.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'To Do', count: tasks.filter(t => t.status === 'todo').length, gradient: 'bg-gradient-to-br from-slate-500 to-slate-600', icon: ListTodo },
            { label: 'In Progress', count: tasks.filter(t => t.status === 'in_progress').length, gradient: 'bg-gradient-to-br from-blue-500 to-indigo-600', icon: Clock },
            { label: 'In Review', count: tasks.filter(t => t.status === 'in_review').length, gradient: 'bg-gradient-to-br from-amber-500 to-orange-600', icon: MessageSquare },
            { label: 'Done', count: tasks.filter(t => t.status === 'done').length, gradient: 'bg-gradient-to-br from-emerald-500 to-teal-600', icon: Target },
          ].map(({ label, count, gradient, icon: Icon }) => (
            <div key={label} className={`relative overflow-hidden rounded-xl border-0 ${gradient} p-4`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/70">{label}</p>
                  <p className="mt-1 text-2xl font-bold text-white">{count}</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                  <Icon className="h-4 w-4 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ticket ID or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 pr-8"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="hidden sm:block h-6 w-px bg-border" />
        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-36">
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
            <SelectTrigger className="w-full sm:w-36">
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
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {(projectsList ?? []).map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.projectName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Search results banner */}
      {isSearchMode && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-teal-500/10 border border-teal-500/20 rounded-md px-3 py-2">
          <Search className="h-3.5 w-3.5 text-teal-600" />
          <span>
            Showing <strong className="text-foreground">{tasks.length}</strong> result{tasks.length !== 1 ? 's' : ''} for &quot;{search}&quot;
          </span>
          <button onClick={() => setSearch('')} className="ml-auto text-xs text-teal-600 hover:underline">Clear search</button>
        </div>
      )}

      {/* Empty / Loading state (shared) */}
      {isLoading ? (
        <>
          {/* Mobile/Tablet skeleton */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
          {/* Desktop skeleton */}
          <div className="hidden lg:block rounded-lg border bg-card shadow-sm">
            <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-teal-500 via-cyan-500 to-blue-500" />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead><TableHead>Title</TableHead><TableHead>Project</TableHead>
                  <TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Due Date</TableHead>
                  <TableHead className="w-36">Quick Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(7)].map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-24" /></TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 rounded-xl border bg-card shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/10 mb-3">
            <ListTodo className="h-6 w-6 text-teal-500" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {isSearchMode ? 'No tasks match your search' : 'No tasks assigned yet'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {isSearchMode ? 'Try a different ticket ID' : 'Tasks assigned to you will appear here'}
          </p>
        </div>
      ) : (
        <>
          {/* ── Mobile / Tablet: Card layout ──────────────────────────────── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
            {tasks.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border bg-card shadow-sm p-4 cursor-pointer hover:ring-1 hover:ring-teal-500/30 transition-all"
                onClick={() => openDetail(t)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <span className="text-xs font-mono font-semibold text-teal-600 dark:text-teal-400">{t.ticketNumber ?? '—'}</span>
                    <h3 className="text-sm font-semibold truncate mt-0.5">{t.title}</h3>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${priorityColors[t.priority]}`}>
                    {priorityLabels[t.priority]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate mb-3">
                  <FolderKanban className="inline h-3 w-3 mr-1 -mt-0.5" />
                  {t.project?.projectName ?? '—'}
                  {t.dueDate && (
                    <span className="ml-3">
                      <Calendar className="inline h-3 w-3 mr-1 -mt-0.5" />
                      {t.dueDate}
                    </span>
                  )}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[t.status]}`}>
                    {statusLabels[t.status]}
                  </span>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={t.status}
                      onValueChange={(val) => handleStatusChange(t.id, val)}
                    >
                      <SelectTrigger className="h-7 text-xs w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo">To Do</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="in_review">In Review</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Desktop: Table layout ──────────────────────────────────────── */}
          <div className="hidden lg:block rounded-lg border bg-card overflow-x-auto shadow-sm">
            <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-teal-500 via-cyan-500 to-blue-500" />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="w-36">Quick Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer hover:bg-accent/50" onClick={() => openDetail(t)}>
                    <TableCell className="text-xs font-mono text-teal-600 dark:text-teal-400 whitespace-nowrap">{t.ticketNumber ?? '—'}</TableCell>
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.project?.projectName ?? '—'}
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={t.status}
                        onValueChange={(val) => handleStatusChange(t.id, val)}
                      >
                        <SelectTrigger className="h-7 text-xs w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="in_review">In Review</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* ── Task Detail Dialog ─────────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={(v) => { setDetailOpen(v); if (!v) setDetailTask(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-xl flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-teal-500 via-cyan-500 to-blue-500" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-teal-500" />
              Task Detail
            </DialogTitle>
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
                      <span className="text-xs font-mono font-semibold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded">{taskDetail.ticketNumber}</span>
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
                    {taskDetail.project?.projectName ?? '—'}
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

                {/* Status update */}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">Update Status:</span>
                  <Select
                    value={taskDetail.status}
                    onValueChange={(val) => {
                      handleStatusChange(taskDetail.id, val);
                    }}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="in_review">In Review</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Reassign */}
                <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 ${taskDetail.status === 'closed' ? 'opacity-50 pointer-events-none' : ''}`}>
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <UserRoundPlus className="h-3.5 w-3.5" />
                    Reassign To:
                    {taskDetail.status === 'closed' && <span className="text-xs text-muted-foreground ml-1">(Closed)</span>}
                  </span>
                  <SearchableSelect
                    value={reassignTo}
                    onValueChange={setReassignTo}
                    options={(companyEmployees ?? [])
                      .filter((emp: any) => emp._type !== 'admin')
                      .map((emp) => ({ value: String(emp.id), label: emp.empName }))}
                    placeholder="Select employee..."
                    disabled={taskDetail.status === 'closed'}
                    className="w-full sm:w-52"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!reassignTo || reassignMut.isPending || taskDetail.status === 'closed'}
                    onClick={() => reassignMut.mutate({ taskId: taskDetail.id, assigneeId: Number(reassignTo) })}
                  >
                    {reassignMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reassign'}
                  </Button>
                </div>

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

                {/* Comments list */}
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
                            {formatCommentTime(c.createdAt)}
                            {' · '}
                            {timeAgo(c.createdAt)}
                          </span>
                        </div>
                        <p className="text-foreground">{renderMentions(c.content)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Fixed comment input at bottom */}
              <div className="border-t pt-3 flex gap-2 shrink-0">
                <MentionTextarea
                  value={commentText}
                  onChange={setCommentText}
                  onMentionAdded={(emp) => setTaggedMentions((prev) => [...prev, emp])}
                  employees={(companyEmployees ?? []).filter((e: any) => e._type !== 'admin').map((e) => ({ id: e.id, empName: e.empName }))}
                  placeholder="Add a comment… type @ to mention someone"
                  rows={2}
                />
                <Button
                  size="sm"
                  className="self-end"
                  disabled={!commentText.trim() || addCommentMut.isPending}
                  onClick={() => {
                    const content = buildMentionContent(commentText, taggedMentions).trim();
                    addCommentMut.mutate(content);
                  }}
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
                          {new Date(h.createdAt).toLocaleString('en-IN', { timeZone: 'UTC' })}
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
