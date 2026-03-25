/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  Users, FolderKanban, CalendarCheck, TrendingUp,
  ClipboardList, Clock, FileCheck, BarChart3, ArrowRight,
  CheckCircle2, XCircle, ListTodo, PlayCircle, Eye, CircleCheckBig, Ticket,
  Cake, CalendarHeart,
} from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { useCompany } from '@/providers/company-provider';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { dashboardApi } from '@/lib/api/dashboard';
import { myTasksApi } from '@/lib/api/project-planning';
import { companiesApi, PlatformDashboard as PlatformDashboardData } from '@/lib/api/companies';
import { employeesApi } from '@/lib/api/employees';
import { TodayEvent } from '@/types';

const thisMonth = format(new Date(), 'yyyy-MM');
const thisMonthLabel = format(new Date(), 'MMMM yyyy');

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

function KpiCard({
  title, value, sub, icon: Icon, gradient, textColor,
}: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; gradient: string; textColor: string;
}) {
  return (
    <Card className={`relative overflow-hidden border-0 ${gradient}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/70">{title}</p>
            <p className={`mt-1 text-3xl font-bold ${textColor}`}>{value}</p>
            {sub && <p className="mt-1 text-xs text-white/60">{sub}</p>}
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Today's Events Widget (Birthdays & Anniversaries)
   ═══════════════════════════════════════════════════════════════════════════ */

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

const AVATAR_GRADIENTS = [
  'from-pink-500 to-rose-500',
  'from-violet-500 to-purple-500',
  'from-indigo-500 to-blue-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-red-500',
  'from-teal-500 to-cyan-500',
  'from-blue-500 to-indigo-500',
];

function EventPersonCard({ event }: { event: TodayEvent }) {
  const gradient = AVATAR_GRADIENTS[event.id % AVATAR_GRADIENTS.length];
  const href = event._type === 'employee' ? `/employees/${event.id}?type=employee` : '#';
  return (
    <Link href={href}>
      <div className="group flex flex-col items-center gap-1.5 cursor-pointer">
        <div className={`relative flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br ${gradient} text-white text-sm font-bold ring-2 ring-background shadow-md group-hover:ring-indigo-400 group-hover:scale-110 transition-all`}>
          {getInitials(event.name)}
        </div>
        <p className="text-[11px] font-medium text-center leading-tight max-w-[60px] truncate text-foreground group-hover:text-indigo-500 transition-colors">
          {event.name.split(' ')[0]}
        </p>
      </div>
    </Link>
  );
}

function EventsChart({
  events, emptyMsg, accentColor, Icon,
}: {
  events: TodayEvent[];
  emptyMsg: string;
  accentColor: string;
  Icon: React.ElementType;
}) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 gap-2">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${accentColor}/10`}>
          <Icon className={`h-5 w-5 ${accentColor}`} />
        </div>
        <p className="text-xs text-muted-foreground">{emptyMsg}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-3 pt-1">
      {events.map((e) => <EventPersonCard key={e.id} event={e} />)}
    </div>
  );
}

function TodayEventsWidget({ isEmployee }: { isEmployee?: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ['today-events'],
    queryFn: () =>
      (isEmployee ? employeesApi.employeeGetTodayEvents() : employeesApi.getTodayEvents())
        .then((r) => r.data.data),
  });

  const birthdays = (data ?? []).filter((e) => e.type === 'birthday');
  const anniversaries = (data ?? []).filter((e) => e.type === 'anniversary');

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Birthdays */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Cake className="h-4 w-4 text-pink-500" />
            Today&apos;s Birthdays
            {!isLoading && (
              <span className="ml-1 rounded-full bg-pink-100 dark:bg-pink-500/20 px-1.5 py-0.5 text-[10px] font-bold text-pink-600 dark:text-pink-400">
                {birthdays.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex gap-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <Skeleton className="h-3 w-10 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <EventsChart
              events={birthdays}
              emptyMsg="No birthdays today"
              accentColor="text-pink-500"
              Icon={Cake}
            />
          )}
        </CardContent>
      </Card>

      {/* Anniversaries */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <CalendarHeart className="h-4 w-4 text-rose-500" />
            Today&apos;s Work Anniversaries
            {!isLoading && (
              <span className="ml-1 rounded-full bg-rose-100 dark:bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                {anniversaries.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex gap-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <Skeleton className="h-3 w-10 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <EventsChart
              events={anniversaries}
              emptyMsg="No work anniversaries today"
              accentColor="text-rose-500"
              Icon={CalendarHeart}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Employee Dashboard
   ═══════════════════════════════════════════════════════════════════════════ */

function EmployeeDashboard() {
  const { user } = useAuth();
  const displayName = user?._type === 'employee'
    ? (user as { empName: string }).empName
    : user?._type === 'client'
      ? (user as { fullName: string }).fullName
      : (user as any)?.name ?? '';

  const { data: personal, isLoading } = useQuery({
    queryKey: ['emp-personal-dashboard'],
    queryFn: () => dashboardApi.getPersonalDashboard().then((r) => r.data.data),
  });

  const { data: taskSummary, isLoading: taskLoading } = useQuery({
    queryKey: ['emp-task-summary'],
    queryFn: () => myTasksApi.getSummary().then((r) => r.data.data),
  });

  const todayFilled = personal?.today?.filled ?? false;
  const todayHours = personal?.today?.totalHours ?? 0;
  const weekHours = personal?.thisWeek?.totalHours ?? 0;
  const monthHours = personal?.thisMonth?.totalHours ?? 0;
  const monthManDays = personal?.thisMonth?.manDays ?? 0;
  const sheetsSubmitted = personal?.thisMonth?.sheetsSubmitted ?? 0;
  const last7Days = personal?.last7Days ?? [];

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const chartData = last7Days.map((d: any) => ({
    day: dayLabels[new Date(d.date + 'T00:00:00').getDay()],
    date: format(new Date(d.date + 'T00:00:00'), 'dd MMM'),
    hours: d.hours,
    submitted: d.submitted,
  }));

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl border-0 shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-indigo-600 via-violet-600 to-purple-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoNnptMC0zMHY2aC02VjRoNnptMCAzMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative px-6 py-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/70">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},</p>
            <h1 className="text-2xl font-bold text-white mt-0.5">{displayName}</h1>
            <p className="text-sm text-white/60 mt-1">
              {todayFilled
                ? `Today's sheet submitted (${todayHours}h)`
                : "You haven't filled today's sheet yet"}
            </p>
          </div>
          <Button asChild size="sm" className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-0 shadow-lg">
            <Link href="/task-sheets/fill">
              <ClipboardList className="mr-1.5 h-4 w-4" />
              {todayFilled ? 'View Sheet' : 'Fill Sheet'}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            title="Sheets Submitted"
            value={sheetsSubmitted}
            sub={thisMonthLabel}
            icon={FileCheck}
            gradient="bg-gradient-to-br from-indigo-500 to-blue-600"
            textColor="text-white"
          />
          <KpiCard
            title="Hours This Week"
            value={Number(weekHours).toFixed(1)}
            sub="Current week"
            icon={Clock}
            gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
            textColor="text-white"
          />
          <KpiCard
            title="Hours This Month"
            value={Number(monthHours).toFixed(1)}
            sub={thisMonthLabel}
            icon={BarChart3}
            gradient="bg-gradient-to-br from-violet-500 to-purple-700"
            textColor="text-white"
          />
          <KpiCard
            title="Man-Days"
            value={Number(monthManDays).toFixed(1)}
            sub={thisMonthLabel}
            icon={TrendingUp}
            gradient="bg-gradient-to-br from-amber-400 to-orange-500"
            textColor="text-white"
          />
        </div>
      )}

      {/* Task / Ticket Stats */}
      {taskLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <KpiCard
            title="Total Tickets"
            value={taskSummary?.totalTasks ?? 0}
            icon={Ticket}
            gradient="bg-gradient-to-br from-slate-600 to-slate-800"
            textColor="text-white"
          />
          <KpiCard
            title="To Do"
            value={taskSummary?.todoCount ?? 0}
            icon={ListTodo}
            gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
            textColor="text-white"
          />
          <KpiCard
            title="In Progress"
            value={taskSummary?.inProgressCount ?? 0}
            icon={PlayCircle}
            gradient="bg-gradient-to-br from-amber-400 to-orange-500"
            textColor="text-white"
          />
          <KpiCard
            title="In Review"
            value={taskSummary?.inReviewCount ?? 0}
            icon={Eye}
            gradient="bg-gradient-to-br from-purple-500 to-fuchsia-600"
            textColor="text-white"
          />
          <KpiCard
            title="Done"
            value={taskSummary?.doneCount ?? 0}
            icon={CircleCheckBig}
            gradient="bg-gradient-to-br from-emerald-500 to-green-600"
            textColor="text-white"
          />
        </div>
      )}

      {/* Last 7 Days Chart */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            Last 7 Days — Hours Logged
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-50 w-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.07} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.6 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }}
                  axisLine={false}
                  tickLine={false}
                  unit="h"
                />
                <Tooltip
                  contentStyle={{ borderRadius: 10, fontSize: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}
                  formatter={(v: any) => [`${Number(v).toFixed(1)}h`, 'Hours']}
                />
                <Area
                  type="monotone"
                  dataKey="hours"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fill="url(#hoursGrad)"
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    return (
                      <circle
                        key={props.index}
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill={payload.submitted ? '#6366f1' : '#e5e7eb'}
                        stroke={payload.submitted ? '#4f46e5' : '#d1d5db'}
                        strokeWidth={2}
                      />
                    );
                  }}
                  activeDot={{ r: 7, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Last 7 Days Status Grid */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-emerald-500" />
            Last 7 Days — Submission Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-7 gap-2">
              {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {chartData.map((d: any, i: number) => {
                const isToday = i === chartData.length - 1;
                return (
                  <div
                    key={i}
                    className={`flex flex-col items-center justify-center rounded-xl p-3 transition-all ${d.submitted
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 ring-1 ring-emerald-200 dark:ring-emerald-500/20'
                        : d.hours > 0
                          ? 'bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-200 dark:ring-amber-500/20'
                          : 'bg-gray-50 dark:bg-gray-500/5 ring-1 ring-gray-200 dark:ring-gray-500/10'
                      } ${isToday ? 'ring-2 ring-indigo-400 dark:ring-indigo-500' : ''}`}
                  >
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground'}`}>
                      {d.day}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{d.date.split(' ')[0]}</p>
                    {d.submitted ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-1.5" />
                    ) : d.hours > 0 ? (
                      <Clock className="h-5 w-5 text-amber-500 mt-1.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-300 dark:text-gray-600 mt-1.5" />
                    )}
                    <p className={`text-xs font-semibold mt-1 ${d.submitted ? 'text-emerald-600 dark:text-emerald-400' : d.hours > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'
                      }`}>
                      {d.hours > 0 ? `${Number(d.hours).toFixed(1)}h` : '--'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's Birthdays & Anniversaries */}
      <TodayEventsWidget isEmployee />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link href="/task-sheets/fill" className="group">
          <Card className="shadow-sm transition-all hover:shadow-md hover:ring-1 hover:ring-indigo-500/20 cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
                <ClipboardList className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Fill Today&apos;s Sheet</p>
                <p className="text-xs text-muted-foreground">Log your daily tasks</p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-indigo-500 transition-colors" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/task-sheets" className="group">
          <Card className="shadow-sm transition-all hover:shadow-md hover:ring-1 hover:ring-violet-500/20 cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 group-hover:bg-violet-500/20 transition-colors">
                <FileCheck className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Task Sheet History</p>
                <p className="text-xs text-muted-foreground">View past submissions</p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-violet-500 transition-colors" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/reports/employee-wise" className="group">
          <Card className="shadow-sm transition-all hover:shadow-md hover:ring-1 hover:ring-amber-500/20 cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
                <BarChart3 className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">My Report</p>
                <p className="text-xs text-muted-foreground">View your work summary</p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-amber-500 transition-colors" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Admin Dashboard
   ═══════════════════════════════════════════════════════════════════════════ */

function AdminDashboard() {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => dashboardApi.getSummary().then((r) => r.data.data),
  });

  const { data: taskSummary, isLoading: taskLoading } = useQuery({
    queryKey: ['dashboard-task-summary'],
    queryFn: () => dashboardApi.getTaskSummary().then((r) => r.data.data),
  });

  const { data: byType } = useQuery({
    queryKey: ['dashboard-by-type', thisMonth],
    queryFn: () => dashboardApi.getManDaysByType(thisMonth).then((r) => r.data.data),
  });

  const { data: byProject } = useQuery({
    queryKey: ['dashboard-by-project', thisMonth],
    queryFn: () => dashboardApi.getManDaysByProject(thisMonth).then((r) => r.data.data),
  });

  const { data: trend } = useQuery({
    queryKey: ['dashboard-trend'],
    queryFn: () => dashboardApi.getFillRateTrend(14).then((r) => r.data.data),
  });

  const { data: topEmps } = useQuery({
    queryKey: ['dashboard-top', thisMonth],
    queryFn: () => dashboardApi.getTopEmployees(thisMonth, 10).then((r) => r.data.data),
  });

  const typeLabels: Record<string, string> = {
    project_manager: 'PM',
    functional: 'Functional',
    technical: 'Technical',
    management: 'Management',
    core_team: 'Core Team',
  };

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      {summaryLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            title="Active Employees"
            value={summary?.totalEmployees ?? 0}
            icon={Users}
            gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
            textColor="text-white"
          />
          <KpiCard
            title="Active Projects"
            value={summary?.activeProjects ?? 0}
            icon={FolderKanban}
            gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
            textColor="text-white"
          />
          <KpiCard
            title="Man-Days (Month)"
            value={Number(summary?.totalManDaysThisMonth ?? 0).toFixed(1)}
            icon={CalendarCheck}
            gradient="bg-gradient-to-br from-violet-500 to-purple-700"
            textColor="text-white"
          />
          <KpiCard
            title="Fill Rate Today"
            value={`${summary?.fillRateToday ?? 0}%`}
            sub={`${summary?.filledToday ?? 0} / ${summary?.totalActiveEmployees ?? 0} filled`}
            icon={TrendingUp}
            gradient="bg-gradient-to-br from-amber-400 to-orange-500"
            textColor="text-white"
          />
        </div>
      )}

      {/* Task / Ticket Stats */}
      {taskLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <KpiCard
            title="Total Tickets"
            value={taskSummary?.totalTasks ?? 0}
            icon={Ticket}
            gradient="bg-gradient-to-br from-slate-600 to-slate-800"
            textColor="text-white"
          />
          <KpiCard
            title="To Do"
            value={taskSummary?.todoCount ?? 0}
            icon={ListTodo}
            gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
            textColor="text-white"
          />
          <KpiCard
            title="In Progress"
            value={taskSummary?.inProgressCount ?? 0}
            icon={PlayCircle}
            gradient="bg-gradient-to-br from-amber-400 to-orange-500"
            textColor="text-white"
          />
          <KpiCard
            title="In Review"
            value={taskSummary?.inReviewCount ?? 0}
            icon={Eye}
            gradient="bg-gradient-to-br from-purple-500 to-fuchsia-600"
            textColor="text-white"
          />
          <KpiCard
            title="Done"
            value={taskSummary?.doneCount ?? 0}
            icon={CircleCheckBig}
            gradient="bg-gradient-to-br from-emerald-500 to-green-600"
            textColor="text-white"
          />
        </div>
      )}

      {/* Charts row 1 */}
      {/* <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Man-Days by Consultant Type — {thisMonth}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={(byType ?? []).map((d) => ({
                name: typeLabels[d.consultant_type] ?? d.consultant_type,
                manDays: Number(d.total_man_days),
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.07} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="manDays" name="Man-Days" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Fill Rate Trend — Last 14 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={(trend ?? []).map((d) => ({
                date: format(new Date(d.date), 'MM/dd'),
                rate: Number(d.fill_rate),
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.07} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => `${v}%`} />
                <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div> */}

      {/* Today's Birthdays & Anniversaries */}
      <TodayEventsWidget />

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Man-Days by Project — {thisMonth}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart layout="vertical" data={(byProject ?? []).slice(0, 8).map((d) => ({
                name: d.project_name.length > 18 ? d.project_name.slice(0, 18) + '...' : d.project_name,
                manDays: Number(d.total_man_days),
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.07} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="manDays" name="Man-Days" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Type Share</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={(byType ?? []).map((d) => ({
                    name: typeLabels[d.consultant_type] ?? d.consultant_type,
                    value: Number(d.total_man_days),
                  }))}
                  cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value"
                >
                  {(byType ?? []).map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => `${Number(v).toFixed(1)} MD`} />
                <Legend iconSize={9} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Employees */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Top Employees by Hours — {thisMonth}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={(topEmps ?? []).map((d) => ({
              name: d.emp_name.split(' ')[0],
              hours: Number(d.total_hours),
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.07} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="hours" name="Hours" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Platform Dashboard — super admin without company selected
   ═══════════════════════════════════════════════════════════════════════════ */

function PlatformDashboard() {
  const { selectCompany } = useCompany();

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['platform-dashboard'],
    queryFn: () => companiesApi.getPlatformDashboard().then((r) => r.data.data),
  });

  const { data: companiesRes } = useQuery({
    queryKey: ['platform-companies-dashboard'],
    queryFn: () => companiesApi.getAll({ limit: 10, isActive: true }),
  });

  const companies = companiesRes?.data?.data ?? [];
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <KpiCard title="Total Companies" value={dashboard?.totalCompanies ?? 0} icon={FolderKanban} gradient="bg-gradient-to-br from-violet-500 to-purple-700" textColor="text-white" />
          <KpiCard title="Active Companies" value={dashboard?.activeCompanies ?? 0} icon={CheckCircle2} gradient="bg-gradient-to-br from-emerald-500 to-teal-600" textColor="text-white" />
          <KpiCard title="Company Admins" value={dashboard?.totalAdmins ?? 0} icon={Users} gradient="bg-gradient-to-br from-blue-500 to-indigo-600" textColor="text-white" />
          <KpiCard title="Total Employees" value={dashboard?.totalEmployees ?? 0} icon={Users} gradient="bg-gradient-to-br from-amber-400 to-orange-500" textColor="text-white" />
          <KpiCard title="Expiring Soon" value={dashboard?.expiringSoon ?? 0} sub="Within 30 days" icon={CalendarCheck} gradient="bg-gradient-to-br from-red-500 to-rose-600" textColor="text-white" />
        </div>
      )}

      {/* Quick company access */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Active Companies</h2>
          <Link href="/companies">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              View All <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => (
            <Card key={c.id} className="cursor-pointer hover:ring-1 hover:ring-indigo-500/30 transition-all" onClick={() => selectCompany({ id: c.id, name: c.name, slug: c.slug, logoUrl: c.logoUrl })}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 overflow-hidden">
                      {c.logoUrl ? (
                        <img src={`${apiBase}${c.logoUrl}`} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <FolderKanban className="h-5 w-5 text-indigo-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.slug}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-lg font-bold text-indigo-500">{(c.adminCount ?? 0) + (c.employeeCount ?? 0)}</p>
                    <p className="text-[10px] text-muted-foreground">members</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Page — routes to admin or employee dashboard
   ═══════════════════════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const { user } = useAuth();
  const { isSuperAdmin, selectedCompany } = useCompany();

  if (user?._type === 'employee') return <EmployeeDashboard />;
  if (isSuperAdmin && !selectedCompany) return <PlatformDashboard />;
  return <AdminDashboard />;
}
