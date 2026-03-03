'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, Tags, Search as SearchIcon } from 'lucide-react';
import { taskTypesApi } from '@/lib/api/task-types';
import { TaskType, CreateTaskTypeDto } from '@/types';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const schema = z.object({
  typeCode: z.string().min(1, 'Required'),
  typeName: z.string().min(1, 'Required'),
  category: z.enum(['project_customization', 'support_customization', 'cr']),
});

type FormValues = z.infer<typeof schema>;

const categoryLabels: Record<string, string> = {
  project_customization: 'Project Customization',
  support_customization: 'Support Customization',
  cr: 'CR',
};

export default function TaskTypesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaskType | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['task-types', search],
    queryFn: () => taskTypesApi.getAll({ search, limit: 100 }).then((r) => r.data.data),
  });

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const createMutation = useMutation({
    mutationFn: (dto: CreateTaskTypeDto) => taskTypesApi.create(dto),
    onMutate: () => ({ id: toast.loading('Creating task type…') }),
    onSuccess: (res, _, ctx) => {
      qc.invalidateQueries({ queryKey: ['task-types'] });
      toast.success(`"${res.data.data.typeName}" created`, { id: ctx?.id });
      setOpen(false);
      form.reset();
    },
    onError: (e: any, _, ctx) => toast.error(e?.response?.data?.message ?? 'Failed to create task type', { id: ctx?.id }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<CreateTaskTypeDto> }) => taskTypesApi.update(id, dto),
    onMutate: () => ({ id: toast.loading('Updating task type…') }),
    onSuccess: (res, _, ctx) => {
      qc.invalidateQueries({ queryKey: ['task-types'] });
      toast.success(`"${res.data.data.typeName}" updated`, { id: ctx?.id });
      setOpen(false);
    },
    onError: (e: any, _, ctx) => toast.error(e?.response?.data?.message ?? 'Failed to update task type', { id: ctx?.id }),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }: { id: number; name: string }) => taskTypesApi.remove(id),
    onMutate: ({ name }) => ({ id: toast.loading(`Removing "${name}"…`) }),
    onSuccess: (_, { name }, ctx) => {
      qc.invalidateQueries({ queryKey: ['task-types'] });
      toast.success(`"${name}" removed`, { id: ctx?.id });
    },
    onError: (e: any, _, ctx) => toast.error(e?.response?.data?.message ?? 'Failed to remove task type', { id: ctx?.id }),
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ typeCode: '', typeName: '', category: 'project_customization' });
    setOpen(true);
  };

  const openEdit = (t: TaskType) => {
    setEditing(t);
    form.reset({ typeCode: t.typeCode, typeName: t.typeName, category: t.category });
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
        <div className="absolute inset-0 bg-linear-to-r from-cyan-600 via-indigo-600 to-violet-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoNnptMC0zMHY2aC02VjRoNnptMCAzMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Tags className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Task Types</h1>
              <p className="text-sm text-white/60">Task type categories</p>
            </div>
          </div>
          <Button size="sm" onClick={openCreate} className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-0 shadow-lg">
            <Plus className="mr-1.5 h-4 w-4" /> New Task Type
          </Button>
        </div>
      </div>

      <div className="relative w-full sm:max-w-xs">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search task types..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
        <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-cyan-500 via-indigo-500 to-violet-500" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? [...Array(4)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(5)].map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>)}
                  </TableRow>
                ))
              : (data ?? []).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.typeCode}</TableCell>
                    <TableCell className="font-medium">{t.typeName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{categoryLabels[t.category] ?? t.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${t.isActive ? 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-500 ring-rose-500/30'}`}>
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600"
                          onClick={() => { if (confirm(`Remove "${t.typeName}"?`)) deleteMutation.mutate({ id: t.id, name: t.typeName }); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-cyan-500 via-indigo-500 to-violet-500" />
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Tags className="h-4 w-4 text-cyan-500" />{editing ? 'Edit Task Type' : 'New Task Type'}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField control={form.control} name="typeCode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Code</FormLabel>
                  <FormControl><Input {...field} disabled={!!editing} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="typeName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger  className="w-full"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="project_customization">Project Customization</SelectItem>
                      <SelectItem value="support_customization">Support Customization</SelectItem>
                      <SelectItem value="cr">CR</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editing ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
