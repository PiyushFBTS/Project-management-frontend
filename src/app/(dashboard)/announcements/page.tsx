/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { Megaphone, Plus, Pencil, Trash2, Loader2, CalendarClock, List, Lock, Send, Search, X, Filter } from 'lucide-react';
import { announcementsApi } from '@/lib/api/announcements';
import { Announcement } from '@/types';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const schema = z.object({
  title: z.string().min(1, 'Required').max(200),
  description: z.string().min(1, 'Required'),
  expiresOn: z.string().min(1, 'Required'),
});

type FormValues = z.infer<typeof schema>;

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd');
}

type Tab = 'make' | 'list';

export default function AnnouncementsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';
  const isHr = user?._type === 'employee' && !!(user as any)?.isHr;
  const canManage = isAdmin || isHr;

  // Default tab: Make (if allowed), otherwise List
  const [activeTab, setActiveTab] = useState<Tab>(canManage ? 'make' : 'list');
  const [editing, setEditing] = useState<Announcement | null>(null);

  // List filters
  const [search, setSearch] = useState('');
  const [senderFilter, setSenderFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => announcementsApi.getAll().then((r) => r.data.data ?? []),
    enabled: !!user,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      expiresOn: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    },
  });

  const createMutation = useMutation({
    mutationFn: (dto: FormValues) => announcementsApi.create(dto),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.invalidateQueries({ queryKey: ['announcements-active'] });
      toast.success(`"${res.data.data.title}" announced`);
      form.reset({
        title: '',
        description: '',
        expiresOn: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
      });
      setActiveTab('list');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create announcement'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<FormValues> & { isActive?: boolean } }) =>
      announcementsApi.update(id, dto),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.invalidateQueries({ queryKey: ['announcements-active'] });
      toast.success(`"${res.data.data.title}" updated`);
      setEditing(null);
      form.reset({
        title: '',
        description: '',
        expiresOn: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
      });
      setActiveTab('list');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update announcement'),
  });

  const removeMutation = useMutation({
    mutationFn: ({ id }: { id: number; title: string }) => announcementsApi.remove(id),
    onSuccess: (_, { title }) => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.invalidateQueries({ queryKey: ['announcements-active'] });
      toast.success(`"${title}" removed`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to remove announcement'),
  });

  function startEdit(a: Announcement) {
    setEditing(a);
    form.reset({
      title: a.title,
      description: a.description,
      expiresOn: String(a.expiresOn).slice(0, 10),
    });
    setActiveTab('make');
  }

  function cancelEdit() {
    setEditing(null);
    form.reset({
      title: '',
      description: '',
      expiresOn: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    });
  }

  function onSubmit(values: FormValues) {
    if (editing) updateMutation.mutate({ id: editing.id, dto: values });
    else createMutation.mutate(values);
  }

  const today = todayStr();
  const list: Announcement[] = data ?? [];
  const isExpired = (a: Announcement) => String(a.expiresOn).slice(0, 10) < today;
  const saving = createMutation.isPending || updateMutation.isPending;

  // Distinct senders (by id → name) from the full dataset
  const senderOptions = (() => {
    const seen = new Map<string, string>();
    for (const a of list) {
      const id = `${a.createdByType}:${a.createdById}`;
      if (!seen.has(id)) seen.set(id, a.createdByName);
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  })();

  const filteredList = list.filter((a) => {
    if (senderFilter !== 'all') {
      if (`${a.createdByType}:${a.createdById}` !== senderFilter) return false;
    }
    if (statusFilter === 'active' && isExpired(a)) return false;
    if (statusFilter === 'expired' && !isExpired(a)) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${a.title} ${a.description} ${a.createdByName}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const anyFilterActive =
    senderFilter !== 'all' || statusFilter !== 'all' || search.trim().length > 0;

  return (
    <div className="space-y-5">

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {canManage && (
          <button
            type="button"
            onClick={() => setActiveTab('make')}
            className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === 'make'
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Plus className="h-4 w-4" />
            Make Announcement
            {activeTab === 'make' && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-rose-500" />
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'list'
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <List className="h-4 w-4" />
          Announcement List
          {list.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0 text-[10px] font-semibold text-muted-foreground">
              {list.length}
            </span>
          )}
          {activeTab === 'list' && (
            <span className="absolute inset-x-0 -bottom-px h-0.5 bg-rose-500" />
          )}
        </button>
      </div>

      {/* ─── Make Announcement tab ─── */}
      {activeTab === 'make' && (
        canManage ? (
          <Card className="shadow-sm overflow-hidden">
            <div className="h-1 bg-linear-to-r from-rose-500 via-pink-500 to-purple-500" />
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-bold">
                    {editing ? 'Edit Announcement' : 'New Announcement'}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {editing
                      ? 'Update the content or expiry of this announcement.'
                      : 'Title, description, and the date until it stays visible on the dashboard.'}
                  </p>
                </div>
                {editing && (
                  <Button type="button" variant="outline" size="sm" onClick={cancelEdit}>
                    Cancel edit
                  </Button>
                )}
              </div>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <Input placeholder="e.g. Office closed on 1 May" {...form.register('title')} />
                  {form.formState.errors.title && (
                    <p className="text-xs text-red-500">{form.formState.errors.title.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    placeholder="Full message to show employees on the dashboard banner"
                    rows={5}
                    {...form.register('description')}
                  />
                  {form.formState.errors.description && (
                    <p className="text-xs text-red-500">{form.formState.errors.description.message}</p>
                  )}
                </div>

                <div className="space-y-1 max-w-xs">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Visible until <span className="text-red-500">*</span>
                  </label>
                  <Input type="date" min={today} {...form.register('expiresOn')} />
                  <p className="text-[10px] text-muted-foreground">
                    The banner auto-hides after this date.
                  </p>
                  {form.formState.errors.expiresOn && (
                    <p className="text-xs text-red-500">{form.formState.errors.expiresOn.message}</p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-linear-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white shadow-md"
                  >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {!saving && <Send className="mr-2 h-4 w-4" />}
                    {editing ? 'Save changes' : 'Publish announcement'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          // Non-admin/HR — should not reach here via tabs, but keep defensive fallback
          <Card className="border-dashed">
            <CardContent className="py-10 text-center">
              <Lock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-semibold">Only admins and HR can create announcements.</p>
            </CardContent>
          </Card>
        )
      )}

      {/* ─── List tab ─── */}
      {activeTab === 'list' && (
        isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : list.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Megaphone className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-semibold">No announcements yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                {canManage
                  ? 'Switch to "Make Announcement" to broadcast your first message.'
                  : 'Check back later for updates.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Filter toolbar */}
            <div className="rounded-xl border bg-card shadow-sm p-3 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-9 pl-9 pr-8"
                  placeholder="Search title, message, or sender..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Select value={senderFilter} onValueChange={setSenderFilter}>
                <SelectTrigger className="h-9 w-full sm:w-56">
                  <SelectValue placeholder="Sent by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All senders</SelectItem>
                  {senderOptions.map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="h-9 w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              {anyFilterActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  onClick={() => { setSearch(''); setSenderFilter('all'); setStatusFilter('all'); }}
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Clear
                </Button>
              )}
              <div className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                Showing {filteredList.length} / {list.length}
              </div>
            </div>

            {filteredList.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  No announcements match your filters.
                </CardContent>
              </Card>
            ) : (
            filteredList.map((a) => {
              const expired = isExpired(a);
              return (
                <Card key={a.id} className={`shadow-sm overflow-hidden ${expired ? 'opacity-70' : ''}`}>
                  <div className={`h-1 ${expired ? 'bg-slate-400' : 'bg-linear-to-r from-rose-500 to-pink-600'}`} />
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${expired ? 'bg-slate-100 dark:bg-slate-800/60' : 'bg-rose-100 dark:bg-rose-500/15'}`}>
                        <Megaphone className={`h-5 w-5 ${expired ? 'text-slate-500' : 'text-rose-600 dark:text-rose-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold">{a.title}</h3>
                          {expired ? (
                            <Badge className="border-0 bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 text-[10px]">Expired</Badge>
                          ) : (
                            <Badge className="border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 text-[10px]">Active</Badge>
                          )}
                          {!a.isActive && (
                            <Badge className="border-0 bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 text-[10px]">Disabled</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{a.description}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            Visible until {format(new Date(a.expiresOn), 'MMM d, yyyy')}
                          </span>
                          <span>by {a.createdByName}</span>
                          <span>created {format(new Date(a.createdAt), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(a)} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600"
                            onClick={() => {
                              if (confirm(`Remove "${a.title}"?`)) removeMutation.mutate({ id: a.id, title: a.title });
                            }}
                            title="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
            )}
          </div>
        )
      )}
    </div>
  );
}
