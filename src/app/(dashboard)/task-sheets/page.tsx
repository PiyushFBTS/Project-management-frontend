'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Plus, ClipboardList, Pencil } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { taskSheetsApi } from '@/lib/api/task-sheets';
import { employeesApi } from '@/lib/api/employees';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const today = format(new Date(), 'yyyy-MM-dd');
const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');

function isEditable(sheetDate: string, windowDays: number): boolean {
  const d = new Date(sheetDate);
  const cutoff = new Date();
  // Today counts as day 1, so subtract (windowDays - 1) from today.
  cutoff.setDate(cutoff.getDate() - Math.max(0, windowDays - 1));
  cutoff.setHours(0, 0, 0, 0);
  return d >= cutoff;
}

export default function TaskSheetsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isEmployee = user?._type === 'employee';
  const isAdmin = user?._type === 'admin';
  // HR and non-admin reporting managers also get the team tab.
  const isHr = isEmployee && !!(user as any)?.isHr;
  const isReportingManager = !!(user as any)?.isReportingManager;
  const canSeeTeam = isAdmin || isHr || isReportingManager;

  // Anyone who can see team defaults to the team tab; others on "my".
  const [activeTab, setActiveTab] = useState<'my' | 'team'>(canSeeTeam ? 'team' : 'my');

  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);
  const [empId, setEmpId] = useState<string>('');
  // Selected employee's name, kept so the trigger label survives refetches
  // when server-search returns a page that no longer includes them.
  const [empName, setEmpName] = useState<string>('');
  // Server-side search term (admin only — getAll supports `search`).
  const [empSearch, setEmpSearch] = useState<string>('');

  // Employee list for the team filter. Admin → server-searched (so all
  // employees are findable past the 100 cap); a reporting manager / HR →
  // their full scoped list (filtered client-side). Sorted alphabetically.
  const { data: employees, isFetching: empFetching } = useQuery({
    queryKey: ['task-sheet-filter-employees', isAdmin, empSearch],
    queryFn: async () => {
      const r = isAdmin
        ? await employeesApi.getAll({ search: empSearch || undefined, isActive: true, limit: 100 })
        : await taskSheetsApi.teamEmployees();
      const body: any = r.data?.data ?? r.data;
      const list: any[] = Array.isArray(body) ? body : (body?.data ?? []);
      return list
        .map((e: any) => ({ id: e.id as number, name: (e.name ?? '') as string }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: canSeeTeam,
    placeholderData: (prev) => prev, // avoid flicker while typing a search
  });

  // Options for the picker: "All Employees" + the (sorted) list. Keep the
  // selected employee pinned even if the current server page excludes them.
  const empOptions = [
    { value: '', label: 'All Employees' },
    ...(empId && empName && !(employees ?? []).some((e) => String(e.id) === empId)
      ? [{ value: empId, label: empName }]
      : []),
    ...(employees ?? []).map((e) => ({ value: String(e.id), label: e.name })),
  ];

  // Team tab: admin / HR → whole company; reporting manager → direct
  // reports. Backend enforces the scope; we just choose the route.
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['task-sheets-team', isAdmin, fromDate, toDate, empId],
    queryFn: () => {
      const params = {
        fromDate,
        toDate,
        employeeId: empId ? Number(empId) : undefined,
        limit: 100,
      };
      return (isAdmin ? taskSheetsApi.adminGetAll(params) : taskSheetsApi.teamGetAll(params))
        .then((r) => r.data.data);
    },
    enabled: canSeeTeam && activeTab === 'team',
  });

  // My tab: current user's own history (admin uses bridged-admin endpoint, employees use /task-sheets/history)
  const { data: myData, isLoading: myLoading } = useQuery({
    queryKey: ['my-task-sheets', fromDate, toDate, user?._type],
    queryFn: () =>
      taskSheetsApi.getHistory({
        fromDate,
        toDate,
        limit: 100,
        sort: 'sheetDate',
        order: 'desc',
      }).then((r) => r.data.data),
    enabled: !!user && activeTab === 'my',
  });

  const data = activeTab === 'team' ? teamData : myData;
  const isLoading = activeTab === 'team' ? teamLoading : myLoading;
  const canFillOwn = isEmployee || isAdmin;

  // Detail link. Non-admin team viewers (HR / manager) read via the
  // reportsTo/HR-scoped /task-sheets/team/:id route — flag it with ?scope=team.
  const sheetHref = (id: number) =>
    `/task-sheets/${id}${activeTab === 'team' && !isAdmin ? '?scope=team' : ''}`;

  // Edit window: admin + HR get 30 days, regular employees 3 days.
  const defaultFillDays = isAdmin || isHr ? 30 : 3;
  const fillWindowDays = (user as any)?.fillDaysOverride ?? defaultFillDays;

  return (
    <div className="w-full space-y-4">
      {/* Gradient Header — tighter padding & smaller text on phones. */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-blue-600 to-blue-800" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoNnptMC0zMHY2aC02VjRoNnptMCAzMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative px-4 py-4 sm:px-6 sm:py-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-white truncate">Task Sheets</h1>
              <p className="text-xs sm:text-sm text-white/60 truncate">Task sheet submissions</p>
            </div>
          </div>
          {canFillOwn && (
            <Link href="/task-sheets/fill" className="shrink-0">
              <Button size="sm" className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-0 shadow-lg">
                <Plus className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">Daily Log Sheet</span>
                <span className="sm:hidden">Log Sheet</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Tabs — admin / HR / reporting managers see both; others see only "My Sheets" */}
      {canSeeTeam && (
        <div className="flex gap-1 p-0.5 bg-muted rounded-lg w-fit">
          {(['my', 'team'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === tab ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {tab === 'my' ? 'My Sheets' : 'My Team Sheets'}
            </button>
          ))}
        </div>
      )}

      {/* Filter row — inputs grow to fill on phones, fixed-width on sm+. */}
      <div className="flex flex-wrap gap-2 sm:gap-3">
        <div className="flex flex-1 sm:flex-none items-center gap-2 min-w-[160px]">
          <label className="text-xs text-muted-foreground shrink-0">From</label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="flex-1 sm:w-36" />
        </div>
        <div className="flex flex-1 sm:flex-none items-center gap-2 min-w-[160px]">
          <label className="text-xs text-muted-foreground shrink-0">To</label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="flex-1 sm:w-36" />
        </div>
        {canSeeTeam && activeTab === 'team' && (
          <SearchableSelect
            value={empId}
            onValueChange={(v) => {
              setEmpId(v);
              // Remember the chosen name so the trigger keeps showing it.
              setEmpName(v ? (empOptions.find((o) => o.value === v)?.label ?? '') : '');
            }}
            options={empOptions}
            // Admin uses server search (find anyone past the 100 cap);
            // manager/HR filter their full scoped list client-side.
            onSearch={isAdmin ? setEmpSearch : undefined}
            loading={isAdmin && empFetching}
            placeholder="All Employees"
            className="w-full sm:w-56"
          />
        )}
      </div>

      {/* ── Mobile / Tablet card list ────────────────────────────────
          Renders below md (< 768 px). Same data, vertical card layout
          so the table doesn't need to scroll horizontally on phones. */}
      <div className="md:hidden space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-3">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))
        ) : (data ?? []).length === 0 ? (
          <div className="rounded-xl border bg-card py-10 text-center">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-violet-500/10 mb-3">
              <ClipboardList className="h-6 w-6 text-violet-500" />
            </div>
            <p className="text-sm font-medium">No task sheets found</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting your date range or filters</p>
          </div>
        ) : (
          (data ?? []).map((s) => {
            const dateStr = s.sheetDate?.slice(0, 10) ?? '';
            const showEdit = activeTab === 'my' && canFillOwn && isEditable(s.sheetDate, fillWindowDays);
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(sheetHref(s.id))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(sheetHref(s.id)); }
                }}
                className="rounded-xl border bg-card p-3 shadow-sm cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
              >
                {/* Row 1: date + status pill + edit (my) */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold truncate">{dateStr}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${s.isSubmitted ? 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400' : 'bg-slate-500/15 text-slate-500 ring-slate-500/30'}`}>
                      {s.isSubmitted ? 'Submitted' : 'Draft'}
                    </span>
                  </div>
                  {showEdit && (
                    <Link href={`/task-sheets/fill?date=${dateStr}`} onClick={(e) => e.stopPropagation()} className="shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-violet-600 hover:text-violet-700 hover:bg-violet-500/10" title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  )}
                </div>
                {/* Row 2: employee (team tab only) */}
                {activeTab === 'team' && (
                  <p className="mt-1 text-xs font-medium text-foreground/90 truncate">
                    {s.employee?.name ?? `#${s.employeeId}`}
                  </p>
                )}
                {/* Row 3: stats */}
                <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                  <div className="flex gap-3">
                    <span><span className="font-semibold">{Number(s.totalHours).toFixed(1)}</span><span className="text-muted-foreground">h</span></span>
                    <span><span className="font-semibold">{Number(s.manDays).toFixed(2)}</span><span className="text-muted-foreground"> MD</span></span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {s.submittedAt ? format(new Date(s.submittedAt), 'MMM d, HH:mm') : '—'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Desktop table ────────────────────────────────────────────
          Kept on md+ where there's room for all 6/7 columns side-by-side. */}
      <div className="hidden md:block rounded-lg border bg-card overflow-x-auto shadow-sm">
        <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-blue-500 to-blue-700" />
        <Table>
          <TableHeader>
            <TableRow>
              {activeTab === 'team' && <TableHead>Employee</TableHead>}
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
                    {[...Array(activeTab === 'team' ? 7 : 6)].map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>)}
                  </TableRow>
                ))
              : (data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={activeTab === 'team' ? 7 : 6} className="h-32">
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
                  <TableRow
                    key={s.id}
                    // Whole-row click opens the sheet detail — replaces
                    // the dedicated eye button. The Edit cell stops
                    // propagation so its own link doesn't double-fire.
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => router.push(sheetHref(s.id))}
                  >
                    {activeTab === 'team' && (
                      <TableCell className="font-medium">{s.employee?.name ?? `#${s.employeeId}`}</TableCell>
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {activeTab === 'my' && canFillOwn && isEditable(s.sheetDate, fillWindowDays) && (
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
