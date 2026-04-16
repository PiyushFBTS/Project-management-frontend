/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Mail, Paperclip, Download, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { emailLogsApi } from '@/lib/api/email-logs';
import { EmailLog, EmailLogAttachment } from '@/types';
import { useCompany } from '@/providers/company-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

function formatSentAt(dateStr: string) {
  const d = new Date(dateStr);
  const date = d.toISOString().slice(0, 10);
  let h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${date} ${h}:${m}${ampm}`;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

function AttachmentRow({ attachment }: { attachment: EmailLogAttachment }) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';
  const url = `${apiBase}/uploads/${attachment.path}`;
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

export default function EmailLogDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const logId = Number(id);
  const { isSuperAdmin } = useCompany();

  const { data: log, isLoading, isError } = useQuery({
    queryKey: ['email-log', logId, isSuperAdmin],
    queryFn: async () => {
      const res = isSuperAdmin
        ? await emailLogsApi.getOnePlatform(logId)
        : await emailLogsApi.getOne(logId);
      return (res.data as any)?.data as EmailLog;
    },
    enabled: !Number.isNaN(logId) && logId > 0,
  });

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-1" onClick={() => router.push('/email-inbox')}>
          <ArrowLeft className="h-4 w-4" /> Back to Inbox
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : isError || !log ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
            <p className="text-sm font-semibold">Email log not found</p>
            <p className="text-xs text-muted-foreground mt-1">
              The requested email log may have been deleted or is not accessible.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Hero */}
          <Card className="overflow-hidden border-0 bg-linear-to-br from-sky-600 via-blue-600 to-indigo-700 text-white shadow-md">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <Mail className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={log.status} />
                    {log.triggeredBy && (
                      <Badge className="border-0 bg-white/15 text-white/90 hover:bg-white/20 capitalize">
                        {log.triggeredBy.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </div>
                  <h1 className="mt-1.5 text-lg sm:text-xl font-bold tracking-tight break-words">
                    {log.subject ?? <span className="italic text-white/80">(No subject)</span>}
                  </h1>
                  <p className="text-xs text-white/80 mt-1">{formatSentAt(log.sentAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Meta grid */}
          <Card className="shadow-sm">
            <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">To</p>
                <p className="mt-0.5 text-sm font-medium break-all">{log.toEmail}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">From</p>
                <p className="mt-0.5 text-sm font-medium break-all">
                  {log.fromName ? `${log.fromName} <${log.fromEmail}>` : (log.fromEmail ?? '—')}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sent At</p>
                <p className="mt-0.5 text-sm font-medium">{formatSentAt(log.sentAt)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Triggered By</p>
                <p className="mt-0.5 text-sm font-medium capitalize">
                  {log.triggeredBy?.replace(/_/g, ' ') ?? '—'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Error message */}
          {log.errorMessage && (
            <Card className="border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-950/20 shadow-sm">
              <CardContent className="p-4 flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">Delivery error</p>
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400 break-words">{log.errorMessage}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Body */}
          {log.body && (
            <Card className="shadow-sm overflow-hidden">
              <div className="bg-muted/60 px-4 py-2 text-xs font-semibold text-muted-foreground border-b">
                Email Body
              </div>
              <CardContent className="p-4">
                <div
                  className="text-sm prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: log.body }}
                />
              </CardContent>
            </Card>
          )}

          {/* Attachments */}
          {log.attachments && log.attachments.length > 0 && (
            <Card className="shadow-sm overflow-hidden">
              <div className="bg-muted/60 px-4 py-2 text-xs font-semibold text-muted-foreground border-b flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" />
                Attachments ({log.attachments.length})
              </div>
              <div className="divide-y">
                {log.attachments.map((att, i) => (
                  <AttachmentRow key={i} attachment={att} />
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
