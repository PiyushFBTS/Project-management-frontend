/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Tags, Plus, Trash2, FolderPlus } from 'lucide-react';
import { projectsApi } from '@/lib/api/projects';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const typeColors: Record<string, string> = {
  fresh_implement: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  migration: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  change_request: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  support: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  development: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400',
  consulting: 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-400',
  maintenance: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
};

const defaultColor = 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400';

export default function ProjectTypesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';
  const isHr = user?._type === 'employee' && !!(user as any)?.isHr;
  const canManage = isAdmin || isHr;

  const { data: types, isLoading } = useQuery({
    queryKey: ['project-types'],
    queryFn: () => projectsApi.getProjectTypes().then((r: any) => r.data?.data ?? r.data ?? []),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => projectsApi.deleteProjectType(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-types'] });
      toast.success('Deleted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-cyan-600 via-blue-600 to-indigo-600" />
        <div className="relative px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Tags className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">Project Types</h1>
              <p className="text-xs sm:text-sm text-white/60">{((types ?? []) as any[])?.length ?? 0} types available</p>
            </div>
          </div>
          {canManage && (
            <Button
              size="sm"
              className="bg-white text-blue-700 hover:bg-white/90 border-0 shadow-lg font-semibold"
              onClick={() => router.push('/project-types/new')}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add Type
            </Button>
          )}
        </div>
      </div>

      {/* Types grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : ((types ?? []) as any[])?.length === 0 ? (
        <div className="text-center py-12">
          <Tags className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No project types yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {((types ?? []) as any[]).map((type: any) => (
            <div
              key={type.id}
              className={`rounded-xl border bg-card p-4 hover:shadow-lg hover:-translate-y-1 hover:border-primary/30 transition-all duration-200 group ${canManage ? 'cursor-pointer' : 'cursor-default'}`}
              onClick={() => {
                if (canManage) router.push(`/projects/new?type=${encodeURIComponent(type.value)}`);
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <Badge className={`${typeColors[type.value] ?? defaultColor} text-xs font-semibold`}>
                  {type.label}
                </Badge>
                {canManage && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Create project with this type"
                      onClick={(ev) => { ev.stopPropagation(); router.push(`/projects/new?type=${encodeURIComponent(type.value)}`); }}
                    >
                      <FolderPlus className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(ev) => { ev.stopPropagation(); if (confirm(`Delete "${type.label}"?`)) deleteMut.mutate(type.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              {type.description && <p className="text-sm text-muted-foreground mt-2">{type.description}</p>}
              <p className="text-[10px] text-muted-foreground/60 mt-2 font-mono">{type.value}</p>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
