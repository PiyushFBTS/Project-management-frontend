'use client';

import { use, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, FolderKanban, Users } from 'lucide-react';
import { reportsApi } from '@/lib/api/reports';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const TYPE_META: Record<string, { label: string; color: string }> = {
  project_manager: { label: 'PM',         color: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 ring-indigo-500/30' },
  functional:      { label: 'Functional', color: 'bg-teal-500/15 text-teal-700 dark:text-teal-400 ring-teal-500/30' },
  technical:       { label: 'Technical',  color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 ring-cyan-500/30' },
  management:      { label: 'Management', color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 ring-purple-500/30' },
  core_team:       { label: 'Core',       color: 'bg-pink-500/15 text-pink-700 dark:text-pink-400 ring-pink-500/30' },
};

// Render order — matches the summary columns on the parent page.
const TYPE_ORDER = ['project_manager', 'functional', 'technical', 'management', 'core_team'];

function typeMeta(t: string | null | undefined) {
  return TYPE_META[t ?? ''] ?? { label: t ?? 'Other', color: 'bg-slate-500/15 text-slate-700 dark:text-slate-400 ring-slate-500/30' };
}

export default function ProjectBreakdownPage({
  params: paramsPromise,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId: projectIdStr } = use(paramsPromise);
  const router = useRouter();
  const search = useSearchParams();
  const { user } = useAuth();
  const isEmployee = user?._type === 'employee';
  const isHr = isEmployee && !!(user as { isHr?: boolean })?.isHr;

  const projectId = Number(projectIdStr);
  const month = search.get('month') ?? format(new Date(), 'yyyy-MM');
  const monthLabel = (() => {
    const d = new Date(`${month}-01T00:00:00`);
    return Number.isNaN(d.getTime()) ? month : format(d, 'MMMM yyyy');
  })();

  const { data, isLoading } = useQuery({
    queryKey: ['report-proj-employees', projectId, month, isEmployee],
    queryFn: () =>
      (isEmployee
        ? reportsApi.employeeGetProjectEmployees(projectId, month)
        : reportsApi.getProjectEmployees(projectId, month)
      ).then((r) => r.data?.data ?? r.data),
    // Anyone signed in can drill in — backend auto-scopes a non-HR
    // employee's response to just their own contributor row.
    enabled: !!user && Number.isFinite(projectId),
  });

  const project = data?.project as
    | { project_id: number; project_code: string; project_name: string; project_type: string }
    | null
    | undefined;
  const employees = (data?.employees ?? []) as Array<{
    employee_id: number;
    emp_code: string;
    emp_name: string;
    consultant_type: string;
    man_days: string | number;
    hours: string | number;
  }>;

  // Group by consultant_type so each section can be rendered independently
  // ("PM — name1, name2 ..." style the user asked for).
  const grouped = useMemo(() => {
    const map = new Map<string, typeof employees>();
    for (const row of employees) {
      const k = row.consultant_type ?? 'other';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(row);
    }
    // Sorted: known order first (PM, Func, Tech, Mgmt, Core), then any extras
    const sortedKeys = [
      ...TYPE_ORDER.filter((k) => map.has(k)),
      ...[...map.keys()].filter((k) => !TYPE_ORDER.includes(k)),
    ];
    return sortedKeys.map((k) => ({ type: k, rows: map.get(k)! }));
  }, [employees]);

  const totalManDays = employees.reduce((acc, r) => acc + Number(r.man_days || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-blue-600 to-blue-800" />
        <div className="relative px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.back()}
              className="bg-white/15 hover:bg-white/25 text-white border-0 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shrink-0">
              <FolderKanban className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">
                {project?.project_name ?? 'Project Breakdown'}
              </h1>
              <p className="text-sm text-white/70 truncate">
                {project?.project_code ? `${project.project_code} · ` : ''}{monthLabel} · {employees.length} employee{employees.length === 1 ? '' : 's'} · {totalManDays.toFixed(2)} MD
              </p>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : employees.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          No contributions for this project in {monthLabel}.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ type, rows }) => {
            const meta = typeMeta(type);
            const subtotal = rows.reduce((acc, r) => acc + Number(r.man_days || 0), 0);
            return (
              <div key={type} className="rounded-lg border bg-card overflow-hidden shadow-sm">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-muted/40">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${meta.color}`}>
                      <Users className="h-3 w-3" />
                      {meta.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{rows.length} {rows.length === 1 ? 'person' : 'people'}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Subtotal: </span>
                    <span className="font-semibold">{subtotal.toFixed(2)} MD</span>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right font-semibold">Man-days</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.employee_id}>
                        <TableCell className="font-mono text-xs">{r.emp_code}</TableCell>
                        <TableCell className="font-medium">{r.emp_name}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {Number(r.hours).toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {Number(r.man_days).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })}

          <div className="flex justify-end">
            <Badge variant="secondary" className="text-sm font-semibold">
              Total: {totalManDays.toFixed(2)} MD
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}
