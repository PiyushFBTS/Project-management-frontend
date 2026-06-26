/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  ArrowLeft, Loader2, Check, X, Trash2, Inbox, Clock,
  User, Users, FileText, Image as ImageIcon, AlignLeft, Download, PlayCircle, Pencil,
} from 'lucide-react';
import { requestsApi, adminRequestsApi, hrRequestsApi, RequestStatus, RequestTeam } from '@/lib/api/requests';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  pending: { label: 'Pending', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', icon: Clock },
  in_progress: { label: 'In Progress', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', icon: PlayCircle },
  resolved: { label: 'Resolved', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', icon: Check },
  rejected: { label: 'Rejected', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', icon: X },
};

export default function RequestDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';
  const isEmployee = user?._type === 'employee';
  const isHr = isEmployee && !!(user as any)?.isHr;
  const requestId = Number(params.id);
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:8000';

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const { data: request, isLoading } = useQuery({
    queryKey: ['request-detail', requestId],
    queryFn: async () => {
      const apiClient = isAdmin ? adminRequestsApi : requestsApi;
      const r = await apiClient.getOne(requestId);
      return r.data?.data ?? r.data;
    },
    enabled: !!user && !!requestId,
  });

  // Teams the current employee belongs to — used to let team members action
  // requests routed to their team. Skipped for admins (they action anything).
  const { data: myTeamsRaw } = useQuery({
    queryKey: ['my-request-teams'],
    queryFn: async () => {
      const r = await requestsApi.getMyTeams();
      return (r.data?.data ?? r.data ?? []) as RequestTeam[];
    },
    enabled: !!user && isEmployee && !isHr,
  });
  const myTeamIds: number[] = Array.isArray(myTeamsRaw) ? myTeamsRaw.map((t) => t.id) : [];

  const attachmentPath = (request as any)?.attachmentPath;
  useEffect(() => { setImgFailed(false); }, [attachmentPath]);

  const statusMut = useMutation({
    mutationFn: ({ status, remarks }: { status: Exclude<RequestStatus, 'pending'>; remarks?: string }) =>
      // Admins use the admin route; HR and team members both go through the
      // employee route (authorized server-side by HR flag or membership).
      isAdmin
        ? adminRequestsApi.updateStatus(requestId, status, remarks)
        : hrRequestsApi.updateStatus(requestId, status, remarks),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['request-detail', requestId] });
      qc.invalidateQueries({ queryKey: ['requests'] });
      toast.success('Status updated');
      setRejectOpen(false);
      setRejectReason('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: () => isAdmin ? adminRequestsApi.delete(requestId) : requestsApi.delete(requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requests'] });
      toast.success('Request deleted');
      router.push('/requests');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4"><Skeleton className="h-32" /><Skeleton className="h-48" /></div>
          <Skeleton className="h-60" />
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-20">
        <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-lg font-medium">Request not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/requests')}>Back to Requests</Button>
      </div>
    );
  }

  const r = request;
  const sc = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = sc.icon;

  // Edit / delete affordance — only while pending and only for the owner
  // (non-HR employee). Backend enforces both; mirror to hide dead actions.
  const isOwner = isEmployee && !isHr && r.employeeId != null && r.employeeId === (user as any)?.id;
  const canEdit = r.status === 'pending' && isOwner;
  const canDelete = isAdmin || (isOwner && r.status === 'pending');

  // Who can action: admin / HR (any request) or a member of this request's
  // team. Available until the request reaches a terminal state.
  const isTeamHandler = r.teamId != null && myTeamIds.includes(r.teamId);
  const canReview = isAdmin || isHr || isTeamHandler;
  const canAction = canReview && (r.status === 'pending' || r.status === 'in_progress');

  const isImage = !!(
    (r.attachmentPath && /\.(jpg|jpeg|png|gif|webp)$/i.test(r.attachmentPath)) ||
    (r.attachmentName && /\.(jpg|jpeg|png|gif|webp)$/i.test(r.attachmentName))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <button onClick={() => router.push('/requests')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-1">
            <ArrowLeft className="h-4 w-4" /> Back to Requests
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center">
              <Inbox className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-mono">{r.requestNo ?? `Request #${r.id}`}</h1>
              <p className="text-sm text-muted-foreground">{r.createdAt ? format(new Date(r.createdAt), 'dd MMM yyyy, hh:mm a') : ''}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => router.push(`/requests/${requestId}/edit`)}>
              <Pencil className="h-4 w-4 mr-1.5" /> Edit
            </Button>
          )}
          <Badge className={`text-sm border px-3 py-1.5 ${sc.bg} ${sc.color} ${sc.border}`}>
            <StatusIcon className="h-4 w-4 mr-1.5" />
            {sc.label}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Request</h3>
              <p className="text-lg font-semibold">{r.title}</p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3 text-primary" /> Team</p>
                  <p className="text-sm font-semibold">{r.team?.name ?? '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1"><User className="h-3 w-3 text-primary" /> Raised By</p>
                  <p className="text-sm font-semibold">{r.employee?.name ?? r.submitterName ?? '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3 text-primary" /> Raised On</p>
                  <p className="text-sm font-semibold">{r.createdAt ? format(new Date(r.createdAt), 'dd MMM yyyy') : '—'}</p>
                </div>
              </div>
              {r.description && (
                <div className="mt-6 pt-5 border-t">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1 mb-2"><AlignLeft className="h-3 w-3 text-primary" /> Description</p>
                  <p className="text-sm whitespace-pre-wrap bg-muted/30 rounded-lg p-4 leading-relaxed">{r.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Document */}
          {r.attachmentPath ? (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Document</h3>
                {isImage && !imgFailed ? (
                  <div className="space-y-3">
                    <a href={(r.attachmentPath?.startsWith('http') ? r.attachmentPath : `${apiBase}${r.attachmentPath}`)} target="_blank" rel="noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={(r.attachmentPath?.startsWith('http') ? r.attachmentPath : `${apiBase}${r.attachmentPath}`)}
                        alt={r.attachmentName || 'Document'}
                        onError={() => setImgFailed(true)}
                        className="max-h-80 w-auto mx-auto rounded-xl border shadow-sm hover:shadow-md transition-shadow"
                      />
                    </a>
                    <div className="flex items-center justify-center">
                      <a href={(r.attachmentPath?.startsWith('http') ? r.attachmentPath : `${apiBase}${r.attachmentPath}`)} target="_blank" rel="noreferrer" download={r.attachmentName || undefined}
                        className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent">
                        <Download className="h-3.5 w-3.5" /> Download
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border border-dashed">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{r.attachmentName || 'Document'}</p>
                      <p className="text-xs text-muted-foreground">{imgFailed ? 'Inline preview unavailable — download instead' : 'Click to download'}</p>
                    </div>
                    <a href={(r.attachmentPath?.startsWith('http') ? r.attachmentPath : `${apiBase}${r.attachmentPath}`)} target="_blank" rel="noreferrer" download={r.attachmentName || undefined}
                      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent shrink-0">
                      <Download className="h-3.5 w-3.5" /> Download
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No document attached</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Status + actions */}
        <div>
          <Card>
            <CardContent className="p-5 space-y-4">
              <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Status</h3>
              <div className={`rounded-xl p-4 border ${sc.bg} ${sc.border}`}>
                <div className="flex items-center gap-2.5">
                  <div className={`h-8 w-8 rounded-full ${sc.bg} flex items-center justify-center`}>
                    <StatusIcon className={`h-4 w-4 ${sc.color}`} />
                  </div>
                  <span className={`text-lg font-bold ${sc.color}`}>{sc.label}</span>
                </div>
              </div>

              {(r.status === 'resolved' || r.status === 'rejected' || r.status === 'in_progress') && (r.handledByName || r.remarks) && (
                <div className={`rounded-xl border p-4 space-y-2 ${sc.bg} ${sc.border}`}>
                  {r.handledByName && <p className="text-xs text-muted-foreground">By: {r.handledByName}</p>}
                  {r.remarks && <p className="text-sm whitespace-pre-wrap">&quot;{r.remarks}&quot;</p>}
                </div>
              )}

              <div className="space-y-2 text-xs text-muted-foreground">
                {r.handledAt && <p>Last action: {format(new Date(r.handledAt), 'dd MMM yyyy, hh:mm a')}</p>}
                <p>Created: {format(new Date(r.createdAt), 'dd MMM yyyy, hh:mm a')}</p>
              </div>

              {canAction && (
                <div className="space-y-2 pt-2 border-t">
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{isAdmin ? 'Admin Actions' : isHr ? 'HR Actions' : 'Team Actions'}</h3>
                  {r.status === 'pending' && (
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={statusMut.isPending}
                      onClick={() => statusMut.mutate({ status: 'in_progress' })}>
                      <PlayCircle className="h-4 w-4 mr-1.5" /> Mark In Progress
                    </Button>
                  )}
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={statusMut.isPending}
                    onClick={() => statusMut.mutate({ status: 'resolved' })}>
                    <Check className="h-4 w-4 mr-1.5" /> Mark Resolved
                  </Button>
                  <Button variant="destructive" className="w-full" disabled={statusMut.isPending}
                    onClick={() => { setRejectReason(''); setRejectOpen(true); }}>
                    <X className="h-4 w-4 mr-1.5" /> Reject
                  </Button>
                </div>
              )}

              {canDelete && (
                <Button variant="outline" className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><X className="h-5 w-5 text-red-500" /> Reject Request</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">Reason for Rejection <span className="text-red-500">*</span></label>
              <textarea
                value={rejectReason}
                onChange={(ev) => setRejectReason(ev.target.value)}
                placeholder="Explain why this request is being rejected..."
                rows={3}
                className="w-full rounded-md border px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 resize-none transition-colors"
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button variant="destructive" disabled={!rejectReason.trim() || statusMut.isPending}
                onClick={() => statusMut.mutate({ status: 'rejected', remarks: rejectReason.trim() })}>
                {statusMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation modal */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-red-500" /> Delete request?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete{' '}
            <span className="font-semibold text-foreground">{r.requestNo ?? `#${r.id}`}</span>
            {r.title ? <> — “{r.title}”</> : null}. This action cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMut.isPending} onClick={() => deleteMut.mutate()}>
              {deleteMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
