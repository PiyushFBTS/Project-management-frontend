/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft, Mail, Phone, FileText, Download, Paperclip, Upload, Trash2, Loader2,
  User, Shield, KeyRound, Eye, EyeOff, CheckCircle2, Target, Lock, Ban, AlertTriangle, Plus, ChevronDown,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const AVATAR_GRADIENTS = [
  'from-pink-500 to-rose-600', 'from-violet-500 to-purple-600',
  'from-indigo-500 to-blue-600', 'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
];

const PRAISE_TYPES = [
  { value: 'money_maker', label: 'Money Maker', icon: '💰', color: 'bg-amber-100 dark:bg-amber-900/30' },
  { value: 'relentless', label: 'Relentless', icon: '🔄', color: 'bg-blue-100 dark:bg-blue-900/30' },
  { value: 'problem_solver', label: 'Problem Solver', icon: '🧩', color: 'bg-emerald-100 dark:bg-emerald-900/30' },
  { value: 'tech_bearer', label: 'Tech Bearer', icon: '💡', color: 'bg-violet-100 dark:bg-violet-900/30' },
  { value: 'team_player', label: 'Team Player', icon: '🤝', color: 'bg-cyan-100 dark:bg-cyan-900/30' },
  { value: 'creative_mind', label: 'Creative Mind', icon: '🎨', color: 'bg-pink-100 dark:bg-pink-900/30' },
  { value: 'hard_worker', label: 'Hard Worker', icon: '💪', color: 'bg-orange-100 dark:bg-orange-900/30' },
  { value: 'quick_learner', label: 'Quick Learner', icon: '🚀', color: 'bg-indigo-100 dark:bg-indigo-900/30' },
  { value: 'mentor', label: 'Mentor', icon: '🎓', color: 'bg-teal-100 dark:bg-teal-900/30' },
  { value: 'leader', label: 'Leader', icon: '👑', color: 'bg-yellow-100 dark:bg-yellow-900/30' },
  { value: 'communicator', label: 'Great Communicator', icon: '🗣️', color: 'bg-rose-100 dark:bg-rose-900/30' },
  { value: 'reliable', label: 'Reliable', icon: '🛡️', color: 'bg-slate-100 dark:bg-slate-900/30' },
  { value: 'innovator', label: 'Innovator', icon: '⚡', color: 'bg-purple-100 dark:bg-purple-900/30' },
  { value: 'customer_hero', label: 'Customer Hero', icon: '🦸', color: 'bg-sky-100 dark:bg-sky-900/30' },
  { value: 'deadline_crusher', label: 'Deadline Crusher', icon: '⏰', color: 'bg-red-100 dark:bg-red-900/30' },
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

type Tab = 'profile' | 'documents' | 'goals' | 'pip' | 'security';
type GoalStatus = 'not_started' | 'started' | 'in_progress' | 'finished';

const GOAL_STATUS_META: Record<GoalStatus, { label: string; pill: string; badge: string; dot: string }> = {
  not_started: {
    label: 'Not Started',
    pill: 'text-slate-700 dark:text-slate-300 border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800/40',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300',
    dot: 'bg-slate-400',
  },
  started: {
    label: 'Started',
    pill: 'text-blue-700 dark:text-blue-400 border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/40',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  in_progress: {
    label: 'In Progress',
    pill: 'text-amber-700 dark:text-amber-400 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/40',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  finished: {
    label: 'Finished',
    pill: 'text-emerald-700 dark:text-emerald-400 border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
};

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const targetType = searchParams.get('type') ?? 'employee';
  return <EmployeeDetailView employeeId={Number(id)} targetType={targetType} />;
}

export function EmployeeDetailView({ employeeId, targetType, isSelfProfile }: { employeeId: number; targetType: string; isSelfProfile?: boolean }) {
  const id = String(employeeId);
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isEmployee = user?._type === 'employee';
  const isAdmin = user?._type === 'admin';
  const isHr = isEmployee && !!(user as any)?.isHr;
  const canManageAllDocs = isAdmin || isHr;
  const isSelf = isSelfProfile || (targetType === 'employee' && isEmployee && Number(id) === user?.id) ||
                 (targetType === 'admin' && isAdmin && Number(id) === user?.id);
  const canUploadDocs = canManageAllDocs || isSelf;
  const canEdit = canManageAllDocs || isSelf;

  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab | null) ?? 'profile';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
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
  const [editAnnualCTC, setEditAnnualCTC] = useState('');
  const [editBloodGroup, setEditBloodGroup] = useState('');
  const [editMaritalStatus, setEditMaritalStatus] = useState('');
  const [editReportsToId, setEditReportsToId] = useState<string>('');

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

  // Praises
  const { data: praisesRaw } = useQuery({
    queryKey: ['employee-praises', id],
    queryFn: async () => {
      const endpoint = isAdmin ? `/employees/${id}/praises` : `/employee/employees/${id}/praises`;
      const r = await (await import('@/lib/api/axios-instance')).api.get(endpoint);
      return r.data?.data ?? r.data ?? [];
    },
    enabled: !!id && activeTab === 'profile',
  });
  const praises: any[] = Array.isArray(praisesRaw) ? praisesRaw : [];

  const [praiseDialogOpen, setPraiseDialogOpen] = useState(false);
  const [praiseType, setPraiseType] = useState('');
  const [praiseDesc, setPraiseDesc] = useState('');
  const [viewPraise, setViewPraise] = useState<any>(null);

  // PIP
  const [viewPip, setViewPip] = useState<any>(null);
  const [pipDialogOpen, setPipDialogOpen] = useState(false);
  const [pipForm, setPipForm] = useState({ reason: '', improvementAreas: '', startDate: '', endDate: '', goals: '' });
  const [pipAckId, setPipAckId] = useState<number | null>(null);
  const [pipAckNote, setPipAckNote] = useState('');
  const [pipUpdateId, setPipUpdateId] = useState<number | null>(null);
  const [pipUpdateStatus, setPipUpdateStatus] = useState('');
  const [pipUpdateNotes, setPipUpdateNotes] = useState('');
  const [pipUpdateOutcome, setPipUpdateOutcome] = useState('');

  const { data: pipsRaw } = useQuery({
    queryKey: ['employee-pips', id],
    queryFn: async () => {
      const endpoint = isAdmin ? `/employees/${id}/pips` : `/employee/employees/${id}/pips`;
      const r = await (await import('@/lib/api/axios-instance')).api.get(endpoint);
      return r.data?.data ?? r.data ?? [];
    },
    enabled: !!id && (canManageAllDocs || isSelf) && activeTab === 'pip',
  });
  const pips: any[] = Array.isArray(pipsRaw) ? pipsRaw : [];

  // Goals
  const goalsEndpoint = (() => {
    if (isAdmin) {
      // Admin viewing self-profile (from /profile) → employeeId in URL may not exist, use /me
      if (isSelfProfile) return '/employees/me/goals';
      return `/employees/${id}/goals`;
    }
    // Employee (always employee-guarded using logged-in id)
    return `/employee/employees/${id}/goals`;
  })();

  const { data: goalsRaw } = useQuery({
    queryKey: ['employee-goals', id, isSelfProfile, isAdmin],
    queryFn: async () => {
      const { api } = await import('@/lib/api/axios-instance');
      const res = await api.get(goalsEndpoint);
      const body = res.data as any;
      const inner = body?.data ?? body;
      return Array.isArray(inner) ? inner : (Array.isArray(inner?.data) ? inner.data : []);
    },
    enabled: !!id && activeTab === 'goals',
  });
  const goals: any[] = Array.isArray(goalsRaw) ? goalsRaw : [];
  const canEditGoals = isAdmin || isSelf;
  const [expandedGoalIds, setExpandedGoalIds] = useState<Set<number>>(new Set());
  const toggleGoalExpanded = (goalId: number) => {
    setExpandedGoalIds((prev) => {
      const next = new Set(prev);
      if (next.has(goalId)) next.delete(goalId); else next.add(goalId);
      return next;
    });
  };

  async function deleteGoal(goalId: number) {
    if (!confirm('Delete this goal? This cannot be undone.')) return;
    try {
      const { api } = await import('@/lib/api/axios-instance');
      await api.delete(`${goalsEndpoint}/${goalId}`);
      toast.success('Goal removed');
      qc.invalidateQueries({ queryKey: ['employee-goals', id] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to delete');
    }
  }

  async function quickUpdateProgress(goalId: number, percent: number) {
    try {
      const { api } = await import('@/lib/api/axios-instance');
      await api.patch(`${goalsEndpoint}/${goalId}`, { progressPercent: percent });
      qc.invalidateQueries({ queryKey: ['employee-goals', id] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to update');
    }
  }

  async function quickUpdateStatus(goalId: number, status: GoalStatus) {
    try {
      const { api } = await import('@/lib/api/axios-instance');
      await api.patch(`${goalsEndpoint}/${goalId}`, { status });
      qc.invalidateQueries({ queryKey: ['employee-goals', id] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to update');
    }
  }

  // Reporting team — employees who report to this person
  const { data: reportingTeamRaw } = useQuery({
    queryKey: ['reporting-team', id, targetType],
    queryFn: async () => {
      if (targetType === 'admin') return [];
      const r = isAdmin
        ? await employeesApi.getAll({ limit: 100 })
        : await employeesApi.employeeGetAll({ limit: 100 });
      const all = r.data?.data ?? r.data ?? [];
      const list = Array.isArray(all) ? all : (all as any)?.data ?? [];
      return list.filter((e: any) =>
        (String(e.reportsToId) === String(id) && !e.isReportToAdmin) ||
        (String(e.reportsToAdminId) === String(id) && e.isReportToAdmin && targetType === 'admin')
      );
    },
    enabled: !!id && activeTab === 'profile',
  });
  const reportingTeam: any[] = Array.isArray(reportingTeamRaw) ? reportingTeamRaw : [];

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
    setEditAnnualCTC(emp.annualCTC != null ? String(emp.annualCTC) : '');
    setEditBloodGroup(emp.bloodGroup ?? '');
    setEditMaritalStatus(emp.maritalStatus ?? '');
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
      const dto: any = { empName: editName, email: editEmail, mobileNumber: editPhone, dateOfBirth: editDob || undefined, consultantType: editType, joiningDate: editJoiningDate || undefined, isHr: editIsHr, isReportToAdmin, reportsToId, reportsToAdminId, fillDaysOverride: editFillDays ? Number(editFillDays) : null, annualCTC: editAnnualCTC ? Number(editAnnualCTC) : null, bloodGroup: editBloodGroup || undefined, maritalStatus: editMaritalStatus || undefined };
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
    ...(canViewDocs ? [{ key: 'documents' as Tab, label: 'Docs', icon: Paperclip }] : []),
    { key: 'goals' as Tab, label: 'Goals', icon: Target },
    ...((canManageAllDocs || isSelf) ? [{ key: 'pip' as Tab, label: 'PIP', icon: AlertTriangle }] : []),
    ...((isSelf || canManageAllDocs) ? [{ key: 'security' as Tab, label: 'Security', icon: Shield }] : []),
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
        <div className="space-y-4">

          {/* ── Avatar header card ─────────────────────── */}
          <Card className="overflow-hidden shadow-sm">
            <div className={`bg-linear-to-br ${AVATAR_GRADIENTS[emp.id % AVATAR_GRADIENTS.length]} p-5`}>
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm text-white text-xl font-bold ring-4 ring-white/30 shadow-xl shrink-0">
                  {getInitials(emp.empName)}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-bold text-white">{emp.empName}</h1>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-white/70 text-xs">
                    {emp.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{emp.email}</span>}
                    {emp.mobileNumber && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{emp.mobileNumber}</span>}
                  </div>
                </div>
                <Badge className={`text-[10px] border-0 shrink-0 ${emp.isActive ? 'bg-emerald-500/20 text-emerald-100' : 'bg-red-500/20 text-red-100'}`}>
                  {emp.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </Card>

          {/* ── Horizontal Tabs ─────────────────────── */}
          <div className="flex gap-1 border-b">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* ── Content ─────────────────────── */}

            {/* ── Profile tab ───────────────────────── */}
            {activeTab === 'profile' && (<>
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
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Blood Group</p>
                      {editMode ? (
                        <Select value={editBloodGroup || 'none'} onValueChange={(v) => setEditBloodGroup(v === 'none' ? '' : v)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Not set</SelectItem>
                            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                              <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm font-medium">{emp.bloodGroup || '—'}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Marital Status</p>
                      {editMode ? (
                        <Select value={editMaritalStatus || 'none'} onValueChange={(v) => setEditMaritalStatus(v === 'none' ? '' : v)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Not set</SelectItem>
                            {['Single', 'Married', 'Divorced', 'Widowed'].map((ms) => (
                              <SelectItem key={ms} value={ms}>{ms}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm font-medium">{emp.maritalStatus || '—'}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Annual CTC</p>
                      {editMode && canManageAllDocs ? (
                        <Input type="number" min={0} step="1000" placeholder="e.g. 600000" value={editAnnualCTC} onChange={(e) => setEditAnnualCTC(e.target.value)} className="h-8 text-sm" />
                      ) : (
                        <p className="text-sm font-medium">{emp.annualCTC ? `₹${Number(emp.annualCTC).toLocaleString('en-IN')}` : '—'}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Reporting Team */}
              {reportingTeam.length > 0 && (
                <Card className="shadow-sm">
                  <CardContent className="px-5 py-4">
                    <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                      Reporting Team
                      <Badge variant="secondary" className="text-xs">{reportingTeam.length}</Badge>
                    </h2>
                    <div className="flex flex-wrap gap-4">
                      {reportingTeam.map((member: any) => (
                        <button key={member.id} onClick={() => router.push(`/employees/${member.id}?type=employee`)}
                          className="group flex flex-col items-center gap-1.5 cursor-pointer">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-indigo-500 text-white text-sm font-bold ring-2 ring-background shadow group-hover:scale-110 transition-all">
                            {(member.empName ?? '').split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
                          </div>
                          <p className="text-[11px] font-medium text-center max-w-[70px] truncate group-hover:text-primary transition-colors">{member.empName}</p>
                          <p className="text-[9px] text-muted-foreground">{member.consultantType?.replace('_', ' ')}</p>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Praise / Recognition */}
              <Card className="shadow-sm">
                <CardContent className="px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold">Praise</h2>
                    {canEdit && !isSelf && (
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => { setPraiseType(''); setPraiseDesc(''); setPraiseDialogOpen(true); }}>
                        + Give Praise
                      </Button>
                    )}
                  </div>
                  {praises.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No praises yet</p>
                  ) : (
                    <div className="flex flex-wrap gap-4">
                      {praises.map((p: any) => {
                        const pt = PRAISE_TYPES.find((t) => t.value === p.praiseType);
                        return (
                          <button key={p.id} type="button" onClick={() => setViewPraise(p)}
                            className="group flex flex-col items-center gap-1.5 cursor-pointer hover:scale-105 transition-transform">
                            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${pt?.color ?? 'bg-gray-100 dark:bg-gray-800'} text-xl shadow-sm group-hover:shadow-md transition-shadow`}>
                              {pt?.icon ?? '⭐'}
                            </div>
                            <p className="text-[10px] font-medium text-muted-foreground text-center max-w-[70px] truncate">{pt?.label ?? p.praiseType}</p>
                            <p className="text-[8px] text-muted-foreground/60">by {p.givenByName?.split(' ')[0]}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>)}

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

            {/* ── Goals tab ───── */}
            {activeTab === 'goals' && (
              <div className="space-y-4">
                {/* Summary + add button */}
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Target className="h-4 w-4 text-emerald-500" /> Goals & Objectives
                  </h2>
                  {canEditGoals && (
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white shadow-md"
                      onClick={() => router.push(isSelfProfile ? '/profile/goals/new' : `/employees/${id}/goals/new`)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Goal
                    </Button>
                  )}
                </div>

                {/* Summary cards */}
                {/* {goals.length > 0 && (() => {
                  const isFinished = (g: any) => g.status === 'finished' || (Number(g.progressPercent) || 0) >= 100;
                  const active = goals.filter((g) => !isFinished(g)).length;
                  const completed = goals.filter(isFinished).length;
                  const avg = goals.length === 0 ? 0 : Math.round(goals.reduce((s, g) => s + (Number(g.progressPercent) || 0), 0) / goals.length);
                  return (
                    <div className="grid grid-cols-3 gap-3">
                      <Card className="rounded-xl border border-blue-200/60 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900/40 shadow-sm">
                        <CardContent className="px-4 py-3 flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40">
                            <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xl font-bold text-blue-700 dark:text-blue-400 leading-tight">{active}</p>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600/80 dark:text-blue-400/70">Active</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/40 shadow-sm">
                        <CardContent className="px-4 py-3 flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 leading-tight">{completed}</p>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600/80 dark:text-emerald-400/70">Completed</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="rounded-xl border border-violet-200/60 bg-violet-50/50 dark:bg-violet-950/20 dark:border-violet-900/40 shadow-sm">
                        <CardContent className="px-4 py-3 flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40">
                            <Target className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xl font-bold text-violet-700 dark:text-violet-400 leading-tight">{avg}%</p>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600/80 dark:text-violet-400/70">Avg Progress</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })()} */}

                {/* Goals list */}
                {goals.length === 0 ? (
                  <Card className="shadow-sm ">
                    <CardContent className="px-5 py-12 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 mb-3">
                        <Target className="h-8 w-8 text-emerald-500/60" />
                      </div>
                      <p className="text-sm font-semibold">No goals yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {canEditGoals ? 'Click "Add Goal" to create your first goal' : 'Goals will appear here once created'}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {goals.map((g: any) => {
                      const timeframeMeta: Record<string, { label: string; gradient: string; textColor: string; bg: string }> = {
                        monthly: { label: 'Monthly', gradient: 'from-indigo-500 to-indigo-700', textColor: 'text-indigo-700 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
                        quarterly: { label: 'Quarterly', gradient: 'from-teal-500 to-teal-700', textColor: 'text-teal-700 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-900/30' },
                        half_yearly: { label: 'Half-Yearly', gradient: 'from-amber-500 to-orange-600', textColor: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
                        yearly: { label: 'Yearly', gradient: 'from-pink-500 to-rose-600', textColor: 'text-pink-700 dark:text-pink-400', bg: 'bg-pink-100 dark:bg-pink-900/30' },
                      };
                      const tf = timeframeMeta[g.timeframe ?? 'monthly'] ?? timeframeMeta.monthly;
                      const progress = Math.max(0, Math.min(100, Number(g.progressPercent) || 0));
                      const goalStatus = (GOAL_STATUS_META[g.status as GoalStatus] ? g.status : (progress >= 100 ? 'finished' : progress > 0 ? 'in_progress' : 'not_started')) as GoalStatus;
                      const statusMeta = GOAL_STATUS_META[goalStatus];
                      const isCompleted = goalStatus === 'finished';
                      let progColor = 'bg-red-500';
                      let progText = 'text-red-600 dark:text-red-400';
                      if (isCompleted) { progColor = 'bg-emerald-500'; progText = 'text-emerald-600 dark:text-emerald-400'; }
                      else if (progress >= 75) { progColor = 'bg-blue-500'; progText = 'text-blue-600 dark:text-blue-400'; }
                      else if (progress >= 50) { progColor = 'bg-amber-500'; progText = 'text-amber-600 dark:text-amber-400'; }
                      else if (progress >= 25) { progColor = 'bg-pink-500'; progText = 'text-pink-600 dark:text-pink-400'; }

                      const expanded = expandedGoalIds.has(g.id);
                      return (
                        <Card key={g.id} className="shadow-sm overflow-hidden gap-4 py-4">
                          <div className="h-1 bg-gradient-to-r from-blue-500 to-blue-700" />
                          <CardContent className="px-5 py-4">
                            {/* Header */}
                            <div
                              className="flex items-start gap-3 cursor-pointer select-none"
                              onClick={() => toggleGoalExpanded(g.id)}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                  <Badge className="border-0 text-white bg-gradient-to-r from-blue-500 to-blue-700 shadow-sm">
                                    {tf.label}
                                  </Badge>
                                  <Badge className={`border-0 ${statusMeta.badge}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${statusMeta.dot}`} />
                                    {statusMeta.label}
                                  </Badge>
                                </div>
                                <h3 className="text-sm font-bold leading-snug">{g.title}</h3>
                                {g.description && (
                                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{g.description}</p>
                                )}
                              </div>
                              <div className="flex gap-1 shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                                {canEditGoals && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-blue-600"
                                      onClick={() => router.push(isSelfProfile ? `/profile/goals/${g.id}/edit` : `/employees/${id}/goals/${g.id}/edit`)}
                                    >
                                      <KeyRound className="h-3.5 w-3.5 rotate-180" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-red-600"
                                      onClick={() => deleteGoal(g.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground"
                                  onClick={() => toggleGoalExpanded(g.id)}
                                  aria-label={expanded ? 'Collapse' : 'Expand'}
                                >
                                  <ChevronDown
                                    className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                                  />
                                </Button>
                              </div>
                            </div>

                            {expanded && (
                            <>
                            {/* Progress bar */}
                            <div className="mt-3 flex items-center gap-3">
                              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${progColor}`}
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className={`text-sm font-bold ${progText} tabular-nums`}>{progress}%</span>
                            </div>

                            {/* Meta */}
                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                              {g.createdByName && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" /> by {g.createdByName}
                                </span>
                              )}
                              {g.targetDate && (
                                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                  <Target className="h-3 w-3" /> Target: {format(new Date(g.targetDate), 'MMM d, yyyy')}
                                </span>
                              )}
                              {g.createdAt && (
                                <span>Created {format(new Date(g.createdAt), 'MMM d')}</span>
                              )}
                            </div>

                            {/* Quick update */}
                            {canEditGoals && (
                              <div className="mt-3 pt-3 border-t space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-14 shrink-0">
                                    Status:
                                  </span>
                                  {(['not_started', 'started', 'in_progress', 'finished'] as GoalStatus[]).map((s) => {
                                    const meta = GOAL_STATUS_META[s];
                                    const selected = goalStatus === s;
                                    return (
                                      <button
                                        key={s}
                                        onClick={() => quickUpdateStatus(g.id, s)}
                                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                                          selected
                                            ? meta.pill
                                            : 'text-muted-foreground border-border hover:bg-muted'
                                        }`}
                                      >
                                        {meta.label}
                                      </button>
                                    );
                                  })}
                                </div>
                                {!isCompleted && (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-14 shrink-0">
                                      Progress:
                                    </span>
                                    {[25, 50, 75, 100].map((step) => (
                                      <button
                                        key={step}
                                        onClick={() => quickUpdateProgress(g.id, step)}
                                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                                          progress >= step
                                            ? `${progText} border-current bg-opacity-10`
                                            : 'text-muted-foreground border-border hover:bg-muted'
                                        }`}
                                      >
                                        {step}%
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            </>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── PIP tab (admin/HR only) ───── */}
            {activeTab === 'pip' && (canManageAllDocs || isSelf) && (
              <div className="space-y-4">
                <Card className="shadow-sm">
                  <CardContent className="px-5 py-4">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base font-semibold flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" /> Performance Improvement Plans
                      </h2>
                      {canManageAllDocs && !isSelf && (
                        <Button size="sm" onClick={() => { setPipForm({ reason: '', improvementAreas: '', startDate: format(new Date(), 'yyyy-MM-dd'), endDate: '', goals: '' }); setPipDialogOpen(true); }}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Initiate PIP
                        </Button>
                      )}
                    </div>

                    {pips.length === 0 ? (
                      <div className="text-center py-8">
                        <AlertTriangle className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">No PIPs on record</p>
                        <p className="text-xs text-muted-foreground mt-1">Performance improvement plans will appear here</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pips.map((pip: any) => {
                          const statusColors: Record<string, string> = {
                            active: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                            extended: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                            completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                            terminated: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                          };
                          const daysLeft = pip.endDate ? Math.ceil((new Date(pip.endDate + 'T00:00:00').getTime() - Date.now()) / 86400000) : 0;
                          return (
                            <Card key={pip.id} className={`border-l-4 cursor-pointer hover:shadow-md transition-shadow ${pip.status === 'active' ? 'border-l-amber-500' : pip.status === 'completed' ? 'border-l-emerald-500' : pip.status === 'terminated' ? 'border-l-red-500' : 'border-l-orange-500'}`} onClick={() => setViewPip(pip)}>
                              <CardContent className="px-4 py-3 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <Badge className={`text-[10px] border-0 ${statusColors[pip.status] ?? ''}`}>{pip.status.charAt(0).toUpperCase() + pip.status.slice(1)}</Badge>
                                    {pip.status === 'active' && daysLeft > 0 && <span className="text-[10px] text-muted-foreground ml-2">{daysLeft} days remaining</span>}
                                    {pip.status === 'active' && daysLeft <= 0 && <span className="text-[10px] text-red-500 ml-2 font-medium">Overdue</span>}
                                  </div>
                                  <div className="flex gap-1">
                                    {canManageAllDocs && (
                                      <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={(ev) => { ev.stopPropagation(); setPipUpdateId(pip.id); setPipUpdateStatus(pip.status); setPipUpdateNotes(pip.reviewNotes ?? ''); setPipUpdateOutcome(pip.outcome ?? ''); }}>
                                        Review
                                      </Button>
                                    )}
                                    {isSelf && pip.status === 'active' && !(pip.reviewNotes ?? '').includes('Acknowledged by') && (
                                      <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 text-amber-600 border-amber-300"
                                        onClick={(ev) => { ev.stopPropagation(); setPipAckId(pip.id); setPipAckNote(''); }}>
                                        <CheckCircle2 className="h-3 w-3 mr-1" /> Acknowledge
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{pip.reason}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{pip.improvementAreas}</p>
                                </div>
                                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                  <span>Start: {pip.startDate ? format(new Date(pip.startDate + 'T00:00:00'), 'dd MMM yyyy') : '—'}</span>
                                  <span>End: {pip.endDate ? format(new Date(pip.endDate + 'T00:00:00'), 'dd MMM yyyy') : '—'}</span>
                                  <span>By: {pip.initiatedByName}</span>
                                </div>
                                {pip.goals && <p className="text-xs"><span className="font-medium">Goals:</span> {pip.goals}</p>}
                                {pip.outcome && <p className="text-xs"><span className="font-medium">Outcome:</span> {pip.outcome}</p>}
                                {pip.reviewNotes && <p className="text-xs text-muted-foreground italic">&quot;{pip.reviewNotes}&quot;</p>}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* PIP Create Dialog */}
            <Dialog open={pipDialogOpen} onOpenChange={setPipDialogOpen}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> Initiate PIP</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Reason for PIP *</label>
                    <Textarea value={pipForm.reason} onChange={(e) => setPipForm(p => ({ ...p, reason: e.target.value }))} placeholder="Why is this PIP being initiated?" rows={2} className="mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Areas for Improvement *</label>
                    <Textarea value={pipForm.improvementAreas} onChange={(e) => setPipForm(p => ({ ...p, improvementAreas: e.target.value }))} placeholder="Specific areas the employee needs to improve..." rows={2} className="mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Goals / Expectations</label>
                    <Textarea value={pipForm.goals} onChange={(e) => setPipForm(p => ({ ...p, goals: e.target.value }))} placeholder="What does successful improvement look like?" rows={2} className="mt-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Start Date *</label>
                      <Input type="date" value={pipForm.startDate} onChange={(e) => setPipForm(p => ({ ...p, startDate: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">End Date *</label>
                      <Input type="date" value={pipForm.endDate} onChange={(e) => setPipForm(p => ({ ...p, endDate: e.target.value }))} className="mt-1" min={pipForm.startDate} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setPipDialogOpen(false)}>Cancel</Button>
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={!pipForm.reason || !pipForm.improvementAreas || !pipForm.startDate || !pipForm.endDate}
                      onClick={async () => {
                        try {
                          await (await import('@/lib/api/axios-instance')).api.post(`/employees/${id}/pips`, pipForm);
                          toast.success('PIP initiated');
                          qc.invalidateQueries({ queryKey: ['employee-pips', id] });
                          setPipDialogOpen(false);
                        } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Failed'); }
                      }}>
                      Initiate PIP
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* PIP Detail Dialog */}
            <Dialog open={!!viewPip} onOpenChange={(v) => { if (!v) setViewPip(null); }}>
              <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" /> PIP Details
                  </DialogTitle>
                </DialogHeader>
                {viewPip && (() => {
                  const pip = viewPip;
                  const isAcknowledged = (pip.reviewNotes ?? '').includes('Acknowledged by');
                  const statusColors: Record<string, string> = {
                    active: 'bg-amber-100 text-amber-700', extended: 'bg-orange-100 text-orange-700',
                    completed: 'bg-emerald-100 text-emerald-700', terminated: 'bg-red-100 text-red-700',
                  };
                  const daysLeft = pip.endDate ? Math.ceil((new Date(pip.endDate + 'T00:00:00').getTime() - Date.now()) / 86400000) : 0;
                  return (
                    <div className="space-y-4">
                      {/* Status + Timeline */}
                      <div className="flex items-center gap-3">
                        <Badge className={`text-xs border-0 ${statusColors[pip.status] ?? ''}`}>{pip.status.charAt(0).toUpperCase() + pip.status.slice(1)}</Badge>
                        {pip.status === 'active' && daysLeft > 0 && <span className="text-xs text-muted-foreground">{daysLeft} days remaining</span>}
                        {pip.status === 'active' && daysLeft <= 0 && <span className="text-xs text-red-500 font-medium">Overdue</span>}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {isAcknowledged ? <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">Acknowledged</Badge> : <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">Not Acknowledged</Badge>}
                        </span>
                      </div>

                      {/* Dates */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Start Date</p>
                          <p className="text-sm font-medium mt-1">{pip.startDate ? format(new Date(pip.startDate + 'T00:00:00'), 'dd MMM yyyy') : '—'}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">End Date</p>
                          <p className="text-sm font-medium mt-1">{pip.endDate ? format(new Date(pip.endDate + 'T00:00:00'), 'dd MMM yyyy') : '—'}</p>
                        </div>
                      </div>

                      {/* Reason */}
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Reason for PIP</p>
                        <p className="text-sm bg-red-50 dark:bg-red-950/20 rounded-lg p-3 border border-red-200 dark:border-red-800">{pip.reason}</p>
                      </div>

                      {/* Improvement Areas */}
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Areas for Improvement</p>
                        <p className="text-sm bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">{pip.improvementAreas}</p>
                      </div>

                      {/* Goals */}
                      {pip.goals && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Goals / Expectations</p>
                          <p className="text-sm bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">{pip.goals}</p>
                        </div>
                      )}

                      {/* Outcome */}
                      {pip.outcome && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Outcome</p>
                          <p className="text-sm bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">{pip.outcome}</p>
                        </div>
                      )}

                      {/* Review Notes / Acknowledgment */}
                      {pip.reviewNotes && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes & Acknowledgment</p>
                          <div className="space-y-2">
                            {pip.reviewNotes.split('\n').filter(Boolean).map((note: string, i: number) => {
                              const isAck = note.includes('Acknowledged by');
                              return (
                                <div key={i} className={`text-sm rounded-lg p-3 border ${isAck ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' : 'bg-muted/50 border-border'}`}>
                                  {isAck && <CheckCircle2 className="inline h-3.5 w-3.5 text-emerald-500 mr-1.5" />}
                                  {note}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Initiated by */}
                      <div className="text-xs text-muted-foreground border-t pt-3">
                        <p>Initiated by <span className="font-semibold text-foreground">{pip.initiatedByName}</span> ({pip.initiatedByType})</p>
                        <p>Created: {pip.createdAt ? format(new Date(pip.createdAt), 'dd MMM yyyy, hh:mm a') : '—'}</p>
                      </div>
                    </div>
                  );
                })()}
              </DialogContent>
            </Dialog>

            {/* PIP Acknowledge Dialog */}
            <Dialog open={!!pipAckId} onOpenChange={(v) => { if (!v) { setPipAckId(null); setPipAckNote(''); } }}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-amber-500" /> Acknowledge PIP
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    By acknowledging, you confirm that you have read and understood the Performance Improvement Plan.
                  </p>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Your Response / Comments *</label>
                    <Textarea
                      value={pipAckNote}
                      onChange={(e) => setPipAckNote(e.target.value)}
                      placeholder="Write your acknowledgment, questions, or commitment plan..."
                      rows={4}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => { setPipAckId(null); setPipAckNote(''); }}>Cancel</Button>
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={!pipAckNote.trim()}
                      onClick={async () => {
                        try {
                          await (await import('@/lib/api/axios-instance')).api.patch(`/employee/employees/pips/${pipAckId}/acknowledge`, { note: pipAckNote.trim() });
                          toast.success('PIP acknowledged');
                          qc.invalidateQueries({ queryKey: ['employee-pips', id] });
                          setPipAckId(null);
                          setPipAckNote('');
                        } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Failed'); }
                      }}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Acknowledge
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* PIP Review Dialog */}
            <Dialog open={!!pipUpdateId} onOpenChange={(v) => { if (!v) setPipUpdateId(null); }}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Review PIP</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Status</label>
                    <Select value={pipUpdateStatus} onValueChange={setPipUpdateStatus}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="extended">Extended</SelectItem>
                        <SelectItem value="completed">Completed (Improved)</SelectItem>
                        <SelectItem value="terminated">Terminated (No Improvement)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Review Notes</label>
                    <Textarea value={pipUpdateNotes} onChange={(e) => setPipUpdateNotes(e.target.value)} placeholder="Manager's review notes..." rows={2} className="mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Outcome</label>
                    <Textarea value={pipUpdateOutcome} onChange={(e) => setPipUpdateOutcome(e.target.value)} placeholder="Final outcome / next steps..." rows={2} className="mt-1" />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setPipUpdateId(null)}>Cancel</Button>
                    <Button size="sm" onClick={async () => {
                      try {
                        await (await import('@/lib/api/axios-instance')).api.patch(`/employees/pips/${pipUpdateId}`, { status: pipUpdateStatus, reviewNotes: pipUpdateNotes || undefined, outcome: pipUpdateOutcome || undefined });
                        toast.success('PIP updated');
                        qc.invalidateQueries({ queryKey: ['employee-pips', id] });
                        setPipUpdateId(null);
                      } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Failed'); }
                    }}>
                      Update PIP
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* ── Security tab ───── */}
            {activeTab === 'security' && (isSelf || canManageAllDocs) && (<>
              {/* Password change (self only) */}
              {isSelf && (
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

              {/* Block / Deactivate (admin/HR only) */}
              {canManageAllDocs && !isSelf && (
                <Card className="shadow-sm border-red-200 dark:border-red-800">
                  <CardContent className="px-5 py-4 space-y-3">
                    <h2 className="text-base font-semibold text-red-600">Danger Zone</h2>
                    <p className="text-xs text-muted-foreground">These actions affect the employee&apos;s account access.</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={async () => {
                          if (!confirm(emp.isActive ? 'Deactivate this employee? They will lose access.' : 'Reactivate this employee?')) return;
                          try {
                            await employeesApi.toggleActive(Number(id));
                            toast.success(emp.isActive ? 'Account deactivated' : 'Account reactivated');
                            qc.invalidateQueries({ queryKey: ['employee-detail', id] });
                          } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Failed'); }
                        }}>
                        <Ban className="h-3.5 w-3.5 mr-1.5" />
                        {emp.isActive ? 'Deactivate Account' : 'Reactivate Account'}
                      </Button>
                      <Button variant="outline" size="sm" className="text-amber-600 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                        onClick={async () => {
                          const pwd = prompt('Enter new password for this employee (min 8 chars):');
                          if (!pwd || pwd.length < 8) { if (pwd) toast.error('Password must be at least 8 characters'); return; }
                          try {
                            await employeesApi.resetPassword(Number(id), pwd);
                            toast.success('Password reset successfully');
                          } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Failed'); }
                        }}>
                        <Lock className="h-3.5 w-3.5 mr-1.5" />
                        Reset Password
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>)}
        </div>
      )}

      {/* View Praise Detail Dialog */}
      <Dialog open={!!viewPraise} onOpenChange={(v) => { if (!v) setViewPraise(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle className="sr-only">Praise Detail</DialogTitle>
          {viewPraise && (() => {
            const pt = PRAISE_TYPES.find((t) => t.value === viewPraise.praiseType);
            return (
              <div className="flex flex-col items-center text-center gap-4 py-2">
                <div className={`flex h-20 w-20 items-center justify-center rounded-full ${pt?.color ?? 'bg-gray-100'} text-4xl shadow-lg`}>
                  {pt?.icon ?? '⭐'}
                </div>
                <div>
                  <h3 className="text-lg font-bold">{pt?.label ?? viewPraise.praiseType}</h3>
                  <p className="text-sm text-muted-foreground mt-1">Awarded to <span className="font-semibold text-foreground">{emp?.empName}</span></p>
                </div>
                {viewPraise.description && (
                  <div className="bg-muted/50 rounded-lg px-4 py-3 w-full">
                    <p className="text-sm italic text-muted-foreground">&quot;{viewPraise.description}&quot;</p>
                  </div>
                )}
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Given by <span className="font-semibold text-foreground">{viewPraise.givenByName}</span> ({viewPraise.givenByType})</p>
                  <p>{viewPraise.createdAt ? format(new Date(viewPraise.createdAt), 'dd MMM yyyy, hh:mm a') : ''}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setViewPraise(null)} className="mt-2">Close</Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Give Praise Dialog */}
      <Dialog open={praiseDialogOpen} onOpenChange={setPraiseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Give Praise</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Select a praise type</p>
              <div className="grid grid-cols-3 gap-2">
                {PRAISE_TYPES.map((pt) => (
                  <button key={pt.value} type="button" onClick={() => setPraiseType(pt.value)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all hover:scale-105 ${praiseType === pt.value ? 'border-primary bg-primary/5 shadow-sm' : 'border-transparent hover:border-muted'}`}>
                    <span className="text-xl">{pt.icon}</span>
                    <span className="text-[8px] font-medium text-center leading-tight">{pt.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Message (optional)</p>
              <Textarea value={praiseDesc} onChange={(e) => setPraiseDesc(e.target.value)} placeholder="Write something nice..." rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPraiseDialogOpen(false)}>Cancel</Button>
              <Button size="sm" disabled={!praiseType} onClick={async () => {
                try {
                  const endpoint = isAdmin ? `/employees/${id}/praises` : `/employee/employees/${id}/praises`;
                  await (await import('@/lib/api/axios-instance')).api.post(endpoint, { praiseType, description: praiseDesc || undefined });
                  toast.success('Praise given!');
                  qc.invalidateQueries({ queryKey: ['employee-praises', id] });
                  setPraiseDialogOpen(false);
                } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Failed'); }
              }}>
                Give Praise
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
