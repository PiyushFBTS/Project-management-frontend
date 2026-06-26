/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Plus, Trash2, Loader2, Download, Check, X, Upload, Paperclip,
  Receipt, Filter, FileText, Image as ImageIcon, FileSpreadsheet,
  User as UserIcon,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { expensesApi, adminExpensesApi, hrExpensesApi } from '@/lib/api/expenses';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const EXPENSE_TYPES = [
  'Travel', 'Food', 'Accommodation', 'Transport', 'Office Supplies',
  'Software', 'Hardware', 'Training', 'Communication', 'Other',
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function ExpensesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const isAdmin = user?._type === 'admin';
  const isEmployee = user?._type === 'employee';
  const isHr = isEmployee && !!(user as any)?.isHr;
  const isAccounts = isEmployee && !!(user as any)?.isAccounts;
  const canApprove = isAdmin || isHr;
  // Mark-paid is admin, HR, or accounts.
  const canMarkPaid = isAdmin || isHr || isAccounts;
  // Anyone with isHr / isAccounts / admin can see the team tab.
  const canSeeTeam = isAdmin || isHr || isAccounts;
  const fileRef = useRef<HTMLInputElement>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:8000';

  // Tab: admin/HR/Accounts sees both tabs, regular employees only see "My"
  const [activeTab, setActiveTab] = useState<'my' | 'team'>(canSeeTeam ? 'team' : 'my');

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveId, setApproveId] = useState<number | null>(null);
  const [approveAmount, setApproveAmount] = useState('');
  const [approveRemarks, setApproveRemarks] = useState('');
  const [approveRequestedAmt, setApproveRequestedAmt] = useState(0);

  // Excel import (supports multiple files: Excel + attachment images/docs)
  const importInputRef = useRef<HTMLInputElement>(null);
  const [excelImporting, setExcelImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ row: number; date: string; type: string; amount: string; success: boolean; error?: string }[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Add form state
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formType, setFormType] = useState('Travel');
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formProjectId, setFormProjectId] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);

  // Queries
  const { data: rawData, isLoading } = useQuery({
    queryKey: ['expenses', isAdmin, isHr, isAccounts, statusFilter, activeTab],
    queryFn: async () => {
      if (canSeeTeam && activeTab === 'team') {
        // All company expenses (team view) — admin uses admin endpoint,
        // HR / Accounts use the gated /employee/expenses/all route.
        const params = {
          limit: 200,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        };
        const r = isAdmin
          ? await adminExpensesApi.getAll(params)
          : await hrExpensesApi.getAll(params);
        return r.data?.data ?? r.data;
      }
      if (isAdmin && activeTab === 'my') {
        // Admin's own expenses
        const r = await adminExpensesApi.getAll({ limit: 200 });
        const all = r.data?.data ?? r.data ?? [];
        // Filter to only admin's own
        const adminId = (user as any)?.id;
        return (Array.isArray(all) ? all : []).filter((e: any) =>
          e.submitterType === 'admin' && e.submitterAdminId === adminId
        );
      }
      const r = await expensesApi.getMyExpenses({ limit: 100 });
      return r.data?.data ?? r.data;
    },
    enabled: !!user,
  });
  const allExpenses: any[] = Array.isArray(rawData) ? rawData : (rawData as any)?.data ?? [];
  const expenses = allExpenses.filter((exp: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (exp.employee?.name ?? '').toLowerCase().includes(q)
      || (exp.expenseType ?? '').toLowerCase().includes(q)
      || (exp.project?.projectName ?? '').toLowerCase().includes(q);
  });

  // Group expenses by employee for the Team tab. Admin-bridged expenses
  // get their own bucket per admin so we don't merge admin self-expenses
  // with employee rows that happen to share a name.
  type ExpenseGroup = {
    key: string;
    name: string;
    isAdminBucket: boolean;
    expenses: any[];
    total: number;
    pendingCount: number;
  };
  const groupedExpenses = useMemo<ExpenseGroup[]>(() => {
    if (!(canApprove && activeTab === 'team')) return [];
    const map = new Map<string, ExpenseGroup>();
    for (const exp of expenses) {
      const isAdminRow = exp.submitterType === 'admin';
      const key = isAdminRow
        ? `admin-${exp.submitterAdminId ?? exp.submitterName ?? 'unknown'}`
        : `emp-${exp.employeeId ?? exp.employee?.id ?? exp.employee?.name ?? 'unknown'}`;
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          name: exp.employee?.name ?? exp.submitterName ?? '—',
          isAdminBucket: isAdminRow,
          expenses: [],
          total: 0,
          pendingCount: 0,
        };
        map.set(key, g);
      }
      g.expenses.push(exp);
      g.total += Number(exp.amount || 0);
      if (exp.status === 'pending') g.pendingCount += 1;
    }
    // Sort: most pending first, then by name.
    return Array.from(map.values()).sort((a, b) => {
      if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount;
      return a.name.localeCompare(b.name);
    });
  }, [expenses, canApprove, activeTab]);

  // Projects for dropdown
  const { data: projectsRaw } = useQuery({
    queryKey: ['projects-for-expenses'],
    queryFn: async () => {
      const { api: axiosApi } = await import('@/lib/api/axios-instance');
      const prefix = isAdmin ? '/admin' : '/employee';
      const r = await axiosApi.get(`${prefix}/projects`);
      const d = r.data;
      return Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
    },
    enabled: !!user,
  });
  const projects: any[] = Array.isArray(projectsRaw) ? projectsRaw : [];

  // Create expense
  const createMut = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('expenseDate', formDate);
      fd.append('expenseType', formType);
      fd.append('amount', formAmount);
      if (formDesc) fd.append('description', formDesc);
      if (formProjectId) fd.append('projectId', formProjectId);
      if (formFile) fd.append('file', formFile);
      return expensesApi.create(fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense added');
      resetForm();
      setAddOpen(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to add expense'),
  });

  // Expense pending delete confirmation (null = modal closed).
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  // Delete expense
  const deleteMut = useMutation({
    mutationFn: (id: number) => isAdmin ? adminExpensesApi.delete(id) : expensesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Deleted'); setDeleteTarget(null); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  // Admin / Accounts: toggle paid/unpaid. Routes through /admin or
  // /employee depending on actor type.
  const paidMut = useMutation({
    mutationFn: ({ id, paid }: { id: number; paid: boolean }) =>
      isAdmin
        ? adminExpensesApi.markPaid(id, paid)
        : hrExpensesApi.markPaid(id, paid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Payment status updated');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to update'),
  });

  // Admin / HR: approve/reject (HR routes through the HR-gated endpoint)
  const statusMut = useMutation({
    mutationFn: ({ id, status, remarks, approvedAmount: amt }: { id: number; status: 'approved' | 'rejected'; remarks?: string; approvedAmount?: number }) =>
      isHr
        ? hrExpensesApi.updateStatus(id, status, remarks, amt)
        : adminExpensesApi.updateStatus(id, status, remarks, amt),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Status updated');
      setRejectId(null);
      setRejectReason('');
      setApproveId(null);
      setApproveAmount('');
      setApproveRemarks('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const resetForm = () => {
    setFormDate(format(new Date(), 'yyyy-MM-dd'));
    setFormType('Travel');
    setFormDesc('');
    setFormAmount('');
    setFormProjectId('');
    setFormFile(null);
  };

  const exportToExcel = () => {
    const rows = expenses.map((exp: any) => ({
      'Date': exp.expenseDate ? format(new Date(exp.expenseDate + 'T00:00:00'), 'dd MMM yyyy') : '',
      ...(exp.expenseDateTo && exp.expenseDateTo !== exp.expenseDate ? { 'To Date': format(new Date(exp.expenseDateTo + 'T00:00:00'), 'dd MMM yyyy') } : {}),
      ...(isAdmin && activeTab === 'team' ? { 'Employee': exp.employee?.name ?? exp.submitterName ?? '' } : {}),
      'Project': exp.project?.projectName ?? '',
      'Type': exp.expenseType,
      'Amount': Number(exp.amount || 0),
      'Status': exp.status,
      'Description': exp.description ?? '',
      ...(exp.status === 'approved' ? {
        'Approved By': exp.approvedByName ?? (exp.approvedBy ? `Admin #${exp.approvedBy}` : ''),
        'Approved At': exp.approvedAt ? format(new Date(exp.approvedAt), 'dd MMM yyyy, hh:mm a') : '',
      } : {}),
      ...(exp.status === 'rejected' ? {
        'Rejected By': exp.approvedByName ?? (exp.approvedBy ? `Admin #${exp.approvedBy}` : ''),
        'Rejected At': exp.approvedAt ? format(new Date(exp.approvedAt), 'dd MMM yyyy, hh:mm a') : '',
        'Rejection Reason': exp.remarks ?? '',
      } : {}),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    XLSX.writeFile(wb, `expenses_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleImportFiles = async (fileList: FileList) => {
    setExcelImporting(true);
    console.log("Expense Import Results",importResults);
    
    const results: typeof importResults = [];
    try {
      const files = Array.from(fileList);
      // Separate Excel from attachment files
      const excelFile = files.find(f => /\.(xlsx?|csv)$/i.test(f.name));
      const attachFiles = files.filter(f => !/\.(xlsx?|csv)$/i.test(f.name));

      console.log('[Import] Files selected:', files.map(f => f.name));
      console.log('[Import] Excel:', excelFile?.name, 'Attachments:', attachFiles.map(f => f.name));

      if (!excelFile) {
        toast.error('No Excel file found. Please include an .xlsx or .csv file.');
        setExcelImporting(false);
        return;
      }

      // Build a map of attachment files by name (lowercase)
      const attachMap = new Map<string, File>();
      attachFiles.forEach(f => attachMap.set(f.name.toLowerCase(), f));

      const data = await excelFile.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const expenseDate = r['expense date'] || r['Expense Date'] || r['date'] || r['Date'] || '';
        const projectName = r['project name'] || r['Project Name'] || r['project'] || r['Project'] || '';
        const expenseType = r['expense type'] || r['Expense Type'] || r['type'] || r['Type'] || 'Other';
        const description = r['description'] || r['Description'] || '';
        const amount = r['amount'] || r['Amount'] || 0;
        const attachment = r['attachment'] || r['Attachment'] || r['file'] || r['File'] || '';

        // Parse date
        let dateStr = '';
        if (expenseDate) {
          if (typeof expenseDate === 'number') {
            const d = new Date((expenseDate - 25569) * 86400 * 1000);
            dateStr = format(d, 'yyyy-MM-dd');
          } else {
            try { dateStr = format(new Date(expenseDate), 'yyyy-MM-dd'); } catch { dateStr = String(expenseDate); }
          }
        }

        if (!dateStr || !amount) {
          results.push({ row: i + 2, date: dateStr, type: expenseType, amount: String(amount), success: false, error: 'Missing date or amount' });
          continue;
        }

        // Find project by name
        let projectId: string | undefined;
        if (projectName) {
          const match = projects.find((p: any) => (p.projectName ?? p.project_name ?? '').toLowerCase() === String(projectName).toLowerCase());
          if (match) projectId = String(match.id);
        }

        // Find attachment file
        const attachFile = attachment ? attachMap.get(String(attachment).toLowerCase()) : undefined;

        console.log(`[Row ${i + 2}]`, { dateStr, projectName, projectId, expenseType, description, amount, attachment, attachFileFound: !!attachFile });

        try {
          const fd = new FormData();
          fd.append('expenseDate', dateStr);
          fd.append('expenseType', String(expenseType));
          fd.append('amount', String(amount));
          if (description) fd.append('description', String(description));
          if (projectId) fd.append('projectId', projectId);
          if (attachFile) fd.append('file', attachFile);

          const createFn = isAdmin ? adminExpensesApi.create : expensesApi.create;
          await createFn(fd);
          results.push({ row: i + 2, date: dateStr, type: String(expenseType), amount: String(amount), success: true });
        } catch (err: any) {
          results.push({ row: i + 2, date: dateStr, type: String(expenseType), amount: String(amount), success: false, error: err?.response?.data?.message ?? 'Failed' });
        }
      }

      setImportResults(results);
      setImportDialogOpen(true);
      qc.invalidateQueries({ queryKey: ['expenses'] });
      const successCount = results.filter(r => r.success).length;
      toast.success(`Imported ${successCount}/${rows.length} expenses`);
    } catch (err) {
      toast.error('Failed to read Excel file');
    } finally {
      setExcelImporting(false);
    }
  };

  // Mobile / tablet expense card — used inside both the team-grouped
  // layout and the my-tab flat list when the viewport is below md.
  // Inline closure so it captures all the mutations / role flags.
  const renderMobileExpenseCard = (exp: any, showTeamActions: boolean) => {
    const myId = (user as any)?.id;
    const isOwnAdminExpense = isAdmin && exp.submitterType === 'admin' && exp.submitterAdminId === myId;
    const isOwnHrExpense = isHr && exp.employeeId != null && exp.employeeId === myId;
    const canActionRow = showTeamActions && canApprove && exp.status === 'pending'
      && !isOwnAdminExpense && !isOwnHrExpense;
    const canDelete = isAdmin || (isEmployee && exp.status === 'pending');
    const paid = !!exp.paid;
    const paidCls = paid
      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30'
      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/30';
    return (
      <div
        key={exp.id}
        role="button"
        tabIndex={0}
        onClick={() => router.push(`/expenses/${exp.id}`)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            router.push(`/expenses/${exp.id}`);
          }
        }}
        className="rounded-xl border bg-card p-3 shadow-sm cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
      >
        {/* Row 1: date + status pill */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold">
            {exp.expenseDate ? format(new Date(exp.expenseDate + 'T00:00:00'), 'dd MMM yyyy') : '—'}
            {exp.expenseDateTo && exp.expenseDateTo !== exp.expenseDate
              ? ` — ${format(new Date(exp.expenseDateTo + 'T00:00:00'), 'dd MMM')}`
              : ''}
          </span>
          <Badge className={`text-[10px] border-0 shrink-0 ${STATUS_COLORS[exp.status] ?? ''}`}>{exp.status}</Badge>
        </div>
        {/* Row 2: type + project */}
        <p className="mt-1 text-sm font-semibold truncate">{exp.expenseType}</p>
        {exp.project?.projectName && (
          <p className="text-[11px] text-muted-foreground truncate">{exp.project.projectName}</p>
        )}
        {/* Row 3: amount + paid pill + proof */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-base font-bold tabular-nums">{'₹'}{Number(exp.amount).toLocaleString('en-IN')}</span>
          <div className="flex items-center gap-2" onClick={(ev) => ev.stopPropagation()}>
            {exp.status === 'approved' && (
              canMarkPaid ? (
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 transition hover:opacity-80 ${paidCls}`}
                  disabled={paidMut.isPending}
                  onClick={() => paidMut.mutate({ id: exp.id, paid: !paid })}
                >
                  {paid ? 'Paid' : 'Unpaid'}
                </button>
              ) : (
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${paidCls}`}>
                  {paid ? 'Paid' : 'Unpaid'}
                </span>
              )
            )}
            {exp.attachmentPath && (
              <a
                href={(exp.attachmentPath?.startsWith('http') ? exp.attachmentPath : `${apiBase}${exp.attachmentPath}`)}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
                onClick={(ev) => ev.stopPropagation()}
                title="Open attachment"
              >
                {exp.attachmentName?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                  ? <ImageIcon className="h-4 w-4" />
                  : <FileText className="h-4 w-4" />}
              </a>
            )}
          </div>
        </div>
        {/* Row 4: actions (if any) */}
        {(canActionRow || canDelete) && (
          <div className="mt-3 flex items-center gap-2" onClick={(ev) => ev.stopPropagation()}>
            {canActionRow && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 border-emerald-500/40 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                  onClick={() => {
                    setApproveId(exp.id);
                    setApproveAmount(String(Number(exp.amount || 0)));
                    setApproveRequestedAmt(Number(exp.amount || 0));
                    setApproveRemarks('');
                  }}
                >
                  <Check className="mr-1 h-3.5 w-3.5" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 border-rose-500/40 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                  onClick={() => { setRejectId(exp.id); setRejectReason(''); }}
                >
                  <X className="mr-1 h-3.5 w-3.5" /> Reject
                </Button>
              </>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="ghost"
                className={`text-red-500 hover:text-red-600 ${canActionRow ? '' : 'ml-auto'}`}
                onClick={() => setDeleteTarget(exp)}
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full space-y-4">
      {/* Header — title row above; controls wrap on a second row when
          the viewport can't hold the full action bar. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2"><Receipt className="h-5 w-5 text-primary shrink-0" /> Expenses</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{isAdmin ? 'Manage all employee expenses' : 'Track your expenses'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <Input
            placeholder="Search employee, type, project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 flex-1 min-w-[160px] sm:w-[220px] sm:flex-none text-xs"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><Filter className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => importInputRef.current?.click()} disabled={excelImporting}
            title="Select Excel + attachment files together. In Excel, put the filename (e.g. receipt.jpg) in the Attachment column. Embedded images in Excel cells are not supported.">
            {excelImporting ? <Loader2 className="h-4 w-4 sm:mr-1 animate-spin" /> : <Upload className="h-4 w-4 sm:mr-1" />}
            <span className="hidden sm:inline">Import</span>
          </Button>
          <input
            ref={importInputRef}
            type="file"
            className="hidden"
            multiple
            accept=".xls,.xlsx,.csv,.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx"
            onChange={(ev) => { if (ev.target.files?.length) handleImportFiles(ev.target.files); ev.target.value = ''; }}
          />
          <Button size="sm" variant="outline" onClick={exportToExcel} disabled={expenses.length === 0}>
            <FileSpreadsheet className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Export</span>
          </Button>
          <Button size="sm" onClick={() => router.push('/expenses/new')} className="ml-auto sm:ml-0">
            <Plus className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Add Expense</span><span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* Tabs for admin/HR — admins get both tabs (own + team); HR only
          gets the team tab since "my" is a separate concept for them. */}
      {canApprove && (
        <div className="flex gap-1 p-0.5 bg-muted rounded-lg w-fit">
          {(isAdmin ? (['my', 'team'] as const) : (['team'] as const)).map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === tab ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {tab === 'my' ? 'My Expenses' : 'Team Expenses'}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <Card><CardContent className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</CardContent></Card>
      ) : expenses.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No expenses found</CardContent></Card>
      ) : (canApprove && activeTab === 'team') ? (
        // Team tab — one card per employee, expenses listed inside.
        <div className="space-y-3">
          {groupedExpenses.map((g) => (
            <Card key={g.key}>
              <CardContent className="p-0">
                {/* Employee header */}
                <div className="flex items-center justify-between gap-3 border-b bg-blue-500/5 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">
                      <UserIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {g.name}{g.isAdminBucket ? ' (Admin)' : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {g.expenses.length} expense{g.expenses.length === 1 ? '' : 's'}
                        {g.pendingCount > 0 ? ` · ${g.pendingCount} pending` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
                    <p className="text-base font-bold">{'₹'}{g.total.toLocaleString('en-IN')}</p>
                  </div>
                </div>
                {/* Mobile card list (< md) — one card per expense. */}
                <div className="md:hidden p-3 space-y-2">
                  {g.expenses.map((exp: any) => renderMobileExpenseCard(exp, true))}
                </div>
                {/* Desktop table (md+) — full column set. */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Date</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Project</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Type</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Amount</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Proof</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Status</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Payment</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.expenses.map((exp: any) => (
                        <tr key={exp.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => router.push(`/expenses/${exp.id}`)}>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {exp.expenseDate ? format(new Date(exp.expenseDate + 'T00:00:00'), 'dd MMM yyyy') : '—'}
                            {exp.expenseDateTo && exp.expenseDateTo !== exp.expenseDate ? ` — ${format(new Date(exp.expenseDateTo + 'T00:00:00'), 'dd MMM')}` : ''}
                          </td>
                          <td className="px-3 py-2">{exp.project?.projectName ?? '—'}</td>
                          <td className="px-3 py-2">{exp.expenseType}</td>
                          <td className="px-3 py-2 text-right font-semibold">{'₹'}{Number(exp.amount).toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-center">
                            {exp.attachmentPath ? (
                              <a href={(exp.attachmentPath?.startsWith('http') ? exp.attachmentPath : `${apiBase}${exp.attachmentPath}`)} target="_blank" rel="noreferrer" className="text-primary hover:underline" onClick={(ev) => ev.stopPropagation()}>
                                {exp.attachmentName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? <ImageIcon className="h-4 w-4 inline" /> : <FileText className="h-4 w-4 inline" />}
                              </a>
                            ) : '—'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge className={`text-[10px] border-0 ${STATUS_COLORS[exp.status] ?? ''}`}>{exp.status}</Badge>
                          </td>
                          <td className="px-3 py-2 text-center" onClick={(ev) => ev.stopPropagation()}>
                            {(() => {
                              if (exp.status !== 'approved') {
                                return <span className="text-xs text-muted-foreground">—</span>;
                              }
                              const paid = !!exp.paid;
                              const cls = paid
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/30';
                              if (canMarkPaid) {
                                return (
                                  <button
                                    type="button"
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 transition hover:opacity-80 ${cls}`}
                                    disabled={paidMut.isPending}
                                    onClick={() => paidMut.mutate({ id: exp.id, paid: !paid })}
                                    title={paid ? 'Click to mark unpaid' : 'Click to mark paid'}
                                  >
                                    {paid ? 'Paid' : 'Unpaid'}
                                  </button>
                                );
                              }
                              return (
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${cls}`}>
                                  {paid ? 'Paid' : 'Unpaid'}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-3 py-2 text-center" onClick={(ev) => ev.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              {(() => {
                                const myId = (user as any)?.id;
                                const isOwnAdminExpense =
                                  isAdmin && exp.submitterType === 'admin' && exp.submitterAdminId === myId;
                                const isOwnHrExpense =
                                  isHr && exp.employeeId != null && exp.employeeId === myId;
                                const showActions =
                                  canApprove && exp.status === 'pending'
                                  && !isOwnAdminExpense && !isOwnHrExpense;
                                if (!showActions) return null;
                                return (
                                  <>
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-emerald-600" onClick={() => { setApproveId(exp.id); setApproveAmount(String(Number(exp.amount || 0))); setApproveRequestedAmt(Number(exp.amount || 0)); setApproveRemarks(''); }} title="Approve">
                                      <Check className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-600" onClick={() => { setRejectId(exp.id); setRejectReason(''); }} title="Reject">
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                );
                              })()}
                              {(isAdmin || (isEmployee && exp.status === 'pending')) && (
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => setDeleteTarget(exp)} title="Delete">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
        {/* Mobile card list for My tab (< md). */}
        <div className="md:hidden space-y-2">
          {expenses.map((exp: any) => renderMobileExpenseCard(exp, false))}
        </div>
        {/* Desktop table for My tab (md+). */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Project</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Type</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Amount</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Proof</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Payment</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp: any) => (
                    <tr key={exp.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => router.push(`/expenses/${exp.id}`)}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {exp.expenseDate ? format(new Date(exp.expenseDate + 'T00:00:00'), 'dd MMM yyyy') : '—'}
                        {exp.expenseDateTo && exp.expenseDateTo !== exp.expenseDate ? ` — ${format(new Date(exp.expenseDateTo + 'T00:00:00'), 'dd MMM')}` : ''}
                      </td>
                      <td className="px-3 py-2">{exp.project?.projectName ?? '—'}</td>
                      <td className="px-3 py-2">{exp.expenseType}</td>
                      <td className="px-3 py-2 text-right font-semibold">{'₹'}{Number(exp.amount).toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2 text-center">
                        {exp.attachmentPath ? (
                          <a href={(exp.attachmentPath?.startsWith('http') ? exp.attachmentPath : `${apiBase}${exp.attachmentPath}`)} target="_blank" rel="noreferrer" className="text-primary hover:underline" onClick={(ev) => ev.stopPropagation()}>
                            {exp.attachmentName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? <ImageIcon className="h-4 w-4 inline" /> : <FileText className="h-4 w-4 inline" />}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge className={`text-[10px] border-0 ${STATUS_COLORS[exp.status] ?? ''}`}>{exp.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-center" onClick={(ev) => ev.stopPropagation()}>
                        {(() => {
                          if (exp.status !== 'approved') {
                            return <span className="text-xs text-muted-foreground">—</span>;
                          }
                          const paid = !!exp.paid;
                          const cls = paid
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/30';
                          if (canMarkPaid) {
                            return (
                              <button
                                type="button"
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 transition hover:opacity-80 ${cls}`}
                                disabled={paidMut.isPending}
                                onClick={() => paidMut.mutate({ id: exp.id, paid: !paid })}
                                title={paid ? 'Click to mark unpaid' : 'Click to mark paid'}
                              >
                                {paid ? 'Paid' : 'Unpaid'}
                              </button>
                            );
                          }
                          return (
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${cls}`}>
                              {paid ? 'Paid' : 'Unpaid'}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2 text-center" onClick={(ev) => ev.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {(isAdmin || (isEmployee && exp.status === 'pending')) && (
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => setDeleteTarget(exp)} title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        </>
      )}

      {/* Add Expense Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Date *</label>
                <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Amount (₹) *</label>
                <Input type="number" placeholder="0.00" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Expense Type *</label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Project</label>
                <Select value={formProjectId || 'none'} onValueChange={(v) => setFormProjectId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {projects.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.projectName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Input placeholder="What was the expense for?" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Attachment / Proof</label>
              <div className="flex items-center gap-2 mt-1">
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="h-8 text-xs">
                  <Upload className="h-3 w-3 mr-1" /> {formFile ? formFile.name : 'Choose file'}
                </Button>
                {formFile && <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => setFormFile(null)}><X className="h-3 w-3" /></Button>}
                <input ref={fileRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => setFormFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
            <Button className="w-full" disabled={!formDate || !formAmount || !formType || createMut.isPending} onClick={() => createMut.mutate()}>
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Add Expense
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={!!approveId} onOpenChange={(open) => { if (!open) { setApproveId(null); setApproveAmount(''); setApproveRemarks(''); } }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Approve Expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
              <span className="text-xs text-muted-foreground">Requested Amount</span>
              <span className="text-lg font-bold">{'\u20B9'}{approveRequestedAmt.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Approved Amount *</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={approveAmount}
                onChange={(e) => setApproveAmount(e.target.value)}
                className="mt-1"
                placeholder="Enter approved amount"
              />
              {Number(approveAmount) < approveRequestedAmt && Number(approveAmount) > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  Partial approval: {'\u20B9'}{(approveRequestedAmt - Number(approveAmount)).toLocaleString('en-IN')} less than requested
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Remarks {Number(approveAmount) < approveRequestedAmt ? '*' : '(optional)'}</label>
              <textarea
                value={approveRemarks}
                onChange={(e) => setApproveRemarks(e.target.value)}
                placeholder={Number(approveAmount) < approveRequestedAmt ? 'Reason for partial approval...' : 'Optional remarks...'}
                rows={2}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setApproveId(null); setApproveAmount(''); setApproveRemarks(''); }}>Cancel</Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={!approveAmount || Number(approveAmount) <= 0 || (Number(approveAmount) < approveRequestedAmt && !approveRemarks.trim()) || statusMut.isPending}
                onClick={() => approveId && statusMut.mutate({
                  id: approveId,
                  status: 'approved',
                  approvedAmount: Number(approveAmount),
                  remarks: approveRemarks.trim() || undefined,
                })}
              >
                {statusMut.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Approve
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog open={!!rejectId} onOpenChange={(open) => { if (!open) { setRejectId(null); setRejectReason(''); } }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Reject Expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Reason for Rejection *</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                rows={3}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setRejectId(null); setRejectReason(''); }}>Cancel</Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!rejectReason.trim() || statusMut.isPending}
                onClick={() => rejectId && statusMut.mutate({ id: rejectId, status: 'rejected', remarks: rejectReason.trim() })}
              >
                {statusMut.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Results Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Expense Import Results
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm mb-2">
            <span className="text-emerald-600 font-semibold">{importResults.filter(r => r.success).length} success</span>
            {' · '}
            <span className="text-red-600 font-semibold">{importResults.filter(r => !r.success).length} failed</span>
            {' · '}
            <span className="text-muted-foreground">{importResults.length} total</span>
          </div>
          <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-1.5">
            {importResults.map((r, i) => (
              <div key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${r.success ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                {r.success
                  ? <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  : <X className="h-4 w-4 text-red-500 shrink-0" />
                }
                <span className="text-muted-foreground text-xs font-mono w-8 shrink-0">#{r.row}</span>
                <span className="font-medium truncate">{r.type}</span>
                <span className="text-xs text-muted-foreground">{r.date}</span>
                <span className="ml-auto font-semibold whitespace-nowrap">{'\u20B9'}{r.amount}</span>
                {!r.success && r.error && (
                  <span className="text-[10px] text-red-500 truncate max-w-[120px]" title={r.error}>{r.error}</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-3 border-t">
            <p className="text-[10px] text-muted-foreground max-w-[280px]">
              To attach files: put the filename (e.g. receipt.jpg) in the Attachment column, then select Excel + files together.
            </p>
            <Button onClick={() => setImportDialogOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" /> Delete expense?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete this expense
            {deleteTarget ? (
              <> — <span className="font-semibold text-foreground">{deleteTarget.expenseType}</span>
                {' '}({'₹'}{Number(deleteTarget.amount || 0).toLocaleString('en-IN')})</>
            ) : null}. This action cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              {deleteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
