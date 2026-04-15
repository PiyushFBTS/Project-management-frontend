/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import Link from 'next/link';
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

const empSchema = z.object({
  empCode: z.string().optional(),
  empName: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  mobileNumber: z.string().max(20, 'Max 20 characters').optional(),
  password: z.string().optional(),
  consultantType: z.enum(['project_manager', 'functional', 'technical', 'management', 'core_team']),
  reportsToId: z.string().optional(),
  isHr: z.boolean().optional(),
  dateOfBirth: z.string().optional(),
  joiningDate: z.string().optional(),
});

type EmpFormValues = z.infer<typeof empSchema>;

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
  const { user } = useAuth();
  const isEmployee = user?._type === 'employee';
  const isAdmin = !isEmployee;

  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [assignEmp, setAssignEmp] = useState<Employee | null>(null);
  const [assignProjectId, setAssignProjectId] = useState<string>('none');
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['employees', search, isEmployee],
    queryFn: () =>
      (isEmployee
        ? employeesApi.employeeGetAll({ search, limit: 100 })
        : employeesApi.getAll({ search, limit: 100 })
      ).then((r) => r.data.data),
  });

  const { data: projects } = useQuery({
    queryKey: ['projects-active'],
    queryFn: () => projectsApi.getAll({ status: 'active', limit: 200 }).then((r) => r.data.data),
    enabled: isAdmin,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<EmpFormValues>({
    resolver: zodResolver(empSchema),
    defaultValues: { consultantType: 'functional' },
  });

  const consultantType = watch('consultantType');

  const createMutation = useMutation({
    mutationFn: (values: EmpFormValues) =>
      employeesApi.create({
        empCode: values.empCode!,
        empName: values.empName,
        email: values.email,
        mobileNumber: values.mobileNumber,
        password: values.password!,
        consultantType: values.consultantType,
        reportsToId: values.reportsToId && values.reportsToId !== 'none' ? Number(values.reportsToId) : undefined,
        isHr: values.isHr,
        dateOfBirth: values.dateOfBirth || undefined,
        joiningDate: values.joiningDate || undefined,
      }),
    onMutate: () => setFormError(null),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success(`"${res.data.data.empName}" added`);
      setOpen(false);
      reset();
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message;
      setFormError(Array.isArray(msg) ? msg.join('\n') : (msg ?? 'Failed to create employee'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: EmpFormValues }) =>
      employeesApi.update(id, {
        empName: values.empName,
        email: values.email,
        mobileNumber: values.mobileNumber,
        consultantType: values.consultantType,
        reportsToId: values.reportsToId && values.reportsToId !== 'none' ? Number(values.reportsToId) : null,
        isHr: values.isHr,
        dateOfBirth: values.dateOfBirth || null,
        joiningDate: values.joiningDate || null,
      }),
    onMutate: () => setFormError(null),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success(`"${res.data.data.empName}" updated`);
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message;
      setFormError(Array.isArray(msg) ? msg.join('\n') : (msg ?? 'Failed to update employee'));
    },
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

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    reset({ consultantType: 'functional' });
    setOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setFormError(null);
    reset({
      empName: emp.empName,
      email: emp.email,
      mobileNumber: emp.mobileNumber ?? '',
      consultantType: emp.consultantType,
      reportsToId: emp.reportsToId?.toString() ?? 'none',
      isHr: emp.isHr ?? false,
      dateOfBirth: emp.dateOfBirth ?? '',
      joiningDate: emp.joiningDate ?? '',
    });
    setOpen(true);
  };

  const openAssign = (emp: Employee) => {
    setAssignEmp(emp);
    setAssignProjectId(emp.assignedProjectId?.toString() ?? 'none');
    setAssignOpen(true);
  };

  const onSubmit = (values: EmpFormValues) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

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

      <div className="relative w-full sm:max-w-xs">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search employees..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
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
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Assign project" onClick={(e) => { e.preventDefault(); openAssign(emp); }}>
                      <FolderInput className="h-3 w-3" />
                    </Button>
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

      {/* Create / Edit Dialog — admin only */}
      {isAdmin && (
        <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); setEditing(null); } }}>
          <DialogContent className="max-w-lg overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-emerald-500 via-teal-500 to-cyan-500" />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-500" />
                {editing ? 'Edit Employee' : 'New Employee'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              {/* Server-side error banner */}
              {formError && (
                <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-3 py-2.5">
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-0.5">Please fix the following:</p>
                  {formError.split('\n').map((line, i) => (
                    <p key={i} className="text-xs text-red-600 dark:text-red-400">• {line}</p>
                  ))}
                </div>
              )}

              {!editing && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Emp Code</label>
                  <Input {...register('empCode')} className={errors.empCode ? 'border-red-500 focus-visible:ring-red-500' : ''} />
                  {errors.empCode && <p className="text-xs text-red-500">{errors.empCode.message}</p>}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Full Name <span className="text-red-500">*</span></label>
                  <Input {...register('empName')} className={errors.empName ? 'border-red-500 focus-visible:ring-red-500' : ''} />
                  {errors.empName && <p className="text-xs text-red-500">{errors.empName.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Email <span className="text-red-500">*</span></label>
                  <Input type="email" {...register('email')} className={errors.email ? 'border-red-500 focus-visible:ring-red-500' : ''} />
                  {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Phone</label>
                  <Input {...register('mobileNumber')} className={errors.mobileNumber ? 'border-red-500 focus-visible:ring-red-500' : ''} />
                  {errors.mobileNumber && <p className="text-xs text-red-500">{errors.mobileNumber.message}</p>}
                </div>
                {!editing && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Password <span className="text-red-500">*</span></label>
                    <Input type="password" {...register('password')} className={errors.password ? 'border-red-500 focus-visible:ring-red-500' : ''} />
                    {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-sm font-medium">Consultant Type <span className="text-red-500">*</span></label>
                  <Select
                    value={consultantType}
                    onValueChange={(v) => setValue('consultantType', v as EmpFormValues['consultantType'])}
                  >
                    <SelectTrigger className={`w-full ${errors.consultantType ? 'border-red-500' : ''}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(typeLabels).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.consultantType && <p className="text-xs text-red-500">{errors.consultantType.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Reports To</label>
                  <Select
                    value={watch('reportsToId') ?? 'none'}
                    onValueChange={(v) => setValue('reportsToId', v)}
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select manager" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {(data ?? [])
                        .filter((e) => e.isActive && e.id !== editing?.id)
                        .filter((e, idx, arr) => arr.findIndex((x) => x.id === e.id) === idx)
                        .map((e) => (
                          <SelectItem key={`${(e as any)._type ?? 'employee'}-${e.id}`} value={String(e.id)}>
                            {e.empName} ({e.empCode})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2 pb-1">
                <input
                  type="checkbox"
                  id="isHr"
                  checked={watch('isHr') ?? false}
                  onChange={(e) => setValue('isHr', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="isHr" className="text-sm font-medium leading-none">Is HR</label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Date of Birth</label>
                  <Input type="date" {...register('dateOfBirth')} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Joining Date</label>
                  <Input type="date" {...register('joiningDate')} />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); setFormError(null); }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editing ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
