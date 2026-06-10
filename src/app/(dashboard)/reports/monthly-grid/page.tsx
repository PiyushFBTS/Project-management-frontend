/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, Calendar, ArrowLeft, Search, User } from 'lucide-react';
import { api } from '@/lib/api/axios-instance';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

type LeaveStatus =
  | 'pending'
  | 'manager_approved'
  | 'hr_approved'
  | 'manager_rejected'
  | 'hr_rejected';
type LeaveCell = { id: number; type: string; status: LeaveStatus };
type DayEntry = {
  date: string;
  sheetId: number | null;
  hours: number | null;
  submitted: boolean;
  leave: LeaveCell | null;
};
type EmployeeRow = {
  employeeId: number;
  empCode: string;
  name: string;
  consultantType: string;
  totalHours: number;
  filledDays: number;
  leavesCount: number;
  days: DayEntry[];
};
type GridData = { year: number; month: number; daysInMonth: number; days: string[]; rows: EmployeeRow[] };

// Visual classification for a leave cell, driven by status:
//   approved → solid violet (employee was actually out)
//   pending  → translucent violet w/ dashed border (decision still pending)
//   rejected → muted slate w/ strikethrough (request was made but denied)
function leaveTone(status: LeaveStatus): {
  cell: string;
  pill: string;
  label: string;
} {
  if (status === 'hr_approved') {
    return {
      cell: 'bg-violet-100 dark:bg-violet-900/40 border-violet-300 dark:border-violet-700',
      pill: 'bg-violet-200 dark:bg-violet-800 text-violet-800 dark:text-violet-200 border-violet-300',
      label: 'Approved',
    };
  }
  if (status === 'manager_approved' || status === 'pending') {
    return {
      cell: 'bg-violet-50/70 dark:bg-violet-900/20 border-violet-300 dark:border-violet-700 border-dashed',
      pill: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border-violet-300',
      label: status === 'pending' ? 'Pending' : 'Pending HR',
    };
  }
  // rejected — leave was applied for but denied. We surface it so the
  // viewer knows about the request, but the cell is muted with a
  // strikethrough so it's clear the day is NOT a leave day.
  return {
    cell: 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700',
    pill: 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 line-through',
    label: 'Rejected',
  };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
  admin: 'Admin',
};
const roleLabel = (t: string | null | undefined) =>
  (t && typeLabels[t]) || (t ?? '—');

export default function MonthlyGridPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?._type === 'admin';
  const isHr = !isAdmin && !!(user as any)?.isHr;
  // Plain employees only get their own row from the API; without HR rights
  // the full-company export endpoint 403s, so hide that button for them.
  const canExport = isAdmin || isHr;
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedEmp, setSelectedEmp] = useState<EmployeeRow | null>(null);
  const [empSearch, setEmpSearch] = useState('');

  const { data, isLoading } = useQuery<GridData>({
    queryKey: ['monthly-grid', year, month],
    queryFn: async () => {
      const prefix = isAdmin ? '/admin/reports' : '/employee/reports';
      const r = await api.get(`${prefix}/monthly-grid?year=${year}&month=${month}`);
      return r.data?.data ?? r.data;
    },
    enabled: !!user,
  });

  // Single-row payload (employee scoped to themselves) → skip the picker
  // and drop straight into their calendar grid.
  useEffect(() => {
    if (data?.rows?.length === 1 && !selectedEmp) {
      setSelectedEmp(data.rows[0]);
    }
  }, [data, selectedEmp]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1);
    setSelectedEmp(null);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1);
    setSelectedEmp(null);
  };

  const handleExport = async () => {
    try {
      const prefix = isAdmin ? '/admin/reports' : '/employee/reports';
      const r = await api.get(`${prefix}/export/monthly-grid?year=${year}&month=${month}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `monthly-grid-${year}-${String(month).padStart(2, '0')}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  const getDayOfWeek = (dateStr: string) => new Date(dateStr + 'T00:00:00').getDay();
  const isSunday = (dateStr: string) => getDayOfWeek(dateStr) === 0;

  // Filter employees
  const filteredRows = (data?.rows ?? []).filter(
    (r) => !empSearch || r.name.toLowerCase().includes(empSearch.toLowerCase()) || r.empCode.toLowerCase().includes(empSearch.toLowerCase()),
  );

  // When a specific employee is selected, find their current row
  const empRow = selectedEmp ? (data?.rows ?? []).find((r) => r.employeeId === selectedEmp.employeeId) ?? selectedEmp : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          {selectedEmp && (data?.rows ?? []).length > 1 ? (
            <button onClick={() => setSelectedEmp(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-1">
              <ArrowLeft className="h-4 w-4" /> Back to Employee List
            </button>
          ) : null}
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {selectedEmp ? `${selectedEmp.name} — Monthly Grid` : 'Monthly Attendance Grid'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {selectedEmp ? `${selectedEmp.empCode} · ${roleLabel(selectedEmp.consultantType)}` : 'Select an employee to view their daily task sheet'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-[140px] text-center font-semibold">{MONTHS[month - 1]} {year}</span>
          <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          {canExport && (
            <Button variant="outline" size="sm" onClick={handleExport} className="ml-2">
              <Download className="h-4 w-4 mr-1" /> Export All
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</CardContent></Card>
      ) : !selectedEmp ? (
        /* ── Employee List View ────────────────────────────────────────── */
        <div className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search employee..." value={empSearch} onChange={(e) => setEmpSearch(e.target.value)} className="pl-9" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredRows.map((row) => {
              const fillPct = data?.daysInMonth ? Math.round((row.filledDays / data.daysInMonth) * 100) : 0;
              return (
                <Card
                  key={row.employeeId}
                  onClick={() => setSelectedEmp(row)}
                  className="group cursor-pointer transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg hover:border-primary/50 hover:ring-2 hover:ring-primary/15"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                        {row.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.empCode} · {roleLabel(row.consultantType)}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-base font-bold text-primary">{Number(row.totalHours).toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground">Hours</p>
                      </div>
                      <div>
                        <p className="text-base font-bold text-emerald-600">{row.filledDays}</p>
                        <p className="text-[10px] text-muted-foreground">Days</p>
                      </div>
                      <div>
                        <p className="text-base font-bold text-violet-600 dark:text-violet-400">{row.leavesCount}</p>
                        <p className="text-[10px] text-muted-foreground">Leaves</p>
                      </div>
                      <div>
                        <p className="text-base font-bold" style={{ color: fillPct >= 80 ? '#16a34a' : fillPct >= 50 ? '#d97706' : '#dc2626' }}>{fillPct}%</p>
                        <p className="text-[10px] text-muted-foreground">Fill</p>
                      </div>
                    </div>
                    {/* Mini bar showing filled vs unfilled */}
                    <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${fillPct}%` }} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredRows.length === 0 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No employees found</CardContent></Card>
          )}
        </div>
      ) : empRow && data ? (
        /* ── Individual Employee Calendar Grid ─────────────────────────── */
        <div className="space-y-3">
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-200 dark:bg-emerald-800 inline-block" /> Submitted</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-200 dark:bg-amber-800 inline-block" /> Draft</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-200 dark:bg-red-800 inline-block" /> Not Filled</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-gray-200 dark:bg-gray-700 inline-block" /> Sunday</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-violet-200 dark:bg-violet-800 inline-block" /> On Leave</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-violet-100 dark:bg-violet-900/40 inline-block border border-violet-300 border-dashed" /> Pending Leave</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded inline-block bg-linear-to-br from-violet-200 to-amber-200" /> Worked on Leave</span>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-primary">{Number(empRow.totalHours).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Total Hours</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{empRow.filledDays}</p>
                <p className="text-xs text-muted-foreground">Days Filled</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{empRow.leavesCount}</p>
                <p className="text-xs text-muted-foreground">Leaves</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{data.daysInMonth - empRow.filledDays}</p>
                <p className="text-xs text-muted-foreground">Days Missing</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{empRow.filledDays > 0 ? (empRow.totalHours / empRow.filledDays).toFixed(1) : '0'}</p>
                <p className="text-xs text-muted-foreground">Avg Hrs/Day</p>
              </CardContent>
            </Card>
          </div>

          {/* Calendar Grid */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-7 gap-1.5">
                {/* Day headers */}
                {DAY_NAMES.map((d) => (
                  <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
                ))}

                {/* Empty cells for offset */}
                {Array.from({ length: getDayOfWeek(data.days[0]) }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {/* Day cells — clickable when a sheet exists for that day */}
                {empRow.days.map((entry) => {
                  const day = parseInt(entry.date.split('-')[2], 10);
                  const sun = isSunday(entry.date);
                  const clickable = !sun && entry.sheetId != null;
                  const hasLeave = !sun && entry.leave !== null;
                  const tone = entry.leave ? leaveTone(entry.leave.status) : null;
                  // Cell tone precedence:
                  //   Sunday → grey (leaves on Sundays are ignored visually).
                  //   Leave + filled → leave background with amber bottom
                  //     stripe to flag "worked on a leave day".
                  //   Pure leave → leaveTone(status).
                  //   Otherwise → existing draft/submitted/not-filled logic.
                  let cellClass = '';
                  if (sun) {
                    cellClass = 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800';
                  } else if (hasLeave && tone) {
                    cellClass = tone.cell;
                  } else if (entry.hours !== null) {
                    cellClass = entry.submitted
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800';
                  } else {
                    cellClass = 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';
                  }
                  return (
                    <div
                      key={entry.date}
                      role={clickable ? 'button' : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      onClick={clickable ? () => router.push(`/task-sheets/${entry.sheetId}`) : undefined}
                      onKeyDown={clickable ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          router.push(`/task-sheets/${entry.sheetId}`);
                        }
                      } : undefined}
                      title={
                        hasLeave && entry.hours !== null
                          ? `Worked ${entry.hours}h on a leave day (${entry.leave!.type})`
                          : hasLeave
                            ? `${entry.leave!.type} (${tone!.label})`
                            : clickable
                              ? 'Open task sheet'
                              : undefined
                      }
                      className={`relative rounded-lg border p-2 min-h-[70px] overflow-hidden transition-all ${
                        clickable ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''
                      } ${cellClass}`}
                    >
                      {/* Warning stripe along the bottom for "worked on a
                          leave day" — caught by scan even when the cell
                          is dense with text. */}
                      {hasLeave && entry.hours !== null && (
                        <span className="absolute inset-x-0 bottom-0 h-1 bg-amber-400 dark:bg-amber-600" />
                      )}
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs font-semibold ${sun ? 'text-gray-400' : ''}`}>{day}</span>
                        {hasLeave ? (
                          <Badge variant="outline" className={`text-[8px] px-1 py-0 ${tone!.pill}`}>
                            {tone!.label === 'Approved' ? 'Leave' : tone!.label}
                          </Badge>
                        ) : !sun && entry.submitted ? (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border-emerald-300">
                            Submitted
                          </Badge>
                        ) : !sun && entry.hours !== null && !entry.submitted ? (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-amber-300">
                            Draft
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-1">
                        {sun ? (
                          <span className="text-xs text-gray-400">Sunday</span>
                        ) : entry.hours !== null ? (
                          // Always show hours when the sheet is filled —
                          // even on a leave day. The amber stripe + Leave
                          // pill signal the overlap.
                          <span className="text-lg font-bold">{entry.hours}h</span>
                        ) : hasLeave ? (
                          // Pure leave: show the leave type instead of
                          // the red em-dash. Truncate long type names.
                          <span className="text-[10px] font-medium leading-tight line-clamp-2 text-violet-700 dark:text-violet-300">
                            {entry.leave!.type}
                          </span>
                        ) : (
                          <span className="text-xs text-red-400">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
