'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Download, Search, FolderKanban } from 'lucide-react';
import { toast } from 'sonner';
import { reportsApi } from '@/lib/api/reports';
import { downloadBlob } from '@/lib/utils/download';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const thisMonth = format(new Date(), 'yyyy-MM');

export default function ProjectWiseReportPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const isEmployee = user?._type === 'employee';
  const isAdmin = !isEmployee;
  const isHr = isEmployee && !!(user as any)?.isHr;
  // Plain (non-HR) employees now see their own contributions per project
  // — the backend automatically scopes the response to `employee.id`. We
  // no longer redirect them away from this page.
  void router; // suppress unused-router warning when no redirect runs

  const [month, setMonth] = useState(thisMonth);
  const [autoFetch, setAutoFetch] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['report-proj-wise', month, isEmployee],
    queryFn: () =>
      (isEmployee
        ? reportsApi.employeeGetProjectWise(month)
        : reportsApi.getProjectWise(month)
      ).then((r) => r.data.data),
    enabled: autoFetch,
  });

  const handleExport = async () => {
    if (!isAdmin) return;
    setDownloading(true);
    try {
      const res = await reportsApi.exportProjectWise(month);
      downloadBlob(res.data as Blob, `project-report-${month}.xlsx`);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setDownloading(false);
    }
  };

  if (authLoading) return null;

  return (
    <div className="space-y-4">
      {/* Gradient Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-amber-600 via-orange-600 to-rose-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoNnptMC0zMHY2aC02VjRoNnptMCAzMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <FolderKanban className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Project-Wise Report</h1>
              <p className="text-sm text-white/60">Man-days by project breakdown</p>
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

      <div className="flex items-end gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Month</label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
        </div>
        <Button size="sm" onClick={() => setAutoFetch(true)} className="bg-linear-to-r from-indigo-500 to-violet-600 text-white hover:opacity-90 shadow-sm shadow-indigo-500/25 border-0">
          <Search className="mr-1.5 h-4 w-4" /> Run Report
        </Button>
      </div>

      {!autoFetch ? (
        <div className="flex h-40 items-center justify-center rounded-lg border bg-card text-muted-foreground text-sm">
          Select a month and click Run Report
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
          <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-amber-500 via-orange-500 to-rose-500" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">PM</TableHead>
                <TableHead className="text-right">Functional</TableHead>
                <TableHead className="text-right">Technical</TableHead>
                <TableHead className="text-right">Mgmt</TableHead>
                <TableHead className="text-right">Core</TableHead>
                <TableHead className="text-right font-semibold">Total MD</TableHead>
                <TableHead className="text-right">Emps</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(10)].map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-14" /></TableCell>)}
                    </TableRow>
                  ))
                : (data ?? []).map((row) => (
                    <TableRow
                      key={row.project_id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() =>
                        router.push(`/reports/project-wise/${row.project_id}?month=${month}`)
                      }
                      title="View per-employee breakdown"
                    >
                      <TableCell className="font-mono text-xs">{row.project_code}</TableCell>
                      <TableCell className="font-medium max-w-[160px] truncate">{row.project_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">{row.project_type}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs">{Number(row.pm_man_days).toFixed(1)}</TableCell>
                      <TableCell className="text-right text-xs">{Number(row.functional_man_days).toFixed(1)}</TableCell>
                      <TableCell className="text-right text-xs">{Number(row.technical_man_days).toFixed(1)}</TableCell>
                      <TableCell className="text-right text-xs">{Number(row.management_man_days).toFixed(1)}</TableCell>
                      <TableCell className="text-right text-xs">{Number(row.core_team_man_days).toFixed(1)}</TableCell>
                      <TableCell className="text-right font-semibold">{Number(row.total_man_days).toFixed(2)}</TableCell>
                      <TableCell className="text-right">{row.employee_count}</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
