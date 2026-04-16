/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Bell, BellOff, CheckCheck, Trash2, X, Search,
  UserPlus, UserX, FolderPlus, FolderEdit, ClipboardCheck,
  CalendarPlus, CalendarCheck, CalendarX, CalendarOff,
  ListTodo, ArrowRightLeft, MessageSquare, AtSign,
} from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { notificationsApi } from '@/lib/api/notifications';
import { Notification, NotificationType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const typeConfig: Record<NotificationType, {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
}> = {
  employee_created:     { icon: UserPlus,        iconBg: 'bg-emerald-100 dark:bg-emerald-500/15', iconColor: 'text-emerald-600 dark:text-emerald-400', label: 'Employee' },
  employee_deactivated: { icon: UserX,           iconBg: 'bg-red-100 dark:bg-red-500/15',         iconColor: 'text-red-600 dark:text-red-400',         label: 'Employee' },
  project_created:      { icon: FolderPlus,      iconBg: 'bg-blue-100 dark:bg-blue-500/15',       iconColor: 'text-blue-600 dark:text-blue-400',       label: 'Project'  },
  project_updated:      { icon: FolderEdit,      iconBg: 'bg-amber-100 dark:bg-amber-500/15',     iconColor: 'text-amber-600 dark:text-amber-400',     label: 'Project'  },
  task_sheet_submitted: { icon: ClipboardCheck,  iconBg: 'bg-violet-100 dark:bg-violet-500/15',   iconColor: 'text-violet-600 dark:text-violet-400',   label: 'Task Sheet' },
  leave_request_submitted:        { icon: CalendarPlus,  iconBg: 'bg-orange-100 dark:bg-orange-500/15',   iconColor: 'text-orange-600 dark:text-orange-400',   label: 'Leave' },
  leave_request_manager_approved: { icon: CalendarCheck, iconBg: 'bg-blue-100 dark:bg-blue-500/15',       iconColor: 'text-blue-600 dark:text-blue-400',       label: 'Leave' },
  leave_request_manager_rejected: { icon: CalendarX,     iconBg: 'bg-red-100 dark:bg-red-500/15',         iconColor: 'text-red-600 dark:text-red-400',         label: 'Leave' },
  leave_request_hr_approved:      { icon: CalendarCheck, iconBg: 'bg-emerald-100 dark:bg-emerald-500/15', iconColor: 'text-emerald-600 dark:text-emerald-400', label: 'Leave' },
  leave_request_hr_rejected:      { icon: CalendarX,     iconBg: 'bg-red-100 dark:bg-red-500/15',         iconColor: 'text-red-600 dark:text-red-400',         label: 'Leave' },
  leave_request_cancelled:        { icon: CalendarOff,   iconBg: 'bg-gray-100 dark:bg-gray-500/15',       iconColor: 'text-gray-600 dark:text-gray-400',       label: 'Leave' },
  task_assigned:                  { icon: ListTodo,      iconBg: 'bg-teal-100 dark:bg-teal-500/15',       iconColor: 'text-teal-600 dark:text-teal-400',       label: 'Task' },
  task_status_changed:            { icon: ArrowRightLeft,iconBg: 'bg-indigo-100 dark:bg-indigo-500/15',   iconColor: 'text-indigo-600 dark:text-indigo-400',   label: 'Task' },
  task_commented:                 { icon: MessageSquare, iconBg: 'bg-cyan-100 dark:bg-cyan-500/15',       iconColor: 'text-cyan-600 dark:text-cyan-400',       label: 'Task' },
  task_mention:                   { icon: AtSign,        iconBg: 'bg-violet-100 dark:bg-violet-500/15',   iconColor: 'text-violet-600 dark:text-violet-400',   label: 'Mention' },
  birthday:                       { icon: CalendarCheck, iconBg: 'bg-pink-100 dark:bg-pink-500/15',       iconColor: 'text-pink-600 dark:text-pink-400',       label: 'Birthday' },
  work_anniversary:               { icon: CalendarCheck, iconBg: 'bg-amber-100 dark:bg-amber-500/15',     iconColor: 'text-amber-600 dark:text-amber-400',     label: 'Anniversary' },
};

function getNotificationRoute(notif: Notification, isEmployee: boolean): string | null {
  const meta = notif.metadata;
  switch (notif.type) {
    case 'employee_created':
    case 'employee_deactivated':
      return '/employees';
    case 'project_created':
    case 'project_updated':
      return '/projects';
    case 'task_sheet_submitted':
      return meta?.sheetId ? `/task-sheets/${meta.sheetId}` : '/task-sheets';
    case 'leave_request_submitted':
    case 'leave_request_manager_approved':
    case 'leave_request_manager_rejected':
    case 'leave_request_hr_approved':
    case 'leave_request_hr_rejected':
    case 'leave_request_cancelled':
      return '/leave-requests';
    case 'task_assigned':
    case 'task_status_changed':
    case 'task_commented':
    case 'task_mention':
      return isEmployee ? '/my-tasks' : (meta?.projectId ? `/projects/${meta.projectId}/planning` : '/full-tickets');
    default:
      return null;
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isEmp = user?._type === 'employee';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data: response, isLoading } = useQuery({
    queryKey: ['notifications-page', isEmp],
    queryFn: () => notificationsApi.getAll(200, isEmp).then((r) => r.data),
    refetchInterval: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['notifications'] });

  const markRead = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id, isEmp),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ['notifications-page'] }); },
  });
  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(isEmp),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ['notifications-page'] }); },
  });
  const remove = useMutation({
    mutationFn: (id: number) => notificationsApi.remove(id, isEmp),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ['notifications-page'] }); },
  });
  const clearAll = useMutation({
    mutationFn: () => notificationsApi.clearAll(isEmp),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ['notifications-page'] }); },
  });

  const all: Notification[] = response?.data ?? [];
  const unread = response?.meta?.unreadCount ?? 0;

  // Distinct type categories present in the current data
  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const n of all) {
      const label = typeConfig[n.type]?.label ?? n.type;
      set.add(label);
    }
    return Array.from(set).sort();
  }, [all]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((n) => {
      if (statusFilter === 'unread' && n.isRead) return false;
      if (statusFilter === 'read' && !n.isRead) return false;
      if (typeFilter !== 'all') {
        const label = typeConfig[n.type]?.label ?? n.type;
        if (label !== typeFilter) return false;
      }
      if (q) {
        const hay = `${n.title} ${n.message}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [all, search, statusFilter, typeFilter]);

  // Group by day (Today / Yesterday / dated)
  const groups = useMemo(() => {
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    const yday = new Date(); yday.setDate(yday.getDate() - 1);
    const ydayKey = format(yday, 'yyyy-MM-dd');
    const buckets = new Map<string, { label: string; items: Notification[] }>();
    for (const n of filtered) {
      const key = format(new Date(n.createdAt), 'yyyy-MM-dd');
      const label = key === todayKey ? 'Today'
        : key === ydayKey ? 'Yesterday'
        : format(new Date(n.createdAt), 'EEEE, MMM d');
      if (!buckets.has(key)) buckets.set(key, { label, items: [] });
      buckets.get(key)!.items.push(n);
    }
    // Keep insertion order (API returns newest first)
    return Array.from(buckets.values());
  }, [filtered]);

  const handleClick = (n: Notification) => {
    if (!n.isRead) markRead.mutate(n.id);
    const route = getNotificationRoute(n, isEmp);
    if (route) router.push(route);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-br from-indigo-600 via-violet-600 to-purple-700" />
        <div className="relative px-5 sm:px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Notifications</h1>
              <p className="text-sm text-white/80">
                {unread > 0 ? `${unread} unread` : 'You are all caught up'} · refreshes every 30s
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <Button
                size="sm"
                variant="secondary"
                className="bg-white/15 text-white hover:bg-white/25 border-0"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                <CheckCheck className="h-4 w-4 mr-1.5" /> Mark all read
              </Button>
            )}
            {all.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                className="bg-white/15 text-white hover:bg-red-500/40 border-0"
                onClick={() => { if (confirm('Clear all notifications?')) clearAll.mutate(); }}
                disabled={clearAll.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1.5" /> Clear all
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border bg-card shadow-sm p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="h-9 pl-9"
            placeholder="Search notifications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="h-9 w-full sm:w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="read">Read</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-full sm:w-40"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {typeOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : all.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BellOff className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-semibold">No notifications yet</p>
            <p className="text-xs text-muted-foreground mt-1">You are all caught up!</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No notifications match your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map(({ label, items }) => (
            <div key={label} className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pl-1">
                {label}
              </p>
              <Card className="shadow-sm overflow-hidden">
                <div className="divide-y">
                  {items.map((n) => {
                    const cfg = typeConfig[n.type] ?? typeConfig.project_updated;
                    const Icon = cfg.icon;
                    const hasRoute = !!getNotificationRoute(n, isEmp);
                    return (
                      <div
                        key={n.id}
                        role={hasRoute ? 'button' : undefined}
                        onClick={() => handleClick(n)}
                        className={cn(
                          'group flex items-start gap-3 px-4 py-3 transition-colors',
                          hasRoute ? 'cursor-pointer hover:bg-muted/40' : 'cursor-default',
                          !n.isRead && 'bg-indigo-500/5',
                          n.isRead && 'opacity-70',
                        )}
                      >
                        {!n.isRead ? (
                          <span className="mt-2 h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                        ) : (
                          <span className="mt-2 h-2 w-2 shrink-0" />
                        )}
                        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', cfg.iconBg)}>
                          <Icon className={cn('h-4 w-4', cfg.iconColor)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold leading-snug">{n.title}</p>
                            <Badge variant="outline" className="text-[10px] font-medium">
                              {cfg.label}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{n.message}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground/70">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                            <span className="mx-1">·</span>
                            {format(new Date(n.createdAt), 'HH:mm')}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          {!n.isRead && (
                            <button
                              onClick={(e) => { e.stopPropagation(); markRead.mutate(n.id); }}
                              title="Mark as read"
                              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-indigo-600 hover:bg-accent transition-colors"
                            >
                              <CheckCheck className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); remove.mutate(n.id); }}
                            title="Dismiss"
                            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-accent transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
