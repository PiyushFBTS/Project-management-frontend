'use client';

import { Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail, Search, RefreshCw, Eye, CheckCircle, XCircle, Paperclip, Download } from 'lucide-react';

const formatSentAt = (dateStr: string) => {
  const d = new Date(dateStr);
  const date = d.toISOString().slice(0, 10);
  let h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${date} ${h}:${m}${ampm}`;
};
import { toast } from 'sonner';
import { emailLogsApi, EmailLogFilter } from '@/lib/api/email-logs';
import { EmailLog, EmailLogAttachment } from '@/types';
import { useCompany } from '@/providers/company-provider';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <TableRow>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <TableCell key={i}>
          <div className="h-4 rounded bg-muted animate-pulse" style={{ width: `${50 + i * 8}%` }} />
        </TableCell>
      ))}
    </TableRow>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'sent') {
    return (
      <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">
        <CheckCircle className="h-3 w-3" /> Sent
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20 hover:bg-red-500/20">
      <XCircle className="h-3 w-3" /> Failed
    </Badge>
  );
}

// ── Email Detail Dialog ────────────────────────────────────────────────────────

function EmailDetailDialog({ log, open, onClose }: { log: EmailLog | null; open: boolean; onClose: () => void }) {
  if (!log) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500" />
        <DialogHeader className="pt-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-sky-500" />
            {log.subject ?? '(No subject)'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border bg-muted/40 p-3">
            <div>
              <p className="text-xs text-muted-foreground">To</p>
              <p className="font-medium">{log.toEmail}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">From</p>
              <p className="font-medium">
                {log.fromName ? `${log.fromName} <${log.fromEmail}>` : (log.fromEmail ?? '—')}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sent At</p>
              <p className="font-medium">{formatSentAt(log.sentAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Triggered By</p>
              <p className="font-medium capitalize">{log.triggeredBy?.replace(/_/g, ' ') ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <StatusBadge status={log.status} />
            </div>
          </div>

          {log.errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 text-red-600 dark:text-red-400 text-xs">
              <p className="font-semibold mb-1">Error</p>
              <p>{log.errorMessage}</p>
            </div>
          )}

          {log.body && (
            <div className="rounded-lg border overflow-hidden">
              <p className="bg-muted/60 px-3 py-1.5 text-xs font-medium text-muted-foreground border-b">
                Email Body
              </p>
              <div
                className="p-3 max-h-64 overflow-y-auto text-sm prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: log.body }}
              />
            </div>
          )}

          {log.attachments && log.attachments.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <p className="bg-muted/60 px-3 py-1.5 text-xs font-medium text-muted-foreground border-b flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" />
                Attachments ({log.attachments.length})
              </p>
              <div className="divide-y">
                {log.attachments.map((att, i) => (
                  <AttachmentRow key={i} attachment={att} />
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AttachmentRow({ attachment }: { attachment: EmailLogAttachment }) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';
  const url = `${apiBase}/uploads/${attachment.path}`;

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const icon = attachment.mimetype.startsWith('image/') ? '🖼️' :
    attachment.mimetype === 'application/pdf' ? '📄' : '📎';

  return (
    <div className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40 transition-colors">
      <span className="text-base">{icon}</span>
      <span className="flex-1 truncate font-medium">{attachment.filename}</span>
      <span className="text-xs text-muted-foreground shrink-0">{formatSize(attachment.size)}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        download={attachment.filename}
        className="rounded p-1 hover:bg-sky-500/10 text-sky-500 transition-colors shrink-0"
        title="Download"
      >
        <Download className="h-4 w-4" />
      </a>
    </div>
  );
}

// ── Main Page Content ─────────────────────────────────────────────────────────

function EmailInboxContent() {
  const { isSuperAdmin, selectedCompany } = useCompany();

  const [filter, setFilter] = useState<EmailLogFilter>({ page: 1, limit: 20 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<EmailLog | null>(null);

  // When super admin is in company context, scope to that company's emails
  const scopedCompanyId = isSuperAdmin && selectedCompany ? selectedCompany.id : undefined;

  const queryParams: EmailLogFilter & { companyId?: number } = {
    ...filter,
    search: search || undefined,
    status: status !== 'all' ? (status as 'sent' | 'failed') : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    companyId: scopedCompanyId,
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['email-logs', isSuperAdmin, scopedCompanyId, queryParams],
    queryFn: async () => {
      const res = isSuperAdmin
        ? await emailLogsApi.getAllPlatform(queryParams)
        : await emailLogsApi.getAll(queryParams);
      return res.data; // { success, data: EmailLog[], message, meta }
    },
  } as any);

  const logs: EmailLog[] = (data as any)?.data ?? [];
  const meta = (data as any)?.meta as { page: number; limit: number; total: number; totalPages: number } | null;

  const applyFilter = () => setFilter((f) => ({ ...f, page: 1 }));

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 p-6 text-white shadow-lg">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-inner">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Email Inbox</h1>
              <p className="text-sky-100 text-sm mt-0.5">
                {isSuperAdmin && selectedCompany
                  ? `Emails for ${selectedCompany.name}`
                  : isSuperAdmin
                    ? 'All emails across all companies'
                    : 'Record of all emails sent through the app'}
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-sm font-medium backdrop-blur-sm transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search subject or recipient…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); applyFilter(); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-40"
          placeholder="From date"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-40"
          placeholder="To date"
        />
        <Button onClick={applyFilter} variant="secondary" size="default">
          Apply
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
        <div className="h-1.5 rounded-t-[inherit] bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>To</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Context</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent At</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-500/10">
                      <Mail className="h-7 w-7 text-sky-500" />
                    </div>
                    <p className="font-semibold text-foreground">No emails found</p>
                    <p className="text-sm text-muted-foreground">Emails sent through the app will appear here</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow
                  key={log.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => setSelected(log)}
                >
                  <TableCell className="font-medium max-w-48 truncate">
                    {log.subject ?? <span className="text-muted-foreground italic">(No subject)</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{log.toEmail}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.fromName ?? log.fromEmail ?? '—'}
                  </TableCell>
                  <TableCell>
                    {log.triggeredBy ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                        {log.triggeredBy.replace(/_/g, ' ')}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell><StatusBadge status={log.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatSentAt(log.sentAt)}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelected(log); }}
                      className="rounded p-1 hover:bg-muted transition-colors"
                      title="View details"
                    >
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {((meta.page - 1) * meta.limit) + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              disabled={meta.page <= 1}
              onClick={() => setFilter((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
            >
              Previous
            </Button>
            <Button
              variant="outline" size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => setFilter((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <EmailDetailDialog
        log={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

export default function EmailInboxPage() {
  return (
    <Suspense>
      <EmailInboxContent />
    </Suspense>
  );
}
