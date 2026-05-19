'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Cake, CalendarHeart, PartyPopper, Plane } from 'lucide-react';
import { employeesApi } from '@/lib/api/employees';
import { leaveRequestsApi, OnLeaveTodayUser } from '@/lib/api/leave-requests';
import { useAuth } from '@/providers/auth-provider';
import { UpcomingEvent } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

type Tab = 'on-leave' | 'birthdays' | 'anniversaries';

export default function BirthdaysPage() {
  const { user } = useAuth();
  const isEmployee = user?._type === 'employee';
  const [days, setDays] = useState('30');
  const [tab, setTab] = useState<Tab>('on-leave');

  // Birthdays + anniversaries (shared endpoint)
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['upcoming-events', days],
    queryFn: () =>
      (isEmployee
        ? employeesApi.employeeGetUpcomingEvents(Number(days))
        : employeesApi.getUpcomingEvents(Number(days))
      ).then((r) => r.data.data),
  });

  // On leave today — separate endpoint, no `days` filter (it's always today)
  const { data: onLeave, isLoading: onLeaveLoading } = useQuery({
    queryKey: ['on-leave-today'],
    queryFn: () => leaveRequestsApi.getOnLeaveToday().then((r) => r.data.data),
  });

  const birthdays = (events ?? []).filter((e) => e.type === 'birthday');
  const anniversaries = (events ?? []).filter((e) => e.type === 'anniversary');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-pink-600 via-rose-500 to-orange-500" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoNnptMC0zMHY2aC02VjRoNnptMCAzMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <PartyPopper className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Team Pulse</h1>
              <p className="text-sm text-white/60">Who&apos;s out, who&apos;s celebrating</p>
            </div>
          </div>
          {/* Days filter only applies to upcoming events tabs */}
          {tab !== 'on-leave' && (
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-36 bg-white/20 border-0 text-white backdrop-blur-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Next 7 days</SelectItem>
                <SelectItem value="14">Next 14 days</SelectItem>
                <SelectItem value="30">Next 30 days</SelectItem>
                <SelectItem value="60">Next 60 days</SelectItem>
                <SelectItem value="90">Next 90 days</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg border border-border bg-muted/50 p-1 w-fit">
        {([
          { id: 'on-leave', label: 'On Leave Today', icon: Plane, count: onLeave?.length ?? 0 },
          { id: 'birthdays', label: 'Birthdays', icon: Cake, count: birthdays.length },
          { id: 'anniversaries', label: 'Anniversaries', icon: CalendarHeart, count: anniversaries.length },
        ] as const).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-white dark:bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              <span className="text-xs text-muted-foreground">({t.count})</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'on-leave' && (
        <OnLeaveTable rows={onLeave ?? []} isLoading={onLeaveLoading} />
      )}
      {tab === 'birthdays' && (
        <EventTable
          events={birthdays}
          isLoading={eventsLoading}
          emptyMsg="No upcoming birthdays in this period"
        />
      )}
      {tab === 'anniversaries' && (
        <EventTable
          events={anniversaries}
          isLoading={eventsLoading}
          emptyMsg="No upcoming work anniversaries in this period"
        />
      )}
    </div>
  );
}

// ── On-Leave-Today table ─────────────────────────────────────────────────

function OnLeaveTable({ rows, isLoading }: { rows: OnLeaveTodayUser[]; isLoading: boolean }) {
  const statusBadge = (status: OnLeaveTodayUser['status']) => {
    if (status === 'hr_approved')
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">Approved</Badge>;
    if (status === 'manager_approved')
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">Pending HR</Badge>;
    return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 text-xs">Pending RM</Badge>;
  };
  return (
    <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Leave Type</TableHead>
            <TableHead>From → To</TableHead>
            <TableHead>Days</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? [...Array(3)].map((_, i) => (
              <TableRow key={i}>
                {[...Array(6)].map((__, j) => (
                  <TableCell key={j}><Skeleton className="h-5 w-24" /></TableCell>
                ))}
              </TableRow>
            ))
            : rows.length === 0
              ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Everyone&apos;s in today
                  </TableCell>
                </TableRow>
              )
              : rows.map((r) => (
                <TableRow key={r.leaveRequestId}>
                  <TableCell className="font-medium">
                    {r.name}
                    {r.empCode && (
                      <span className="ml-2 text-xs text-muted-foreground">({r.empCode})</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {r._type === 'admin' ? 'Admin' : 'Employee'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100 text-xs">
                      {r.leaveType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(r.dateFrom), 'dd MMM')}
                    {r.dateFrom !== r.dateTo && (
                      <> → {format(new Date(r.dateTo), 'dd MMM')}</>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">{r.totalDays} {r.totalDays === 1 ? 'day' : 'days'}</span>
                  </TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Birthdays / Anniversaries table ──────────────────────────────────────

function EventTable({
  events,
  isLoading,
  emptyMsg,
}: {
  events: UpcomingEvent[];
  isLoading: boolean;
  emptyMsg: string;
}) {
  return (
    <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Days Until</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? [...Array(3)].map((_, i) => (
              <TableRow key={i}>
                {[...Array(4)].map((__, j) => (
                  <TableCell key={j}><Skeleton className="h-5 w-24" /></TableCell>
                ))}
              </TableRow>
            ))
            : events.length === 0
              ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">{emptyMsg}</TableCell>
                </TableRow>
              )
              : events.map((e, i) => {
                const d = new Date(e.date);
                const thisYear = new Date(new Date().getFullYear(), d.getMonth(), d.getDate());
                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {e._type === 'admin' ? 'Admin' : 'Employee'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(thisYear, 'dd MMM')}
                      <span className="ml-1 text-xs text-muted-foreground/60">
                        ({format(new Date(e.date), 'yyyy')})
                      </span>
                    </TableCell>
                    <TableCell>
                      {e.daysUntil === 0
                        ? <span className="font-semibold text-emerald-600">Today! 🎉</span>
                        : e.daysUntil === 1
                          ? <span className="font-medium text-amber-600">Tomorrow</span>
                          : <span className="text-sm text-muted-foreground">in {e.daysUntil} days</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
        </TableBody>
      </Table>
    </div>
  );
}
