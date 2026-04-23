/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ClipboardList, FolderKanban, Search as SearchIcon } from 'lucide-react';
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

  return (
    <div className="space-y-4">
      {/* Gradient Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-indigo-600 via-violet-600 to-fuchsia-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoNnptMC0zMHY2aC02VjRoNnptMCAzMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <FolderKanban className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Projects</h1>
              <p className="text-sm text-white/60">{isEmployee ? 'Projects with your assigned tickets' : 'Manage all your projects'}</p>
            </div>
          </div>
          {!isEmployee && (
            <Button
              size="sm"
              onClick={() => router.push('/projects/new')}
              className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-0 shadow-lg"
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
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
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
            {isLoading
              ? [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(7)].map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-24" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : (data ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.projectCode}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/projects/${p.id}`} className="text-violet-600 dark:text-violet-400 hover:underline">
                        {p.projectName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{
                        ({ fresh_implement: 'Fresh Implement', migration: 'Migration', change_request: 'Change Request', support: 'Support', development: 'Development', consulting: 'Consulting', maintenance: 'Maintenance' } as Record<string, string>)[p.projectType] ?? p.projectType
                      }</Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">{p.clientName}</TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {p.projectManager ? p.projectManager.empName : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const s = (p as any).status ?? 'active';
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
                      })()}
                    </TableCell>
                    <TableCell>
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
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.push(`/projects/${p.id}`)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600"
                              onClick={() => { if (confirm(`Remove "${p.projectName}"?`)) deleteMutation.mutate({ id: p.id, name: p.projectName }); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
