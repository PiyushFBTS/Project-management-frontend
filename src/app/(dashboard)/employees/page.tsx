/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Loader2, FolderInput, Users, Search as SearchIcon, Mail, Phone, Briefcase } from 'lucide-react';
import { employeesApi } from '@/lib/api/employees';
import { projectsApi } from '@/lib/api/projects';
import { Employee } from '@/types';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';

const AVATAR_GRADIENT = 'bg-linear-to-r from-emerald-600 via-teal-600 to-cyan-600';

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

const typeLabels: Record<string, string> = {
  project_manager: 'Project Manager',
  functional: 'Functional',
  technical: 'Technical',
  management: 'Management',
  core_team: 'Core Team',
  admin: 'Admin',
};

export default function EmployeesPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const isEmployee = user?._type === 'employee';
  const isAdmin = !isEmployee;
  const isHr = isEmployee && !!(user as any)?.isHr;
  const canSeeInactive = isAdmin || isHr;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEmp, setAssignEmp] = useState<Employee | null>(null);
  const [assignProjectId, setAssignProjectId] = useState<string>('none');

  const effectiveStatus = canSeeInactive ? statusFilter : 'active';
  const isActiveParam = effectiveStatus === 'all' ? undefined : effectiveStatus === 'active';

  const { data, isLoading } = useQuery({
    queryKey: ['employees', search, isEmployee, effectiveStatus],
    queryFn: () =>
      (isEmployee
        ? employeesApi.employeeGetAll({ search, limit: 100, isActive: isActiveParam })
        : employeesApi.getAll({ search, limit: 100, isActive: isActiveParam })
      ).then((r) => r.data.data),
  });

  const { data: projects } = useQuery({
    queryKey: ['projects-active'],
    queryFn: () => projectsApi.getAll({ status: 'active', limit: 200 }).then((r) => r.data.data),
    enabled: isAdmin,
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }: { id: number; name: string }) => employeesApi.remove(id),
    onMutate: ({ name }) => ({ id: toast.loading(`Deactivating "${name}"…`) }),
    onSuccess: (_, { name }, ctx) => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success(`"${name}" deactivated`, { id: ctx?.id });
    },
    onError: (e: any, _, ctx) => toast.error(e?.response?.data?.message ?? 'Failed to deactivate employee', { id: ctx?.id }),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, projectId }: { id: number; projectId: number | null; empName: string }) =>
      employeesApi.assignProject(id, projectId),
    onMutate: ({ empName }) => ({ id: toast.loading(`Assigning project to "${empName}"…`) }),
    onSuccess: (_, { empName, projectId }, ctx) => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success(
        projectId ? `Project assigned to "${empName}"` : `Project unassigned from "${empName}"`,
        { id: ctx?.id },
      );
      setAssignOpen(false);
    },
    onError: (e: any, _, ctx) => toast.error(e?.response?.data?.message ?? 'Failed to assign project', { id: ctx?.id }),
  });

  const openCreate = () => { router.push('/employees/new'); };

  const openEdit = (emp: Employee) => { router.push(`/employees/${emp.id}?type=employee&tab=profile&edit=1`); };

  const openAssign = (emp: Employee) => {
    setAssignEmp(emp);
    setAssignProjectId(emp.assignedProjectId?.toString() ?? 'none');
    setAssignOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Gradient Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-emerald-600 via-teal-600 to-cyan-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoNnptMC0zMHY2aC02VjRoNnptMCAzMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Employees</h1>
              <p className="text-sm text-white/60">Manage your team members</p>
            </div>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={openCreate} className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-0 shadow-lg">
              <Plus className="mr-1.5 h-4 w-4" /> New Employee
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
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

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-4 flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </Card>
          ))}
        </div>
      ) : (data ?? []).length === 0 ? (
        <Card className="py-12 text-center text-muted-foreground">
          No employees found.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(data ?? []).map((emp) => {
            const isAdminRow = (emp as any)._type === 'admin';
            const roleLabel = typeLabels[emp.consultantType] ?? 'Employee';
            return (
              <Card
                key={`${isAdminRow ? 'admin' : 'emp'}-${emp.id}`}
                className="group relative overflow-hidden p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:ring-1 hover:ring-blue-500/30"
              >
                <Link
                  href={`/employees/${emp.id}?type=${isAdminRow ? 'admin' : 'employee'}`}
                  className="flex items-center gap-3"
                >
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${AVATAR_GRADIENT} text-white text-sm font-bold shadow-sm ring-2 ring-white dark:ring-slate-900 transition-transform duration-300 group-hover:scale-110 group-hover:shadow-blue-500/40 group-hover:shadow-lg`}>
                    {getInitials(emp.empName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{emp.empName}</p>
                    <p className="text-xs text-muted-foreground truncate">{roleLabel}</p>
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center text-[9px] font-bold tracking-wider uppercase text-muted-foreground/80">
                        <Briefcase className="h-2.5 w-2.5 mr-1" />
                        {emp.empCode}
                      </span>
                      {!emp.isActive && (
                        <span className="rounded-full px-1.5 py-0 text-[9px] font-bold tracking-wide uppercase bg-rose-500/15 text-rose-500 ring-1 ring-rose-500/30">
                          Inactive
                        </span>
                      )}
                      {(emp as any).isHr && (
                        <span className="rounded-full px-1.5 py-0 text-[9px] font-bold tracking-wide uppercase bg-blue-500/15 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30">
                          HR
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                      {emp.mobileNumber ? (
                        <>
                          <Phone className="h-3 w-3 shrink-0" />
                          <span className="truncate">{emp.mobileNumber}</span>
                        </>
                      ) : emp.email ? (
                        <>
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{emp.email}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </Link>
                {isAdmin && !isAdminRow && (
                  <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* <Button variant="ghost" size="icon" className="h-6 w-6" title="Assign project" onClick={(e) => { e.preventDefault(); openAssign(emp); }}>
                      <FolderInput className="h-3 w-3" />
                    </Button> */}
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Edit" onClick={(e) => { e.preventDefault(); openEdit(emp); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600" title="Deactivate"
                      onClick={(e) => { e.preventDefault(); if (confirm(`Deactivate "${emp.empName}"?`)) deleteMutation.mutate({ id: emp.id, name: emp.empName }); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}


      {/* Assign Project Dialog — admin only */}
      {isAdmin && (
        <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
          <DialogContent className="max-w-sm overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-indigo-500 via-violet-500 to-purple-500" />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderInput className="h-4 w-4 text-indigo-500" />
                Assign Project — {assignEmp?.empName}
              </DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <Select value={assignProjectId} onValueChange={setAssignProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(projects ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.projectName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
              <Button
                disabled={assignMutation.isPending}
                onClick={() =>
                  assignMutation.mutate({
                    id: assignEmp!.id,
                    projectId: assignProjectId === 'none' ? null : Number(assignProjectId),
                    empName: assignEmp!.empName,
                  })
                }
              >
                {assignMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Assign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
