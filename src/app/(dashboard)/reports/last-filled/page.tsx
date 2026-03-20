/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { CalendarClock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { reportsApi } from '@/lib/api/reports';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const typeLabels: Record<string, string> = {
  project_manager: 'PM',
  functional: 'Functional',
  technical: 'Technical',
  management: 'Management',
  core_team: 'Core',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}


export default function LastFilledReportPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const isEmployee = user?._type === 'employee';
  const isHr = isEmployee && !!(user as any)?.isHr;

  if (!authLoading && isEmployee && !isHr) {
    router.replace('/reports/employee-wise');
    return null;
  }

  const { data, isLoading } = useQuery({
    queryKey: ['report-last-filled', isEmployee],
    queryFn: () =>
      (isEmployee
        ? reportsApi.employeeGetLastFilled()
        : reportsApi.getLastFilled()
      ).then((r) => r.data.data),
  });

  if (authLoading) return null;

  const rows = data ?? [];
  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const neverFilled = rows.filter((r) => !r.last_filled_date || new Date(r.last_filled_date) < currentMonthStart).length;
  const overdue = rows.filter((r) => r.days_since_last_fill !== null && r.days_since_last_fill >= 5 && new Date(r.last_filled_date!) >= currentMonthStart).length;
  const upToDate = rows.filter((r) => r.days_since_last_fill !== null && r.days_since_last_fill <= 1).length;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {!isLoading && rows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-teal-600">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Up to Date (Yesterday)</p>
                  <p className="mt-1 text-3xl font-bold text-white">{upToDate}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-500 to-orange-600">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Overdue (5+ days)</p>
                  <p className="mt-1 text-3xl font-bold text-white">{overdue}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-rose-500 to-pink-600">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Not Filled (This Month)</p>
                  <p className="mt-1 text-3xl font-bold text-white">{neverFilled}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <CalendarClock className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
        <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-rose-500 via-pink-500 to-fuchsia-500" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Last Filled Date</TableHead>
              <TableHead className="text-right">Days Ago</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? [...Array(6)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(6)].map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-16" /></TableCell>)}
                </TableRow>
              ))
              : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <CalendarClock className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">No employee data found</p>
                    </div>
                  </TableCell>
                </TableRow>
              )
                : rows.map((row) => {
                  const daysAgo = row.days_since_last_fill;
                  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                  const notFilledThisMonth = !row.last_filled_date || new Date(row.last_filled_date) < monthStart;
                  const isOverdue = !notFilledThisMonth && daysAgo !== null && daysAgo >= 5;
                  const isUpToDate = daysAgo !== null && daysAgo <= 1;
                  return (
                    <TableRow key={row.id} className={notFilledThisMonth ? 'bg-red-50/50 dark:bg-red-950/10' : isOverdue ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}>
                      <TableCell className="font-mono text-xs">{row.emp_code}</TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/employees/${row.id}?type=employee`} className="text-violet-600 dark:text-violet-400 hover:underline">
                          {row.emp_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                        {typeLabels[row.consultant_type] ?? row.consultant_type}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.assigned_project ?? '—'}</TableCell>
                      <TableCell>
                        {notFilledThisMonth ? (
                          <span className="text-xs font-medium text-red-500">{row.last_filled_date ? formatDate(row.last_filled_date) : 'Never'}</span>
                        ) : (
                          <span className="text-sm">{formatDate(row.last_filled_date)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {notFilledThisMonth ? (
                          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-600 ring-1 ring-red-500/30">Not this month</span>
                        ) : isOverdue ? (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 ring-1 ring-amber-500/30">{daysAgo}d ago</span>
                        ) : isUpToDate ? (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 ring-1 ring-emerald-500/30">{daysAgo === 0 ? 'Today' : '1d ago'}</span>
                        ) : (
                          <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-500/30">{daysAgo}d ago</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
