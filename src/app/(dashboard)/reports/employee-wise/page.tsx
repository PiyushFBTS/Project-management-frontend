/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

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

const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');
const today = format(new Date(), 'yyyy-MM-dd');

const typeLabels: Record<string, string> = {
  project_manager: 'Project Manager',
  functional: 'Functional',
  technical: 'Technical',
  management: 'Management',
  core_team: 'Core Team',
};

export default function EmployeeWiseReportPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isEmployee = user?._type === 'employee';
  const isAdmin = !isEmployee;
  const isHr = isEmployee && !!(user as any)?.isHr;
  const canSeeAll = isAdmin || isHr;

  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);
  const [consultantType, setConsultantType] = useState('');
  const [autoFetch, setAutoFetch] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Ticket list dialog
  const [ticketEmpId, setTicketEmpId] = useState<number | null>(null);
  const [ticketEmpName, setTicketEmpName] = useState('');
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['report-emp-wise', fromDate, toDate, consultantType, isEmployee],
    queryFn: () =>
      (isEmployee
        ? reportsApi.employeeGetEmployeeWise(fromDate, toDate, consultantType || undefined)
        : reportsApi.getEmployeeWise(fromDate, toDate, consultantType || undefined)
      ).then((r) => r.data.data),
    enabled: autoFetch,
  });

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
              <h1 className="text-xl font-bold text-white">{canSeeAll ? 'Employee-Wise Report' : 'My Report'}</h1>
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
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">From</label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-36" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-36" />
        </div>
        {canSeeAll && (
          <Select value={consultantType || 'all'} onValueChange={(v) => setConsultantType(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(typeLabels).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button size="sm" onClick={() => setAutoFetch(true)} className="bg-linear-to-r from-blue-600 to-blue-800 text-white hover:opacity-90 shadow-sm shadow-blue-500/25 border-0">
          <Search className="mr-1.5 h-4 w-4" /> Run Report
        </Button>
      </div>

      {!autoFetch ? (
        <div className="flex h-40 items-center justify-center rounded-lg border bg-card text-muted-foreground text-sm">
          Select filters and click Run Report
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
          <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-blue-500 to-blue-700" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Days Filled</TableHead>
                <TableHead className="text-right">Total Hours</TableHead>
                <TableHead className="text-right">Avg Hrs/Day</TableHead>
                <TableHead className="text-right">Ticket Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? [...Array(canSeeAll ? 6 : 1)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(8)].map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-16" /></TableCell>)}
                    </TableRow>
                  ))
                : (data ?? []).map((row: any) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() =>
                        router.push(
                          `/reports/employee-wise/${row.id}?from_date=${fromDate}&to_date=${toDate}`,
                        )
                      }
                      title="Open per-project / per-ticket breakdown"
                    >
                      <TableCell className="font-mono text-xs">{row.emp_code}</TableCell>
                      <TableCell className="font-medium" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/employees/${row.id}?type=admin`}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                          title="Open employee profile"
                        >
                          {row.emp_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">{typeLabels[row.consultant_type] ?? row.consultant_type}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.assigned_project ?? '—'}</TableCell>
                      <TableCell className="text-right">{row.days_filled}</TableCell>
                      <TableCell className="text-right">{Number(row.total_hours).toFixed(1)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{Number(row.avg_hours_per_day).toFixed(2)}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          onClick={() => { setTicketEmpId(row.id); setTicketEmpName(row.emp_name); setTicketDialogOpen(true); }}
                        >
                          {Number(row.ticket_count ?? 0).toFixed(2)}
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
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
