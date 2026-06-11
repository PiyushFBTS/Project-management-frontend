/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import Link from 'next/link';
import { Building2, Mail, Phone, User as UserIcon, FolderKanban, ArrowRight } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmployeeDetailView } from '../employees/[id]/page';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Slimmed-down profile for client users. Mirrors Flutter's `_ClientProfileView`
 * — clients are external, so they don't see goals/PIPs/documents/timesheets.
 * The page is intentionally simple: identity + assigned project + contact info.
 */
function ClientProfileView() {
  const { user } = useAuth();
  const c = user as {
    id: number;
    fullName: string;
    email: string;
    mobileNumber?: string;
    projectId: number;
    projectName: string | null;
    companyName: string | null;
    companyLogoUrl: string | null;
  };
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-blue-600 via-blue-700 to-blue-900" />
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -right-4 bottom-2 h-24 w-24 rounded-full bg-blue-300/20 blur-xl" />
        <div className="relative p-6 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm ring-1 ring-white/20 shadow-inner text-xl font-bold text-white">
            {initialsOf(c.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-white truncate">{c.fullName}</h1>
            <p className="text-sm text-white/80 truncate">{c.email}</p>
            <span className="inline-block mt-2 rounded-md bg-white/20 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-white ring-1 ring-white/20">
              CLIENT
            </span>
          </div>
          {c.companyLogoUrl ? (
            <img
              src={`${apiBase}${c.companyLogoUrl}`}
              alt={c.companyName ?? ''}
              className="h-12 w-12 shrink-0 rounded-xl bg-white/15 object-cover ring-1 ring-white/20 hidden sm:block"
            />
          ) : null}
        </div>
      </div>

      {/* Account information */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-blue-600" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {c.companyName ? (
            <InfoRow icon={Building2} label="Company" value={c.companyName} />
          ) : null}
          <InfoRow icon={UserIcon} label="Full Name" value={c.fullName} />
          <InfoRow icon={Mail} label="Email" value={c.email} />
          {c.mobileNumber ? (
            <InfoRow icon={Phone} label="Mobile" value={c.mobileNumber} />
          ) : null}
        </CardContent>
      </Card>

      {/* Assigned project */}
      {c.projectId ? (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-blue-600" />
              Assigned Project
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/projects/${c.projectId}`}
              className="group flex items-center gap-3 rounded-lg p-3 ring-1 ring-border hover:ring-blue-500/30 hover:bg-blue-500/5 transition"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-blue-600 to-blue-800 text-white shadow-md">
                <FolderKanban className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate group-hover:text-blue-600 transition">
                  {c.projectName ?? `Project #${c.projectId}`}
                </p>
                <p className="text-xs text-muted-foreground">Open the project workspace</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-blue-600 group-hover:translate-x-0.5 transition" />
            </Link>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              <Button asChild variant="outline" size="sm" className="justify-start">
                <Link href="/tickets?view=log">View Ticket Log</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="justify-start">
                <Link href="/tickets?view=my">My Tickets</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  // Clients get a slim, read-only profile — different shape from EmployeeDetailView
  if (user._type === 'client') return <ClientProfileView />;

  const userId = (user as any).id;
  // Branch on the BACKEND row type, not the promoted `_type`. Soft-admins
  // (`userType='employee'` + `isAdmin=true`) are flipped to `_type='admin'`
  // by the auth provider so admin-only UI gates pass, but their actual
  // record lives in the employee row — consultantType, empCode, dept,
  // etc. all sit there. Using `_type` here would route them through
  // `employeesApi.getAdmin()` and render the admin stub (literal "Admin"
  // role, empCode "ADMIN", blank department) instead of their real
  // employee profile. So look at `user.userType` (preserved from
  // `/auth/me`) to decide which endpoint owns the data.
  const userType = (user as any).userType === 'admin' ? 'admin' : 'employee';
  return <EmployeeDetailView employeeId={userId} targetType={userType} isSelfProfile />;
}
