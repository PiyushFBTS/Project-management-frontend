/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ClipboardList, FolderKanban, Search as SearchIcon, Layers, ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { projectsApi } from '@/lib/api/projects';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export default function ProjectsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const isEmployee = user?._type === 'employee';
  const isClient = user?._type === 'client';
  const isHr = isEmployee && !!(user as { isHr?: boolean })?.isHr;
  const canSeeInactive = !isEmployee || isHr;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [groupFilter, setGroupFilter] = useState<string>('all'); // 'all' | groupId | 'ungrouped'
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  // Regular employees can only see active projects — mirror the employees page pattern.
  const effectiveStatus = canSeeInactive ? statusFilter : 'active';

  // Client: fetch their single project and redirect to detail page
  const { data: clientProject } = useQuery({
    queryKey: ['client-project'],
    queryFn: () => projectsApi.clientGetProject().then((r) => r.data?.data ?? r.data),
    enabled: isClient,
  });

  useEffect(() => {
    if (isClient && clientProject?.id) {
      router.replace(`/projects/${clientProject.id}`);
    }
  }, [isClient, clientProject, router]);

  const statusParam = effectiveStatus === 'all' ? undefined : effectiveStatus;
  const { data, isLoading } = useQuery({
    queryKey: ['projects', search, isEmployee, isHr, effectiveStatus],
    queryFn: () =>
      isEmployee
        ? projectsApi.employeeGetAll({ status: statusParam }).then((r) => r.data.data)
        : projectsApi.getAll({ search, limit: 100, status: statusParam }).then((r) => r.data.data),
    enabled: !isClient,
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }: { id: number; name: string }) => projectsApi.remove(id),
    onMutate: ({ name }) => ({ id: toast.loading(`Removing "${name}"…`) }),
    onSuccess: (_, { name }, ctx) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success(`"${name}" removed`, { id: ctx?.id });
    },
    onError: (e: any, _, ctx) => toast.error(e?.response?.data?.message ?? 'Failed to remove project', { id: ctx?.id }),
  });

  const TYPE_LABELS: Record<string, string> = {
    fresh_implement: 'Fresh Implement', migration: 'Migration',
    change_request: 'Change Request', support: 'Support',
    development: 'Development', consulting: 'Consulting', maintenance: 'Maintenance',
  };

  // Shared status pill + row actions so the desktop table and the mobile
  // card list render identically from one source.
  const statusPill = (p: any) => {
    const s = p.status ?? 'active';
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

  const renderActions = (p: any) => (
    <div className="flex gap-1">
      <Button
        variant="ghost" size="icon" className="h-7 w-7 text-violet-500 hover:text-violet-600"
        title="Planning"
        onClick={() => router.push(`/projects/${p.id}/planning`)}
      >
        <ClipboardList className="h-3.5 w-3.5" />
      </Button>
      {!isEmployee && (
        <>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => router.push(`/projects/${p.id}`)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600"
            title="Remove"
            onClick={() => { if (confirm(`Remove "${p.projectName}"?`)) deleteMutation.mutate({ id: p.id, name: p.projectName }); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </div>
  );

  // ── Grouping: split projects into their "primary name" umbrellas + the
  // standalone (ungrouped) ones. Group info rides on each project (p.group).
  const { groups, ungrouped } = useMemo(() => {
    const map = new Map<number, { id: number; name: string; projects: any[] }>();
    const loose: any[] = [];
    for (const p of (data ?? []) as any[]) {
      const g = p.group;
      if (g?.id) {
        const entry = map.get(g.id) ?? { id: g.id, name: g.name, projects: [] as any[] };
        entry.projects.push(p);
        map.set(g.id, entry);
      } else {
        loose.push(p);
      }
    }
    return {
      groups: [...map.values()].sort((a, b) => a.name.localeCompare(b.name)),
      ungrouped: loose,
    };
  }, [data]);

  const visibleGroups = groupFilter === 'all'
    ? groups
    : groupFilter === 'ungrouped'
      ? []
      : groups.filter((g) => String(g.id) === groupFilter);
  const showUngrouped = groupFilter === 'all' || groupFilter === 'ungrouped';
  const hasGroups = groups.length > 0;
  const total = (data ?? []).length;

  const toggleGroup = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const groupBadges = (projects: any[]) => {
    const types = Array.from(new Set(projects.map((p) => p.projectType).filter(Boolean)));
    return types.map((t) => (
      <Badge key={t as string} variant="outline" className="text-[10px]">
        {TYPE_LABELS[t as string] ?? (t as string)}
      </Badge>
    ));
  };

  // ── Single-source card (mobile) + row (desktop) renderers ──
  const projectCard = (p: any) => (
    <div key={p.id} className="rounded-lg border bg-card shadow-sm overflow-hidden">
      <div className="h-1 bg-linear-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
      <div className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/projects/${p.id}`} className="font-semibold text-violet-600 dark:text-violet-400 hover:underline block truncate">
              {p.projectName}
            </Link>
            <p className="font-mono text-[11px] text-muted-foreground mt-0.5">{p.projectCode}</p>
          </div>
          {statusPill(p)}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">{TYPE_LABELS[p.projectType] ?? p.projectType}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Client</p>
            <p className="truncate text-foreground">{p.clientName || '—'}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Manager</p>
            <p className="truncate text-foreground">{p.projectManager?.name ?? '—'}</p>
          </div>
        </div>
        <div className="flex justify-end border-t pt-2">{renderActions(p)}</div>
      </div>
    </div>
  );

  const projectRow = (p: any) => (
    <TableRow key={p.id}>
      <TableCell className="font-mono text-xs">{p.projectCode}</TableCell>
      <TableCell className="font-medium">
        <Link href={`/projects/${p.id}`} className="text-violet-600 dark:text-violet-400 hover:underline">
          {p.projectName}
        </Link>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{TYPE_LABELS[p.projectType] ?? p.projectType}</Badge>
      </TableCell>
      <TableCell className="text-slate-600">{p.clientName}</TableCell>
      <TableCell className="text-slate-600 text-sm">
        {p.projectManager ? p.projectManager.name : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell>{statusPill(p)}</TableCell>
      <TableCell>{renderActions(p)}</TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-4">
      {/* Gradient Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-indigo-600 via-violet-600 to-fuchsia-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoNnptMC0zMHY2aC02VjRoNnptMCAzMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative px-4 py-4 sm:px-6 sm:py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <FolderKanban className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-white truncate">Projects</h1>
              <p className="text-xs sm:text-sm text-white/60 truncate">{isEmployee ? 'Projects with your assigned tickets' : 'Manage all your projects'}</p>
            </div>
          </div>
          {!isEmployee && (
            <Button
              size="sm"
              onClick={() => router.push('/projects/new')}
              className="w-full sm:w-auto bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-0 shadow-lg"
            >
              <Plus className="mr-1.5 h-4 w-4" /> New Project
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {canSeeInactive && (
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'active' | 'inactive' | 'all')}>
            <SelectTrigger className="w-full xs:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        )}
        {hasGroups && (
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-full xs:w-44"><SelectValue placeholder="All groups" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All groups</SelectItem>
              {ungrouped.length > 0 && <SelectItem value="ungrouped">Ungrouped</SelectItem>}
              {groups.map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ── Mobile / small screens: card list (below md) ── */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)
        ) : total === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">No projects found.</div>
        ) : (
          <>
            {visibleGroups.map((g) => {
              const isOpen = !collapsed.has(g.id);
              return (
                <div key={g.id} className="space-y-3">
                  <button
                    type="button"
                    onClick={() => toggleGroup(g.id)}
                    className="w-full flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-left shadow-sm"
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <Layers className="h-4 w-4 text-teal-500 shrink-0" />
                    <Link href={`/project-groups/${g.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-foreground hover:underline truncate">
                      {g.name}
                    </Link>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{g.projects.length}</Badge>
                    <div className="ml-auto hidden xs:flex flex-wrap gap-1 justify-end">{groupBadges(g.projects)}</div>
                  </button>
                  {isOpen && (
                    <div className="space-y-3 border-l-2 border-teal-500/30 pl-3">
                      {g.projects.map(projectCard)}
                    </div>
                  )}
                </div>
              );
            })}
            {showUngrouped && ungrouped.length > 0 && (
              <>
                {hasGroups && (
                  <p className="px-1 pt-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Ungrouped</p>
                )}
                {ungrouped.map(projectCard)}
              </>
            )}
          </>
        )}
      </div>

      {/* ── md and up: full table (scrolls horizontally if cramped) ── */}
      <div className="hidden md:block rounded-lg border bg-card overflow-x-auto shadow-sm">
        <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(7)].map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-24" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : total === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No projects found.</TableCell>
              </TableRow>
            ) : (
              <>
                {visibleGroups.map((g) => {
                  const isOpen = !collapsed.has(g.id);
                  return (
                    <Fragment key={g.id}>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell colSpan={7} className="py-2">
                          <button type="button" onClick={() => toggleGroup(g.id)} className="flex items-center gap-2 w-full text-left">
                            {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            <Layers className="h-4 w-4 text-teal-500" />
                            <Link href={`/project-groups/${g.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold hover:underline">
                              {g.name}
                            </Link>
                            <Badge variant="secondary" className="text-[10px]">{g.projects.length}</Badge>
                            <div className="ml-2 flex flex-wrap gap-1">{groupBadges(g.projects)}</div>
                          </button>
                        </TableCell>
                      </TableRow>
                      {isOpen && g.projects.map(projectRow)}
                    </Fragment>
                  );
                })}
                {showUngrouped && ungrouped.length > 0 && (
                  <>
                    {hasGroups && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={7} className="py-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Ungrouped</TableCell>
                      </TableRow>
                    )}
                    {ungrouped.map(projectRow)}
                  </>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
