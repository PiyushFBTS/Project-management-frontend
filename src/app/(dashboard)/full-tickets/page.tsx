/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2, MessageSquare, Calendar, Clock, User, Target, Search, X,
  FolderKanban, UserRoundPlus, Ticket, History, ArrowUpDown, ArrowUp, ArrowDown, Download, AlertTriangle,
  Paperclip, FileText, Image as ImageIcon, Trash2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { projectTicketsApi, adminTicketsApi, clientTicketsApi } from '@/lib/api/project-planning';
import { employeesApi } from '@/lib/api/employees';
import { projectsApi } from '@/lib/api/projects';
import { useAuth } from '@/providers/auth-provider';
import {
  ProjectTask, ProjectTaskComment, ProjectTaskHistory, ProjectTaskStatus,
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

/** Convert mention tokens to styled HTML spans and sanitize plain text */
function renderMentionsHtml(content: string): string {
  // First escape HTML in the raw text
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Replace @[name](id) tokens with styled spans
  return escaped.replace(
    /@\[([^\]]+)\]\(\d+\)/g,
    '<span class="inline-flex items-center rounded-full bg-violet-500/15 px-1.5 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400">@$1</span>',
  ).replace(/\n/g, '<br/>');
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

export default function FullTicketsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = user?._type === 'admin';
  const isClient = user?._type === 'client';

  // Pick the correct API based on user role
  const ticketsApi = isAdmin ? adminTicketsApi : isClient ? clientTicketsApi : projectTicketsApi;

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [dueDateFilter, setDueDateFilter] = useState<string>('all');

  // Search
  const [search, setSearch] = useState('');

  // Sort
  const [sortBy, setSortBy] = useState<'dueDate' | 'ticketNumber'>('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Projects dropdown — admin sees all, employee sees accessible only, client has one project
  const { data: projectsListRaw } = useQuery({
    queryKey: ['accessible-projects', isAdmin],
    queryFn: () => ticketsApi.getProjects().then((r) => r.data.data),
    enabled: !isClient,
  });
  const projectsList = Array.isArray(projectsListRaw) ? projectsListRaw : [];

  // Detail dialog
  const [detailTask, setDetailTask] = useState<ProjectTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [taggedMentions, setTaggedMentions] = useState<MentionEmployee[]>([]);
  const [reassignTo, setReassignTo] = useState<string>('');


  // History dialog
  const [historyTaskId, setHistoryTaskId] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Contributors dialog (shown when closing a ticket)
  const [contributorsOpen, setContributorsOpen] = useState(false);
  const [closingTaskId, setClosingTaskId] = useState<number | null>(null);
  const [selectedContributors, setSelectedContributors] = useState<number[]>([]);

  // View Contributors dialog (for closed tickets)
  const [contributorsViewOpen, setContributorsViewOpen] = useState(false);
  const [contributorsViewTaskId, setContributorsViewTaskId] = useState<number | null>(null);

  // ── Single source-of-truth query (all tickets, no filters) ──────────────
  // KPI counts AND table rows are both derived from this one array client-side.

  const { data: allTickets = [], isLoading } = useQuery({
    queryKey: ['project-tickets-all', isAdmin],
    enabled: !authLoading,
    queryFn: async (): Promise<ProjectTask[]> => {
      const r = await ticketsApi.getAll({ limit: 500 });
      const body = r.data;
      if (Array.isArray(body?.data)) return body.data;
      if (Array.isArray((body?.data as any)?.data)) return (body.data as any).data;
      return [];
    },
  });

  // Helper: apply all filters except status (used for KPI counts)
  const applyNonStatusFilters = (t: ProjectTask) => {
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (projectFilter !== 'all' && String(t.projectId ?? t.project?.id) !== projectFilter) return false;
    if (assigneeFilter !== 'all' && String(t.assigneeId ?? '') !== assigneeFilter) return false;
    if (dueDateFilter === 'overdue') {
      if (!t.dueDate || new Date(t.dueDate) >= new Date() || t.status === 'done' || t.status === 'closed') return false;
    } else if (dueDateFilter === 'due_today') {
      const today = new Date().toISOString().slice(0, 10);
      if (!t.dueDate || t.dueDate.slice(0, 10) !== today) return false;
    } else if (dueDateFilter === 'no_due_date') {
      if (t.dueDate) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!(t.ticketNumber ?? '').toLowerCase().includes(q) && !t.title.toLowerCase().includes(q)) return false;
    }
    return true;
  };

  // KPI counts — based on current search/project/priority filters (status excluded so all buckets remain visible)
  const statsAll = allTickets.filter(applyNonStatusFilters);

  // Table rows — full filter including status
  const filteredTasks = allTickets.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    return applyNonStatusFilters(t);
  });

  // Sort
  const toggleSort = (col: 'dueDate' | 'ticketNumber') => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir('desc'); }
  };

  const tasks = [...filteredTasks].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortBy === 'dueDate') {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return (da - db) * dir;
    }
    // ticketNumber sort (e.g. "TICK-001")
    return (a.ticketNumber ?? '').localeCompare(b.ticketNumber ?? '', undefined, { numeric: true }) * dir;
  });

  // ── Export to Excel ──────────────────────────────────────────────────────
  const exportToExcel = () => {
    const rows = tasks.map((t) => ({
      'Ticket ID': t.ticketNumber ?? '—',
      'Title': t.title,
      'Project': t.project?.projectName ?? '—',
      'Assignee': t.assignee?.empName ?? (t as any).assignedAdmin?.name ?? (t as any).assignedClient?.fullName ?? 'Unassigned',
      'Priority': priorityLabels[t.priority] ?? t.priority,
      'Status': statusLabels[t.status] ?? t.status,
      'Due Date': t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—',
      'Created At': new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    // Auto-size columns
    ws['!cols'] = Object.keys(rows[0] ?? {}).map((key) => ({
      wch: Math.max(key.length, ...rows.map((r) => String((r as any)[key] ?? '').length)) + 2,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tickets');
    XLSX.writeFile(wb, `tickets_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── Inline status update ─────────────────────────────────────────────────

  const updateStatusMut = useMutation({
    mutationFn: ({ taskId, status, assignToAdminId }: { taskId: number; status: ProjectTaskStatus; assignToAdminId?: number }) =>
      ticketsApi.updateStatus(taskId, status, assignToAdminId),
    onMutate: async ({ taskId, status }) => {
      await qc.cancelQueries({ queryKey: ['project-tickets-all', isAdmin] });
      const prev = qc.getQueryData<ProjectTask[]>(['project-tickets-all', isAdmin]);
      if (prev) {
        qc.setQueryData<ProjectTask[]>(
          ['project-tickets-all', isAdmin],
          prev.map((t) => t.id === taskId ? { ...t, status } : t),
        );
      }
      return { prev };
    },
    onError: (e: any, _vars, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['project-tickets-all', isAdmin], ctx.prev);
      toast.error(e?.response?.data?.message ?? 'Failed to update status');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-tickets-all', isAdmin] });
      qc.invalidateQueries({ queryKey: ['project-ticket-detail', detailTask?.id] });
      qc.invalidateQueries({ queryKey: ['task-history'] });
      toast.success('Status updated');
    },
  });

  const handleStatusChange = (taskId: number, newStatus: string) => {
    if (newStatus === 'closed') {
      // Open contributors dialog before closing
      setClosingTaskId(taskId);
      setSelectedContributors([]);
      setContributorsOpen(true);
      return;
    }
    updateStatusMut.mutate({ taskId, status: newStatus as ProjectTaskStatus });
  };

  // ── Contributors (shown when closing a ticket) ───────────────────────────

  const toggleContributor = (empId: number) => {
    setSelectedContributors((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId],
    );
  };

  const confirmCloseWithContributors = async () => {
    if (!closingTaskId) return;
    const taskId = closingTaskId;
    const contribs = [...selectedContributors];
    setContributorsOpen(false);
    setClosingTaskId(null);

    // Save contributors first, then close the ticket
    if (contribs.length > 0) {
      try {
        const res = await ticketsApi.setContributors(taskId, contribs);
        console.log('Contributors saved:', res.data);
      } catch (err: any) {
        console.error('Failed to save contributors:', err?.response?.data ?? err);
        toast.error(err?.response?.data?.message ?? 'Failed to save contributors');
      }
    }

    updateStatusMut.mutate({ taskId, status: 'closed' as ProjectTaskStatus });
  };

  // ── Task detail ──────────────────────────────────────────────────────────

  const { data: taskDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['project-ticket-detail', detailTask?.id],
    queryFn: () => ticketsApi.getOne(detailTask!.id).then((r) => r.data.data),
    enabled: !!detailTask,
  });

  // Contributors for the view dialog
  const { data: viewContributors, isLoading: viewContribLoading } = useQuery({
    queryKey: ['ticket-contributors', contributorsViewTaskId],
    queryFn: () => ticketsApi.getContributors(contributorsViewTaskId!).then((r: any) => r.data?.data ?? r.data),
    enabled: !!contributorsViewTaskId && contributorsViewOpen,
  });

  // Attachments
  const { data: attachments } = useQuery({
    queryKey: ['task-attachments', detailTask?.id],
    queryFn: () => ticketsApi.getAttachments!(detailTask!.id).then((r: any) => r.data?.data ?? r.data ?? []),
    enabled: !!detailTask && detailOpen && !!ticketsApi.getAttachments,
  });

  const uploadAttachmentMut = useMutation({
    mutationFn: (file: File) => ticketsApi.uploadAttachment!(detailTask!.id, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-attachments', detailTask?.id] });
      toast.success('File uploaded');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Upload failed'),
  });

  const deleteAttachmentMut = useMutation({
    mutationFn: (attId: number) => ticketsApi.deleteAttachment!(detailTask!.id, attId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-attachments', detailTask?.id] });
      toast.success('Attachment deleted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Delete failed'),
  });

  const addCommentMut = useMutation({
    mutationFn: (content: string) => ticketsApi.addComment(detailTask!.id, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-ticket-detail', detailTask?.id] });
      setCommentText('');
      setTaggedMentions([]);
      toast.success('Comment added');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  // ── Task history ────────────────────────────────────────────────────
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['task-history', historyTaskId],
    queryFn: () => ticketsApi.getHistory(historyTaskId!).then((r) => r.data.data),
    enabled: !!historyTaskId && historyOpen,
  });
  console.log("historyData", historyData)

  // ── Employees list for reassign ─────────────────────────────────────
  const { data: companyEmployeesRaw } = useQuery({
    queryKey: ['company-employees-list', isAdmin, isClient],
    queryFn: async (): Promise<any[]> => {
      if (isClient) {
        const r = await clientTicketsApi.getEmployees();
        const d: any = r.data;
        return Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
      }
      const fn = isAdmin ? employeesApi.getAll : employeesApi.employeeGetAll;
      const r = await fn({ limit: 100, isActive: true });
      const d: any = r.data;
      return Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
    },
    enabled: !authLoading,
  });
  const companyEmployees = Array.isArray(companyEmployeesRaw) ? companyEmployeesRaw : [];

  // Fetch history for the ticket being closed (to filter contributors)
  const { data: closingHistory } = useQuery({
    queryKey: ['task-history', closingTaskId],
    queryFn: () => ticketsApi.getHistory(closingTaskId!).then((r) => r.data.data),
    enabled: !!closingTaskId && contributorsOpen,
  });

  // Only show employees whose names appear in the ticket's assign/reassign history
  const contributorEmployeeList = (() => {
    const allEmps = (companyEmployees ?? [])
      .filter((e: any) => e._type !== 'admin')
      .filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i);

    if (!closingHistory || !Array.isArray(closingHistory)) return allEmps;

    // Collect all names from assigned/reassigned history entries
    const historyNames = new Set<string>();
    for (const h of closingHistory) {
      if (h.action === 'assigned' || h.action === 'reassigned') {
        if (h.oldValue && h.oldValue !== 'Unassigned') historyNames.add(h.oldValue);
        if (h.newValue && h.newValue !== 'Unassigned') historyNames.add(h.newValue);
      }
    }

    if (historyNames.size === 0) return allEmps;

    return allEmps.filter((e) => historyNames.has(e.empName));
  })();

  // Fetch project clients for reassign dropdown (admin & employee — not client)
  // We load clients per-project when detail dialog opens
  const projectIdForClients = detailTask?.projectId ?? (detailTask as any)?.project?.id;
  const { data: projectClientsRaw } = useQuery({
    queryKey: ['project-clients-for-reassign', projectIdForClients],
    queryFn: async (): Promise<any[]> => {
      try {
        const r = isAdmin
          ? await projectsApi.getClients(projectIdForClients!)
          : await projectsApi.employeeGetClients(projectIdForClients!);
        const d: any = r.data;
        return Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
      } catch {
        return [];
      }
    },
    enabled: !!projectIdForClients && !isClient && detailOpen,
  });
  const projectClients = Array.isArray(projectClientsRaw) ? projectClientsRaw : [];

  // Build reassign options: employees + admins + clients
  const reassignOptions = (() => {
    const all = companyEmployees ?? [];
    const deduped = all.filter((e, i, arr) => arr.findIndex((x) => x.id === e.id && (x as any)._type === (e as any)._type) === i);

    const empOpts = deduped
      .filter((e: any) => !e._type || e._type === 'employee')
      .map((emp) => ({ value: `emp-${emp.id}`, label: emp.empName }));

    const adminOpts = deduped
      .filter((e: any) => e._type === 'admin')
      .map((a) => ({ value: `admin-${a.id}`, label: `${a.empName} (Admin)` }));

    const clientFromList = deduped
      .filter((e: any) => e._type === 'client')
      .map((c) => ({ value: `client-${c.id}`, label: `${c.empName} (Client)` }));

    if (isClient) return [...empOpts, ...adminOpts, ...clientFromList];

    const clientOpts = ((projectClients ?? []) as any[])
      .filter((c: any) => c.isActive)
      .map((c: any) => ({ value: `client-${c.id}`, label: `${c.fullName} (Client)` }));

    return [...empOpts, ...adminOpts, ...clientOpts];
  })();
console.log("reassignOptions",reassignOptions);

  const reassignMut = useMutation({
    mutationFn: ({ taskId, target }: { taskId: number; target: string }) => {
      const [type, ...rest] = target.split('-');
      const id = Number(rest.join('-'));
      if (type === 'client' && ticketsApi.reassignAny) {
        return ticketsApi.reassignAny(taskId, { clientId: id });
      }
      if (type === 'admin' && ticketsApi.reassignAny) {
        return ticketsApi.reassignAny(taskId, { adminId: id });
      }
      if (ticketsApi.reassignAny) {
        return ticketsApi.reassignAny(taskId, { employeeId: id });
      }
      return ticketsApi.reassign(taskId, id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-tickets-all', isAdmin] });
      qc.invalidateQueries({ queryKey: ['project-ticket-detail', detailTask?.id] });
      qc.invalidateQueries({ queryKey: ['task-history'] });
      toast.success('Task reassigned successfully');
      setReassignTo('');
      setDetailOpen(false);
      setDetailTask(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to reassign'),
  });

  const openDetail = (t: ProjectTask) => {
    router.push(`/full-tickets/${t.id}`);
  };
  console.log("reassignTo", reassignTo)
  return (
    <div className="space-y-4">
      {/* Gradient Header */}
      {/* <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-violet-600 via-purple-600 to-indigo-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoNnptMC0zMHY2aC02VjRoNnptMCAzMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative px-6 py-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Ticket className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">All Tickets</h1>
            <p className="text-sm text-white/60">All tickets from your projects</p>
          </div>
        </div>
      </div> */}

      {/* KPI Stats */}
      <div className={`grid grid-cols-2 gap-3 ${isClient ? 'lg:grid-cols-5' : 'lg:grid-cols-6'}`}>
        {[
          { label: 'To Do', count: statsAll.filter(t => t.status === 'todo').length, gradient: 'bg-gradient-to-br from-slate-500 to-slate-600', icon: Ticket },
          { label: 'In Progress', count: statsAll.filter(t => t.status === 'in_progress').length, gradient: 'bg-gradient-to-br from-blue-500 to-indigo-600', icon: Clock },
          { label: 'In Review', count: statsAll.filter(t => t.status === 'in_review').length, gradient: 'bg-gradient-to-br from-amber-500 to-orange-600', icon: MessageSquare },
          { label: 'Done', count: statsAll.filter(t => t.status === 'done').length, gradient: 'bg-gradient-to-br from-emerald-500 to-teal-600', icon: Target },
          { label: 'Closed', count: statsAll.filter(t => t.status === 'closed').length, gradient: 'bg-gradient-to-br from-purple-500 to-purple-700', icon: X },
          ...(!isClient ? [{ label: 'Overdue', count: statsAll.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done' && t.status !== 'closed').length, gradient: 'bg-gradient-to-br from-red-500 to-rose-700', icon: AlertTriangle }] : []),
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
          {!isClient && (
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
          )}
          <SearchableSelect
            value={assigneeFilter}
            onValueChange={setAssigneeFilter}
            options={[
              { value: 'all', label: 'All Employees' },
              ...(companyEmployees ?? [])
                .filter((emp: any) => emp._type !== 'admin')
                .filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i)
                .map((emp) => ({ value: String(emp.id), label: emp.empName })),
            ]}
            placeholder="All Employees"
            className="w-full sm:w-48"
          />
          <Select value={dueDateFilter} onValueChange={setDueDateFilter}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="Due Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Due Dates</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="due_today">Due Today</SelectItem>
              <SelectItem value="no_due_date">No Due Date</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(statusFilter !== 'all' || priorityFilter !== 'all' || projectFilter !== 'all' || assigneeFilter !== 'all' || dueDateFilter !== 'all' || search) && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
            onClick={() => { setStatusFilter('all'); setPriorityFilter('all'); setProjectFilter('all'); setAssigneeFilter('all'); setDueDateFilter('all'); setSearch(''); }}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Clear Filters
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {isClient && (user as any)?.projectId && (
            <Button
              size="sm"
              className="bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white"
              onClick={() => router.push(`/projects/${(user as any).projectId}/planning/new-task`)}
            >
              <Ticket className="h-4 w-4 mr-1.5" />
              New Ticket
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={tasks.length === 0}
            onClick={exportToExcel}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Empty / Loading state */}
      {isLoading ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
          <div className="hidden lg:block rounded-lg border bg-card shadow-sm">
            <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-violet-500 via-purple-500 to-indigo-500" />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead><TableHead>Title</TableHead>{!isClient && <TableHead>Project</TableHead>}
                  <TableHead>Assignee</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(isClient ? 5 : 6)].map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-24" /></TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 rounded-xl border bg-card shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/10 mb-3">
            <Ticket className="h-6 w-6 text-violet-500" />
          </div>
          <p className="text-sm font-medium text-foreground">No tickets found</p>
          <p className="text-xs text-muted-foreground mt-1">Tickets from your projects will appear here</p>
        </div>
      ) : (
        <>
          {/* ── Mobile / Tablet: Card layout ──────────────────────────────── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
            {tasks.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border bg-card shadow-sm p-4 cursor-pointer hover:ring-1 hover:ring-violet-500/30 transition-all"
                onClick={() => openDetail(t)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <span className="text-xs font-mono font-semibold text-violet-600 dark:text-violet-400">{t.ticketNumber ?? '—'}</span>
                    <h3 className="text-sm font-semibold truncate mt-0.5">{t.title}</h3>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${priorityColors[t.priority]}`}>
                    {priorityLabels[t.priority]}
                  </span>
                </div>
                {!isClient && (
                  <p className="text-xs text-muted-foreground truncate mb-1">
                    <FolderKanban className="inline h-3 w-3 mr-1 -mt-0.5" />
                    {t.project?.projectName ?? '—'}
                  </p>
                )}
                <p className="text-xs text-muted-foreground truncate mb-3">
                  <User className="inline h-3 w-3 mr-1 -mt-0.5" />
                  {t.assignee?.empName ?? (t as any).assignedAdmin?.name ?? (t as any).assignedClient?.fullName ?? 'Unassigned'}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[t.status]}`}>
                    {statusLabels[t.status]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    <Calendar className="inline h-3 w-3 mr-1 -mt-0.5" />
                    {t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No due date'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Desktop: Table layout ──────────────────────────────────────── */}
          <div className="hidden lg:block rounded-lg border bg-card overflow-x-auto shadow-sm">
            <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-violet-500 via-purple-500 to-indigo-500" />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('ticketNumber')}>
                    <span className="inline-flex items-center gap-1">
                      Ticket
                      {sortBy === 'ticketNumber' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </span>
                  </TableHead>
                  <TableHead>Title</TableHead>
                  {!isClient && <TableHead>Project</TableHead>}
                  <TableHead>Assignee</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer hover:bg-accent/50" onClick={() => openDetail(t)}>
                    <TableCell className="text-xs font-mono text-violet-600 dark:text-violet-400 whitespace-nowrap">{t.ticketNumber ?? '—'}</TableCell>
                    <TableCell className="font-medium">{t.title}</TableCell>
                    {!isClient && (
                      <TableCell className="text-sm text-muted-foreground">
                        {t.project?.projectName ?? '—'}
                      </TableCell>
                    )}
                    <TableCell className="text-sm text-muted-foreground">
                      {t.assignee?.empName ?? (t as any).assignedAdmin?.name ?? (t as any).assignedClient?.fullName ?? 'Unassigned'}
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* ── Task Detail Dialog ─────────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={(v) => { setDetailOpen(v); if (!v) setDetailTask(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden gap-0 p-0">
          <DialogTitle className="sr-only">Ticket Detail</DialogTitle>
          {/* ── Gradient header ─────────────────────────────────────────── */}
          <div className="bg-linear-to-r from-violet-600 via-purple-600 to-indigo-600 px-5 py-4 text-white rounded-t-lg">
            {detailLoading || !taskDetail ? (
              <Skeleton className="h-6 w-3/4 bg-white/20" />
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  {taskDetail.ticketNumber && (
                    <span className="text-xs font-mono font-bold bg-white/20 backdrop-blur px-2 py-0.5 rounded">{taskDetail.ticketNumber}</span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold bg-white/20 backdrop-blur`}>
                    {statusLabels[taskDetail.status]}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold bg-white/20 backdrop-blur`}>
                    {priorityLabels[taskDetail.priority]}
                  </span>
                </div>
                <h3 className="text-lg font-bold leading-snug">{taskDetail.title}</h3>
              </>
            )}
          </div>

          {detailLoading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : taskDetail ? (
            <>
              {/* ── Scrollable body ──────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-5">
                {/* Description */}
                {taskDetail.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{taskDetail.description}</p>
                )}

                {/* Info cards row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="rounded-lg border bg-violet-500/5 p-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-violet-600 dark:text-violet-400 mb-1">
                      <FolderKanban className="h-3 w-3" /> Project
                    </div>
                    <p className="text-sm font-medium truncate">{taskDetail.project?.projectName ?? '—'}</p>
                  </div>
                  <div className="rounded-lg border bg-blue-500/5 p-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400 mb-1">
                      <User className="h-3 w-3" /> Assignee
                    </div>
                    <p className="text-sm font-medium truncate">{taskDetail.assignee?.empName ?? (taskDetail as any).assignedAdmin?.name ?? (taskDetail as any).assignedClient?.fullName ?? 'Unassigned'}</p>
                  </div>
                  <div className="rounded-lg border bg-amber-500/5 p-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400 mb-1">
                      <Calendar className="h-3 w-3" /> Due Date
                    </div>
                    <p className="text-sm font-medium">{taskDetail.dueDate ? new Date(taskDetail.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                  </div>
                  {taskDetail.estimatedHours && (
                    <div className="rounded-lg border bg-emerald-500/5 p-2.5">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                        <Clock className="h-3 w-3" /> Estimated
                      </div>
                      <p className="text-sm font-medium">{taskDetail.estimatedHours}h</p>
                    </div>
                  )}
                  {taskDetail.phase && (
                    <div className="rounded-lg border bg-pink-500/5 p-2.5">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-pink-600 dark:text-pink-400 mb-1">
                        <Target className="h-3 w-3" /> Phase
                      </div>
                      <p className="text-sm font-medium truncate">{taskDetail.phase.name}</p>
                    </div>
                  )}
                </div>

                {/* Actions row */}
                <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                  {/* Status update */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24 shrink-0">Status</span>
                    <Select
                      value={taskDetail.status}
                      onValueChange={(val) => handleStatusChange(taskDetail.id, val)}
                    >
                      <SelectTrigger className="h-8 text-xs w-36">
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
                  <div className={`flex flex-col gap-2 sm:flex-row sm:items-center ${taskDetail.status === 'closed' ? 'opacity-50 pointer-events-none' : ''}`}>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24 shrink-0 flex items-center gap-1">
                      <UserRoundPlus className="h-3 w-3" /> Reassign
                    </span>
                    <div className="flex flex-1 gap-2">
                      <SearchableSelect
                        value={reassignTo}
                        onValueChange={setReassignTo}
                        options={reassignOptions}
                        placeholder="Select assignee..."
                        disabled={taskDetail.status === 'closed'}
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!reassignTo || reassignMut.isPending || taskDetail.status === 'closed'}
                        onClick={() => reassignMut.mutate({ taskId: taskDetail.id, target: reassignTo })}
                      >
                        {reassignMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reassign'}
                      </Button>
                    </div>
                  </div>

                  {/* History */}
                  <div className="flex">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-violet-600 dark:text-violet-400 hover:bg-violet-500/10"
                      onClick={() => { setHistoryTaskId(taskDetail.id); setHistoryOpen(true); }}
                    >
                      <History className="h-3.5 w-3.5 mr-1.5" />
                      View History
                    </Button>
                  </div>
                </div>

                {/* ── View Contributors button (closed tickets) ────────── */}
                {taskDetail.status === 'closed' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
                    onClick={() => { setContributorsViewTaskId(taskDetail.id); setContributorsViewOpen(true); }}
                  >
                    <User className="h-3.5 w-3.5 mr-1.5" />
                    View Contributors
                  </Button>
                )}

                {/* ── Attachments ──────────────────────────────────────────── */}
                {ticketsApi.getAttachments && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Paperclip className="h-3.5 w-3.5" />
                        Attachments ({(attachments as any[])?.length ?? 0})
                      </h4>
                      <div>
                        <input
                          ref={attachInputRef}
                          type="file"
                          className="hidden"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadAttachmentMut.mutate(f);
                            e.target.value = '';
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => attachInputRef.current?.click()}
                          disabled={uploadAttachmentMut.isPending}
                        >
                          {uploadAttachmentMut.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Paperclip className="h-3 w-3 mr-1" />}
                          Upload
                        </Button>
                      </div>
                    </div>
                    {(attachments as any[])?.length > 0 ? (
                      <div className="space-y-1.5">
                        {(attachments as any[]).map((att: any) => {
                          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(att.originalName);
                          const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';
                          return (
                            <div key={att.id} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                              {isImage ? <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" /> : <FileText className="h-4 w-4 text-violet-500 shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <a
                                  href={`${apiBase}${att.filePath}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-medium text-foreground hover:text-violet-600 truncate block"
                                >
                                  {att.originalName}
                                </a>
                                <p className="text-[10px] text-muted-foreground">
                                  {(att.fileSize / 1024).toFixed(1)} KB · {att.uploadedByName}
                                </p>
                              </div>
                              <a
                                href={`${apiBase}${att.filePath}`}
                                download={att.originalName}
                                className="shrink-0 text-muted-foreground hover:text-foreground"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                              {isAdmin && (
                                <button
                                  className="shrink-0 text-muted-foreground hover:text-red-500"
                                  onClick={() => { if (confirm('Delete this attachment?')) deleteAttachmentMut.mutate(att.id); }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-3">No attachments yet.</p>
                    )}
                  </div>
                )}

                {/* ── Comments ─────────────────────────────────────────────── */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Comments ({taskDetail.comments?.length ?? 0})
                  </h4>
                  {(taskDetail.comments ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No comments yet. Start the conversation below.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {(taskDetail.comments ?? []).map((c: ProjectTaskComment) => (
                        <div key={c.id} className="rounded-lg border bg-card p-3 text-sm shadow-sm">
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="h-6 w-6 rounded-full bg-linear-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                              {((c as any).authorName ?? c.authorType).charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-semibold text-foreground">{(c as any).authorName ?? c.authorType}</span>
                            <Badge variant="outline" className="text-[10px] capitalize">{c.authorType}</Badge>
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {formatCommentTime(c.createdAt)}
                              {' · '}
                              {timeAgo(c.createdAt)}
                            </span>
                          </div>
                          <div className="text-foreground leading-relaxed pl-8 text-sm [&_p]:my-0.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold"
                            dangerouslySetInnerHTML={{ __html: renderMentionsHtml(c.content) }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Footer: comment input ────────────────────────────────── */}
              <div className="border-t bg-muted/20 px-5 py-3 shrink-0">
                <div className="flex flex-col gap-2">
                  <MentionTextarea
                    value={commentText}
                    onChange={setCommentText}
                    onMentionAdded={(emp) => setTaggedMentions((prev) => [...prev, emp])}
                    employees={(companyEmployees ?? []).filter((e: any) => e._type !== 'admin').map((e) => ({ id: e.id, empName: e.empName }))}
                    placeholder="Add a comment… type @ to mention someone"
                    rows={2}
                  />
                  <Button
                    className="w-full bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white"
                    disabled={!commentText.trim() || addCommentMut.isPending}
                    onClick={() => {
                      const content = buildMentionContent(commentText, taggedMentions).trim();
                      addCommentMut.mutate(content);
                    }}
                  >
                    {addCommentMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Comment'}
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
                    <div className={`absolute -left-3.5 top-1.5 h-3 w-3 rounded-full border-2 border-background ${h.action === 'created' ? 'bg-emerald-500' :
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

      {/* ── Contributors Dialog (on close) ─────────────────────────────── */}
      <Dialog open={contributorsOpen} onOpenChange={(open) => { if (!open) { setContributorsOpen(false); setClosingTaskId(null); } }}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-violet-500" />
            Employees Who Worked on This Ticket
          </DialogTitle>
          <p className="text-xs text-muted-foreground -mt-1">Select the employees who actually contributed to this ticket before closing it.</p>

          <div className="flex-1 overflow-y-auto min-h-0 space-y-1.5 py-2">
            {contributorEmployeeList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No employees found.</p>
            ) : (
              contributorEmployeeList.map((emp) => (
                <label
                  key={`contrib-${emp.id}`}
                  className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                    checked={selectedContributors.includes(emp.id)}
                    onChange={() => toggleContributor(emp.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{emp.empName}</p>
                    <p className="text-xs text-muted-foreground">{emp.empCode}</p>
                  </div>
                </label>
              ))
            )}
          </div>

          <div className="flex gap-2 pt-2 border-t shrink-0">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { setContributorsOpen(false); setClosingTaskId(null); }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white"
              disabled={updateStatusMut.isPending}
              onClick={confirmCloseWithContributors}
            >
              {updateStatusMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Close Ticket
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── View Contributors Dialog ───────────────────────────────── */}
      <Dialog open={contributorsViewOpen} onOpenChange={(open) => { if (!open) { setContributorsViewOpen(false); setContributorsViewTaskId(null); } }}>
        <DialogContent className="max-w-sm max-h-[70vh] flex flex-col">
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-indigo-500" />
            Contributors
          </DialogTitle>
          <div className="flex-1 overflow-y-auto min-h-0 py-2">
            {viewContribLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (viewContributors ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No contributors recorded for this ticket.</p>
            ) : (
              <div className="space-y-2">
                {(viewContributors ?? []).map((c: any) => (
                  <div key={`view-contrib-${c.employeeId ?? c.id}`} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="h-8 w-8 rounded-full bg-linear-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                      {(c.employee?.empName ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{c.employee?.empName ?? `#${c.employeeId}`}</p>
                      {c.employee?.empCode && <p className="text-xs text-muted-foreground">{c.employee.empCode}</p>}
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
