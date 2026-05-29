/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft, Layers, Plus, FolderKanban, ClipboardList, FolderInput, Loader2, Check, Search as SearchIcon } from 'lucide-react';
import { projectsApi } from '@/lib/api/projects';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const TYPE_LABELS: Record<string, string> = {
  fresh_implement: 'Fresh Implement', migration: 'Migration', change_request: 'Change Request',
  support: 'Support', development: 'Development', consulting: 'Consulting', maintenance: 'Maintenance',
};

const statusPill = (s: string) => {
  const cls = s === 'active'
    ? 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30'
    : s === 'completed'
      ? 'bg-blue-500/15 text-blue-600 ring-blue-500/30'
      : 'bg-slate-500/15 text-slate-500 ring-slate-500/30';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      {s === 'active' ? 'Active' : s === 'completed' ? 'Completed' : 'Inactive'}
    </span>
  );
};

export default function ProjectGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isEmployee = user?._type === 'employee';

  const { data: group, isLoading } = useQuery({
    queryKey: ['project-group', id],
    queryFn: () => projectsApi.getGroup(Number(id)).then((r: any) => r.data?.data ?? r.data),
  });

  // ── "Assign existing projects" migration helper ──
  const [assignOpen, setAssignOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data: allProjects, isLoading: loadingAll } = useQuery({
    queryKey: ['projects', 'all-for-assign'],
    queryFn: () => projectsApi.getAll({ limit: 100 }).then((r) => r.data.data),
    enabled: assignOpen,
  });
  // Only projects not already in THIS group can be assigned (those in
  // another group are moved). Standalone + other-group projects qualify.
  const assignable = ((allProjects ?? []) as any[]).filter((p) => p.groupId !== Number(id));

  // Pre-select projects whose name matches the group's primary name — the
  // common "I made 3 projects all called BTW" case.
  useEffect(() => {
    if (assignOpen && group && assignable.length) {
      const sameName = assignable
        .filter((p) => (p.projectName ?? '').trim().toLowerCase() === (group.name ?? '').trim().toLowerCase())
        .map((p) => p.id as number);
      if (sameName.length) setSelected(new Set(sameName));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignOpen, allProjects, group?.name]);

  const assignMut = useMutation({
    mutationFn: (ids: number[]) => projectsApi.assignProjectsToGroup(Number(id), ids),
    onSuccess: (res: any) => {
      const n = res?.data?.data?.assigned ?? 0;
      qc.invalidateQueries({ queryKey: ['project-group', id] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project-groups'] });
      toast.success(`${n} project(s) added to the group`);
      setAssignOpen(false);
      setSelected(new Set());
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to assign projects'),
  });

  const toggle = (pid: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });

  const filteredAssignable = assignable.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (p.projectName ?? '').toLowerCase().includes(q) || (p.projectCode ?? '').toLowerCase().includes(q);
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-16">
        <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Project group not found.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push('/project-groups')}>Back to groups</Button>
      </div>
    );
  }

  const projects: any[] = group.projects ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-teal-600 via-emerald-600 to-cyan-600" />
        <div className="relative px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 shrink-0" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-white truncate">{group.name}</h1>
              <p className="text-xs sm:text-sm text-white/60 truncate">
                {[group.code, group.clientName].filter(Boolean).join(' · ') || 'Primary project name'} · {projects.length} project{projects.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          {!isEmployee && (
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 border-white/30"
                onClick={() => { setSelected(new Set()); setSearch(''); setAssignOpen(true); }}
              >
                <FolderInput className="mr-1.5 h-4 w-4" /> Assign Existing
              </Button>
              <Button
                size="sm"
                className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-0 shadow-lg"
                onClick={() => router.push(`/projects/new?groupId=${group.id}`)}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Add Project
              </Button>
            </div>
          )}
        </div>
      </div>

      {group.description && (
        <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">{group.description}</div>
      )}

      {/* Typed projects under this group */}
      {projects.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center">
          <FolderKanban className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No projects in this group yet.</p>
          {!isEmployee && (
            <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push(`/projects/new?groupId=${group.id}`)}>
              <Plus className="mr-1.5 h-4 w-4" /> Add the first project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((p) => (
            <div key={p.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="h-1 bg-linear-to-r from-teal-500 to-cyan-500" />
              <div className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/projects/${p.id}`} className="font-semibold text-teal-600 dark:text-teal-400 hover:underline block truncate">
                      {p.projectName}
                    </Link>
                    <p className="font-mono text-[11px] text-muted-foreground mt-0.5">{p.projectCode}</p>
                  </div>
                  {statusPill(p.status ?? 'active')}
                </div>
                <Badge variant="outline" className="text-xs">{TYPE_LABELS[p.projectType] ?? p.projectType}</Badge>
                <div className="flex justify-end border-t pt-2 gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-violet-500 hover:text-violet-600" title="Planning"
                    onClick={() => router.push(`/projects/${p.id}/planning`)}>
                    <ClipboardList className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7" onClick={() => router.push(`/projects/${p.id}`)}>
                    Open
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Assign existing projects (migration helper) ── */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-lg flex flex-col max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderInput className="h-5 w-5 text-teal-600" /> Add existing projects to {group.name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Projects matching this group&apos;s name are pre-selected. Selecting a project already in another group moves it here.
          </p>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name or code..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1.5 min-h-[120px]">
            {loadingAll ? (
              [...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)
            ) : filteredAssignable.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No assignable projects.</p>
            ) : (
              filteredAssignable.map((p) => {
                const checked = selected.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={`w-full flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${checked ? 'border-teal-500 bg-teal-500/5' : 'hover:bg-muted/50'}`}
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded border shrink-0 ${checked ? 'bg-teal-600 border-teal-600 text-white' : 'border-muted-foreground/40'}`}>
                      {checked && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.projectName}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{p.projectCode}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">{TYPE_LABELS[p.projectType] ?? p.projectType}</Badge>
                    {p.group?.name && <span className="text-[10px] text-amber-600 shrink-0">in {p.group.name}</span>}
                  </button>
                );
              })
            )}
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
              <Button
                disabled={selected.size === 0 || assignMut.isPending}
                onClick={() => assignMut.mutate([...selected])}
              >
                {assignMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                Add {selected.size > 0 ? `(${selected.size})` : ''}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
