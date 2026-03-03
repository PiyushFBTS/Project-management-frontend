'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell, UserPlus, UserX, FolderPlus, FolderEdit, ClipboardCheck,
  CheckCheck, Trash2, X, BellOff, CalendarPlus, CalendarCheck, CalendarX, CalendarOff,
  ListTodo, ArrowRightLeft, MessageSquare,
} from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { notificationsApi } from '@/lib/api/notifications';
import { Notification, NotificationType } from '@/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// ── Icon + colour per notification type ──────────────────────────────────────

const typeConfig: Record<NotificationType, {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}> = {
  employee_created:     { icon: UserPlus,       iconBg: 'bg-emerald-100 dark:bg-emerald-500/15', iconColor: 'text-emerald-600 dark:text-emerald-400' },
  employee_deactivated: { icon: UserX,          iconBg: 'bg-red-100 dark:bg-red-500/15',         iconColor: 'text-red-600 dark:text-red-400'         },
  project_created:      { icon: FolderPlus,     iconBg: 'bg-blue-100 dark:bg-blue-500/15',       iconColor: 'text-blue-600 dark:text-blue-400'       },
  project_updated:      { icon: FolderEdit,     iconBg: 'bg-amber-100 dark:bg-amber-500/15',     iconColor: 'text-amber-600 dark:text-amber-400'     },
  task_sheet_submitted:             { icon: ClipboardCheck, iconBg: 'bg-violet-100 dark:bg-violet-500/15',   iconColor: 'text-violet-600 dark:text-violet-400'   },
  leave_request_submitted:          { icon: CalendarPlus,  iconBg: 'bg-orange-100 dark:bg-orange-500/15',   iconColor: 'text-orange-600 dark:text-orange-400'   },
  leave_request_manager_approved:   { icon: CalendarCheck, iconBg: 'bg-blue-100 dark:bg-blue-500/15',       iconColor: 'text-blue-600 dark:text-blue-400'       },
  leave_request_manager_rejected:   { icon: CalendarX,     iconBg: 'bg-red-100 dark:bg-red-500/15',         iconColor: 'text-red-600 dark:text-red-400'         },
  leave_request_hr_approved:        { icon: CalendarCheck, iconBg: 'bg-emerald-100 dark:bg-emerald-500/15', iconColor: 'text-emerald-600 dark:text-emerald-400' },
  leave_request_hr_rejected:        { icon: CalendarX,     iconBg: 'bg-red-100 dark:bg-red-500/15',         iconColor: 'text-red-600 dark:text-red-400'         },
  leave_request_cancelled:          { icon: CalendarOff,   iconBg: 'bg-gray-100 dark:bg-gray-500/15',       iconColor: 'text-gray-600 dark:text-gray-400'       },
  task_assigned:                    { icon: ListTodo,      iconBg: 'bg-teal-100 dark:bg-teal-500/15',       iconColor: 'text-teal-600 dark:text-teal-400'       },
  task_status_changed:              { icon: ArrowRightLeft, iconBg: 'bg-indigo-100 dark:bg-indigo-500/15',  iconColor: 'text-indigo-600 dark:text-indigo-400'   },
  task_commented:                   { icon: MessageSquare, iconBg: 'bg-cyan-100 dark:bg-cyan-500/15',       iconColor: 'text-cyan-600 dark:text-cyan-400'       },
};

// ── Resolve notification → target route ──────────────────────────────────────

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
      return isEmployee ? '/my-tasks' : (meta?.projectId ? `/projects/${meta.projectId}/planning` : '/my-tasks');
    default:
      return null;
  }
}

// ── Single notification row ───────────────────────────────────────────────────

function NotifItem({
  notif,
  onMarkRead,
  onRemove,
  onClick,
  isEmployee,
}: {
  notif: Notification;
  onMarkRead: (id: number) => void;
  onRemove: (id: number) => void;
  onClick: (notif: Notification) => void;
  isEmployee: boolean;
}) {
  const cfg = typeConfig[notif.type] ?? typeConfig.project_updated;
  const Icon = cfg.icon;
  const hasRoute = !!getNotificationRoute(notif, isEmployee);

  return (
    <div
      role={hasRoute ? 'button' : undefined}
      onClick={() => onClick(notif)}
      className={cn(
        'group relative flex items-start gap-3 px-3 py-2.5 transition-colors',
        hasRoute ? 'cursor-pointer' : 'cursor-default',
        !notif.isRead && 'bg-indigo-500/5 hover:bg-indigo-500/8',
        notif.isRead && 'hover:bg-accent/50 opacity-60',
      )}
    >
      {/* Unread indicator dot */}
      {!notif.isRead && (
        <span className="absolute left-1 top-4 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
      )}

      {/* Icon */}
      <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', cfg.iconBg)}>
        <Icon className={cn('h-4 w-4', cfg.iconColor)} />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground leading-snug">{notif.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-snug line-clamp-2">{notif.message}</p>
        <p className="mt-1 text-[10px] text-muted-foreground/50">
          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
        </p>
      </div>

      {/* Hover actions */}
      <div className="flex shrink-0 flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {!notif.isRead && (
          <button
            onClick={(e) => { e.stopPropagation(); onMarkRead(notif.id); }}
            title="Mark as read"
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <CheckCheck className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(notif.id); }}
          title="Dismiss"
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Main bell component ───────────────────────────────────────────────────────

export function NotificationBell() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isEmp = user?._type === 'employee';
  const [open, setOpen] = useState(false);

  const { data: response } = useQuery({
    queryKey: ['notifications', isEmp],
    queryFn: () => notificationsApi.getAll(40, isEmp).then((r) => r.data),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const markRead = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id, isEmp),
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(isEmp),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => notificationsApi.remove(id, isEmp),
    onSuccess: invalidate,
  });

  const clearAll = useMutation({
    mutationFn: () => notificationsApi.clearAll(isEmp),
    onSuccess: invalidate,
  });

  const handleNotifClick = (notif: Notification) => {
    if (!notif.isRead) markRead.mutate(notif.id);
    const route = getNotificationRoute(notif, isEmp);
    if (route) {
      setOpen(false);
      router.push(route);
    }
  };

  const unread = response?.meta?.unreadCount ?? 0;
  const notifications = response?.data ?? [];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 rounded-lg text-foreground/70 hover:text-foreground hover:bg-accent/80 transition-colors"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 dark:bg-indigo-500 px-1 text-[9px] font-bold text-white leading-none ring-2 ring-card">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 shadow-xl"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unread > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/15 px-1.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                {unread} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                title="Mark all as read"
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-accent/80 transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={() => clearAll.mutate()}
                title="Clear all"
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-accent/80 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── List ── */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10">
            <BellOff className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No notifications yet</p>
            <p className="text-xs text-muted-foreground/50">You&apos;re all caught up!</p>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[360px] divide-y divide-border/50">
            {notifications.map((n) => (
              <NotifItem
                key={n.id}
                notif={n}
                onMarkRead={(id) => markRead.mutate(id)}
                onRemove={(id) => remove.mutate(id)}
                onClick={handleNotifClick}
                isEmployee={isEmp}
              />
            ))}
          </div>
        )}

        {/* ── Footer ── */}
        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="px-3 py-2 text-center">
              <p className="text-[10px] text-muted-foreground/50">
                {notifications.length} notification{notifications.length !== 1 ? 's' : ''} · refreshes every 30s
              </p>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
