'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, ClipboardList, FolderKanban, Search as SearchIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { projectsApi } from '@/lib/api/projects';
import { Project, CreateProjectDto } from '@/types';
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
import { Textarea } from '@/components/ui/textarea';

const schema = z.object({
  projectCode: z.string().min(1, 'Required'),
  projectName: z.string().min(1, 'Required'),
  projectType: z.enum(['project', 'support', 'development', 'consulting', 'migration', 'maintenance']),
  clientName: z.string().min(1, 'Required'),
  status: z.enum(['active', 'inactive', 'completed']).optional(),
  startDate: z.string().min(1, 'Required'),
  endDate: z.string().optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30 dark:text-emerald-400',
  inactive: 'bg-slate-500/15 text-slate-500 ring-1 ring-slate-500/30',
  completed: 'bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/30 dark:text-blue-400',
};

export default function ProjectsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['projects', search],
    queryFn: () => projectsApi.getAll({ search, limit: 100 }).then((r) => r.data.data),
  });

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const createMutation = useMutation({
    mutationFn: (dto: CreateProjectDto) => projectsApi.create(dto),
    onMutate: () => ({ id: toast.loading('Creating project…') }),
    onSuccess: (res, _, ctx) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success(`"${res.data.data.projectName}" created`, { id: ctx?.id });
      setOpen(false);
      form.reset();
    },
    onError: (e: any, _, ctx) => toast.error(e?.response?.data?.message ?? 'Failed to create project', { id: ctx?.id }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<CreateProjectDto> }) => projectsApi.update(id, dto),
    onMutate: () => ({ id: toast.loading('Updating project…') }),
    onSuccess: (res, _, ctx) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success(`"${res.data.data.projectName}" updated`, { id: ctx?.id });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any, _, ctx) => toast.error(e?.response?.data?.message ?? 'Failed to update project', { id: ctx?.id }),
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

  const openCreate = () => {
    setEditing(null);
    form.reset({ projectCode: '', projectName: '', projectType: 'project', clientName: '', status: 'active', startDate: '', endDate: '', description: '' });
    setOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    form.reset({
      projectCode: p.projectCode ?? '',
      projectName: p.projectName ?? '',
      projectType: p.projectType,
      clientName: p.clientName ?? '',
      status: p.status,
      startDate: p.startDate?.slice(0, 10) ?? '',
      endDate: p.endDate?.slice(0, 10) ?? '',
      description: p.description ?? '',
    });
    setOpen(true);
  };

  const onSubmit = (values: FormValues) => {
    if (editing) {
      console.log("values",values)
      updateMutation.mutate({ id: editing.id, dto: values });
    } else {
      createMutation.mutate(values as CreateProjectDto);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

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
              <p className="text-sm text-white/60">Manage all your projects</p>
            </div>
          </div>
          <Button size="sm" onClick={openCreate} className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-0 shadow-lg">
            <Plus className="mr-1.5 h-4 w-4" /> New Project
          </Button>
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
              <TableHead>Status</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead className="w-20">Actions</TableHead>
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
                    <TableCell className="font-medium">{p.projectName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{p.projectType}</Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">{p.clientName}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[p.status]}`}>
                        {p.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600">{p.startDate?.slice(0, 10)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-violet-500 hover:text-violet-600"
                          title="Planning"
                          onClick={() => router.push(`/projects/${p.id}/planning`)}
                        >
                          <ClipboardList className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600"
                          onClick={() => { if (confirm(`Remove "${p.projectName}"?`)) deleteMutation.mutate({ id: p.id, name: p.projectName }); }}
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
        <DialogContent className="max-w-lg overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-indigo-500" />
              {editing ? 'Edit Project' : 'New Project'}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField control={form.control} name="projectCode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Code</FormLabel>
                    <FormControl><Input {...field} disabled={!!editing} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="projectName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="projectType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger  className="w-full"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="project">Project</SelectItem>
                        <SelectItem value="support">Support</SelectItem>
                        <SelectItem value="development">Development</SelectItem>
                        <SelectItem value="consulting">Consulting</SelectItem>
                        <SelectItem value="migration">Migration</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger  className="w-full"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="clientName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
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
