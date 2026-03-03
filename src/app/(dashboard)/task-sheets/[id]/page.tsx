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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Task Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Time Taken</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sheet.taskEntries ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                    No entries
                  </TableCell>
                </TableRow>
              ) : (
                (sheet.taskEntries ?? []).map((entry, i) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-slate-500">{i + 1}</TableCell>
                    <TableCell className="font-medium text-sm">
                      {entry.project?.projectName ?? entry.otherProjectName ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{entry.taskType?.typeName ?? (entry.taskTypeId ? `#${entry.taskTypeId}` : '—')}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm">{entry.taskDescription}</TableCell>
                    <TableCell className="font-semibold">{Number(entry.durationHours).toFixed(2)}h</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs">{entry.status?.replace('_', ' ')}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
