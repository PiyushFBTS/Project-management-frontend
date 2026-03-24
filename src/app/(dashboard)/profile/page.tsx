/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { authApi } from '@/lib/api/auth';
import { employeesApi } from '@/lib/api/employees';
import { Employee } from '@/types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  KeyRound, Eye, EyeOff, CheckCircle2, Pencil,
  FileText, Download, Paperclip, User, Shield, Loader2, Upload, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const AVATAR_GRADIENTS = [
  'from-indigo-500 to-violet-600', 'from-pink-500 to-rose-600',
  'from-emerald-500 to-teal-600', 'from-amber-500 to-orange-600',
  'from-blue-500 to-indigo-600',
];

const consultantTypeLabels: Record<string, string> = {
  project_manager: 'Project Manager', functional: 'Functional Consultant',
  technical: 'Technical Consultant', management: 'Management', core_team: 'Core Team',
};

const CATEGORY_LABELS: Record<string, string> = {
  aadhaar: 'Aadhaar Card', pan: 'PAN Card', joining: 'Joining Doc', exit: 'Exit Doc', other: 'Other',
};

type Tab = 'profile' | 'documents' | 'security';

export default function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Edit state
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDob, setEditDob] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEmp = user?._type === 'employee';
  const isAdmin = user?._type === 'admin';
  const emp = isEmp ? (user as Employee & { _type: 'employee' }) : null;

  const displayName = user
    ? isEmp ? (user as any).empName : (user as any).name ?? (user as any).fullName
    : '';

  const initials = displayName
    ? displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const roleLabel = isEmp
    ? (emp?.isHr ? 'HR Employee' : 'Employee')
    : (user as any)?.role === 'super_admin' ? 'Super Admin' : 'Admin';

  const gradient = AVATAR_GRADIENTS[(user?.id ?? 0) % AVATAR_GRADIENTS.length];
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';

  // Documents
  const qc = useQueryClient();
  const [docCategory, setDocCategory] = useState('aadhaar');
  const docFileRef = useRef<HTMLInputElement>(null);

  const { data: docs, isLoading: docsLoading } = useQuery({
    queryKey: ['my-documents', isEmp ? 'employee' : 'admin', user?.id],
    queryFn: () =>
      isEmp
        ? employeesApi.getMyDocuments().then((r: any) => r.data?.data ?? r.data ?? [])
        : employeesApi.getDocuments('admin', user!.id).then((r: any) => r.data?.data ?? r.data ?? []),
    enabled: !!user?.id && activeTab === 'documents',
  });

  const uploadMyDocMut = useMutation({
    mutationFn: (file: File) => {
      if (isEmp) return employeesApi.uploadMyDocument(file, docCategory);
      return employeesApi.uploadDocument('admin', user!.id, file, docCategory);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-documents'] });
      toast.success('Document uploaded');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Upload failed'),
  });

  const openEdit = () => {
    setEditName(emp?.empName ?? '');
    setEditPhone(emp?.mobileNumber ?? '');
    setEditDob(emp?.dateOfBirth ?? '');
    setEditMode(true);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await employeesApi.updateSelf({
        empName: editName || undefined,
        mobileNumber: editPhone || undefined,
        dateOfBirth: editDob || undefined,
      });
      await refreshProfile();
      toast.success('Profile updated');
      setEditMode(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed');
    } finally { setSavingProfile(false); }
  };

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

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'documents', label: 'Documents', icon: Paperclip },
    { key: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">

      {/* ── Left sidebar ──────────────────────── */}
      <div className="space-y-3">
        {/* Avatar card */}
        <Card className="overflow-hidden shadow-sm">
          <div className={`bg-linear-to-br ${gradient} p-5 flex flex-col items-center gap-2`}>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm text-white text-2xl font-bold ring-4 ring-white/30 shadow-xl">
              {initials}
            </div>
            <p className="font-bold text-white text-sm leading-tight truncate max-w-full">{displayName || '—'}</p>
            <p className="text-white/70 text-xs">{user?.email}</p>
            <Badge className="text-[10px] border-0 bg-emerald-500/20 text-emerald-100">Active</Badge>
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
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold">{displayName}</h1>
              <p className="text-sm text-muted-foreground">{roleLabel}</p>
              {isEmp && emp?.mobileNumber && <p className="text-xs text-muted-foreground mt-0.5">{emp.mobileNumber}</p>}
            </div>
          </CardContent>
        </Card>

        {/* ── Profile tab ──────────────────────── */}
        {activeTab === 'profile' && (
          <Card className="shadow-sm">
            <CardContent className="px-5 py-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold">Personal Information</h2>
                {isEmp && !editMode && (
                  <Button variant="ghost" size="sm" onClick={openEdit} className="gap-1 text-xs text-muted-foreground">
                    <Pencil className="h-3 w-3" /> Edit
                  </Button>
                )}
                {isEmp && editMode && (
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => setEditMode(false)} className="text-xs">Cancel</Button>
                    <Button size="sm" disabled={savingProfile} onClick={handleSaveProfile}
                      className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white border-0">
                      {savingProfile ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      Save
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-5 gap-x-8">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Full Name</p>
                  {isEmp && editMode ? (
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm" />
                  ) : (
                    <p className="text-sm font-medium">{displayName}</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Email Address</p>
                  <p className="text-sm font-medium">{user?.email}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Phone Number</p>
                  {isEmp && editMode ? (
                    <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="h-8 text-sm" />
                  ) : (
                    <p className="text-sm font-medium">{isEmp ? emp?.mobileNumber || '—' : '—'}</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Date of Birth</p>
                  {isEmp && editMode ? (
                    <Input type="date" value={editDob} onChange={(e) => setEditDob(e.target.value)} className="h-8 text-sm w-40" />
                  ) : (
                    <p className="text-sm font-medium">
                      {isEmp && emp?.dateOfBirth ? format(new Date(emp.dateOfBirth + 'T00:00:00'), 'dd MMM yyyy') : '—'}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">User Role</p>
                  <p className="text-sm font-medium uppercase">{roleLabel}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Joined</p>
                  <p className="text-sm font-medium">
                    {isEmp && emp?.joiningDate
                      ? format(new Date(emp.joiningDate + 'T00:00:00'), 'dd MMM yyyy')
                      : (user as any)?.createdAt ? format(new Date((user as any).createdAt), 'dd MMM yyyy') : '—'}
                  </p>
                </div>
                {isEmp && emp?.empCode && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Employee Code</p>
                    <p className="text-sm font-medium font-mono">{emp.empCode}</p>
                  </div>
                )}
                {isEmp && emp?.consultantType && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Type</p>
                    <p className="text-sm font-medium">{consultantTypeLabels[emp.consultantType] ?? emp.consultantType}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Status</p>
                  <Badge className="text-xs border-0 bg-emerald-500/10 text-emerald-600">Active</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Documents tab ────────────────────── */}
        {activeTab === 'documents' && (
          <Card className="shadow-sm">
            <CardContent className="px-5 py-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold">My Documents</h2>
                <div className="flex items-center gap-2">
                  <Select value={docCategory} onValueChange={setDocCategory}>
                    <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aadhaar">Aadhaar Card</SelectItem>
                      <SelectItem value="pan">PAN Card</SelectItem>
                      {!isEmp && (
                        <>
                          <SelectItem value="joining">Joining Doc</SelectItem>
                          <SelectItem value="exit">Exit Doc</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <input
                    ref={docFileRef} type="file" className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadMyDocMut.mutate(f);
                      if (docFileRef.current) docFileRef.current.value = '';
                    }}
                  />
                  <Button size="sm" variant="outline" disabled={uploadMyDocMut.isPending} onClick={() => docFileRef.current?.click()}>
                    {uploadMyDocMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                    Upload
                  </Button>
                </div>
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
                      <a href={`${apiBase}${doc.filePath}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Download className="h-4 w-4" /></Button>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Security tab ─────────────────────── */}
        {activeTab === 'security' && (
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
  );
}
