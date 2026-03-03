'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Download, Search, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { reportsApi } from '@/lib/api/reports';
import { downloadBlob } from '@/lib/utils/download';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

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
  const isEmployee = user?._type === 'employee';
  const isAdmin = !isEmployee;
  const isHr = isEmployee && !!(user as any)?.isHr;
  const canSeeAll = isAdmin || isHr;

  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);
  const [consultantType, setConsultantType] = useState('');
  const [autoFetch, setAutoFetch] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['report-emp-wise', fromDate, toDate, consultantType, isEmployee],
    queryFn: () =>
      (isEmployee
        ? reportsApi.employeeGetEmployeeWise(fromDate, toDate, consultantType || undefined)
        : reportsApi.getEmployeeWise(fromDate, toDate, consultantType || undefined)
      ).then((r) => r.data.data),
    enabled: autoFetch,
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
      {/* Gradient Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-indigo-600 via-violet-600 to-fuchsia-600" />
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
        <Button size="sm" onClick={() => setAutoFetch(true)} className="bg-linear-to-r from-indigo-500 to-violet-600 text-white hover:opacity-90 shadow-sm shadow-indigo-500/25 border-0">
          <Search className="mr-1.5 h-4 w-4" /> Run Report
        </Button>
      </div>

      {!autoFetch ? (
        <div className="flex h-40 items-center justify-center rounded-lg border bg-card text-muted-foreground text-sm">
          Select filters and click Run Report
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
          <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Days Filled</TableHead>
                <TableHead className="text-right">Total Hours</TableHead>
                <TableHead className="text-right">Man-Days</TableHead>
                <TableHead className="text-right">Avg Hrs/Day</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? [...Array(canSeeAll ? 6 : 1)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(8)].map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-16" /></TableCell>)}
                    </TableRow>
                  ))
                : (data ?? []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.emp_code}</TableCell>
                      <TableCell className="font-medium">{row.emp_name}</TableCell>
                      <TableCell className="text-xs">{typeLabels[row.consultant_type] ?? row.consultant_type}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.assigned_project ?? '—'}</TableCell>
                      <TableCell className="text-right">{row.days_filled}</TableCell>
                      <TableCell className="text-right">{Number(row.total_hours).toFixed(1)}</TableCell>
                      <TableCell className="text-right font-medium">{Number(row.total_man_days).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{Number(row.avg_hours_per_day).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
