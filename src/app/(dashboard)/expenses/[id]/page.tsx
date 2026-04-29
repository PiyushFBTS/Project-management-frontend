/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  ArrowLeft, Loader2, Check, X, Trash2, Receipt,
  Calendar, IndianRupee, FolderKanban, Tag, User, Clock,
  FileText, Image as ImageIcon, AlignLeft, Download,
} from 'lucide-react';
import { expensesApi, adminExpensesApi, hrExpensesApi } from '@/lib/api/expenses';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  pending: { label: 'Pending', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', icon: Clock },
  approved: { label: 'Approved', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', icon: Check },
  rejected: { label: 'Rejected', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', icon: X },
};

export default function ExpenseDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';
  const isEmployee = user?._type === 'employee';
  const isHr = isEmployee && !!(user as any)?.isHr;
  const expenseId = Number(params.id);
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:8000';

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveAmount, setApproveAmount] = useState('');
  const [approveRemarks, setApproveRemarks] = useState('');

  const { data: expense, isLoading } = useQuery({
    queryKey: ['expense-detail', expenseId],
    queryFn: async () => {
      const api = isAdmin ? adminExpensesApi : expensesApi;
      const r = await api.getOne(expenseId);
      return r.data?.data ?? r.data;
    },
    enabled: !!user && !!expenseId,
  });

  const statusMut = useMutation({
    mutationFn: ({ status, remarks, approvedAmount: amt }: { status: 'approved' | 'rejected'; remarks?: string; approvedAmount?: number }) =>
      // Route through the HR endpoint when the requester is HR — admins
      // keep using the admin endpoint. Both share the same self-approval
      // guard server-side.
      isHr
        ? hrExpensesApi.updateStatus(expenseId, status, remarks, amt)
        : adminExpensesApi.updateStatus(expenseId, status, remarks, amt),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense-detail', expenseId] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Status updated');
      setRejectOpen(false);
      setRejectReason('');
      setApproveOpen(false);
      setApproveAmount('');
      setApproveRemarks('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: () => isAdmin ? adminExpensesApi.delete(expenseId) : expensesApi.delete(expenseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense deleted');
      router.push('/expenses');
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

  if (!expense) {
    return (
      <div className="text-center py-20">
        <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-lg font-medium">Expense not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/expenses')}>Back to Expenses</Button>
      </div>
    );
  }

  const e = expense;
  const sc = STATUS_CONFIG[e.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = sc.icon;
  const isImage = e.attachmentName?.match(/\.(jpg|jpeg|png|gif|webp)$/i);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <button onClick={() => router.push('/expenses')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-1">
            <ArrowLeft className="h-4 w-4" /> Back to Expenses
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Expense #{e.id}</h1>
              <p className="text-sm text-muted-foreground">{e.expenseType} · {e.expenseDate ? format(new Date(e.expenseDate + 'T00:00:00'), 'dd MMM yyyy') : ''}</p>
            </div>
          </div>
        </div>
        <Badge className={`text-sm border px-3 py-1.5 ${sc.bg} ${sc.color} ${sc.border}`}>
          <StatusIcon className="h-4 w-4 mr-1.5" />
          {sc.label}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Row 1: Expense Details (col-span-2) | Status (col-span-1) */}

        {/* 3. Expense Details */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5">Expense Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3 text-primary" /> Date</p>
                  <p className="text-sm font-semibold">{e.expenseDate ? format(new Date(e.expenseDate + 'T00:00:00'), 'dd MMM yyyy') : '—'}{e.expenseDateTo && e.expenseDateTo !== e.expenseDate ? ` — ${format(new Date(e.expenseDateTo + 'T00:00:00'), 'dd MMM yyyy')}` : ''}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3 text-primary" /> Type</p>
                  <p className="text-sm font-semibold">{e.expenseType}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1"><FolderKanban className="h-3 w-3 text-primary" /> Project</p>
                  <p className="text-sm font-semibold">{e.project?.projectName ?? '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1"><User className="h-3 w-3 text-primary" /> Employee</p>
                  <p className="text-sm font-semibold">{e.employee?.empName ?? '—'}</p>
                </div>
              </div>
              {e.description && (
                <div className="mt-6 pt-5 border-t">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1 mb-2"><AlignLeft className="h-3 w-3 text-primary" /> Description</p>
                  <p className="text-sm whitespace-pre-wrap bg-muted/30 rounded-lg p-4 leading-relaxed">{e.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 2. Status */}
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
              {e.status === 'approved' && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Requested</span>
                    <span className="text-sm font-semibold">{'\u20B9'}{Number(e.amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Approved</span>
                    <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{'\u20B9'}{Number(e.approvedAmount ?? e.amount ?? 0).toLocaleString('en-IN')}</span>
                  </div>
                  {e.approvedAmount != null && Number(e.approvedAmount) < Number(e.amount) && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">Partial: {'\u20B9'}{(Number(e.amount) - Number(e.approvedAmount)).toLocaleString('en-IN')} deducted</p>
                  )}
                  {e.approvedByName && <p className="text-xs text-muted-foreground">By: {e.approvedByName}</p>}
                  {e.remarks && <p className="text-xs text-muted-foreground italic">&quot;{e.remarks}&quot;</p>}
                </div>
              )}
              {e.status === 'rejected' && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400">Rejected</p>
                  {e.approvedByName && <p className="text-xs text-muted-foreground">By: {e.approvedByName}</p>}
                  {e.remarks && <p className="text-sm text-red-700 dark:text-red-400">&quot;{e.remarks}&quot;</p>}
                </div>
              )}
              <div className="space-y-2 text-xs text-muted-foreground">
                {e.approvedAt && <p>{e.status === 'approved' ? 'Approved' : 'Reviewed'}: {format(new Date(e.approvedAt), 'dd MMM yyyy, hh:mm a')}</p>}
                <p>Created: {format(new Date(e.createdAt), 'dd MMM yyyy, hh:mm a')}</p>
              </div>
              {(() => {
                // Self-approval guard: an admin can't action their own
                // admin-bridged expense; an HR can't action a leave they
                // themselves submitted (matched by employeeId).
                const isOwnAdminExpense =
                  isAdmin && e.submitterAdminId != null && e.submitterAdminId === (user as any)?.id;
                const isOwnHrExpense =
                  isHr && e.employeeId != null && e.employeeId === (user as any)?.id;
                const canAction =
                  (isAdmin || isHr) && e.status === 'pending' && !isOwnAdminExpense && !isOwnHrExpense;
                if (!canAction) return null;
                return (
                  <>
                    <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{isHr ? 'HR Actions' : 'Admin Actions'}</h3>
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => { setApproveAmount(String(Number(e.amount || 0))); setApproveRemarks(''); setApproveOpen(true); }}>
                      <Check className="h-4 w-4 mr-1.5" /> Approve
                    </Button>
                    <Button variant="destructive" className="w-full" onClick={() => { setRejectReason(''); setRejectOpen(true); }}>
                      <X className="h-4 w-4 mr-1.5" /> Reject
                    </Button>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Document (col-span-2) | Amount + Actions (col-span-1) */}

        {/* 4. Document */}
        <div className="lg:col-span-2">
          {e.attachmentPath ? (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Receipt / Proof</h3>
                {isImage ? (
                  <a href={`${apiBase}${e.attachmentPath}`} target="_blank" rel="noreferrer" className="block">
                    <img src={`${apiBase}${e.attachmentPath}`} alt="Receipt" className="max-h-80 rounded-xl border shadow-sm mx-auto hover:shadow-md transition-shadow" />
                  </a>
                ) : (
                  <a href={`${apiBase}${e.attachmentPath}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors border border-dashed">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{e.attachmentName}</p>
                      <p className="text-xs text-muted-foreground">Click to download</p>
                    </div>
                    <Download className="h-5 w-5 text-muted-foreground" />
                  </a>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No receipt attached</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 1. Amount + Actions */}
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="bg-linear-to-r from-violet-600 via-purple-600 to-indigo-600 p-8 text-center text-white">
              <p className="text-xs uppercase tracking-widest opacity-80 mb-1">Expense Amount</p>
              <p className="text-4xl font-bold">{'\u20B9'}{Number(e.amount).toLocaleString('en-IN')}</p>
            </div>
          </Card>



          {(isAdmin || (isEmployee && e.status === 'pending')) && (
            <Button variant="outline" className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={() => { if (confirm('Delete this expense?')) deleteMut.mutate(); }}>
              <Trash2 className="h-4 w-4 mr-1.5" /> Delete
            </Button>
          )}
        </div>
      </div>

      {/* Approve Dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Check className="h-5 w-5 text-emerald-500" /> Approve Expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
              <span className="text-xs text-muted-foreground">Requested Amount</span>
              <span className="text-lg font-bold">{'\u20B9'}{Number(expense?.amount || 0).toLocaleString('en-IN')}</span>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Approved Amount *</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={approveAmount}
                onChange={(ev) => setApproveAmount(ev.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                placeholder="Enter approved amount"
              />
              {Number(approveAmount) > 0 && Number(approveAmount) < Number(expense?.amount || 0) && (
                <p className="text-xs text-amber-600 mt-1">
                  Partial approval: {'\u20B9'}{(Number(expense?.amount || 0) - Number(approveAmount)).toLocaleString('en-IN')} less than requested
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Remarks {Number(approveAmount) < Number(expense?.amount || 0) ? <span className="text-red-500">*</span> : '(optional)'}
              </label>
              <textarea
                value={approveRemarks}
                onChange={(ev) => setApproveRemarks(ev.target.value)}
                placeholder={Number(approveAmount) < Number(expense?.amount || 0) ? 'Reason for partial approval...' : 'Optional remarks...'}
                rows={2}
                className="w-full rounded-md border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={!approveAmount || Number(approveAmount) <= 0 || (Number(approveAmount) < Number(expense?.amount || 0) && !approveRemarks.trim()) || statusMut.isPending}
                onClick={() => statusMut.mutate({
                  status: 'approved',
                  approvedAmount: Number(approveAmount),
                  remarks: approveRemarks.trim() || undefined,
                })}
              >
                {statusMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Approve
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><X className="h-5 w-5 text-red-500" /> Reject Expense</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">Reason for Rejection <span className="text-red-500">*</span></label>
              <textarea
                value={rejectReason}
                onChange={(ev) => setRejectReason(ev.target.value)}
                placeholder="Explain why this expense is being rejected..."
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
    </div>
  );
}
