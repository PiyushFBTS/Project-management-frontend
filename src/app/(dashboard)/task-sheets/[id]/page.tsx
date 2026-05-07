'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { taskSheetsApi } from '@/lib/api/task-sheets';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function TaskSheetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isEmployee = user?._type === 'employee';

  const { data: sheet, isLoading } = useQuery({
    queryKey: ['task-sheet', id, isEmployee],
    queryFn: () =>
      (isEmployee
        ? taskSheetsApi.getById(Number(id))
        : taskSheetsApi.adminGetOne(Number(id))
      ).then((r) => r.data.data),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!sheet) return <p className="text-slate-500">Sheet not found.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold text-foreground">
          Task Sheet {!isEmployee && <>— {sheet.employee?.empName ?? `#${sheet.employeeId}`}</>}
        </h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${sheet.isSubmitted ? 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 ring-amber-500/30'}`}>
          {sheet.isSubmitted ? 'Submitted' : 'Draft'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Date', value: sheet.sheetDate?.slice(0, 10) },
          { label: 'Total Hours', value: `${Number(sheet.totalHours).toFixed(1)}h` },
          { label: 'Man-Days', value: Number(sheet.manDays).toFixed(2) },
          { label: 'Submitted At', value: sheet.submittedAt ? format(new Date(sheet.submittedAt), 'MMM d, HH:mm') : '—' },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-lg font-semibold text-foreground">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Task Entries</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(() => {
            const entries = sheet.taskEntries ?? [];
            if (entries.length === 0) {
              return (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No entries
                </p>
              );
            }

            // Group entries by project (or "Other" for entries with no
            // project link). Preserves the order in which projects first
            // appear so the user sees them roughly chronologically.
            const groups = new Map<string, { name: string; entries: typeof entries; total: number }>();
            for (const e of entries) {
              const name = e.project?.projectName ?? e.otherProjectName ?? 'Other';
              if (!groups.has(name)) {
                groups.set(name, { name, entries: [], total: 0 });
              }
              const g = groups.get(name)!;
              g.entries.push(e);
              g.total += Number(e.durationHours ?? 0);
            }

            return (
              <div className="divide-y">
                {[...groups.values()].map((g) => (
                  <div key={g.name}>
                    {/* Project header */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-blue-500/5 border-b">
                      <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                        {g.name}
                      </p>
                      <p className="text-xs font-semibold text-muted-foreground">
                        {g.entries.length} entr{g.entries.length === 1 ? 'y' : 'ies'} · {g.total.toFixed(2)}h
                      </p>
                    </div>

                    {/* Per-project ticket / activity table */}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Ticket / Activity</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right w-20">Hours</TableHead>
                          <TableHead className="w-32">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {g.entries.map((e, i) => {
                          const ticketNo = e.ticket?.ticketNumber ?? null;
                          const ticketTitle = e.ticket?.title ?? null;
                          // Activity label for non-ticketed entries —
                          // normalised to Internal Meeting / Client
                          // Meeting / Other so labels stay consistent.
                          const rawAct = (e.activityType ?? '').toLowerCase().trim();
                          const activityLabel = rawAct === 'internal_meeting'
                            ? 'Internal Meeting'
                            : rawAct === 'client_meeting'
                              ? 'Client Meeting'
                              : 'Other';
                          // Clip description to 100 chars per spec.
                          const desc = (e.taskDescription ?? '').length > 100
                            ? `${e.taskDescription.slice(0, 100)}…`
                            : (e.taskDescription ?? '');
                          return (
                            <TableRow key={e.id}>
                              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                              <TableCell>
                                {ticketNo ? (
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-mono text-[10px] text-blue-700 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded shrink-0">
                                      {ticketNo}
                                    </span>
                                    {ticketTitle && (
                                      <span className="text-sm truncate">{ticketTitle}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">
                                    {activityLabel}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-md truncate" title={e.taskDescription ?? ''}>
                                {desc || '—'}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {Number(e.durationHours).toFixed(2)}h
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize text-xs">
                                  {e.status?.replace('_', ' ')}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
