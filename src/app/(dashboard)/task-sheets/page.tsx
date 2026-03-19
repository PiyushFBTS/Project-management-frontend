'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { format } from 'date-fns';
import { Eye, Plus, ClipboardList, Pencil } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { taskSheetsApi } from '@/lib/api/task-sheets';
import { employeesApi } from '@/lib/api/employees';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const today = format(new Date(), 'yyyy-MM-dd');
const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');

function isEditable(sheetDate: string): boolean {
  const d = new Date(sheetDate);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 2);
  cutoff.setHours(0, 0, 0, 0);
  return d >= cutoff;
}

export default function TaskSheetsPage() {
  const { user } = useAuth();
  const isEmployee = user?._type === 'employee';

  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);
  const [empId, setEmpId] = useState<string>('');
  const [submitted, setSubmitted] = useState<string>('');

  // Admin: employee list for filter
  const { data: employees } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => employeesApi.getAll({ limit: 200 }).then((r) => r.data.data),
    enabled: !isEmployee,
  });

  // Admin: all task sheets
  const { data: adminData, isLoading: adminLoading } = useQuery({
    queryKey: ['task-sheets', fromDate, toDate, empId, submitted],
    queryFn: () =>
      taskSheetsApi.adminGetAll({
        fromDate,
        toDate,
        employeeId: empId ? Number(empId) : undefined,
        isSubmitted: submitted === '' ? undefined : submitted === 'true',
        limit: 100,
      }).then((r) => r.data.data),
    enabled: !isEmployee,
  });

  // Employee: history
  const { data: empData, isLoading: empLoading } = useQuery({
    queryKey: ['my-task-sheets', fromDate, toDate],
    queryFn: () =>
      taskSheetsApi.getHistory({
        fromDate,
        toDate,
        limit: 100,
        sort: 'sheetDate',
        order: 'desc',
      }).then((r) => r.data.data),
    enabled: isEmployee,
  });

  const data = isEmployee ? empData : adminData;
  const isLoading = isEmployee ? empLoading : adminLoading;

  return (
    <div className="space-y-4">
      {/* Gradient Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-violet-600 via-purple-600 to-indigo-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoNnptMC0zMHY2aC02VjRoNnptMCAzMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Task Sheets</h1>
              <p className="text-sm text-white/60">Task sheet submissions</p>
            </div>
          </div>
          {isEmployee && (
            <Link href="/task-sheets/fill">
              <Button size="sm" className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-0 shadow-lg">
                <Plus className="mr-1.5 h-4 w-4" />
                Fill Today&apos;s Sheet
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">From</label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-36" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-36" />
        </div>
        {!isEmployee && (
          <>
            <Select value={empId || 'all'} onValueChange={(v) => setEmpId(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {(employees ?? []).map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.empName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={submitted || 'all'} onValueChange={(v) => setSubmitted(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Submitted</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
        <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-violet-500 via-purple-500 to-indigo-500" />
        <Table>
          <TableHeader>
            <TableRow>
              {!isEmployee && <TableHead>Employee</TableHead>}
              <TableHead>Date</TableHead>
              <TableHead>Total Hours</TableHead>
              <TableHead>Man-Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted At</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? [...Array(6)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(isEmployee ? 6 : 7)].map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>)}
                  </TableRow>
                ))
              : (data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isEmployee ? 6 : 7} className="h-32">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/10 mb-3">
                          <ClipboardList className="h-6 w-6 text-violet-500" />
                        </div>
                        <p className="text-sm font-medium text-foreground">No task sheets found</p>
                        <p className="text-xs text-muted-foreground mt-1">Try adjusting your date range or filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              : (data ?? []).map((s) => (
                  <TableRow key={s.id}>
                    {!isEmployee && (
                      <TableCell className="font-medium">{s.employee?.empName ?? `#${s.employeeId}`}</TableCell>
                    )}
                    <TableCell>{s.sheetDate?.slice(0, 10)}</TableCell>
                    <TableCell>{Number(s.totalHours).toFixed(1)}h</TableCell>
                    <TableCell>{Number(s.manDays).toFixed(2)}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${s.isSubmitted ? 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400' : 'bg-slate-500/15 text-slate-500 ring-slate-500/30'}`}>
                        {s.isSubmitted ? 'Submitted' : 'Draft'}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-500 text-xs">
                      {s.submittedAt ? format(new Date(s.submittedAt), 'MMM d, HH:mm') : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Link href={`/task-sheets/${s.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="View">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        {isEmployee && isEditable(s.sheetDate) && (
                          <Link href={`/task-sheets/fill?date=${s.sheetDate?.slice(0, 10)}`}>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-violet-600 hover:text-violet-700 hover:bg-violet-500/10" title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
