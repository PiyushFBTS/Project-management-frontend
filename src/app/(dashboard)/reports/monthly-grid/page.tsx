/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, Calendar, ArrowLeft, Search, User } from 'lucide-react';
import { api } from '@/lib/api/axios-instance';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

type DayEntry = { date: string; hours: number | null; submitted: boolean };
type EmployeeRow = {
  employeeId: number;
  empCode: string;
  empName: string;
  consultantType: string;
  totalHours: number;
  filledDays: number;
  days: DayEntry[];
};
type GridData = { year: number; month: number; daysInMonth: number; days: string[]; rows: EmployeeRow[] };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MonthlyGridPage() {
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';
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

  const getCellColor = (entry: DayEntry) => {
    if (entry.hours === null) return 'bg-red-50 dark:bg-red-950/30 text-muted-foreground';
    if (entry.submitted) return 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400';
    return 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400';
  };

  // Filter employees
  const filteredRows = (data?.rows ?? []).filter(
    (r) => !empSearch || r.empName.toLowerCase().includes(empSearch.toLowerCase()) || r.empCode.toLowerCase().includes(empSearch.toLowerCase()),
  );

  // When a specific employee is selected, find their current row
  const empRow = selectedEmp ? (data?.rows ?? []).find((r) => r.employeeId === selectedEmp.employeeId) ?? selectedEmp : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          {selectedEmp ? (
            <button onClick={() => setSelectedEmp(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-1">
              <ArrowLeft className="h-4 w-4" /> Back to Employee List
            </button>
          ) : null}
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {selectedEmp ? `${selectedEmp.empName} — Monthly Grid` : 'Monthly Attendance Grid'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {selectedEmp ? `${selectedEmp.empCode} · ${selectedEmp.consultantType ?? 'Employee'}` : 'Select an employee to view their daily task sheet'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-[140px] text-center font-semibold">{MONTHS[month - 1]} {year}</span>
          <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="ml-2">
            <Download className="h-4 w-4 mr-1" /> Export All
          </Button>
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
                <Card key={row.employeeId} className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all" onClick={() => setSelectedEmp(row)}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                        {row.empName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{row.empName}</p>
                        <p className="text-xs text-muted-foreground">{row.empCode} · {row.consultantType ?? '—'}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold text-primary">{row.totalHours}</p>
                        <p className="text-[10px] text-muted-foreground">Hours</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-emerald-600">{row.filledDays}</p>
                        <p className="text-[10px] text-muted-foreground">Days Filled</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold" style={{ color: fillPct >= 80 ? '#16a34a' : fillPct >= 50 ? '#d97706' : '#dc2626' }}>{fillPct}%</p>
                        <p className="text-[10px] text-muted-foreground">Fill Rate</p>
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
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-200 dark:bg-emerald-800 inline-block" /> Submitted</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-200 dark:bg-amber-800 inline-block" /> Draft</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-200 dark:bg-red-800 inline-block" /> Not Filled</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-gray-200 dark:bg-gray-700 inline-block" /> Sunday</span>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-primary">{empRow.totalHours}</p>
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

                {/* Day cells */}
                {empRow.days.map((entry) => {
                  const day = parseInt(entry.date.split('-')[2], 10);
                  const sun = isSunday(entry.date);
                  return (
                    <div
                      key={entry.date}
                      className={`rounded-lg border p-2 min-h-[70px] transition-all ${
                        sun
                          ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800'
                          : entry.hours !== null
                            ? entry.submitted
                              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                              : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                            : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold ${sun ? 'text-gray-400' : ''}`}>{day}</span>
                        {!sun && entry.submitted && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border-emerald-300">
                            Submitted
                          </Badge>
                        )}
                        {!sun && entry.hours !== null && !entry.submitted && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-amber-300">
                            Draft
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1">
                        {sun ? (
                          <span className="text-xs text-gray-400">Sunday</span>
                        ) : entry.hours !== null ? (
                          <span className="text-lg font-bold">{entry.hours}h</span>
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
