'use client';

import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { authApi } from '@/lib/api/auth';
import { employeesApi } from '@/lib/api/employees';
import { Employee } from '@/types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Mail, Phone, KeyRound, Eye, EyeOff, CheckCircle2, Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const AVATAR_GRADIENTS = [
  'from-indigo-500 to-violet-600',
  'from-pink-500 to-rose-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-blue-500 to-indigo-600',
];

const roleMap: Record<string, { label: string; color: string }> = {
  super_admin: { label: 'Super Admin', color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800' },
  admin:       { label: 'Admin',       color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' },
};

const consultantTypeLabels: Record<string, string> = {
  project_manager: 'Project Manager',
  functional: 'Functional Consultant',
  technical: 'Technical Consultant',
  management: 'Management',
  core_team: 'Core Team',
};

function DetailRow({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start py-3 border-b border-border/50 last:border-0 gap-4">
      <span className="w-36 shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-indigo-500 dark:text-indigo-400' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}

export default function ProfilePage() {
  const { user, refreshProfile } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent]         = useState(false);
  const [showNew, setShowNew]                 = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [saving, setSaving]                   = useState(false);

  // Edit profile state (employees only)
  const [editName, setEditName]           = useState('');
  const [editPhone, setEditPhone]         = useState('');
  const [editDob, setEditDob]             = useState('');
  const [editMode, setEditMode]           = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const displayName = user
    ? user._type === 'employee' ? (user as { empName: string }).empName : user.name
    : '';

  const initials = displayName
    ? displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const isEmp = user?._type === 'employee';
  const emp = isEmp ? (user as Employee & { _type: 'employee' }) : null;

  const roleInfo = isEmp
    ? { label: emp?.isHr ? 'HR Employee' : 'Employee', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' }
    : roleMap[(user as { role?: string })?.role ?? ''] ?? { label: 'Admin', color: roleMap.admin.color };

  const gradient = AVATAR_GRADIENTS[(user?.id ?? 0) % AVATAR_GRADIENTS.length];

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error('New passwords do not match'); return; }
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setSaving(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const passwordStrength = (() => {
    if (!newPassword) return null;
    if (newPassword.length < 6) return { label: 'Too short', color: 'bg-red-500', width: 'w-1/4' };
    if (newPassword.length < 8 || !/[0-9]/.test(newPassword)) return { label: 'Weak', color: 'bg-amber-500', width: 'w-2/4' };
    if (!/[^a-zA-Z0-9]/.test(newPassword)) return { label: 'Medium', color: 'bg-yellow-500', width: 'w-3/4' };
    return { label: 'Strong', color: 'bg-emerald-500', width: 'w-full' };
  })();

  const openEdit = () => {
    setEditName(emp?.empName ?? '');
    setEditPhone(emp?.mobileNumber ?? '');
    setEditDob(emp?.dateOfBirth ?? '');
    setEditMode(true);
  };

  const handleSaveProfile = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();
    setSavingProfile(true);
    try {
      await employeesApi.updateSelf({
        empName: editName || undefined,
        mobileNumber: editPhone || undefined,
        dateOfBirth: editDob || undefined,
      });
      await refreshProfile();
      toast.success('Profile updated successfully');
      setEditMode(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">

      {/* ── Left sidebar ───────────────────────────── */}
      <div className="space-y-4">

        {/* Avatar card */}
        <Card className="overflow-hidden shadow-sm">
          <div className={`bg-linear-to-br ${gradient} p-6 flex flex-col items-center gap-3`}>
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm text-white text-3xl font-bold ring-4 ring-white/30 shadow-xl">
              {initials}
            </div>
            <div className="text-center">
              <p className="font-bold text-white text-base leading-tight">{displayName || '—'}</p>
              <p className="text-white/70 text-xs mt-0.5">
                {isEmp
                  ? (consultantTypeLabels[emp?.consultantType ?? ''] ?? emp?.consultantType)
                  : roleInfo.label}
              </p>
            </div>
          </div>
          <CardContent className="px-4 py-3 flex flex-wrap gap-1.5 justify-center">
            <Badge variant="outline" className={`text-xs ${roleInfo.color}`}>{roleInfo.label}</Badge>
            {isEmp && emp?.isHr && (
              <Badge className="text-xs bg-violet-500/10 text-violet-600 border-violet-200 dark:border-violet-800 dark:text-violet-400">HR</Badge>
            )}
            <Badge className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400">
              Active
            </Badge>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="shadow-sm">
          <CardContent className="px-4 py-3 space-y-2.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Contact</p>
            {user?.email && (
              <a href={`mailto:${user.email}`} className="flex items-center gap-2.5 text-sm text-indigo-500 hover:text-indigo-600 transition-colors">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{user.email}</span>
              </a>
            )}
            {isEmp && emp?.mobileNumber && (
              <a href={`tel:${emp.mobileNumber}`} className="flex items-center gap-2.5 text-sm text-indigo-500 hover:text-indigo-600 transition-colors">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {emp.mobileNumber}
              </a>
            )}
          </CardContent>
        </Card>

        {/* Tags */}
        <Card className="shadow-sm">
          <CardContent className="px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Info</p>
            <div className="flex flex-wrap gap-1.5">
              {isEmp && emp?.consultantType && (
                <span className="rounded-md bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  {consultantTypeLabels[emp.consultantType] ?? emp.consultantType}
                </span>
              )}
              {isEmp && emp?.isHr && (
                <span className="rounded-md bg-violet-50 dark:bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400">
                  Human Resources
                </span>
              )}
              {!isEmp && (
                <span className="rounded-md bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  {roleInfo.label}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Right main area ─────────────────────────── */}
      <div className="space-y-4">

        {/* Name + role header */}
        <Card className="shadow-sm">
          <CardContent className="px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-foreground">{displayName || '—'}</h1>
                <p className="text-sm text-indigo-500 dark:text-indigo-400 font-medium mt-0.5">
                  {isEmp
                    ? `${consultantTypeLabels[emp?.consultantType ?? ''] ?? emp?.consultantType ?? ''}${emp?.isHr ? ' · HR' : ''}`
                    : roleInfo.label}
                </p>
              </div>
              <Badge variant="outline" className={`text-xs shrink-0 ${roleInfo.color}`}>{roleInfo.label}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card className="shadow-sm">
          <CardContent className="px-5 py-2">
            <div className="flex items-center justify-between py-3 border-b">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">About</p>
              {isEmp && !editMode && (
                <Button variant="ghost" size="sm" onClick={openEdit} className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground">
                  <Pencil className="h-3 w-3" /> Edit
                </Button>
              )}
              {isEmp && editMode && (
                <div className="flex gap-1.5">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditMode(false)} className="h-6 px-2 text-xs">
                    Cancel
                  </Button>
                  <Button
                    type="button" size="sm" disabled={savingProfile}
                    onClick={handleSaveProfile}
                    className="h-6 px-2 text-xs bg-indigo-500 hover:bg-indigo-600 text-white border-0"
                  >
                    {savingProfile ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              )}
            </div>

            <DetailRow label="Email" value={user?.email} highlight />

            {isEmp && emp && (
              <>
                <DetailRow label="Employee ID" value={emp.empCode} highlight />

                {/* Editable: Full Name */}
                {editMode ? (
                  <div className="flex items-center py-3 border-b border-border/50 gap-4">
                    <span className="w-36 shrink-0 text-sm text-muted-foreground">Full Name</span>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-7 text-sm"
                      placeholder="Full name"
                    />
                  </div>
                ) : (
                  <DetailRow label="Full Name" value={emp.empName} highlight />
                )}

                {/* Editable: Phone */}
                {editMode ? (
                  <div className="flex items-center py-3 border-b border-border/50 gap-4">
                    <span className="w-36 shrink-0 text-sm text-muted-foreground">Phone</span>
                    <Input
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="h-7 text-sm"
                      placeholder="Mobile number"
                    />
                  </div>
                ) : (
                  <DetailRow label="Phone" value={emp.mobileNumber} highlight />
                )}

                <DetailRow label="Role" value={consultantTypeLabels[emp.consultantType] ?? emp.consultantType} highlight />
                <DetailRow
                  label="Reports To"
                  value={emp.reportsTo ? `${emp.reportsTo.empName} (${emp.reportsTo.empCode})` : null}
                  highlight
                />

                {/* Editable: Date of Birth */}
                {editMode ? (
                  <div className="flex items-center py-3 border-b border-border/50 gap-4">
                    <span className="w-36 shrink-0 text-sm text-muted-foreground">Date of Birth</span>
                    <Input
                      type="date"
                      value={editDob}
                      onChange={(e) => setEditDob(e.target.value)}
                      className="h-7 text-sm w-40"
                    />
                  </div>
                ) : (
                  <DetailRow
                    label="Date of Birth"
                    value={emp.dateOfBirth ? format(new Date(emp.dateOfBirth + 'T00:00:00'), 'dd MMMM yyyy') : null}
                  />
                )}

                <DetailRow
                  label="Work Anniversary"
                  value={emp.joiningDate ? format(new Date(emp.joiningDate + 'T00:00:00'), 'dd MMMM yyyy') : null}
                />
              </>
            )}
            {!isEmp && (
              <DetailRow label="Role" value={roleInfo.label} highlight />
            )}
            <DetailRow
              label="Member Since"
              value={user?.createdAt ? format(new Date(user.createdAt), 'dd MMMM yyyy') : null}
            />
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/15">
                <KeyRound className="h-3.5 w-3.5 text-amber-500" />
              </div>
              Change Password
            </CardTitle>
            <CardDescription className="text-xs">
              Use a strong password with letters, numbers and symbols.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Current Password</label>
                  <div className="relative">
                    <Input
                      type={showCurrent ? 'text' : 'password'}
                      placeholder="Enter current"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required className="pr-9"
                    />
                    <button type="button" onClick={() => setShowCurrent((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">New Password</label>
                  <div className="relative">
                    <Input
                      type={showNew ? 'text' : 'password'}
                      placeholder="Enter new"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required className="pr-9"
                    />
                    <button type="button" onClick={() => setShowNew((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordStrength && (
                    <div className="space-y-0.5">
                      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${passwordStrength.color} ${passwordStrength.width}`} />
                      </div>
                      <p className={`text-[10px] font-medium ${
                        passwordStrength.label === 'Strong' ? 'text-emerald-500' :
                        passwordStrength.label === 'Medium' ? 'text-yellow-500' :
                        passwordStrength.label === 'Weak'   ? 'text-amber-500'  : 'text-red-500'
                      }`}>{passwordStrength.label}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Confirm Password</label>
                  <div className="relative">
                    <Input
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Confirm new"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className={`pr-9 ${
                        confirmPassword && confirmPassword !== newPassword ? 'border-red-500 focus-visible:ring-red-500' :
                        confirmPassword && confirmPassword === newPassword  ? 'border-emerald-500 focus-visible:ring-emerald-500' : ''
                      }`}
                    />
                    <button type="button" onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== newPassword && (
                    <p className="text-[10px] text-red-500 font-medium">Passwords do not match</p>
                  )}
                  {confirmPassword && confirmPassword === newPassword && (
                    <p className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Passwords match
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="submit" size="sm" disabled={saving}
                  className="bg-linear-to-r from-indigo-500 to-violet-600 text-white hover:opacity-90 shadow-sm shadow-indigo-500/25 border-0"
                >
                  <KeyRound className="mr-1.5 h-4 w-4" />
                  {saving ? 'Updating…' : 'Update Password'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
