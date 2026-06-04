/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, Search, BarChart3, Ticket, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { reportsApi } from '@/lib/api/reports';
import { downloadBlob } from '@/lib/utils/download';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog';

const statusColors: Record<string, string> = {
  todo: 'bg-slate-500/15 text-slate-600',
  in_progress: 'bg-blue-500/15 text-blue-600',
  in_review: 'bg-amber-500/15 text-amber-600',
  done: 'bg-emerald-500/15 text-emerald-600',
  closed: 'bg-purple-500/15 text-purple-600',
};
const statusLabels: Record<string, string> = {
  todo: 'To Do', in_progress: 'In Progress', in_review: 'In Review', done: 'Done', closed: 'Closed',
};

// Date defaults are computed inside the component so the values stay
// fresh — module-level constants get evaluated once when the JS module
// first loads in the browser, which means a tab kept open across
// midnight keeps yesterday as "today" and silently misses the newest
// task-sheet submissions.
function todayIso() {
  return format(new Date(), 'yyyy-MM-dd');
}
function monthStartIso() {
  const n = new Date();
  return format(new Date(n.getFullYear(), n.getMonth(), 1), 'yyyy-MM-dd');
}

// Match the labels used on the /employees page so role display stays
// consistent across the app.
const typeLabels: Record<string, string> = {
  project_manager: 'Project Manager',
  functional: 'Functional Consultant',
  technical: 'Technical Consultant',
  senior_project_manager: 'Senior Project Manager',
  senior_functional: 'Senior Functional Consultant',
  senior_technical: 'Senior Technical Consultant',
  ceo: 'CEO',
  coo: 'COO',
  cto: 'CTO',
  full_stack_developer: 'Full Stack Developer',
  account_manager: 'Account Manager',
  human_resource_manager: 'Human Resource Manager',
  brand_manager: 'Brand Manager',
};

export default function EmployeeWiseReportPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isEmployee = user?._type === 'employee';
  const isAdmin = !isEmployee;
  const isHr = isEmployee && !!(user as any)?.isHr;
  const canSeeAll = isAdmin || isHr;

  const [fromDate, setFromDate] = useState(monthStartIso);
  const [toDate, setToDate] = useState(todayIso);
  // Client-side search across employee name + emp_code. Filtering server-
  // side would require an extra param the backend doesn't expose yet.
  const [searchQuery, setSearchQuery] = useState('');
  const [downloading, setDownloading] = useState(false);

  // Ticket list dialog
  const [ticketEmpId, setTicketEmpId] = useState<number | null>(null);
  const [ticketEmpName, setTicketEmpName] = useState('');
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);

  // Auto-run on mount and refetch whenever the date range changes. No
  // explicit "Run Report" button needed.
  const { data, isLoading } = useQuery({
    queryKey: ['report-emp-wise', fromDate, toDate, isEmployee],
    queryFn: () =>
      (isEmployee
        ? reportsApi.employeeGetEmployeeWise(fromDate, toDate)
        : reportsApi.getEmployeeWise(fromDate, toDate)
      ).then((r) => r.data.data),
    enabled: !!user,
  });

  const filteredData = useMemo(() => {
    const rows = (data ?? []) as any[];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.name ?? '').toLowerCase().includes(q)
      || (r.emp_code ?? '').toLowerCase().includes(q),
    );
  }, [data, searchQuery]);

  const { data: empTickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ['employee-contributed-tickets', ticketEmpId],
    queryFn: () => reportsApi.getEmployeeTickets(ticketEmpId!).then((r: any) => r.data?.data ?? r.data),
    enabled: !!ticketEmpId && ticketDialogOpen,
  });

  const handleExport = async () => {
    if (!isAdmin) return;
    setDownloading(true);
    try {
      const res = await reportsApi.exportEmployeeWise(fromDate, toDate);
      downloadBlob(res.data as Blob, `employee-report-${fromDate}-${toDate}.xlsx`);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Gradient Header — brand blue, matches the rest of the app
          (project-wise drill-down, leave page, announcements). */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-blue-600 to-blue-800" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoNnptMC0zMHY2aC02VjRoNnptMCAzMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{canSeeAll ? 'Activity Tracker' : 'My Report'}</h1>
              <p className="text-sm text-white/60">Employee hours & man-days summary</p>
            </div>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={handleExport} disabled={downloading} className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-0 shadow-lg">
              <Download className="mr-1.5 h-4 w-4" />
              {downloading ? 'Exporting…' : 'Export Excel'}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {canSeeAll && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search name or code…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-60"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">From</label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-36" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-36" />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: canSeeAll ? 8 : 1 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 4 }).map((__, j) => <Skeleton key={j} className="h-10" />)}
              </div>
            </CardContent></Card>
          ))}
        </div>
      ) : filteredData.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">
          {searchQuery ? 'No employees match your search' : 'No employees match this filter'}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredData.map((row: any) => (
            <Card
              key={row.id}
              onClick={() =>
                router.push(
                  `/reports/employee-wise/${row.id}?from_date=${fromDate}&to_date=${toDate}`,
                )
              }
              title="Open per-project / per-ticket breakdown"
              className="cursor-pointer transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg hover:border-primary/50 hover:ring-2 hover:ring-primary/15"
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {(row.name ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Name links to the employee profile; stop propagation
                        so the click doesn't trigger the card-level drill. */}
                    <Link
                      href={`/employees/${row.id}?type=admin`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-semibold text-sm truncate block hover:text-primary hover:underline"
                      title="Open employee profile"
                    >
                      {row.name}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate">
                      {row.emp_code} · {typeLabels[row.consultant_type] ?? row.consultant_type ?? '—'}
                    </p>
                    {row.assigned_project && (
                      <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5">
                        {row.assigned_project}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-base font-bold text-primary">{Number(row.total_hours ?? 0).toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">Hours</p>
                  </div>
                  <div>
                    <p className="text-base font-bold text-emerald-600">{row.days_filled ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground">Days</p>
                  </div>
                  <div>
                    <p className="text-base font-bold text-amber-600">{Number(row.avg_hours_per_day ?? 0).toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">Avg/Day</p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => { setTicketEmpId(row.id); setTicketEmpName(row.name); setTicketDialogOpen(true); }}
                      className="font-bold text-base text-blue-600 dark:text-blue-400 hover:underline"
                      title="View contributed tickets"
                    >
                      {Number(row.ticket_count ?? 0).toFixed(2)}
                    </button>
                    <p className="text-[10px] text-muted-foreground">Tickets</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Ticket List Dialog ──────────────────────────────────────── */}
      <Dialog open={ticketDialogOpen} onOpenChange={(open) => { if (!open) { setTicketDialogOpen(false); setTicketEmpId(null); } }}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col gap-0 p-0">
          <div className="bg-linear-to-r from-blue-600 to-blue-800 px-5 py-4 text-white rounded-t-lg">
            <DialogTitle className="text-white flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              Contributed Tickets
            </DialogTitle>
            <p className="text-sm text-white/70 mt-0.5">{ticketEmpName}</p>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 p-4">
            {ticketsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : !empTickets || (empTickets as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No contributed tickets found.</p>
            ) : (
              <div className="space-y-2">
                {(empTickets as any[]).map((t: any) => (
                  <div key={t.id} className="rounded-lg border p-3 hover:bg-accent/30 transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded shrink-0">
                          {t.ticket_number ?? `#${t.id}`}
                        </span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${statusColors[t.status] ?? ''}`}>
                          {statusLabels[t.status] ?? t.status}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                        Share: {t.weighted_share}
                      </span>
                    </div>
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{t.project_name ?? '—'}</span>
                      <span>{t.contributor_count} contributor{t.contributor_count > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
