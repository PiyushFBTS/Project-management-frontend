/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Plus, Pencil, Trash2, Users, Power, UserPlus, X } from 'lucide-react';
import { requestsApi, adminRequestsApi, hrRequestsApi, RequestTeam, RequestTeamMember } from '@/lib/api/requests';
import { employeesApi } from '@/lib/api/employees';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';

export default function ManageRequestTeamsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';
  const isEmployee = user?._type === 'employee';
  const isHr = isEmployee && !!(user as any)?.isHr;
  const canManage = isAdmin || isHr;

  // HR can only ever see the active list (its endpoint filters inactive
  // out); admins get the full list. Mutations route to the matching API.
  const teamsApi = isAdmin ? adminRequestsApi : hrRequestsApi;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RequestTeam | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const { data: teamsRaw, isLoading } = useQuery({
    queryKey: ['request-teams-manage', isAdmin],
    queryFn: async () => {
      // Admin has a dedicated list endpoint (incl. inactive); HR reuses the
      // active picker list.
      const r = isAdmin ? await adminRequestsApi.getTeams() : await requestsApi.getTeams();
      return (r.data?.data ?? r.data ?? []) as RequestTeam[];
    },
    enabled: !!user && canManage,
  });
  const teams: RequestTeam[] = Array.isArray(teamsRaw) ? teamsRaw : [];

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = { name: name.trim(), description: description.trim() || undefined };
      if (editing) return teamsApi.updateTeam(editing.id, payload);
      return teamsApi.createTeam(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['request-teams-manage'] });
      qc.invalidateQueries({ queryKey: ['request-teams'] });
      toast.success(editing ? 'Team updated' : 'Team created');
      closeDialog();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to save team'),
  });

  const toggleMut = useMutation({
    mutationFn: (team: RequestTeam) => teamsApi.updateTeam(team.id, { isActive: !team.isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['request-teams-manage'] });
      qc.invalidateQueries({ queryKey: ['request-teams'] });
      toast.success('Team updated');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => teamsApi.deleteTeam(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['request-teams-manage'] });
      qc.invalidateQueries({ queryKey: ['request-teams'] });
      toast.success('Team deleted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  // ── Members ───────────────────────────────────────────────────────────
  const [membersTeam, setMembersTeam] = useState<RequestTeam | null>(null);
  const [addEmployeeId, setAddEmployeeId] = useState('');

  const { data: membersRaw, isLoading: membersLoading } = useQuery({
    queryKey: ['request-team-members', membersTeam?.id],
    queryFn: async () => {
      const r = await teamsApi.getMembers(membersTeam!.id);
      return (r.data?.data ?? r.data ?? []) as RequestTeamMember[];
    },
    enabled: !!membersTeam,
  });
  const members: RequestTeamMember[] = Array.isArray(membersRaw) ? membersRaw : [];

  // Employee list to pick from — admin uses the admin list, HR the
  // employee-facing mirror.
  const { data: employeesRaw } = useQuery({
    queryKey: ['employees-for-team-picker', isAdmin],
    queryFn: async () => {
      // NOTE: backend caps pagination `limit` at 100 — sending more returns
      // 400 and the picker comes back empty.
      const r = isAdmin
        ? await employeesApi.getAll({ isActive: true, limit: 100 })
        : await employeesApi.employeeGetAll({ isActive: true, limit: 100 });
      const all = r.data?.data ?? r.data ?? [];
      return (Array.isArray(all) ? all : (all as any)?.data ?? []) as any[];
    },
    enabled: !!membersTeam,
  });
  const employees: any[] = Array.isArray(employeesRaw) ? employeesRaw : [];

  const addMemberMut = useMutation({
    mutationFn: () => teamsApi.addMember(membersTeam!.id, Number(addEmployeeId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['request-team-members', membersTeam?.id] });
      qc.invalidateQueries({ queryKey: ['my-request-teams'] });
      toast.success('Member added');
      setAddEmployeeId('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to add member'),
  });

  const removeMemberMut = useMutation({
    mutationFn: (employeeId: number) => teamsApi.removeMember(membersTeam!.id, employeeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['request-team-members', membersTeam?.id] });
      qc.invalidateQueries({ queryKey: ['my-request-teams'] });
      toast.success('Member removed');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  // Employees not already on the team — the picker options.
  const memberIds = new Set(members.map((m) => m.employeeId));
  const employeeOptions = employees
    .filter((e) => !memberIds.has(e.id))
    .map((e) => ({ value: String(e.id), label: e.name ?? e.email ?? `#${e.id}` }));

  const openCreate = () => { setEditing(null); setName(''); setDescription(''); setDialogOpen(true); };
  const openEdit = (t: RequestTeam) => { setEditing(t); setName(t.name); setDescription(t.description ?? ''); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); setName(''); setDescription(''); };

  if (!canManage) {
    return (
      <div className="text-center py-20">
        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-lg font-medium">You don&apos;t have access to manage teams</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/requests')}>Back to Requests</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <button onClick={() => router.push('/requests')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-1">
            <ArrowLeft className="h-4 w-4" /> Back to Requests
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            Request Teams
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Teams employees can route their requests to.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> New Team
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <Card><CardContent className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</CardContent></Card>
      ) : teams.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No teams yet. Create your first one.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Description</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t) => (
                    <tr key={t.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">{t.name}</td>
                      <td className="px-4 py-2 text-muted-foreground max-w-[360px] truncate">{t.description || '—'}</td>
                      <td className="px-4 py-2 text-center">
                        <Badge className={`text-[10px] border-0 ${t.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                          {t.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-center gap-1">
                          {/* Only admins see the active/inactive toggle — HR's
                              list never includes inactive teams to reactivate. */}
                          {isAdmin && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title={t.isActive ? 'Deactivate' : 'Activate'} disabled={toggleMut.isPending} onClick={() => toggleMut.mutate(t)}>
                              <Power className={`h-3.5 w-3.5 ${t.isActive ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs" title="Manage members" onClick={() => { setMembersTeam(t); setAddEmployeeId(''); }}>
                            <Users className="h-3.5 w-3.5" /> Members
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Edit" onClick={() => openEdit(t)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" title="Delete" disabled={deleteMut.isPending}
                            onClick={() => { if (confirm(`Delete team "${t.name}"? Existing requests keep their history but lose the team link.`)) deleteMut.mutate(t.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members dialog */}
      <Dialog open={!!membersTeam} onOpenChange={(o) => { if (!o) { setMembersTeam(null); setAddEmployeeId(''); } }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> {membersTeam?.name} — Members</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">Members see and action every request routed to this team.</p>

          {/* Add member */}
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Add employee</label>
              <SearchableSelect
                value={addEmployeeId}
                onValueChange={setAddEmployeeId}
                options={employeeOptions}
                placeholder="Search employees..."
              />
            </div>
            <Button disabled={!addEmployeeId || addMemberMut.isPending} onClick={() => addMemberMut.mutate()}>
              {addMemberMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            </Button>
          </div>

          {/* Current members */}
          <div className="mt-2 max-h-[300px] overflow-y-auto space-y-1.5">
            {membersLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No members yet. Add one above.</p>
            ) : (
              members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.employee?.name ?? `#${m.employeeId}`}</p>
                    {m.employee?.email && <p className="text-xs text-muted-foreground truncate">{m.employee.email}</p>}
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 shrink-0" title="Remove" disabled={removeMemberMut.isPending}
                    onClick={() => removeMemberMut.mutate(m.employeeId)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader><DialogTitle>{editing ? 'Edit Team' : 'New Team'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Name <span className="text-red-500">*</span></label>
              <Input placeholder="e.g. IT, Facilities, Payroll" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoFocus />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What kind of requests should go here?"
                rows={3}
                className="w-full rounded-md border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button disabled={name.trim().length < 2 || saveMut.isPending} onClick={() => saveMut.mutate()}>
                {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {editing ? 'Save' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
