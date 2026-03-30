/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2, Calendar, Clock, User,
  FolderKanban, UserRoundPlus, Ticket, History, Download, AlertTriangle,
  Paperclip, FileText, Image as ImageIcon, Trash2, ChevronRight, Users,
  Flag, Layers, Send,
} from 'lucide-react';
import { projectTicketsApi, adminTicketsApi, clientTicketsApi } from '@/lib/api/project-planning';
import { employeesApi } from '@/lib/api/employees';
import { projectsApi } from '@/lib/api/projects';
import { useAuth } from '@/providers/auth-provider';
import { ProjectTask, ProjectTaskComment, ProjectTaskStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { RichTextEditor, RichTextDisplay } from '@/components/ui/rich-text-editor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import Link from 'next/link';

// ── Helpers ──────────────────────────────────────────────────────────────

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

/** Renders comment content — handles both old plain-text+mention tokens and new rich HTML */
function renderCommentHtml(content: string): string {
  // If content looks like HTML (from rich text editor), render as-is
  if (content.trim().startsWith('<')) return content;
  // Otherwise, it's old plain-text format — escape HTML and convert mention tokens
  const escaped = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(
    /@\[([^\]]+)\]\(\d+\)/g,
    '<span class="inline-flex items-center rounded-full bg-violet-500/15 px-1.5 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400">@$1</span>',
  ).replace(/\n/g, '<br/>');
}

function formatHistoryTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'UTC' });
}

const statusColors: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  in_review: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  closed: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
};
const statusLabels: Record<string, string> = {
  todo: 'To Do', in_progress: 'In Progress', in_review: 'In Review', done: 'Done', closed: 'Closed',
};
const priorityColors: Record<string, string> = {
  low: 'bg-green-100 text-green-700', medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700', critical: 'bg-red-100 text-red-700',
};
const priorityLabels: Record<string, string> = {
  low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical',
};

// ── File type icon helper ──
function fileIcon(mime: string) {
  if (mime?.startsWith('image/')) return <ImageIcon className="h-4 w-4 text-pink-500" />;
  if (mime?.includes('pdf')) return <FileText className="h-4 w-4 text-red-500" />;
  if (mime?.includes('sheet') || mime?.includes('excel')) return <FileText className="h-4 w-4 text-green-500" />;
  return <Paperclip className="h-4 w-4 text-muted-foreground" />;
}

export default function TicketDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const qc = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = user?._type === 'admin';
  const isClient = user?._type === 'client';
  const ticketsApi = isAdmin ? adminTicketsApi : isClient ? clientTicketsApi : projectTicketsApi;

  const taskId = Number(params.id);

  // State
  const [commentText, setCommentText] = useState('');
  const [reassignTo, setReassignTo] = useState('');
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [contributorsOpen, setContributorsOpen] = useState(false);
  const [closingTaskId, setClosingTaskId] = useState<number | null>(null);
  const [selectedContributors, setSelectedContributors] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<'comments' | 'history' | 'all'>('comments');

  // ── Queries ────────────────────────────────────────────────────────────

  const { data: taskDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['project-ticket-detail', taskId],
    queryFn: async () => {
      const r = await ticketsApi.getOne(taskId);
      const body = r.data as any;
      return body?.data ?? body;
    },
    enabled: !authLoading && !!taskId,
  });

  const t: ProjectTask | null = taskDetail ?? null;

  const { data: attachments = [] } = useQuery({
    queryKey: ['task-attachments', taskId],
    queryFn: () => (ticketsApi as any).getAttachments(taskId).then((r: any) => r.data?.data ?? r.data ?? []),
    enabled: !!taskId && !!ticketsApi.getAttachments,
  });

  const { data: historyData = [], isLoading: historyLoading } = useQuery({
    queryKey: ['task-history', taskId],
    queryFn: () => ticketsApi.getHistory(taskId).then((r) => r.data.data),
    enabled: !!taskId,
  });

  const { data: companyEmployeesRaw } = useQuery({
    queryKey: ['company-employees-list', isAdmin, isClient],
    queryFn: async (): Promise<any[]> => {
      if (isClient) {
        const r = await clientTicketsApi.getEmployees();
        const d: any = r.data;
        return Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
      }
      const fn = isAdmin ? employeesApi.getAll : employeesApi.employeeGetAll;
      const r = await fn({ limit: 100 });
      const d: any = r.data;
      return Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
    },
    enabled: !authLoading,
  });
  const companyEmployees = Array.isArray(companyEmployeesRaw) ? companyEmployeesRaw : [];

  const projectIdForClients = t?.projectId ?? (t as any)?.project?.id;
  const { data: projectClientsRaw } = useQuery({
    queryKey: ['project-clients-for-reassign', projectIdForClients],
    queryFn: async (): Promise<any[]> => {
      try {
        const r = isAdmin
          ? await projectsApi.getClients(projectIdForClients!)
          : await projectsApi.employeeGetClients(projectIdForClients!);
        const d: any = r.data;
        return Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
      } catch { return []; }
    },
    enabled: !!projectIdForClients && !isClient,
  });
  const projectClients = Array.isArray(projectClientsRaw) ? projectClientsRaw : [];

  // Closing history for contributors
  const { data: closingHistory } = useQuery({
    queryKey: ['task-history', closingTaskId],
    queryFn: () => ticketsApi.getHistory(closingTaskId!).then((r) => r.data.data),
    enabled: !!closingTaskId && contributorsOpen,
  });

  const contributorEmployeeList = (() => {
    const allEmps = (companyEmployees ?? [])
      .filter((e: any) => e._type !== 'admin')
      .filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i);
    if (!closingHistory || !Array.isArray(closingHistory)) return allEmps;
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

  const { data: savedContributors = [] } = useQuery({
    queryKey: ['task-contributors', taskId],
    queryFn: () => (ticketsApi as any).getContributors?.(taskId).then((r: any) => r.data?.data ?? r.data ?? []),
    enabled: !!taskId && t?.status === 'closed' && !!(ticketsApi as any).getContributors,
  });

  // ── Reassign options ──────────────────────────────────────────────────

  const reassignOptions = (() => {
    const all = companyEmployees ?? [];
    const deduped = all.filter((e, i, arr) => arr.findIndex((x) => x.id === e.id && (x as any)._type === (e as any)._type) === i);
    const empOpts = deduped.filter((e: any) => !e._type || e._type === 'employee').map((emp) => ({ value: `emp-${emp.id}`, label: emp.empName }));
    const adminOpts = deduped.filter((e: any) => e._type === 'admin').map((a) => ({ value: `admin-${a.id}`, label: `${a.empName} (Admin)` }));
    const clientFromList = deduped.filter((e: any) => e._type === 'client').map((c) => ({ value: `client-${c.id}`, label: `${c.empName} (Client)` }));
    if (isClient) return [...empOpts, ...adminOpts, ...clientFromList];
    const clientOpts = ((projectClients ?? []) as any[]).filter((c: any) => c.isActive).map((c: any) => ({ value: `client-${c.id}`, label: `${c.fullName} (Client)` }));
    return [...empOpts, ...adminOpts, ...clientOpts];
  })();

  // ── Mutations ─────────────────────────────────────────────────────────

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: ProjectTaskStatus }) => ticketsApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-ticket-detail', taskId] });
      qc.invalidateQueries({ queryKey: ['project-tickets-all'] });
      qc.invalidateQueries({ queryKey: ['task-history', taskId] });
      toast.success('Status updated');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const reassignMut = useMutation({
    mutationFn: ({ tId, target }: { tId: number; target: string }) => {
      const [type, ...rest] = target.split('-');
      const id = Number(rest.join('-'));
      const api = isAdmin ? adminTicketsApi : isClient ? clientTicketsApi : projectTicketsApi;
      if (type === 'client') return api.reassignAny(tId, { clientId: id });
      if (type === 'admin') return api.reassignAny(tId, { adminId: id });
      return api.reassignAny(tId, { employeeId: id });
    },
    onSuccess: async () => {
      await qc.refetchQueries({ queryKey: ['project-ticket-detail', taskId] });
      qc.invalidateQueries({ queryKey: ['project-tickets-all'] });
      qc.invalidateQueries({ queryKey: ['task-history', taskId] });
      qc.invalidateQueries({ queryKey: ['task-assignees', taskId] });
      setReassignTo('');
      toast.success('Reassigned');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const addCommentMut = useMutation({
    mutationFn: (content: string) => ticketsApi.addComment(taskId, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-ticket-detail', taskId] });
      setCommentText('');
      toast.success('Comment added');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const uploadAttachmentMut = useMutation({
    mutationFn: (file: File) => (ticketsApi as any).uploadAttachment(taskId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-attachments', taskId] });
      toast.success('Uploaded');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Upload failed'),
  });

  const deleteAttachmentMut = useMutation({
    mutationFn: (attId: number) => (ticketsApi as any).deleteAttachment(taskId, attId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-attachments', taskId] });
      toast.success('Deleted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Delete failed'),
  });

  const setContributorsMut = useMutation({
    mutationFn: (ids: number[]) => (ticketsApi as any).setContributors!(closingTaskId!, ids),
    onSuccess: () => {
      toast.success('Contributors saved');
      setContributorsOpen(false);
      setClosingTaskId(null);
    },
    onError: () => toast.error('Failed to save contributors'),
  });

  // ── Handle status change ──────────────────────────────────────────────
  const handleStatusChange = (newStatus: ProjectTaskStatus) => {
    if (newStatus === 'closed' && (ticketsApi as any).setContributors) {
      setClosingTaskId(taskId);
      setSelectedContributors([]);
      setContributorsOpen(true);
    } else {
      updateStatusMut.mutate({ id: taskId, status: newStatus });
    }
  };

  // ── Multi-Assignees ──────────────────────────────────────────────────
  const { data: assigneesRaw = [], refetch: refetchAssignees } = useQuery({
    queryKey: ['task-assignees', taskId],
    queryFn: async () => {
      const r = await ticketsApi.getAssignees!(taskId);
      return (r.data?.data ?? r.data) as { id: number; userId: number; userType: string; userName: string }[];
    },
    enabled: !!t && !!ticketsApi.getAssignees,
  });
  const assignees = Array.isArray(assigneesRaw) ? assigneesRaw : [];
  const assigneeName = assignees.length > 0
    ? assignees.map(a => a.userName).join(', ')
    : t?.assignee?.empName ?? (t as any)?.assignedAdmin?.name ?? (t as any)?.assignedClient?.fullName ?? 'Unassigned';

  const [showAddAssignee, setShowAddAssignee] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');

  const addAssigneeMut = useMutation({
    mutationFn: ({ userId, userType }: { userId: number; userType: 'employee' | 'admin' | 'client' }) =>
      ticketsApi.addAssignee!(taskId, userId, userType),
    onSuccess: () => { refetchAssignees(); toast.success('Assignee added'); setShowAddAssignee(false); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to add assignee'),
  });

  const removeAssigneeMut = useMutation({
    mutationFn: (assigneeId: number) => ticketsApi.removeAssignee!(taskId, assigneeId),
    onSuccess: () => { refetchAssignees(); toast.success('Assignee removed'); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to remove'),
  });

  // ── Loading & error states ────────────────────────────────────────────
  if (authLoading || detailLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-64" />
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-40 w-full" /><Skeleton className="h-60 w-full" /></div>
          <div className="space-y-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>
        </div>
      </div>
    );
  }

  if (!t) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-semibold">Ticket not found</p>
          <Button variant="ghost" className="mt-3" onClick={() => router.push('/full-tickets')}>Back to All Tickets</Button>
        </div>
      </div>
    );
  }

  const comments = (t as any).comments as ProjectTaskComment[] ?? [];
  const sortedComments = [...comments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const sortedHistory = Array.isArray(historyData) ? [...historyData].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : [];

  return (
    <div className="min-h-full">
      {/* ── Breadcrumb ────────────────────────────────────────────────── */}
      <div className="px-6 pt-4 pb-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link href="/full-tickets">All Tickets</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator><ChevronRight className="h-3.5 w-3.5" /></BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage className="font-semibold">{t.ticketNumber ?? `#${t.id}`}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* ── Main layout (Jira-like: left content + right sidebar) ───── */}
      <div className="px-6 pb-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ═══ LEFT PANEL (2/3) ═══════════════════════════════════════ */}
        <div className="lg:col-span-2 space-y-5">

          {/* Title */}
          <div>
            <h1 className="text-xl font-bold text-foreground leading-snug">{t.title}</h1>
            {t.description && (
              <div className="mt-2"><RichTextDisplay html={t.description} /></div>
            )}
          </div>

          {/* ── Attachments ─────────────────────────────────────────── */}
          <div className="rounded-xl border bg-card">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                Attachments
                {(attachments as any[]).length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">{(attachments as any[]).length}</Badge>
                )}
              </div>
              {t.status !== 'closed' && 'uploadAttachment' in ticketsApi && (
                <>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => attachInputRef.current?.click()}>
                    <Paperclip className="h-3 w-3 mr-1" /> Attach
                  </Button>
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
                </>
              )}
            </div>
            <div className="p-4">
              {(attachments as any[]).length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">No attachments</p>
              ) : (
                <div className="space-y-2">
                  {(attachments as any[]).map((att: any) => (
                    <div key={att.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      {fileIcon(att.mimeType)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{att.originalName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {(att.fileSize / 1024).toFixed(1)} KB
                          {att.uploadedByName ? ` · ${att.uploadedByName}` : ''}
                        </p>
                      </div>
                      <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${att.filePath}`} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><Download className="h-3.5 w-3.5" /></Button>
                      </a>
                      {(isAdmin || att.uploadedByName === (user as any)?.name || att.uploadedByName === (user as any)?.empName) && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                          onClick={() => deleteAttachmentMut.mutate(att.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Activity section (Comments + History tabs) ──────────── */}
          <div className="rounded-xl border bg-card">
            <div className="flex items-center gap-4 px-4 py-3 border-b">
              <span className="text-sm font-semibold">Activity</span>
              <div className="flex gap-1 ml-auto">
                {(['comments', 'history', 'all'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      activeTab === tab
                        ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {tab === 'comments' ? 'Comments' : tab === 'history' ? 'History' : 'All'}
                  </button>
                ))}
              </div>
            </div>

            {/* Comment input at top */}
            <div className="px-4 py-3 border-b bg-muted/20">
              <div className="flex flex-col gap-2">
                <RichTextEditor
                  value={commentText}
                  onChange={setCommentText}
                  employees={(companyEmployees ?? []).filter((e: any) => e._type !== 'admin').map((e) => ({ id: e.id, empName: e.empName }))}
                  onMentionAdded={() => {}}
                  placeholder="Add a comment… type @ to mention"
                  minHeight="80px"
                />
                <Button
                  size="sm"
                  className="self-end bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white"
                  disabled={!commentText.trim() || commentText === '<p></p>' || addCommentMut.isPending}
                  onClick={() => {
                    addCommentMut.mutate(commentText.trim());
                  }}
                >
                  {addCommentMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Send className="h-3.5 w-3.5 mr-1" /> Comment</>}
                </Button>
              </div>
            </div>

            {/* Activity feed */}
            <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
              {/* Comments */}
              {(activeTab === 'comments' || activeTab === 'all') && sortedComments.map((c) => (
                <div key={`c-${c.id}`} className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {((c as any).authorName ?? c.authorType)?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{(c as any).authorName ?? c.authorType}</span>
                      <Badge variant="outline" className="text-[9px] capitalize py-0">{c.authorType}</Badge>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {formatCommentTime(c.createdAt)} · {timeAgo(c.createdAt)}
                      </span>
                    </div>
                    <div
                      className="mt-1 text-sm text-foreground leading-relaxed [&_h1]:text-xl [&_h1]:font-bold [&_h1]:my-1 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:my-1 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:my-0.5 [&_p]:my-0.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 [&_li]:my-0.5 [&_blockquote]:border-l-3 [&_blockquote]:border-violet-500 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_mark]:rounded [&_mark]:px-0.5 [&_.mention]:bg-violet-500/15 [&_.mention]:rounded-full [&_.mention]:px-1.5 [&_.mention]:py-0.5 [&_.mention]:text-xs [&_.mention]:font-medium [&_.mention]:text-violet-600"
                      dangerouslySetInnerHTML={{ __html: renderCommentHtml(c.content) }}
                    />
                  </div>
                </div>
              ))}

              {/* History */}
              {(activeTab === 'history' || activeTab === 'all') && sortedHistory.map((h: any) => (
                <div key={`h-${h.id}`} className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <History className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium capitalize">{h.action?.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{formatHistoryTime(h.createdAt)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{h.details}</p>
                    {h.performerName && <p className="text-[10px] text-muted-foreground">by {h.performerName}</p>}
                  </div>
                </div>
              ))}

              {activeTab === 'comments' && sortedComments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No comments yet</p>
              )}
              {activeTab === 'history' && sortedHistory.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">{historyLoading ? 'Loading...' : 'No history'}</p>
              )}
            </div>
          </div>
        </div>

        {/* ═══ RIGHT SIDEBAR (1/3) ════════════════════════════════════ */}
        <div className="space-y-4">

          {/* Status + Priority card */}
          <div className="rounded-xl border bg-card p-4 space-y-4">
            {/* Status */}
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 block">Status</label>
              {!isClient ? (
                <Select value={t.status} onValueChange={(v) => handleStatusChange(v as ProjectTaskStatus)}>
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge className={`${statusColors[t.status]} text-xs`}>{statusLabels[t.status]}</Badge>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 block">Priority</label>
              <Badge className={`${priorityColors[t.priority]} text-xs`}>
                <Flag className="h-3 w-3 mr-1" />
                {priorityLabels[t.priority]}
              </Badge>
            </div>
          </div>

          {/* Details card */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Details</h3>

            <div className="py-1.5 border-b border-dashed">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Assignees</span>
                <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => { setShowAddAssignee(!showAddAssignee); setAssigneeSearch(''); }}>
                  <UserRoundPlus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>

              {assignees.length === 0 && <p className="text-xs text-muted-foreground">No assignees</p>}

              <div className="space-y-1">
                {assignees.map((a) => (
                  <div key={a.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">{a.userName.charAt(0)}</div>
                      <span className="text-xs font-medium">{a.userName}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0">{a.userType}</Badge>
                    </div>
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-red-500"
                      onClick={() => removeAssigneeMut.mutate(a.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>

              {showAddAssignee && (
                <div className="mt-2 p-2 bg-muted/50 rounded-lg space-y-1.5">
                  <input
                    type="text"
                    placeholder="Search by name..."
                    value={assigneeSearch}
                    onChange={(e) => setAssigneeSearch(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                  <div className="max-h-40 overflow-y-auto space-y-0.5">
                    {(companyEmployees ?? [])
                      .filter((e: any) => !assignees.some(a => a.userId === e.id && a.userType === (e._type || 'employee')))
                      .filter((e: any) => !assigneeSearch || e.empName?.toLowerCase().includes(assigneeSearch.toLowerCase()))
                      .map((emp: any) => {
                        const uType = emp._type === 'admin' ? 'admin' : emp._type === 'client' ? 'client' : 'employee';
                        return (
                          <button key={`${uType}-${emp.id}`}
                            className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-primary/10 flex items-center gap-2"
                            onClick={() => addAssigneeMut.mutate({ userId: emp.id, userType: uType as any })}>
                            <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-semibold text-primary">{emp.empName?.charAt(0)}</div>
                            {emp.empName}
                            {uType !== 'employee' && <Badge variant="outline" className="text-[8px] px-1 py-0 ml-auto">{uType}</Badge>}
                          </button>
                        );
                      })}
                    {(companyEmployees ?? [])
                      .filter((e: any) => !assignees.some(a => a.userId === e.id && a.userType === (e._type || 'employee')))
                      .filter((e: any) => !assigneeSearch || e.empName?.toLowerCase().includes(assigneeSearch.toLowerCase()))
                      .length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No matches found</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-dashed">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5"><FolderKanban className="h-3.5 w-3.5" /> Project</span>
              <span className="text-sm font-medium">{(t as any).project?.projectName ?? (t as any).project?.name ?? '—'}</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-dashed">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Due Date</span>
              <span className="text-sm font-medium">
                {t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-dashed">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Est. Hours</span>
              <span className="text-sm font-medium">{(t as any).estimatedHours ?? '—'}</span>
            </div>

            {(t as any).phase?.name && (
              <div className="flex items-center justify-between py-1.5 border-b border-dashed">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> Phase</span>
                <span className="text-sm font-medium">{(t as any).phase.name}</span>
              </div>
            )}

            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Ticket className="h-3.5 w-3.5" /> Ticket ID</span>
              <span className="text-sm font-mono font-medium">{t.ticketNumber}</span>
            </div>
          </div>

          {/* Reassign card */}
          {t.status !== 'closed' && (
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
                <UserRoundPlus className="h-3.5 w-3.5" /> Reassign
              </h3>
              <SearchableSelect
                options={reassignOptions}
                value={reassignTo}
                onValueChange={setReassignTo}
                placeholder="Select person…"
              />
              <Button
                size="sm"
                className="w-full"
                disabled={!reassignTo || reassignMut.isPending}
                onClick={() => reassignMut.mutate({ tId: taskId, target: reassignTo })}
              >
                {reassignMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Reassign'}
              </Button>
            </div>
          )}

          {/* Contributors (for closed tickets) */}
          {t.status === 'closed' && (ticketsApi as any).getContributors && (
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Contributors
              </h3>
              {(savedContributors as any[]).length === 0 ? (
                <p className="text-xs text-muted-foreground">No contributors recorded</p>
              ) : (
                <div className="space-y-1.5">
                  {(savedContributors as any[]).map((c: any) => (
                    <div key={c.id} className="flex items-center gap-2 text-sm">
                      <div className="h-6 w-6 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-[10px] font-bold text-violet-600 dark:text-violet-400">
                        {c.employee?.empName?.[0] ?? '?'}
                      </div>
                      <span>{c.employee?.empName ?? `Employee #${c.employeeId}`}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Contributors dialog (shown when closing a ticket) ─────── */}
      <Dialog open={contributorsOpen} onOpenChange={(open) => { if (!open) { setContributorsOpen(false); setClosingTaskId(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-violet-600" />
              Employees Who Worked on This Ticket
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Select the employees who actually contributed to this ticket before closing.
          </p>
          <div className="max-h-60 overflow-y-auto space-y-1.5 my-2">
            {contributorEmployeeList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No employees found in ticket history.</p>
            ) : (
              contributorEmployeeList.map((emp: any) => (
                <label key={emp.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedContributors.includes(emp.id)}
                    onChange={(e) => {
                      setSelectedContributors((prev) =>
                        e.target.checked ? [...prev, emp.id] : prev.filter((id) => id !== emp.id),
                      );
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{emp.empName}</span>
                </label>
              ))
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { setContributorsOpen(false); setClosingTaskId(null); }}>Cancel</Button>
            <Button
              className="bg-linear-to-r from-violet-600 to-indigo-600 text-white"
              onClick={async () => {
                if ((ticketsApi as any).setContributors) {
                  await setContributorsMut.mutateAsync(selectedContributors);
                }
                updateStatusMut.mutate({ id: closingTaskId!, status: 'closed' as ProjectTaskStatus });
              }}
            >
              Close Ticket
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
