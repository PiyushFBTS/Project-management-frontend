/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Layers, Plus, Trash2, Pencil, FolderPlus, Loader2, Check } from 'lucide-react';
import { projectsApi } from '@/lib/api/projects';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { capitalizeFirst } from '@/lib/utils';

const typeBadge = 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300';

export default function ProjectGroupsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';

  // Admin-only page (mirrors /project-types). HR can still assign groups
  // from the project form; this management surface stays admin-only.
  useEffect(() => {
    if (user && !isAdmin) router.replace('/dashboard');
  }, [user, isAdmin, router]);

  const { data: groups, isLoading } = useQuery({
    queryKey: ['project-groups'],
    queryFn: () => projectsApi.getGroups().then((r: any) => r.data?.data ?? r.data ?? []),
    enabled: isAdmin,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');

  const openCreate = () => {
    setEditId(null); setName(''); setCode(''); setClientName(''); setDescription('');
    setDialogOpen(true);
  };
  const openEdit = (g: any) => {
    setEditId(g.id);
    setName(g.name ?? ''); setCode(g.code ?? ''); setClientName(g.clientName ?? ''); setDescription(g.description ?? '');
    setDialogOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: (dto: any) =>
      editId ? projectsApi.updateGroup(editId, dto) : projectsApi.createGroup(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-groups'] });
      toast.success(editId ? 'Group updated' : 'Group created');
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => projectsApi.deleteGroup(id),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['project-groups'] });
      const n = res?.data?.data?.ungrouped ?? 0;
      toast.success(n > 0 ? `Group deleted · ${n} project(s) ungrouped` : 'Group deleted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const list = (groups ?? []) as any[];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-teal-600 via-emerald-600 to-cyan-600" />
        <div className="relative px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">Project Groups</h1>
              <p className="text-xs sm:text-sm text-white/60">{list.length} group{list.length !== 1 ? 's' : ''} · one primary name, many typed projects</p>
            </div>
          </div>
          <Button
            size="sm"
            className="bg-white text-teal-700 hover:bg-white/90 border-0 shadow-lg font-semibold"
            onClick={openCreate}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add Group
          </Button>
        </div>
      </div>

      {/* Groups grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-12">
          <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No project groups yet. Add one to group projects under a primary name.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map((g: any) => {
            const projects: any[] = g.projects ?? [];
            const types = Array.from(new Set(projects.map((p) => p.projectType).filter(Boolean)));
            return (
              <div key={g.id} className="rounded-xl border bg-card p-4 hover:shadow-lg transition-all duration-200 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button type="button" onClick={() => router.push(`/project-groups/${g.id}`)} className="font-semibold truncate hover:underline text-left block w-full">
                      {g.name}
                    </button>
                    <p className="text-xs text-muted-foreground truncate">
                      {[g.code, g.clientName].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-teal-600" title="Add project to group"
                      onClick={() => router.push(`/projects/new?groupId=${g.id}`)}>
                      <FolderPlus className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-primary" title="Edit group"
                      onClick={() => openEdit(g)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600" title="Delete group"
                      onClick={() => { if (confirm(`Delete group "${g.name}"? Its projects will be ungrouped (not deleted).`)) deleteMut.mutate(g.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">{g.projectCount ?? projects.length} project{(g.projectCount ?? projects.length) !== 1 ? 's' : ''}</Badge>
                  {types.map((t) => <Badge key={t as string} className={`${typeBadge} text-[10px]`}>{t as string}</Badge>)}
                </div>
                {g.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{g.description}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-teal-600" /> {editId ? 'Edit Group' : 'New Project Group'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">Name *</label>
              <Input value={name} onChange={(e) => setName(capitalizeFirst(e.target.value))} placeholder="e.g. BTW" className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">Code</label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="optional" className="h-9 font-mono" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">Client</label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="optional" className="h-9" />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">Description</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="optional" className="h-9" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!name.trim() || saveMut.isPending}
              onClick={() => saveMut.mutate({
                name: name.trim(),
                code: code.trim() || undefined,
                clientName: clientName.trim() || undefined,
                description: description.trim() || undefined,
              })}
            >
              {saveMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
              {editId ? 'Save' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
