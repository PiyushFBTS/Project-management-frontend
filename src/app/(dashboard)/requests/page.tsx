/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Plus, Trash2, Loader2, Inbox, FileText,
  Image as ImageIcon, User as UserIcon, Users, Settings2,
} from 'lucide-react';
import { requestsApi, adminRequestsApi, hrRequestsApi, RequestTeam } from '@/lib/api/requests';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

export default function RequestsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const isAdmin = user?._type === 'admin';
  const isEmployee = user?._type === 'employee';
  const isHr = isEmployee && !!(user as any)?.isHr;
  // Admin and HR can review the whole company queue.
  const canReview = isAdmin || isHr;
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:8000';

  const [statusFilter, setStatusFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Teams the current employee belongs to — non-reviewer members get a
  // "My Team" queue. Reviewers already see everything, so skip the call.
  const { data: myTeamsRaw } = useQuery({
    queryKey: ['my-request-teams'],
    queryFn: async () => {
      const r = await requestsApi.getMyTeams();
      return (r.data?.data ?? r.data ?? []) as RequestTeam[];
    },
    enabled: !!user && isEmployee && !isHr,
  });
  const isTeamMember = Array.isArray(myTeamsRaw) && myTeamsRaw.length > 0;

  // Tabs: reviewers → team(all) + my; non-HR team members → myteam + my;
  // everyone else → my only.
  type Tab = 'my' | 'team' | 'myteam';
  const [activeTab, setActiveTab] = useState<Tab>(canReview ? 'team' : 'my');
  // Promote a fresh team member to their queue once membership loads.
  useEffect(() => {
    if (!canReview && isTeamMember) setActiveTab((t) => (t === 'my' ? 'myteam' : t));
  }, [canReview, isTeamMember]);

  // Teams — for the filter dropdown. Admins read the admin list (incl.
  // inactive); everyone else reads the active list.
  const { data: teamsRaw } = useQuery({
    queryKey: ['request-teams', isAdmin],
    queryFn: async () => {
      const r = isAdmin ? await adminRequestsApi.getTeams() : await requestsApi.getTeams();
      return (r.data?.data ?? r.data ?? []) as RequestTeam[];
    },
    enabled: !!user,
  });
  const teams: RequestTeam[] = Array.isArray(teamsRaw) ? teamsRaw : [];

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['requests', isAdmin, isHr, statusFilter, teamFilter, activeTab],
    queryFn: async () => {
      const params: any = {
        limit: 200,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        teamId: teamFilter !== 'all' ? Number(teamFilter) : undefined,
      };
      if (canReview && activeTab === 'team') {
        const r = isAdmin ? await adminRequestsApi.getAll(params) : await hrRequestsApi.getAll(params);
        return r.data?.data ?? r.data;
      }
      if (activeTab === 'myteam') {
        const r = await requestsApi.getTeamQueue(params);
        return r.data?.data ?? r.data;
      }
      const r = await requestsApi.getMyRequests({ limit: 100 });
      return r.data?.data ?? r.data;
    },
    enabled: !!user,
  });

  const allRequests: any[] = Array.isArray(rawData) ? rawData : (rawData as any)?.data ?? [];
  const requests = allRequests.filter((req: any) => {
    // Team filter is server-side on the team tab, but the "my" tab fetches
    // unfiltered — apply it client-side so the dropdown works in both.
    if (teamFilter !== 'all' && String(req.teamId ?? '') !== teamFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (req.title ?? '').toLowerCase().includes(q)
      || (req.employee?.name ?? req.submitterName ?? '').toLowerCase().includes(q)
      || (req.team?.name ?? '').toLowerCase().includes(q);
  });

  // Request pending delete confirmation (null = modal closed).
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const deleteMut = useMutation({
    mutationFn: (id: number) => isAdmin ? adminRequestsApi.delete(id) : requestsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['requests'] }); toast.success('Deleted'); setDeleteTarget(null); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  // "Raised By" column makes sense whenever we're showing other people's
  // requests (the all-company queue or a team queue).
  const showTeam = activeTab === 'team' || activeTab === 'myteam';

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary shrink-0" /> Requests
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {canReview ? 'Review and action employee requests' : 'Raise and track your requests'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <Input
            placeholder="Search title, employee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 flex-1 min-w-[160px] sm:w-[220px] sm:flex-none text-xs"
          />
          <SearchableSelect
            value={statusFilter}
            // SearchableSelect's clear (✕) emits '' — fall back to 'all'.
            onValueChange={(v) => setStatusFilter(v || 'all')}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'pending', label: 'Pending' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'rejected', label: 'Rejected' },
            ]}
            className="w-[150px]"
          />
          <SearchableSelect
            value={teamFilter}
            onValueChange={(v) => setTeamFilter(v || 'all')}
            options={[
              { value: 'all', label: 'All Teams' },
              ...teams.map((t) => ({ value: String(t.id), label: t.name })),
            ]}
            className="w-[160px]"
          />
          {canReview && (
            <Button size="sm" variant="outline" onClick={() => router.push('/requests/teams')} title="Manage teams">
              <Settings2 className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Teams</span>
            </Button>
          )}
          <Button size="sm" onClick={() => router.push('/requests/new')} className="ml-auto sm:ml-0">
            <Plus className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Raise Request</span><span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      {/* Tabs — reviewers get the all-company queue; team members get their
          team queue; both also get their own raised requests. */}
      {(canReview || isTeamMember) && (
        <div className="flex gap-1 p-0.5 bg-muted rounded-lg w-fit">
          {(canReview ? (['team', 'my'] as Tab[]) : (['myteam', 'my'] as Tab[])).map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === tab ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {tab === 'team' ? 'All Requests' : tab === 'myteam' ? 'My Team' : 'My Requests'}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <Card><CardContent className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</CardContent></Card>
      ) : requests.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No requests found</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Ticket</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Title</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Team</th>
                    {showTeam && <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Raised By</th>}
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Doc</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Date</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req: any) => (
                    <tr key={req.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => router.push(`/requests/${req.id}`)}>
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-muted-foreground">{req.requestNo ?? `#${req.id}`}</td>
                      <td className="px-3 py-2 max-w-[280px]">
                        <p className="font-medium truncate">{req.title}</p>
                        {req.description && <p className="text-xs text-muted-foreground truncate">{req.description}</p>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {req.team?.name ? (
                          <Badge variant="outline" className="text-[10px] gap-1"><Users className="h-3 w-3" />{req.team.name}</Badge>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      {showTeam && (
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            {req.employee?.name ?? req.submitterName ?? '—'}
                          </span>
                        </td>
                      )}
                      <td className="px-3 py-2 text-center">
                        {req.attachmentPath ? (
                          <a href={req.attachmentPath?.startsWith('http') ? req.attachmentPath : `${apiBase}${req.attachmentPath}`} target="_blank" rel="noreferrer" className="text-primary hover:underline" onClick={(ev) => ev.stopPropagation()}>
                            {req.attachmentName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? <ImageIcon className="h-4 w-4 inline" /> : <FileText className="h-4 w-4 inline" />}
                          </a>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {req.createdAt ? format(new Date(req.createdAt), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge className={`text-[10px] border-0 ${STATUS_COLORS[req.status] ?? ''}`}>{STATUS_LABELS[req.status] ?? req.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-center" onClick={(ev) => ev.stopPropagation()}>
                        {(isAdmin || (isEmployee && !isHr && req.status === 'pending')) && (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => setDeleteTarget(req)} title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" /> Delete request?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete{' '}
            <span className="font-semibold text-foreground">
              {deleteTarget?.requestNo ?? `#${deleteTarget?.id}`}
            </span>
            {deleteTarget?.title ? <> — “{deleteTarget.title}”</> : null}. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              {deleteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
