/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, BarChart3, FolderKanban, Ticket as TicketIcon } from 'lucide-react';
import { reportsApi } from '@/lib/api/reports';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const STATUS_BADGE: Record<string, string> = {
  todo:        'bg-slate-500/15 text-slate-700 dark:text-slate-300 ring-slate-500/30',
  in_progress: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 ring-blue-500/30',
  in_review:   'bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-amber-500/30',
  done:        'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-emerald-500/30',
  closed:      'bg-purple-500/15 text-purple-700 dark:text-purple-400 ring-purple-500/30',
};
const STATUS_LABEL: Record<string, string> = {
  todo: 'To Do', in_progress: 'In Progress', in_review: 'In Review', done: 'Done', closed: 'Closed',
};

export default function EmployeeBreakdownPage({
  params: paramsPromise,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId: employeeIdStr } = use(paramsPromise);
  const router = useRouter();
  const search = useSearchParams();
  const { user } = useAuth();
  const isEmployee = user?._type === 'employee';
  const isHr = isEmployee && !!(user as any)?.isHr;

  const employeeId = Number(employeeIdStr);
  // Default to month-to-date if URL didn't carry the range.
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const monthStartStr = format(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    'yyyy-MM-dd',
  );
  const fromDate = search.get('from_date') ?? monthStartStr;
  const toDate = search.get('to_date') ?? todayStr;

  const { data, isLoading } = useQuery({
    queryKey: ['report-emp-breakdown', employeeId, fromDate, toDate, isEmployee],
    queryFn: () =>
      (isEmployee
        ? reportsApi.employeeGetEmployeeBreakdown(employeeId, fromDate, toDate)
        : reportsApi.getEmployeeBreakdown(employeeId, fromDate, toDate)
      ).then((r: any) => r.data?.data ?? r.data),
    enabled: !!user && Number.isFinite(employeeId) && (!isEmployee || isHr),
  });

  const employee = data?.employee as
    | { id: number; emp_code: string; emp_name: string; consultant_type: string }
    | null
    | undefined;
  const projects = (data?.projects ?? []) as Array<{
    project_id: number;
    project_code: string;
    project_name: string;
    project_type: string | null;
    total_hours: number;
    total_man_days: number;
    tickets: Array<{
      ticket_id: number | null;
      ticket_number: string | null;
      title: string;
      status: string | null;
      hours: number;
      man_days: number;
    }>;
  }>;
  const totals = (data?.totals ?? { total_hours: 0, total_man_days: 0 }) as {
    total_hours: number;
    total_man_days: number;
  };

  const fromLabel = (() => {
    try { return format(new Date(`${fromDate}T00:00:00`), 'd MMM yyyy'); } catch { return fromDate; }
  })();
  const toLabel = (() => {
    try { return format(new Date(`${toDate}T00:00:00`), 'd MMM yyyy'); } catch { return toDate; }
  })();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-blue-600 to-blue-800" />
        <div className="relative px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.back()}
              className="bg-white/15 hover:bg-white/25 text-white border-0 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shrink-0">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">
                {employee?.emp_name ?? 'Employee Breakdown'}
              </h1>
              <p className="text-sm text-white/70 truncate">
                {employee?.emp_code ? `${employee.emp_code} · ` : ''}
                {fromLabel} → {toLabel} · {projects.length} project{projects.length === 1 ? '' : 's'} · {totals.total_hours.toFixed(1)} hrs ({totals.total_man_days.toFixed(2)} MD)
              </p>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          No submitted task entries for {fromLabel} → {toLabel}.
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((proj) => (
            <div key={proj.project_id} className="rounded-lg border bg-card overflow-hidden shadow-sm">
              {/* Project header */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-linear-to-r from-blue-50 to-blue-100/40 dark:from-blue-950/40 dark:to-blue-900/20 border-b border-blue-500/15">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-linear-to-br from-blue-600 to-blue-800 text-white">
                    <FolderKanban className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 truncate">
                      {proj.project_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono">{proj.project_code}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-blue-700 dark:text-blue-400">
                    {proj.total_hours.toFixed(1)} hrs
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {proj.total_man_days.toFixed(2)} MD · {proj.tickets.length} ticket{proj.tickets.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              {/* Ticket rows */}
              <ul className="divide-y">
                {proj.tickets.map((t) => (
                  <li key={`${proj.project_id}-${t.ticket_id ?? 'no_ticket'}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                    <TicketIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {t.ticket_number ? (
                      <span className="font-mono text-[10px] text-blue-700 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded shrink-0">
                        {t.ticket_number}
                      </span>
                    ) : (
                      // Non-ticketed entry (meeting / call / internal work).
                      // The title cell carries the actual description.
                      <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded shrink-0">
                        Activity
                      </span>
                    )}
                    {t.status && STATUS_LABEL[t.status] && (
                      <Badge className={`text-[9px] border-0 ring-1 ${STATUS_BADGE[t.status] ?? ''}`}>
                        {STATUS_LABEL[t.status]}
                      </Badge>
                    )}
                    <span className="flex-1 min-w-0 truncate text-sm">{t.title}</span>
                    <span className="text-sm font-semibold shrink-0">{t.hours.toFixed(1)} hrs</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="flex justify-end">
            <Badge variant="secondary" className="text-sm font-semibold">
              Total: {totals.total_hours.toFixed(1)} hrs · {totals.total_man_days.toFixed(2)} MD
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}
