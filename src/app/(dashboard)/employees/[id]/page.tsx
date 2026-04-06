/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft, Mail, Phone, FileText, Download, Paperclip, Upload, Trash2, Loader2,
  User, Shield, KeyRound, Eye, EyeOff, CheckCircle2,
} from 'lucide-react';
import { employeesApi } from '@/lib/api/employees';
import { authApi } from '@/lib/api/auth';
import { useAuth } from '@/providers/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';

const AVATAR_GRADIENTS = [
  'from-pink-500 to-rose-600', 'from-violet-500 to-purple-600',
  'from-indigo-500 to-blue-600', 'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
];

const TYPE_LABELS: Record<string, string> = {
  project_manager: 'Project Manager', functional: 'Functional Consultant',
  technical: 'Technical Consultant', management: 'Management', core_team: 'Core Team',
};

const CATEGORY_LABELS: Record<string, string> = {
  aadhaar: 'Aadhaar Card', pan: 'PAN Card', joining: 'Joining Doc', exit: 'Exit Doc', other: 'Other',
};

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

type Tab = 'profile' | 'documents' | 'security';

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isEmployee = user?._type === 'employee';
  const isAdmin = user?._type === 'admin';
  const isHr = isEmployee && !!(user as any)?.isHr;
  const canManageAllDocs = isAdmin || isHr;
  const targetType = searchParams.get('type') ?? 'employee';
  const isSelf = (targetType === 'employee' && isEmployee && Number(id) === user?.id) ||
                 (targetType === 'admin' && isAdmin && Number(id) === user?.id);
  const canUploadDocs = canManageAllDocs || isSelf;

  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [docCategory, setDocCategory] = useState('other');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';

  // Edit profile state (admin/HR or self)
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editType, setEditType] = useState('');
  const [editJoiningDate, setEditJoiningDate] = useState('');
  const [editIsHr, setEditIsHr] = useState(false);
  const [editFillDays, setEditFillDays] = useState('');
  const [editMonthlyCTC, setEditMonthlyCTC] = useState('');
  const [editReportsToId, setEditReportsToId] = useState<string>('');
  const canEdit = canManageAllDocs || isSelf; // admin, HR, or self

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: emp, isLoading } = useQuery({
    queryKey: ['employee-detail', id, targetType],
    queryFn: () => {
      if (targetType === 'admin' && isAdmin) return employeesApi.getAdmin(Number(id)).then((r) => r.data.data);
      return (isEmployee ? employeesApi.employeeGetOne(Number(id)) : employeesApi.getOne(Number(id))).then((r) => r.data.data);
    },
    enabled: !!id,
  });

  // Use admin or employee API based on logged-in user role
  const docApi = {
    get: isAdmin ? employeesApi.getDocuments : employeesApi.employeeGetDocuments,
    upload: isAdmin ? employeesApi.uploadDocument : employeesApi.employeeUploadDocument,
    del: isAdmin ? employeesApi.deleteDocument : employeesApi.employeeDeleteDocument,
  };

  const { data: docs, isLoading: docsLoading } = useQuery({
    queryKey: ['employee-documents', targetType, id],
    queryFn: () => {
      if (isSelf && isEmployee) return employeesApi.getMyDocuments().then((r: any) => r.data?.data ?? r.data ?? []);
      return docApi.get(targetType, Number(id)).then((r: any) => r.data?.data ?? r.data ?? []);
    },
    enabled: !!id && activeTab === 'documents',
  });

  // Employee list for "Reports To" dropdown — load for admin/HR always
  const { data: allEmployeesRaw } = useQuery({
    queryKey: ['all-employees-for-reports-to'],
    queryFn: async () => {
      const r = await employeesApi.getAll({ limit: 100 });
      return r.data;
    },
    enabled: !!user && (isAdmin || isHr),
  });
  const allEmployees: any[] = (() => {
    const d = allEmployeesRaw as any;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.data)) return d.data;
    return [];
  })();
  const startEdit = () => {
    if (!emp) return;
    setEditName(emp.empName ?? '');
    setEditEmail(emp.email ?? '');
    setEditPhone(emp.mobileNumber ?? '');
    setEditDob(emp.dateOfBirth ?? '');
    setEditType(emp.consultantType ?? '');
    setEditJoiningDate(emp.joiningDate ?? '');
    setEditIsHr(!!emp.isHr);
    setEditFillDays(emp.fillDaysOverride != null ? String(emp.fillDaysOverride) : '');
    setEditMonthlyCTC(emp.monthlyCTC != null ? String(emp.monthlyCTC) : '');
    setEditReportsToId(
      (emp as any).isReportToAdmin && (emp as any).reportsToAdminId
        ? `adm-${(emp as any).reportsToAdminId}`
        : emp.reportsToId ? `emp-${emp.reportsToId}` : 'none'
    );
    setEditMode(true);
  };

  const saveProfileMut = useMutation({
    mutationFn: async () => {
      if (isSelf && isEmployee) {
        // Employee self-update (limited fields)
        return employeesApi.updateSelf({ empName: editName, mobileNumber: editPhone, dateOfBirth: editDob || undefined });
      }
      // Admin/HR update (all fields)
      const [reportsType, reportsIdStr] = editReportsToId && editReportsToId !== 'none' ? editReportsToId.split('-') : [null, null];
      const isReportToAdmin = reportsType === 'adm';
      const reportsToId = reportsType === 'emp' ? Number(reportsIdStr) : null;
      const reportsToAdminId = reportsType === 'adm' ? Number(reportsIdStr) : null;
      const dto: any = { empName: editName, email: editEmail, mobileNumber: editPhone, dateOfBirth: editDob || undefined, consultantType: editType, joiningDate: editJoiningDate || undefined, isHr: editIsHr, isReportToAdmin, reportsToId, reportsToAdminId, fillDaysOverride: editFillDays ? Number(editFillDays) : null, monthlyCTC: editMonthlyCTC ? Number(editMonthlyCTC) : null };
      return employeesApi.update(Number(id), dto);
    },
    onSuccess: () => {
      toast.success('Profile updated');
      setEditMode(false);
      qc.invalidateQueries({ queryKey: ['employee-detail', id] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Update failed'),
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) => {
      // Employee self-upload (aadhaar/pan only)
      if (isSelf && isEmployee) return employeesApi.uploadMyDocument(file, docCategory);
      return docApi.upload(targetType, Number(id), file, docCategory);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-documents', targetType, id] });
      toast.success('Document uploaded');
      setDocCategory('other');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Upload failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (docId: number) => docApi.del(docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-documents', targetType, id] });
      toast.success('Document deleted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Delete failed'),
  });

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (newPassword.length < 6) { toast.error('Min 6 characters'); return; }
    setSaving(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success('Password changed');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed');
    } finally { setSaving(false); }
  };

  const passwordStrength = (() => {
    if (!newPassword) return null;
    if (newPassword.length < 6) return { label: 'Too short', color: 'bg-red-500', width: 'w-1/4' };
    if (newPassword.length < 8 || !/[0-9]/.test(newPassword)) return { label: 'Weak', color: 'bg-amber-500', width: 'w-2/4' };
    if (!/[^a-zA-Z0-9]/.test(newPassword)) return { label: 'Medium', color: 'bg-yellow-500', width: 'w-3/4' };
    return { label: 'Strong', color: 'bg-emerald-500', width: 'w-full' };
  })();

  // Documents tab visible to: admin, HR, or the employee viewing their own profile
  const canViewDocs = canManageAllDocs || isSelf;

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'profile', label: 'Profile', icon: User },
    ...(canViewDocs ? [{ key: 'documents' as Tab, label: 'Documents', icon: Paperclip }] : []),
    ...(isSelf ? [{ key: 'security' as Tab, label: 'Security', icon: Shield }] : []),
  ];

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-1" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      ) : !emp ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Employee not found.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">

          {/* ── Left sidebar ─────────────────────── */}
          <div className="space-y-3">
            {/* Avatar + info */}
            <Card className="overflow-hidden shadow-sm">
              <div className={`bg-linear-to-br ${AVATAR_GRADIENTS[emp.id % AVATAR_GRADIENTS.length]} p-5 flex flex-col items-center gap-2`}>
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm text-white text-2xl font-bold ring-4 ring-white/30 shadow-xl">
                  {getInitials(emp.empName)}
                </div>
                <p className="font-bold text-white text-sm leading-tight truncate max-w-full">{emp.empName}</p>
                <p className="text-white/70 text-xs">{emp.email}</p>
                <Badge className={`text-[10px] border-0 ${emp.isActive ? 'bg-emerald-500/20 text-emerald-100' : 'bg-red-500/20 text-red-100'}`}>
                  {emp.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </Card>

            {/* Tab nav */}
            <Card className="shadow-sm">
              <CardContent className="p-2">
                {tabs.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === key
                        ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* ── Right content ─────────────────────── */}
          <div className="space-y-4">

            {/* Header card */}
            <Card className="shadow-sm">
              <CardContent className="px-5 py-4 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-slate-800 to-slate-900 text-white text-xl font-bold shrink-0">
                  {getInitials(emp.empName)}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-bold">{emp.empName}</h1>
                  <p className="text-sm text-muted-foreground">
                    {TYPE_LABELS[emp.consultantType] ?? emp.consultantType}
                    {emp.isHr ? ' · HR' : ''}
                  </p>
                  {emp.mobileNumber && <p className="text-xs text-muted-foreground mt-0.5">{emp.mobileNumber}</p>}
                </div>
              </CardContent>
            </Card>

            {/* ── Profile tab ───────────────────────── */}
            {activeTab === 'profile' && (
              <Card className="shadow-sm">
                <CardContent className="px-5 py-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold">Personal Information</h2>
                    {canEdit && targetType !== 'admin' && !editMode && (
                      <Button size="sm" variant="outline" onClick={startEdit}>Edit</Button>
                    )}
                    {editMode && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditMode(false)}>Cancel</Button>
                        <Button size="sm" onClick={() => saveProfileMut.mutate()} disabled={saveProfileMut.isPending}>
                          {saveProfileMut.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Save
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-5 gap-x-8">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Full Name</p>
                      {editMode ? <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm" /> : <p className="text-sm font-medium">{emp.empName}</p>}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Email Address</p>
                      {editMode && canManageAllDocs ? <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="h-8 text-sm" /> : <p className="text-sm font-medium">{emp.email}</p>}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Phone Number</p>
                      {editMode ? <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="h-8 text-sm" /> : <p className="text-sm font-medium">{emp.mobileNumber || '—'}</p>}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Date of Birth</p>
                      {editMode ? <Input type="date" value={editDob} onChange={(e) => setEditDob(e.target.value)} className="h-8 text-sm" /> : <p className="text-sm font-medium">{emp.dateOfBirth ? format(new Date(emp.dateOfBirth + 'T00:00:00'), 'dd MMM yyyy') : '—'}</p>}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">User Role</p>
                      {editMode && canManageAllDocs ? (
                        <Select value={editType} onValueChange={setEditType}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : <p className="text-sm font-medium uppercase">{targetType === 'admin' ? 'Admin' : TYPE_LABELS[emp.consultantType] ?? emp.consultantType}</p>}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Joined</p>
                      {editMode && canManageAllDocs ? (
                        <Input type="date" value={editJoiningDate} onChange={(e) => setEditJoiningDate(e.target.value)} className="h-8 text-sm" />
                      ) : <p className="text-sm font-medium">{emp.joiningDate ? format(new Date(emp.joiningDate + 'T00:00:00'), 'dd MMM yyyy') : emp.createdAt ? format(new Date(emp.createdAt), 'dd MMM yyyy') : '—'}</p>}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Employee Code</p>
                      <p className="text-sm font-medium font-mono">{emp.empCode ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Reports To</p>
                      {editMode && canManageAllDocs ? (
                        <SearchableSelect
                          value={editReportsToId}
                          onValueChange={setEditReportsToId}
                          placeholder="Search employee..."
                          className="h-8 text-sm"
                          options={[
                            { value: 'none', label: 'None' },
                            ...allEmployees
                              .filter((e: any) => e.id !== Number(id) && e.isActive !== false)
                              .filter((e: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === e.id && x._type === e._type) === i)
                              .map((e: any) => ({
                                value: `${e._type === 'admin' ? 'adm' : 'emp'}-${e.id}`,
                                label: `${e.empName}${e._type === 'admin' ? ' (Admin)' : ''} — ${e.empCode}`,
                              })),
                          ]}
                        />
                      ) : <p className="text-sm font-medium">
                          {(emp as any).isReportToAdmin
                            ? (emp as any).reportsToAdmin?.name ?? '—'
                            : emp.reportsTo?.empName ?? '—'}
                        </p>}
                    </div>
                    {emp.assignedProject && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Assigned Project</p>
                        <p className="text-sm font-medium">{emp.assignedProject.projectName}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Status</p>
                      <Badge className={`text-xs border-0 ${emp.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                        {emp.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">HR Access</p>
                      {editMode && canManageAllDocs ? (
                        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                          <input type="checkbox" checked={editIsHr} onChange={(e) => setEditIsHr(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                          {editIsHr ? 'Yes' : 'No'}
                        </label>
                      ) : (
                        <p className="text-sm font-medium">{emp.isHr ? 'Yes' : 'No'}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Fill Days</p>
                      {editMode && canManageAllDocs ? (
                        <div className="flex items-center gap-1.5">
                          <Input type="number" min={1} max={365} placeholder="Default (3)" value={editFillDays} onChange={(e) => setEditFillDays(e.target.value)} className="h-8 text-sm w-24" />
                          {editFillDays && <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => setEditFillDays('')}>Reset</Button>}
                        </div>
                      ) : (
                        <p className="text-sm font-medium">{emp.fillDaysOverride ?? 'Default (3)'}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Monthly CTC</p>
                      {editMode && canManageAllDocs ? (
                        <Input type="number" min={0} step="100" placeholder="e.g. 50000" value={editMonthlyCTC} onChange={(e) => setEditMonthlyCTC(e.target.value)} className="h-8 text-sm" />
                      ) : (
                        <p className="text-sm font-medium">{emp.monthlyCTC ? `₹${Number(emp.monthlyCTC).toLocaleString('en-IN')}` : '—'}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Documents tab ─────────────────────── */}
            {activeTab === 'documents' && (
              <Card className="shadow-sm">
                <CardContent className="px-5 py-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold">Documents</h2>
                    {canUploadDocs && (
                      <div className="flex items-center gap-2">
                        <Select value={docCategory} onValueChange={setDocCategory}>
                          <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="aadhaar">Aadhaar Card</SelectItem>
                            <SelectItem value="pan">PAN Card</SelectItem>
                            {canManageAllDocs && (
                              <>
                                <SelectItem value="joining">Joining Doc</SelectItem>
                                <SelectItem value="exit">Exit Doc</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <input
                          ref={fileInputRef} type="file" className="hidden"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadMut.mutate(f);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                        />
                        <Button size="sm" variant="outline" disabled={uploadMut.isPending} onClick={() => fileInputRef.current?.click()}>
                          {uploadMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                          Upload
                        </Button>
                      </div>
                    )}
                  </div>

                  {docsLoading ? (
                    <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
                  ) : !(docs as any[])?.length ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No documents uploaded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {(docs as any[]).map((doc: any) => (
                        <div key={doc.id} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/30 transition-colors">
                          <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-violet-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{doc.originalName}</p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                              <span className="capitalize rounded bg-violet-500/10 px-1.5 py-0.5 text-violet-600 dark:text-violet-400">
                                {CATEGORY_LABELS[doc.category] ?? doc.category}
                              </span>
                              <span>{(doc.fileSize / 1024).toFixed(0)} KB</span>
                              <span>by {doc.uploadedByName}</span>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <a href={`${apiBase}${doc.filePath}`} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" className="h-8 w-8"><Download className="h-4 w-4" /></Button>
                            </a>
                            {canManageAllDocs && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600"
                                disabled={deleteMut.isPending}
                                onClick={() => { if (confirm(`Delete "${doc.originalName}"?`)) deleteMut.mutate(doc.id); }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Security tab (only for own profile) ───── */}
            {activeTab === 'security' && isSelf && (
              <Card className="shadow-sm">
                <CardContent className="px-5 py-4">
                  <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-amber-500" /> Change Password
                  </h2>
                  <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Current Password</label>
                      <div className="relative">
                        <Input type={showCurrent ? 'text' : 'password'} value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)} required className="pr-9" />
                        <button type="button" onClick={() => setShowCurrent(v => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">New Password</label>
                      <div className="relative">
                        <Input type={showNew ? 'text' : 'password'} value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)} required className="pr-9" />
                        <button type="button" onClick={() => setShowNew(v => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {passwordStrength && (
                        <div className="space-y-0.5">
                          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${passwordStrength.color} ${passwordStrength.width}`} />
                          </div>
                          <p className="text-[10px] font-medium text-muted-foreground">{passwordStrength.label}</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Confirm Password</label>
                      <div className="relative">
                        <Input type={showConfirm ? 'text' : 'password'} value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)} required
                          className={`pr-9 ${confirmPassword && confirmPassword !== newPassword ? 'border-red-500' : confirmPassword && confirmPassword === newPassword ? 'border-emerald-500' : ''}`} />
                        <button type="button" onClick={() => setShowConfirm(v => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {confirmPassword && confirmPassword === newPassword && (
                        <p className="text-[10px] text-emerald-500 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Passwords match</p>
                      )}
                    </div>
                    <Button type="submit" disabled={saving}
                      className="bg-linear-to-r from-indigo-500 to-violet-600 text-white hover:opacity-90 border-0">
                      <KeyRound className="mr-1.5 h-4 w-4" />
                      {saving ? 'Updating…' : 'Update Password'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
