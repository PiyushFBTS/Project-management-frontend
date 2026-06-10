/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Tags, Plus, Trash2, FolderPlus, Pencil, Repeat, Check, Loader2 } from 'lucide-react';
import { projectsApi } from '@/lib/api/projects';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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

  // Admin-only page — non-admins (employees, HR, clients) get bounced to
  // the dashboard even if they deep-link here.
  useEffect(() => {
    if (user && !isAdmin) router.replace('/dashboard');
  }, [user, isAdmin, router]);

  const { data: types, isLoading } = useQuery({
    queryKey: ['project-types'],
    queryFn: () => projectsApi.getProjectTypes().then((r: any) => r.data?.data ?? r.data ?? []),
    enabled: isAdmin,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => projectsApi.deleteProjectType(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-types'] });
      toast.success('Deleted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  // ── Inline edit dialog ──
  const [editing, setEditing] = useState<{ id: number; label: string; description: string; isRecurring: boolean } | null>(null);

  const updateMut = useMutation({
    mutationFn: (vars: { id: number; dto: { label?: string; description?: string; isRecurring?: boolean } }) =>
      projectsApi.updateProjectType(vars.id, vars.dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-types'] });
      toast.success('Project type updated');
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update'),
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
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge className={`${typeColors[type.value] ?? defaultColor} text-xs font-semibold`}>
                    {type.label}
                  </Badge>
                  {type.isRecurring && (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 text-[10px] font-semibold inline-flex items-center gap-0.5">
                      <Repeat className="h-2.5 w-2.5" /> Recurring
                    </Badge>
                  )}
                </div>
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
                      className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Edit type"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setEditing({
                          id: type.id,
                          label: type.label ?? '',
                          description: type.description ?? '',
                          isRecurring: !!type.isRecurring,
                        });
                      }}
                    >
                      <Pencil className="h-3 w-3" />
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

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-blue-600" /> Edit Project Type
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <>
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">Label *</label>
                  <Input value={editing.label} onChange={(e) => setEditing((p) => p ? { ...p, label: e.target.value } : p)} className="h-9" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">Description</label>
                  <Textarea
                    value={editing.description}
                    onChange={(e) => setEditing((p) => p ? { ...p, description: e.target.value } : p)}
                    rows={3}
                    placeholder="optional"
                  />
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={editing.isRecurring}
                  onClick={() => setEditing((p) => p ? { ...p, isRecurring: !p.isRecurring } : p)}
                  className="flex w-full items-start gap-3 rounded-lg border p-3 text-left"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                    <Repeat className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">Recurring billing type</p>
                      <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${editing.isRecurring ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${editing.isRecurring ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Recurring billing rows instead of milestones (e.g. support / maintenance). Cadence — monthly, quarterly, half-yearly, or yearly — is chosen per project.
                    </p>
                  </div>
                </button>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button
                  disabled={!editing.label.trim() || updateMut.isPending}
                  onClick={() => updateMut.mutate({
                    id: editing.id,
                    dto: {
                      label: editing.label.trim(),
                      description: editing.description.trim(),
                      isRecurring: editing.isRecurring,
                    },
                  })}
                >
                  {updateMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                  Save
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
