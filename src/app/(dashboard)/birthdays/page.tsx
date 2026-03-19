'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';
import { Cake, CalendarHeart, PartyPopper } from 'lucide-react';
import { employeesApi } from '@/lib/api/employees';
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

export default function BirthdaysPage() {
  const { user } = useAuth();
  const isEmployee = user?._type === 'employee';
  const [days, setDays] = useState('30');

  const { data, isLoading } = useQuery({
    queryKey: ['upcoming-events', days],
    queryFn: () =>
      (isEmployee
        ? employeesApi.employeeGetUpcomingEvents(Number(days))
        : employeesApi.getUpcomingEvents(Number(days))
      ).then((r) => r.data.data),
  });

  const birthdays = (data ?? []).filter((e) => e.type === 'birthday');
  const anniversaries = (data ?? []).filter((e) => e.type === 'anniversary');

  const EventTable = ({ events, emptyMsg }: { events: UpcomingEvent[]; emptyMsg: string }) => (
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
              <h1 className="text-xl font-bold text-white">Birthdays &amp; Anniversaries</h1>
              <p className="text-sm text-white/60">Upcoming celebrations for your team</p>
            </div>
          </div>
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
        </div>
      </div>

      {/* Birthdays */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Cake className="h-4 w-4 text-pink-500" />
          <h2 className="text-sm font-semibold">Birthdays</h2>
          <span className="text-xs text-muted-foreground">({birthdays.length})</span>
        </div>
        <EventTable events={birthdays} emptyMsg="No upcoming birthdays in this period" />
      </div>

      {/* Anniversaries */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CalendarHeart className="h-4 w-4 text-rose-500" />
          <h2 className="text-sm font-semibold">Work Anniversaries</h2>
          <span className="text-xs text-muted-foreground">({anniversaries.length})</span>
        </div>
        <EventTable events={anniversaries} emptyMsg="No upcoming work anniversaries in this period" />
      </div>
    </div>
  );
}
