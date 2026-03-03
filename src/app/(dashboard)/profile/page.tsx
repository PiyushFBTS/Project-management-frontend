'use client';

import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { authApi } from '@/lib/api/auth';
import { Employee } from '@/types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  User, Mail, Shield, Calendar, KeyRound, Eye, EyeOff, CheckCircle2,
  Briefcase, UserCheck, Hash, Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const roleMap: Record<string, { label: string; color: string }> = {
  super_admin: { label: 'Super Admin', color: 'bg-violet-500/15 text-violet-600 ring-1 ring-violet-500/30 dark:text-violet-400' },
  admin:       { label: 'Admin',       color: 'bg-indigo-500/15 text-indigo-600 ring-1 ring-indigo-500/30 dark:text-indigo-400' },
};

const consultantTypeLabels: Record<string, string> = {
  project_manager: 'Project Manager',
  functional: 'Functional Consultant',
  technical: 'Technical Consultant',
  management: 'Management',
  core_team: 'Core Team',
};

function InfoRow({ icon: Icon, label, value, iconColor }: {
  icon: React.ElementType; label: string; value: string; iconColor: string;
}) {
  return (
    <div className="flex items-center gap-4 py-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconColor}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent]         = useState(false);
  const [showNew, setShowNew]                 = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [saving, setSaving]                   = useState(false);

  const displayName = user
    ? user._type === 'employee' ? (user as { empName: string }).empName : user.name
    : '';

  const initials = displayName
    ? displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const isEmp = user?._type === 'employee';
  const emp = isEmp ? (user as Employee & { _type: 'employee' }) : null;

  const roleInfo = isEmp
    ? { label: 'Employee', color: 'bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/30 dark:text-blue-400' }
    : roleMap[(user as { role?: string })?.role ?? ''] ?? { label: 'Admin', color: roleMap.admin.color };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">

      {/* ── Profile hero card ── */}
      <div className="relative overflow-hidden rounded-xl border bg-card shadow-sm">
        {/* Gradient band */}
        <div className="h-24 bg-linear-to-r from-indigo-500 via-violet-500 to-fuchsia-500 opacity-90" />
        <div className="px-6 pb-6">
          {/* Avatar overlapping the band */}
          <div className="-mt-12 mb-4 flex items-end justify-between">
            <Avatar className="h-20 w-20 ring-4 ring-card shadow-lg">
              <AvatarFallback className="bg-linear-to-br from-indigo-500 to-violet-600 text-white text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <Badge className={`mb-1 text-xs font-medium ${roleInfo.color}`}>
              {roleInfo.label}
            </Badge>
          </div>
          <h1 className="text-xl font-bold text-foreground">{displayName || '—'}</h1>
          <p className="text-sm text-muted-foreground">{user?.email ?? '—'}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">

        {/* ── Account information ── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500/15">
                <User className="h-4 w-4 text-indigo-500" />
              </div>
              Account Information
            </CardTitle>
            <CardDescription className="text-xs">Your current account details</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-border">
              <InfoRow
                icon={User}
                label="Full Name"
                value={displayName || '—'}
                iconColor="bg-indigo-500/10 text-indigo-500"
              />
              <InfoRow
                icon={Mail}
                label="Email Address"
                value={user?.email ?? '—'}
                iconColor="bg-violet-500/10 text-violet-500"
              />
              {isEmp && emp && (
                <>
                  <InfoRow
                    icon={Hash}
                    label="Employee Code"
                    value={emp.empCode}
                    iconColor="bg-cyan-500/10 text-cyan-500"
                  />
                  <InfoRow
                    icon={Briefcase}
                    label="Designation"
                    value={consultantTypeLabels[emp.consultantType] ?? emp.consultantType}
                    iconColor="bg-amber-500/10 text-amber-500"
                  />
                  <InfoRow
                    icon={UserCheck}
                    label="Reports To"
                    value={emp.reportsTo ? `${emp.reportsTo.empName} (${emp.reportsTo.empCode})` : 'Not assigned'}
                    iconColor="bg-rose-500/10 text-rose-500"
                  />
                  {emp.phone && (
                    <InfoRow
                      icon={Phone}
                      label="Phone"
                      value={emp.phone}
                      iconColor="bg-teal-500/10 text-teal-500"
                    />
                  )}
                </>
              )}
              {!isEmp && (
                <InfoRow
                  icon={Shield}
                  label="Role"
                  value={roleInfo.label}
                  iconColor="bg-fuchsia-500/10 text-fuchsia-500"
                />
              )}
              <InfoRow
                icon={Calendar}
                label={isEmp ? 'Join Date' : 'Member Since'}
                value={
                  isEmp && emp?.joinDate
                    ? format(new Date(emp.joinDate), 'MMMM d, yyyy')
                    : user?.createdAt
                    ? format(new Date(user.createdAt), 'MMMM d, yyyy')
                    : '—'
                }
                iconColor="bg-emerald-500/10 text-emerald-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Account status ── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/15">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              Account Status
            </CardTitle>
            <CardDescription className="text-xs">Portal access & permissions</CardDescription>
          </CardHeader>
          <CardContent className="pt-2 space-y-4">
            {/* Status indicator */}
            <div className="flex items-center justify-between rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Account Active</p>
                <p className="text-xs text-muted-foreground">Full portal access granted</p>
              </div>
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              </span>
            </div>

            <Separator />

            {/* Permissions list */}
            <div className="space-y-2">
              {(isEmp
                ? [
                    { label: 'Submit Task Sheets', granted: true },
                    { label: 'Apply for Leave', granted: true },
                    { label: 'Approve Leave Requests', granted: !!(emp?.isHr || emp?.reportsToId) },
                    { label: 'View Reports', granted: true },
                  ]
                : [
                    { label: 'Manage Projects', granted: true },
                    { label: 'Manage Employees', granted: true },
                    { label: 'View Reports', granted: true },
                    { label: 'View Task Sheets', granted: true },
                  ]
              ).map((p) => (
                <div key={p.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{p.label}</span>
                  <span className={`flex items-center gap-1 text-xs font-medium ${
                    p.granted
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> {p.granted ? 'Granted' : 'N/A'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Change password ── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/15">
              <KeyRound className="h-4 w-4 text-amber-500" />
            </div>
            Change Password
          </CardTitle>
          <CardDescription className="text-xs">
            Update your password. Use a strong password with letters, numbers and symbols.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">

              {/* Current password */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Current Password</label>
                <div className="relative">
                  <Input
                    type={showCurrent ? 'text' : 'password'}
                    placeholder="Enter current"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">New Password</label>
                <div className="relative">
                  <Input
                    type={showNew ? 'text' : 'password'}
                    placeholder="Enter new"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Strength bar */}
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

              {/* Confirm password */}
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
                      confirmPassword && confirmPassword !== newPassword
                        ? 'border-red-500 focus-visible:ring-red-500'
                        : confirmPassword && confirmPassword === newPassword
                        ? 'border-emerald-500 focus-visible:ring-emerald-500'
                        : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
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
                type="submit"
                size="sm"
                disabled={saving}
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
  );
}
