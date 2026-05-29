/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, BarChart3, FolderKanban, Ticket as TicketIcon, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { reportsApi } from '@/lib/api/reports';
import { downloadBlob } from '@/lib/utils/download';
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
    // Anyone signed in can open this — backend allows HR (any employee)
    // or any employee for their own id; others get a 403 they can see.
    enabled: !!user && Number.isFinite(employeeId),
  });

  const employee = data?.employee as
    | { id: number; emp_code: string; name: string; consultant_type: string }
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
      // For non-ticketed rows this is the activity label
      // (e.g. "Internal Meeting", "Client Meeting", "Other"). null
      // when the row is a real ticket.
      activity_type: string | null;
      status: string | null;
      hours: number;
      man_days: number;
    }>;
  }>;
  const totals = (data?.totals ?? { total_hours: 0, total_man_days: 0 }) as {
    total_hours: number;
    total_man_days: number;
  };

  // Collapsible project sections — collapsed ids are hidden.
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const toggleProject = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = isEmployee
        ? await reportsApi.employeeExportEmployeeBreakdown(employeeId, fromDate, toDate)
        : await reportsApi.exportEmployeeBreakdown(employeeId, fromDate, toDate);
      const filename = `employee-breakdown-${employee?.emp_code ?? employeeId}-${fromDate}_${toDate}.xlsx`;
      downloadBlob(res.data as Blob, filename);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
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
                {employee?.name ?? 'Employee Breakdown'}
              </h1>
              <p className="text-sm text-white/70 truncate">
                {employee?.emp_code ? `${employee.emp_code} · ` : ''}
                {fromLabel} → {toLabel} · {projects.length} project{projects.length === 1 ? '' : 's'} · {totals.total_hours.toFixed(1)} hrs ({totals.total_man_days.toFixed(2)} MD)
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={exporting || isLoading || projects.length === 0}
            className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-0 shadow-lg"
          >
            <Download className="mr-1.5 h-4 w-4" />
            {exporting ? 'Exporting…' : 'Export Excel'}
          </Button>
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
          {projects.map((proj) => {
            const isOpen = !collapsed.has(proj.project_id);
            return (
            <div key={proj.project_id} className="rounded-lg border bg-card overflow-hidden shadow-sm">
              {/* Project header — click to collapse / expand */}
              <button
                type="button"
                onClick={() => toggleProject(proj.project_id)}
                className="w-full text-left flex items-center justify-between gap-3 px-4 py-3 bg-linear-to-r from-blue-50 to-blue-100/40 dark:from-blue-950/40 dark:to-blue-900/20 border-b border-blue-500/15"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isOpen
                    ? <ChevronDown className="h-4 w-4 shrink-0 text-blue-700 dark:text-blue-400" />
                    : <ChevronRight className="h-4 w-4 shrink-0 text-blue-700 dark:text-blue-400" />}
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
                    {(() => {
                      const ticketCount = proj.tickets.filter((t) => t.ticket_id != null).length;
                      const activityCount = proj.tickets.length - ticketCount;
                      const parts: string[] = [`${proj.total_man_days.toFixed(2)} MD`];
                      if (ticketCount > 0) parts.push(`${ticketCount} ticket${ticketCount === 1 ? '' : 's'}`);
                      if (activityCount > 0) parts.push(`${activityCount} activit${activityCount === 1 ? 'y' : 'ies'}`);
                      return parts.join(' · ');
                    })()}
                  </p>
                </div>
              </button>
              {/* Ticket / activity rows.
                  - Ticketed → ticket-number badge + summed hours.
                  - Non-ticketed → activity_type badge (Internal
                    Meeting / Client Meeting / Other) so each piece of
                    work shows up in detail with its own row. */}
              {isOpen && (
              <ul className="divide-y">
                {proj.tickets.map((t, idx) => {
                  const isTicketed = t.ticket_id != null;
                  return (
                    <li
                      key={`${proj.project_id}-${isTicketed ? `t-${t.ticket_id}` : `a-${idx}-${t.activity_type ?? ''}`}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40"
                    >
                      <TicketIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {isTicketed && t.ticket_number ? (
                        <span className="font-mono text-[10px] text-blue-700 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded shrink-0">
                          {t.ticket_number}
                        </span>
                      ) : (
                        // Three badge categories — Internal Meeting /
                        // Client Meeting / Other. Anything that isn't
                        // one of the meeting enum values collapses to
                        // "Other" so the report stays consistent.
                        (() => {
                          const raw = (t.activity_type ?? '').toLowerCase().trim();
                          const label = raw === 'internal_meeting'
                            ? 'Internal Meeting'
                            : raw === 'client_meeting'
                              ? 'Client Meeting'
                              : 'Other';
                          return (
                            <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded shrink-0">
                              {label}
                            </span>
                          );
                        })()
                      )}
                      {isTicketed && t.status && STATUS_LABEL[t.status] && (
                        <Badge className={`text-[9px] border-0 ring-1 ${STATUS_BADGE[t.status] ?? ''}`}>
                          {STATUS_LABEL[t.status]}
                        </Badge>
                      )}
                      <span className="flex-1 min-w-0 truncate text-sm">{t.title}</span>
                      <span className="text-sm font-semibold shrink-0">{t.hours.toFixed(1)} hrs</span>
                    </li>
                  );
                })}
              </ul>
              )}
            </div>
            );
          })}

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
