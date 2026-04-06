/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { IndianRupee, Users, Download, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '@/lib/api/axios-instance';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const fmt = (n: number | string | null) => Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function EmployeeCostPage() {
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';
  const now = new Date();
  const [fromDate, setFromDate] = useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(endOfMonth(now), 'yyyy-MM-dd'));

  const { data, isLoading } = useQuery({
    queryKey: ['employee-cost', fromDate, toDate],
    queryFn: async () => {
      const prefix = isAdmin ? '/admin' : '/employee';
      const r = await api.get(`${prefix}/reports/employee-cost`, { params: { from_date: fromDate, to_date: toDate } });
      return r.data?.data ?? r.data;
    },
    enabled: !!user,
  });

  const employeeCosts: any[] = data?.employeeCosts ?? [];

  // Group by employee
  const grouped: Record<string, { employee: any; projects: any[]; totalHours: number; totalManDays: number; totalCost: number }> = {};
  employeeCosts.forEach((row: any) => {
    const id = row.employee_id;
    if (!grouped[id]) grouped[id] = { employee: row, projects: [], totalHours: 0, totalManDays: 0, totalCost: 0 };
    grouped[id].projects.push(row);
    grouped[id].totalHours += Number(row.total_hours ?? 0);
    grouped[id].totalManDays += Number(row.man_days ?? 0);
    grouped[id].totalCost += Number(row.cost ?? 0);
  });
  const employeeList = Object.values(grouped).sort((a, b) => b.totalCost - a.totalCost);

  const totalCost = employeeList.reduce((s, e) => s + e.totalCost, 0);
  const totalHours = employeeList.reduce((s, e) => s + e.totalHours, 0);
  const totalManDays = employeeList.reduce((s, e) => s + e.totalManDays, 0);

  const exportToExcel = () => {
    const rows = employeeCosts.map((r: any) => ({
      'Employee': r.emp_name, 'Code': r.emp_code, 'Monthly CTC': Number(r.monthly_ctc), 'Daily Rate': Number(r.daily_rate),
      'Project': r.project_name ?? '—', 'Hours': Number(r.total_hours), 'Man-Days': Number(r.man_days), 'Cost': Number(r.cost),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employee Cost');
    XLSX.writeFile(wb, `employee-cost_${fromDate}_${toDate}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><IndianRupee className="h-5 w-5 text-primary" /> Employee Costing</h1>
          <p className="text-sm text-muted-foreground">Cost analysis by employee across projects</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 w-36 text-xs" />
          <span className="text-muted-foreground text-sm">to</span>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 w-36 text-xs" />
          <Button size="sm" variant="outline" onClick={exportToExcel} disabled={employeeCosts.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <div className="h-10 w-10 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <Clock className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Hours / Man-Days</p>
              <p className="text-lg font-bold">{totalHours.toFixed(1)}h / {totalManDays.toFixed(1)}d</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Users className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Employees with CTC</p>
              <p className="text-lg font-bold">{employeeList.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>CTC/Month</TableHead>
                    <TableHead>Daily Rate</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Man-Days</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeList.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No data. Set Monthly CTC for employees first.</TableCell></TableRow>
                  ) : (
                    employeeList.map((emp) => (
                      emp.projects.map((row: any, idx: number) => (
                        <TableRow key={`${emp.employee.employee_id}-${idx}`}>
                          {idx === 0 ? (
                            <>
                              <TableCell rowSpan={emp.projects.length} className="font-medium border-r">
                                <div>{row.emp_name}</div>
                                <div className="text-xs text-muted-foreground font-mono">{row.emp_code}</div>
                              </TableCell>
                              <TableCell rowSpan={emp.projects.length} className="border-r">{'\u20B9'}{fmt(row.monthly_ctc)}</TableCell>
                              <TableCell rowSpan={emp.projects.length} className="border-r">{'\u20B9'}{fmt(row.daily_rate)}</TableCell>
                            </>
                          ) : null}
                          <TableCell>{row.project_name ?? '—'}</TableCell>
                          <TableCell className="text-right">{Number(row.total_hours).toFixed(1)}</TableCell>
                          <TableCell className="text-right">{Number(row.man_days).toFixed(1)}</TableCell>
                          <TableCell className="text-right font-semibold">{'\u20B9'}{fmt(row.cost)}</TableCell>
                        </TableRow>
                      ))
                    ))
                  )}
                  {employeeList.length > 0 && (
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={4}>Total</TableCell>
                      <TableCell className="text-right">{totalHours.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{totalManDays.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{'\u20B9'}{fmt(totalCost)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
