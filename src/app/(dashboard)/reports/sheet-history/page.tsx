'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  Search, ClipboardList, Eye, X, CalendarDays, Clock, Award,
  CheckCircle2, FileEdit, ChevronRight, User, Users, Building2,
  AlertCircle, Filter, RefreshCw, Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { taskSheetsApi } from '@/lib/api/task-sheets';
import { employeesApi } from '@/lib/api/employees';
import { downloadBlob } from '@/lib/utils/download';
import { useAuth } from '@/providers/auth-provider';
import { useCompany } from '@/providers/company-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { DailyTaskSheet } from '@/types';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, parts[0].length >= 2 ? 2 : 1).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function fmtDateParts(d: string) {
  try {
    const dt = new Date(d + 'T00:00:00');
    return {
      day: format(dt, 'd'),
      month: format(dt, 'MMM').toUpperCase(),
      weekday: format(dt, 'EEEE'),
      full: format(dt, 'MMM d, yyyy'),
    };
  } catch {
    return { day: '—', month: '—', weekday: '', full: d };
  }
}

export default function SheetHistoryReportPage() {
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const { selectedCompany, isSuperAdmin } = useCompany();
  const isAdmin = user?._type === 'admin';
  const isEmployee = user?._type === 'employee';
  const isHr = isEmployee && !!(user as { isHr?: boolean })?.isHr;
  const canSeeTeam = isAdmin || isHr;
  const needsCompanyContext = isSuperAdmin && !selectedCompany;

  const [tab, setTab] = useState<'mine' | 'team'>('mine');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [employeeId, setEmployeeId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'draft'>('all');
  const [search, setSearch] = useState('');

  const extractRows = (r: unknown): DailyTaskSheet[] => {
    const outer = (r as { data?: unknown })?.data;
    const inner = (outer as { data?: unknown })?.data;
    if (Array.isArray(outer)) return outer as DailyTaskSheet[];
    if (Array.isArray(inner)) return inner as DailyTaskSheet[];
    return [];
  };

  const PAGE_LIMIT = 100;

  const { data: myRaw, isLoading: myLoading, error: myError } = useQuery({
    queryKey: ['sheet-history-mine', fromDate, toDate, selectedCompany?.id ?? null],
    queryFn: () => taskSheetsApi.getHistory({
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
      page: 1,
      limit: PAGE_LIMIT,
    }).then(extractRows),
    enabled: !authLoading && !needsCompanyContext,
  });

  const { data: teamRaw, isLoading: teamLoading, error: teamError } = useQuery({
    queryKey: ['sheet-history-team', fromDate, toDate, employeeId, selectedCompany?.id ?? null],
    queryFn: () => taskSheetsApi.adminGetAll({
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
      employeeId: employeeId === 'all' ? undefined : Number(employeeId),
      page: 1,
      limit: PAGE_LIMIT,
    }).then(extractRows),
    enabled: !authLoading && canSeeTeam && tab === 'team' && !needsCompanyContext,
  });

  const { data: employees } = useQuery({
    queryKey: ['employees-for-sheet-history'],
    queryFn: () => employeesApi.getAll({ limit: PAGE_LIMIT, isActive: true }).then((r) => r.data.data),
    enabled: canSeeTeam && tab === 'team',
  });

  const myList = myRaw ?? [];
  const teamList = teamRaw ?? [];

  const filterRows = (rows: DailyTaskSheet[]) => {
    const q = search.trim().toLowerCase();
    return rows.filter((s) => {
      if (statusFilter === 'submitted' && !s.isSubmitted) return false;
      if (statusFilter === 'draft' && s.isSubmitted) return false;
      if (q) {
        const name = (s.employee?.name ?? '').toLowerCase();
        const code = (s.employee?.empCode ?? '').toLowerCase();
        if (!name.includes(q) && !code.includes(q)) return false;
      }
      return true;
    });
  };

  const visibleMine = filterRows(myList);
  const visibleTeam = filterRows(teamList);

  const summary = (rows: DailyTaskSheet[]) => {
    const submitted = rows.filter((r) => r.isSubmitted).length;
    const draft = rows.length - submitted;
    const totalHours = rows.reduce((s, r) => s + Number(r.totalHours ?? 0), 0);
    const totalMD = rows.reduce((s, r) => s + Number(r.manDays ?? 0), 0);
    return { submitted, draft, totalHours, totalMD };
  };

  const filtersActive = !!(fromDate || toDate || statusFilter !== 'all' || search || employeeId !== 'all');

  const clearFilters = () => {
    setFromDate('');
    setToDate('');
    setStatusFilter('all');
    setSearch('');
    setEmployeeId('all');
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['sheet-history-mine'] });
    queryClient.invalidateQueries({ queryKey: ['sheet-history-team'] });
  };

  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const dateRange = {
        ...(fromDate ? { fromDate } : {}),
        ...(toDate ? { toDate } : {}),
      };
      const isTeam = canSeeTeam && tab === 'team';
      // Mirror the active tab's filters so the export matches what the user sees.
      const res = isTeam
        ? await taskSheetsApi.adminExportTeam({
            ...dateRange,
            ...(employeeId !== 'all' ? { employeeId: Number(employeeId) } : {}),
            ...(statusFilter !== 'all' ? { isSubmitted: statusFilter === 'submitted' } : {}),
          })
        : await taskSheetsApi.exportHistory(dateRange);
      const tag = `${fromDate || 'all'}_${toDate || 'all'}`;
      const filename = isTeam
        ? `task-sheet-history-team-${tag}.xlsx`
        : `task-sheet-history-${tag}.xlsx`;
      downloadBlob(res.data as Blob, filename);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  // ── Sub-renderers ────────────────────────────────────────────────────────

  const renderSummaryStrip = (rows: DailyTaskSheet[]) => {
    const stats = summary(rows);
    const items = [
      {
        label: 'Submitted',
        value: stats.submitted,
        icon: CheckCircle2,
        ring: 'ring-emerald-500/20',
        iconBg: 'bg-linear-to-br from-emerald-500 to-emerald-600',
        text: 'text-emerald-700 dark:text-emerald-400',
      },
      {
        label: 'Drafts',
        value: stats.draft,
        icon: FileEdit,
        ring: 'ring-amber-500/20',
        iconBg: 'bg-linear-to-br from-amber-400 to-amber-600',
        text: 'text-amber-700 dark:text-amber-400',
      },
      {
        label: 'Total Hours',
        value: stats.totalHours.toFixed(1),
        icon: Clock,
        ring: 'ring-blue-500/20',
        iconBg: 'bg-linear-to-br from-blue-500 to-blue-700',
        text: 'text-blue-700 dark:text-blue-400',
      },
      {
        label: 'Man-Days',
        value: stats.totalMD.toFixed(2),
        icon: Award,
        ring: 'ring-indigo-500/20',
        iconBg: 'bg-linear-to-br from-indigo-500 to-blue-700',
        text: 'text-indigo-700 dark:text-indigo-400',
      },
    ];
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map(({ label, value, icon: Icon, ring, iconBg, text }) => (
          <div
            key={label}
            className={`relative overflow-hidden rounded-xl bg-card ring-1 ${ring} shadow-sm p-3.5 flex items-center gap-3 transition hover:shadow-md hover:-translate-y-0.5`}
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg} text-white shadow-md`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
              <p className={`text-xl font-bold ${text} leading-tight`}>{value}</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderSheetCard = (s: DailyTaskSheet, showEmployeeCol: boolean) => {
    const dt = fmtDateParts(s.sheetDate);
    return (
      <Link
        key={s.id}
        href={`/task-sheets/${s.id}`}
        className="group block rounded-xl bg-card ring-1 ring-border/60 shadow-sm hover:shadow-md hover:ring-blue-500/30 hover:-translate-y-0.5 transition-all overflow-hidden"
      >
        <div className="flex items-stretch">
          {/* Date block — blue gradient tile */}
          <div className="flex flex-col items-center justify-center w-[72px] shrink-0 bg-linear-to-br from-blue-600 to-blue-800 text-white py-3 px-1">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{dt.month}</span>
            <span className="text-2xl font-extrabold leading-none mt-0.5">{dt.day}</span>
            <span className="text-[9px] font-medium opacity-75 mt-0.5">{dt.weekday.slice(0, 3)}</span>
          </div>

          {/* Body */}
          <div className="flex-1 min-w-0 p-3.5 flex items-center gap-3">
            {showEmployeeCol ? (
              <div className="flex items-center gap-2.5 min-w-0 w-56">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-blue-700 text-white text-xs font-bold shadow-sm">
                  {initialsOf(s.employee?.name ?? '?')}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{s.employee?.name ?? '—'}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{s.employee?.empCode ?? ''}</p>
                </div>
              </div>
            ) : (
              <div className="hidden sm:flex flex-col min-w-0 w-44">
                <p className="text-sm font-semibold text-foreground">{dt.weekday}</p>
                <p className="text-xs text-muted-foreground">{dt.full}</p>
              </div>
            )}

            {/* Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2 py-1 text-[11px] font-semibold ring-1 ring-blue-500/20">
                <Clock className="h-3 w-3" />
                {Number(s.totalHours ?? 0).toFixed(1)}h
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 px-2 py-1 text-[11px] font-semibold ring-1 ring-indigo-500/20">
                <Award className="h-3 w-3" />
                {Number(s.manDays ?? 0).toFixed(2)} MD
              </span>
              {s.isSubmitted ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-1 text-[11px] font-semibold ring-1 ring-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3" />
                  Submitted
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-1 text-[11px] font-semibold ring-1 ring-amber-500/20">
                  <FileEdit className="h-3 w-3" />
                  Draft
                </span>
              )}
            </div>

            <div className="ml-auto flex items-center gap-1">
              {/* The whole card is already a <Link> to /task-sheets/:id —
                  rendering a second <Link> here for the Eye icon nested
                  an <a> inside an <a> (invalid HTML, hydration error).
                  Keep the Eye as a non-interactive icon-button shape. */}
              <span
                aria-hidden
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground group-hover:text-blue-600 group-hover:bg-blue-500/10 transition-colors"
              >
                <Eye className="h-4 w-4" />
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-blue-600 group-hover:translate-x-0.5 transition" />
            </div>
          </div>
        </div>
      </Link>
    );
  };

  const renderEmptyOrState = (
    rows: DailyTaskSheet[],
    isLoading: boolean,
    error: unknown,
  ) => {
    if (needsCompanyContext) {
      return (
        <div className="rounded-xl bg-card ring-1 ring-border p-10 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
            <Building2 className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold text-foreground">Select a company first</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
            You&apos;re signed in as a super admin. Pick a company from the
            switcher in the header to view its task sheet history.
          </p>
        </div>
      );
    }
    if (isLoading) {
      return (
        <div className="space-y-2.5">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-[68px] w-full rounded-xl" />
          ))}
        </div>
      );
    }
    if (error) {
      const msg = error instanceof Error ? error.message : 'Failed to load sheets.';
      return (
        <div className="rounded-xl bg-card ring-1 ring-red-500/30 p-10 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-600">
            <AlertCircle className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold text-red-600 dark:text-red-400">Couldn&apos;t load sheets</p>
          <p className="mt-1 text-xs text-muted-foreground">{msg}</p>
        </div>
      );
    }
    if (rows.length === 0) {
      return (
        <div className="rounded-xl bg-card ring-1 ring-border p-10 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
            <ClipboardList className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold text-foreground">No sheets yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {filtersActive
              ? 'Try adjusting the filters above to widen the search.'
              : 'Submitted and draft sheets will appear here as they\'re filled in.'}
          </p>
          {filtersActive && (
            <Button variant="ghost" size="sm" className="mt-3 text-blue-600 hover:bg-blue-500/10" onClick={clearFilters}>
              <X className="h-3.5 w-3.5 mr-1.5" /> Clear filters
            </Button>
          )}
        </div>
      );
    }
    return null;
  };

  const renderList = (
    rows: DailyTaskSheet[],
    showEmployeeCol: boolean,
    isLoading: boolean,
    error?: unknown,
  ) => {
    const stateUI = renderEmptyOrState(rows, isLoading, error);
    if (stateUI) return stateUI;
    return (
      <div className="space-y-3">
        {renderSummaryStrip(rows)}
        <div className="space-y-2.5">
          {rows.map((s) => renderSheetCard(s, showEmployeeCol))}
        </div>
      </div>
    );
  };

  // ── Filter bar ────────────────────────────────────────────────────────────

  const filterBar = (
    <div className="rounded-xl bg-card ring-1 ring-border shadow-sm p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-shrink-0">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <CalendarDays className="h-3 w-3" /> From
          </p>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-9 w-40 focus:ring-blue-500/30"
          />
        </div>
        <div className="flex-shrink-0">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <CalendarDays className="h-3 w-3" /> To
          </p>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-9 w-40 focus:ring-blue-500/30"
          />
        </div>
        <div className="flex-shrink-0">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <Filter className="h-3 w-3" /> Status
          </p>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="draft">Drafts only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {canSeeTeam && tab === 'team' && (
          <div className="min-w-[16rem] flex-shrink-0">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 flex items-center gap-1">
              <User className="h-3 w-3" /> Employee
            </p>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="All employees" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {(employees ?? []).map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.name} ({e.empCode})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex-1 min-w-[12rem]">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <Search className="h-3 w-3" /> Search
          </p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={tab === 'team' ? 'Search employee name / code…' : 'Search…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
        {filtersActive && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-red-500 hover:text-red-600 hover:bg-red-500/10"
            onClick={clearFilters}
          >
            <X className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleExport}
          disabled={exporting || needsCompanyContext}
          className="h-9 bg-linear-to-r from-blue-600 to-blue-800 text-white hover:opacity-90 shadow-sm shadow-blue-500/25 border-0"
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          {exporting ? 'Exporting…' : 'Export Excel'}
        </Button>
      </div>
    </div>
  );

  const mineCount = visibleMine.length;
  const teamCount = visibleTeam.length;

  return (
    <div className="space-y-4">
      {/* Hero header */}
      {/* <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-blue-600 via-blue-700 to-blue-900" />
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -right-4 bottom-2 h-24 w-24 rounded-full bg-blue-300/20 blur-xl" />
        <div className="relative px-5 py-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-inner ring-1 ring-white/20">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Log History</h1>
              <p className="text-sm text-white/75">Daily task-sheet submissions and drafts</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            className="text-white/90 hover:bg-white/15 hover:text-white"
          >
            <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
          </Button>
        </div>
      </div> */}

      {canSeeTeam ? (
        <div className="space-y-3">
          {/* Tab bar with counts */}
          <div className="flex rounded-xl border border-border bg-muted/40 p-1 w-fit shadow-sm">
            {([
              { id: 'mine' as const, label: 'My Sheets', icon: User, count: mineCount },
              { id: 'team' as const, label: 'Team Sheets', icon: Users, count: teamCount },
            ]).map(({ id, label, icon: Icon, count }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                    active
                      ? 'bg-linear-to-r from-blue-600 to-blue-800 text-white shadow-md'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {!authLoading && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      active ? 'bg-white/20 text-white' : 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                    }`}>
                      {(id === 'mine' ? myLoading : teamLoading) ? '…' : count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {filterBar}
          {tab === 'mine'
            ? renderList(visibleMine, false, myLoading, myError)
            : renderList(visibleTeam, true, teamLoading, teamError)}
        </div>
      ) : (
        <>
          {filterBar}
          {renderList(visibleMine, false, myLoading, myError)}
        </>
      )}
    </div>
  );
}
