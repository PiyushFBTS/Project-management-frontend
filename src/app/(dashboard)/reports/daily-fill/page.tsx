'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import Link from 'next/link';
import { Search, CheckCircle2, XCircle, BarChart3, Users as UsersIcon } from 'lucide-react';
import { reportsApi } from '@/lib/api/reports';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const today = format(new Date(), 'yyyy-MM-dd');

const typeLabels: Record<string, string> = {
  project_manager: 'PM',
  functional: 'Functional',
  technical: 'Technical',
  management: 'Management',
  core_team: 'Core',
};

export default function DailyFillReportPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const isEmployee = user?._type === 'employee';
  const isHr = isEmployee && !!(user as any)?.isHr;

  // Regular employees cannot access this page
  if (!authLoading && isEmployee && !isHr) {
    router.replace('/reports/employee-wise');
    return null;
  }

  const [date, setDate] = useState(today);
  const [autoFetch, setAutoFetch] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['report-daily-fill', date, isEmployee],
    queryFn: () =>
      (isEmployee
        ? reportsApi.employeeGetDailyFill(date)
        : reportsApi.getDailyFill(date)
      ).then((r) => r.data.data),
    enabled: autoFetch,
  });

  if (authLoading) return null;

  return (
    <div className="space-y-4">
      {/* Gradient Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-rose-600 via-pink-600 to-fuchsia-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoNnptMC0zMHY2aC02VjRoNnptMCAzMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative px-6 py-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Daily Fill Compliance</h1>
            <p className="text-sm text-white/60">Track daily task sheet fill rates</p>
          </div>
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Date</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-36" />
        </div>
        <Button size="sm" onClick={() => setAutoFetch(true)} className="bg-linear-to-r from-indigo-500 to-violet-600 text-white hover:opacity-90 shadow-sm shadow-indigo-500/25 border-0">
          <Search className="mr-1.5 h-4 w-4" /> Run Report
        </Button>
      </div>

      {!autoFetch ? (
        <div className="flex h-40 items-center justify-center rounded-lg border bg-card text-muted-foreground text-sm">
          Select a date and click Run Report
        </div>
      ) : (
        <>
          {/* Summary cards */}
          {data && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-indigo-500 to-violet-600">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Fill Rate</p>
                      <p className="mt-1 text-3xl font-bold text-white">{data.fillRate}%</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                      <BarChart3 className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-teal-600">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Filled</p>
                      <p className="mt-1 text-3xl font-bold text-white">{data.filledCount}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-rose-500 to-pink-600">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Not Filled</p>
                      <p className="mt-1 text-3xl font-bold text-white">{data.totalCount - data.filledCount}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                      <XCircle className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
            <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-rose-500 via-pink-500 to-fuchsia-500" />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Entries</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? [...Array(8)].map((_, i) => (
                      <TableRow key={i}>
                        {[...Array(6)].map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-16" /></TableCell>)}
                      </TableRow>
                    ))
                  : (data?.rows ?? []).map((row) => (
                      <TableRow key={row.id} className={row.is_filled ? '' : 'bg-red-50/50'}>
                        <TableCell className="font-mono text-xs">{row.emp_code}</TableCell>
                        <TableCell className="font-medium">
                          <Link href={`/employees/${row.id}?type=employee`} className="text-violet-600 dark:text-violet-400 hover:underline">
                            {row.emp_name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {typeLabels[row.consultant_type] ?? row.consultant_type}
                        </TableCell>
                        <TableCell>
                          {row.is_filled ? (
                            <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Filled
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-500 text-xs font-medium">
                              <XCircle className="h-3.5 w-3.5" /> Not Filled
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.is_filled ? `${Number(row.total_hours).toFixed(1)}h` : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.is_filled ? row.entry_count : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
