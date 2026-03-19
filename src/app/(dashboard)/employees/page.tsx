/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, FolderInput, Users, Search as SearchIcon } from 'lucide-react';
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

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

      <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
        <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-emerald-500 via-teal-500 to-cyan-500" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Reports To</TableHead>
              <TableHead>HR</TableHead>
              <TableHead>Active</TableHead>
              {isAdmin && <TableHead className="w-28">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(isAdmin ? 9 : 8)].map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
              : (data ?? []).map((emp) => (
                <TableRow key={`${(emp as any)._type === 'admin' ? 'admin' : 'emp'}-${emp.id}`}>
                  <TableCell className="font-mono text-xs">{emp.empCode}</TableCell>
                  <TableCell className="font-medium">{emp.empName}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{emp.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {typeLabels[emp.consultantType] ?? emp.consultantType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {emp.assignedProject?.projectName ?? <span className="text-muted-foreground/60">—</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {emp.reportsTo?.empName ?? <span className="text-muted-foreground/60">—</span>}
                  </TableCell>
                  <TableCell>
                    {emp.isHr && (
                      <Badge variant="outline" className="text-xs bg-violet-500/15 text-violet-600 ring-violet-500/30 border-0">
                        HR
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${emp.isActive ? 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-500 ring-rose-500/30'}`}>
                      {emp.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Assign project" onClick={() => openAssign(emp)}>
                          <FolderInput className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(emp)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600"
                          onClick={() => { if (confirm(`Deactivate "${emp.empName}"?`)) deleteMutation.mutate({ id: emp.id, name: emp.empName }); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

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
