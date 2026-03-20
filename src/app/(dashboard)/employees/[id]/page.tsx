'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, Mail, Phone } from 'lucide-react';
import { employeesApi } from '@/lib/api/employees';
import { useAuth } from '@/providers/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const AVATAR_GRADIENTS = [
  'from-pink-500 to-rose-600',
  'from-violet-500 to-purple-600',
  'from-indigo-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
];

const TYPE_LABELS: Record<string, string> = {
  project_manager: 'Project Manager',
  functional: 'Functional Consultant',
  technical: 'Technical Consultant',
  management: 'Management',
  core_team: 'Core Team',
};

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function getAvatarGradient(id: number) {
  return AVATAR_GRADIENTS[id % AVATAR_GRADIENTS.length];
}

function DetailRow({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start py-3 border-b border-border/50 last:border-0 gap-4">
      <span className="w-40 shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-indigo-500 dark:text-indigo-400' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const isEmployee = user?._type === 'employee';
  const isAdmin = user?._type !== 'employee';
  const targetType = searchParams.get('type') ?? 'employee'; // 'admin' or 'employee'

  const { data: emp, isLoading } = useQuery({
    queryKey: ['employee-detail', id, targetType],
    queryFn: () => {
      if (targetType === 'admin' && isAdmin) {
        return employeesApi.getAdmin(Number(id)).then((r) => r.data.data);
      }
      return (isEmployee
        ? employeesApi.employeeGetOne(Number(id))
        : employeesApi.getOne(Number(id))
      ).then((r) => r.data.data);
    },
    enabled: !!id,
  });

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-1" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
          <div className="space-y-4">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      ) : !emp ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Employee not found.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">

          {/* ── Left sidebar ─────────────────────────────────── */}
          <div className="space-y-4">

            {/* Avatar card */}
            <Card className="overflow-hidden shadow-sm">
              <div className={`bg-linear-to-br ${getAvatarGradient(emp.id)} p-6 flex flex-col items-center gap-3`}>
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm text-white text-3xl font-bold ring-4 ring-white/30 shadow-xl">
                  {getInitials(emp.empName)}
                </div>
                <div className="text-center">
                  <p className="font-bold text-white text-base leading-tight">{emp.empName}</p>
                  <p className="text-white/70 text-xs mt-0.5">{TYPE_LABELS[emp.consultantType] ?? emp.consultantType}</p>
                </div>
              </div>
              <CardContent className="px-4 py-3 flex flex-wrap gap-1.5 justify-center">
                <Badge variant="outline" className="text-xs">{emp.empCode}</Badge>
                {emp.isHr && <Badge className="text-xs bg-violet-500/10 text-violet-600 border-violet-200 dark:border-violet-800 dark:text-violet-400">HR</Badge>}
                <Badge className={`text-xs border-0 ${emp.isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                  {emp.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </CardContent>
            </Card>

            {/* Contact quick links */}
            <Card className="shadow-sm">
              <CardContent className="px-4 py-3 space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Contact</p>
                {emp.email && (
                  <a href={`mailto:${emp.email}`} className="flex items-center gap-2.5 text-sm text-indigo-500 hover:text-indigo-600 transition-colors">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{emp.email}</span>
                  </a>
                )}
                {emp.mobileNumber && (
                  <a href={`tel:${emp.mobileNumber}`} className="flex items-center gap-2.5 text-sm text-indigo-500 hover:text-indigo-600 transition-colors">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {emp.mobileNumber}
                  </a>
                )}
              </CardContent>
            </Card>

            {/* Tags */}
            {(emp.consultantType || emp.assignedProject) && (
              <Card className="shadow-sm">
                <CardContent className="px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Info</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-md bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      {TYPE_LABELS[emp.consultantType] ?? emp.consultantType}
                    </span>
                    {emp.isHr && (
                      <span className="rounded-md bg-violet-50 dark:bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400">
                        Human Resources
                      </span>
                    )}
                    {emp.assignedProject && (
                      <span className="rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {emp.assignedProject.projectName}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Right main area ───────────────────────────────── */}
          <div className="space-y-4">

            {/* Name + role header */}
            <Card className="shadow-sm">
              <CardContent className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-bold text-foreground">{emp.empName}</h1>
                    <p className="text-sm text-indigo-500 dark:text-indigo-400 font-medium mt-0.5">
                      {TYPE_LABELS[emp.consultantType] ?? emp.consultantType}
                      {emp.isHr ? ' · HR' : ''}
                    </p>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => router.push('/employees')}
                    >
                      Edit Profile
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* About tab content */}
            <Card className="shadow-sm">
              <CardContent className="px-5 py-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-3 border-b">About</p>
                <DetailRow label="Employee ID" value={emp.empCode} highlight />
                <DetailRow label="Full Name" value={emp.empName} highlight />
                <DetailRow label="Email" value={emp.email} highlight />
                <DetailRow label="Phone" value={emp.mobileNumber} highlight />
                <DetailRow
                  label="Role"
                  value={TYPE_LABELS[emp.consultantType] ?? emp.consultantType}
                  highlight
                />
                <DetailRow
                  label="Reports To"
                  value={emp.reportsTo ? `${emp.reportsTo.empName} (${emp.reportsTo.empCode})` : null}
                  highlight
                />
                <DetailRow
                  label="Assigned Project"
                  value={emp.assignedProject ? `${emp.assignedProject.projectName} (${emp.assignedProject.projectCode})` : null}
                  highlight
                />
                <DetailRow
                  label="Date of Birth"
                  value={emp.dateOfBirth ? format(new Date(emp.dateOfBirth + 'T00:00:00'), 'dd MMMM yyyy') : null}
                />
                <DetailRow
                  label="Work Anniversary"
                  value={emp.joiningDate ? format(new Date(emp.joiningDate + 'T00:00:00'), 'dd MMMM yyyy') : null}
                />
                <DetailRow
                  label="Member Since"
                  value={emp.createdAt ? format(new Date(emp.createdAt), 'dd MMMM yyyy') : null}
                />
                <DetailRow
                  label="Status"
                  value={emp.isActive ? 'Active' : 'Inactive'}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
