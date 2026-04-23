/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, FileText, Search as SearchIcon } from 'lucide-react';
import { leaveTypesApi } from '@/lib/api/leave-reasons';
import { LeaveType } from '@/types';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const schema = z.object({
  reasonCode: z.string().min(1, 'Required').max(50),
  reasonName: z.string().min(1, 'Required').max(150),
  description: z.string().optional(),
  // Number input: use `valueAsNumber: true` on the <input> so RHF hands us a number.
  defaultDays: z.number({ message: 'Must be a number' })
    .int()
    .min(0, 'Must be 0 or more'),
});

type FormValues = z.infer<typeof schema>;

export default function LeaveTypesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isEmployee = user?._type === 'employee';
  const isAdmin = !isEmployee;
  const isHr = isEmployee && (user as any)?.isHr;
  const canManage = isAdmin || isHr;

  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveType | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['leave-types', search, isEmployee],
    queryFn: () =>
      (isEmployee
        ? leaveTypesApi.employeeGetAll({ search, limit: 100 })
        : leaveTypesApi.getAll({ search, limit: 100 })
      ).then((r) => r.data.data),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const createMutation = useMutation({
    mutationFn: (dto: FormValues) =>
      isEmployee ? leaveTypesApi.employeeCreate(dto) : leaveTypesApi.create(dto),
    onMutate: () => ({ id: toast.loading('Creating leave type...') }),
    onSuccess: (res, _, ctx) => {
      qc.invalidateQueries({ queryKey: ['leave-types'] });
      toast.success(`"${res.data.data.reasonName}" created`, { id: ctx?.id });
      setOpen(false);
      reset();
    },
    onError: (e: any, _, ctx) => toast.error(e?.response?.data?.message ?? 'Failed to create leave type', { id: ctx?.id }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<FormValues> }) =>
      isEmployee ? leaveTypesApi.employeeUpdate(id, dto) : leaveTypesApi.update(id, dto),
    onMutate: () => ({ id: toast.loading('Updating leave type...') }),
    onSuccess: (res, _, ctx) => {
      qc.invalidateQueries({ queryKey: ['leave-types'] });
      toast.success(`"${res.data.data.reasonName}" updated`, { id: ctx?.id });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any, _, ctx) => toast.error(e?.response?.data?.message ?? 'Failed to update leave type', { id: ctx?.id }),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }: { id: number; name: string }) =>
      isEmployee ? leaveTypesApi.employeeRemove(id) : leaveTypesApi.remove(id),
    onMutate: ({ name }) => ({ id: toast.loading(`Deactivating "${name}"...`) }),
    onSuccess: (_, { name }, ctx) => {
      qc.invalidateQueries({ queryKey: ['leave-types'] });
      toast.success(`"${name}" deactivated`, { id: ctx?.id });
    },
    onError: (e: any, _, ctx) => toast.error(e?.response?.data?.message ?? 'Failed to deactivate leave type', { id: ctx?.id }),
  });

  const openCreate = () => {
    setEditing(null);
    reset({ reasonCode: '', reasonName: '', description: '', defaultDays: 0 });
    setOpen(true);
  };

  const openEdit = (r: LeaveType) => {
    setEditing(r);
    reset({
      reasonCode: r.reasonCode,
      reasonName: r.reasonName,
      description: r.description ?? '',
      defaultDays: (r as any).defaultDays ?? 0,
    });
    setOpen(true);
  };

  const onSubmit = (values: FormValues) => {
    if (editing) updateMutation.mutate({ id: editing.id, dto: values });
    else createMutation.mutate(values);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Gradient Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-orange-600 via-rose-600 to-pink-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoNnptMC0zMHY2aC02VjRoNnptMCAzMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Leave Types</h1>
              <p className="text-sm text-white/60">Leave type categories</p>
            </div>
          </div>
          {canManage && (
            <Button size="sm" onClick={openCreate} className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-0 shadow-lg">
              <Plus className="mr-1.5 h-4 w-4" /> New Leave Type
            </Button>
          )}
        </div>
      </div>

      <div className="relative w-full sm:max-w-xs">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search leave types..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
        <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-orange-500 via-rose-500 to-pink-500" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Annual Days</TableHead>
              <TableHead>Active</TableHead>
              {canManage && <TableHead className="w-20">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? [...Array(4)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(canManage ? 6 : 5)].map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>)}
                  </TableRow>
                ))
              : (data ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.reasonCode}</TableCell>
                    <TableCell className="font-medium">{r.reasonName}</TableCell>
                    <TableCell className="text-muted-foreground text-xs max-w-48 truncate">
                      {r.description || <span className="text-muted-foreground/60">-</span>}
                    </TableCell>
                    <TableCell className="text-sm font-medium tabular-nums">
                      {((r as any).defaultDays ?? 0) > 0
                        ? `${(r as any).defaultDays} days`
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${r.isActive ? 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-500 ring-rose-500/30'}`}>
                        {r.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600"
                            onClick={() => { if (confirm(`Deactivate "${r.reasonName}"?`)) deleteMutation.mutate({ id: r.id, name: r.reasonName }); }}
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

      {canManage && (
        <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); setEditing(null); } }}>
          <DialogContent className="max-w-sm overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-orange-500 via-rose-500 to-pink-500" />
            <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-orange-500" />{editing ? 'Edit Leave Type' : 'New Leave Type'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Reason Code</label>
                <Input {...register('reasonCode')} disabled={!!editing} />
                {errors.reasonCode && <p className="text-xs text-red-500">{errors.reasonCode.message}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Reason Name</label>
                <Input {...register('reasonName')} />
                {errors.reasonName && <p className="text-xs text-red-500">{errors.reasonName.message}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Description</label>
                <Input {...register('description')} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Annual Days</label>
                <Input type="number" min={0} {...register('defaultDays', { valueAsNumber: true })} placeholder="e.g. 12" />
                <p className="text-[10px] text-muted-foreground">Annual allowance per employee. 0 means no quota is enforced.</p>
                {errors.defaultDays && <p className="text-xs text-red-500">{errors.defaultDays.message}</p>}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Cancel</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editing ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
