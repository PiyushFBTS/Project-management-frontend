/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { IndianRupee, TrendingUp, TrendingDown, FolderKanban, Download, ChevronDown, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '@/lib/api/axios-instance';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const fmt = (n: number | string | null) => Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function ProjectCostPage() {
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';
  const now = new Date();
  const [fromDate, setFromDate] = useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(endOfMonth(now), 'yyyy-MM-dd'));
  const [expandedProject, setExpandedProject] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['project-cost', fromDate, toDate],
    queryFn: async () => {
      const prefix = isAdmin ? '/admin' : '/employee';
      const r = await api.get(`${prefix}/reports/employee-cost`, { params: { from_date: fromDate, to_date: toDate } });
      return r.data?.data ?? r.data;
    },
    enabled: !!user,
  });

  const employeeCosts: any[] = data?.employeeCosts ?? [];
  const projectProfitability: any[] = data?.projectProfitability ?? [];

  // Build per-project employee breakdown
  const projectEmployeeMap: Record<number, any[]> = {};
  employeeCosts.forEach((row: any) => {
    const pid = row.project_id;
    if (!pid) return;
    if (!projectEmployeeMap[pid]) projectEmployeeMap[pid] = [];
    projectEmployeeMap[pid].push(row);
  });

  // KPIs
  const totalRevenue = projectProfitability.reduce((s, p) => s + Number(p.milestone_received ?? 0), 0);
  const totalCost = projectProfitability.reduce((s, p) => s + Number(p.employee_cost ?? 0), 0);
  const totalProfit = totalRevenue - totalCost;

  const exportToExcel = () => {
    const rows = projectProfitability.map((p: any) => ({
      'Project': p.project_name,
      'Code': p.project_code,
      'Budget': Number(p.project_budget ?? 0),
      'Milestone Total': Number(p.milestone_total),
      'Received': Number(p.milestone_received),
      'Employee Cost': Number(p.employee_cost),
      'Profit': Number(p.profit),
      'Margin %': Number(p.milestone_received) > 0 ? ((Number(p.profit) / Number(p.milestone_received)) * 100).toFixed(1) : '—',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Project Profitability');
    XLSX.writeFile(wb, `project-cost_${fromDate}_${toDate}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><FolderKanban className="h-5 w-5 text-primary" /> Project Costing</h1>
          <p className="text-sm text-muted-foreground">Project profitability & employee cost breakdown</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 w-36 text-xs" />
          <span className="text-muted-foreground text-sm">to</span>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 w-36 text-xs" />
          <Button size="sm" variant="outline" onClick={exportToExcel}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-lg font-bold">{'\u20B9'}{fmt(totalRevenue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <IndianRupee className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Employee Cost</p>
              <p className="text-lg font-bold">{'\u20B9'}{fmt(totalCost)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg ${totalProfit >= 0 ? 'bg-emerald-500/15' : 'bg-red-500/15'} flex items-center justify-center`}>
              {totalProfit >= 0 ? <TrendingUp className="h-5 w-5 text-emerald-500" /> : <TrendingDown className="h-5 w-5 text-red-500" />}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Net Profit / Loss</p>
              <p className={`text-lg font-bold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {totalProfit >= 0 ? '+' : ''}{'\u20B9'}{fmt(totalProfit)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : projectProfitability.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No project cost data found for this period</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead className="text-right">Milestone Total</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Employee Cost</TableHead>
                    <TableHead className="text-right">Profit / Loss</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectProfitability.map((p: any) => {
                    const profit = Number(p.profit ?? 0);
                    const received = Number(p.milestone_received ?? 0);
                    const margin = received > 0 ? ((profit / received) * 100).toFixed(1) : '—';
                    const isExpanded = expandedProject === p.id;
                    const empBreakdown = projectEmployeeMap[p.id] ?? [];

                    return (
                      <Fragment key={p.id}>
                        <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedProject(isExpanded ? null : p.id)}>
                          <TableCell className="w-8 px-2">
                            {empBreakdown.length > 0 && (isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />)}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{p.project_name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{p.project_code}</div>
                          </TableCell>
                          <TableCell className="text-right">{p.project_budget ? `\u20B9${fmt(p.project_budget)}` : '—'}</TableCell>
                          <TableCell className="text-right">{'\u20B9'}{fmt(p.milestone_total)}</TableCell>
                          <TableCell className="text-right">{'\u20B9'}{fmt(p.milestone_received)}</TableCell>
                          <TableCell className="text-right">{'\u20B9'}{fmt(p.employee_cost)}</TableCell>
                          <TableCell className="text-right">
                            <span className={`font-semibold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {profit >= 0 ? '+' : ''}{'\u20B9'}{fmt(profit)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {margin !== '—' ? (
                              <Badge className={`text-[10px] border-0 ${Number(margin) >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                {margin}%
                              </Badge>
                            ) : '—'}
                          </TableCell>
                        </TableRow>

                        {/* Expanded: employee breakdown */}
                        {isExpanded && empBreakdown.length > 0 && empBreakdown.map((emp: any, idx: number) => (
                          <TableRow key={`${p.id}-emp-${idx}`} className="bg-muted/20">
                            <TableCell></TableCell>
                            <TableCell className="pl-8 text-sm">
                              <span className="text-muted-foreground">{emp.emp_name}</span>
                              <span className="text-xs text-muted-foreground ml-2 font-mono">{emp.emp_code}</span>
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">CTC: {'\u20B9'}{fmt(emp.monthly_ctc)}/mo</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">Rate: {'\u20B9'}{fmt(emp.daily_rate)}/day</TableCell>
                            <TableCell className="text-right text-xs">{Number(emp.total_hours).toFixed(1)}h</TableCell>
                            <TableCell className="text-right text-xs font-medium">{'\u20B9'}{fmt(emp.cost)}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{Number(emp.man_days).toFixed(1)} days</TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    );
                  })}

                  {/* Totals row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell></TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">{'\u20B9'}{fmt(projectProfitability.reduce((s: number, p: any) => s + Number(p.milestone_total ?? 0), 0))}</TableCell>
                    <TableCell className="text-right">{'\u20B9'}{fmt(totalRevenue)}</TableCell>
                    <TableCell className="text-right">{'\u20B9'}{fmt(totalCost)}</TableCell>
                    <TableCell className="text-right">
                      <span className={totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {totalProfit >= 0 ? '+' : ''}{'\u20B9'}{fmt(totalProfit)}
                      </span>
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
