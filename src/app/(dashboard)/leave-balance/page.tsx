/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Wallet, Info, HeartPulse, Umbrella, HeartHandshake, CalendarDays, Heart, Baby,
} from 'lucide-react';
import { leaveTypesApi } from '@/lib/api/leave-reasons';
import { leaveRequestsApi } from '@/lib/api/leave-requests';
import { useAuth } from '@/providers/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Per-code visual + default quota (mirrors the Flutter sample data)
const TYPE_META: Record<string, { icon: React.ElementType; accent: string; defaultTotal: number }> = {
  CL:  { icon: Umbrella,       accent: 'sky',     defaultTotal: 12 },
  SL:  { icon: HeartPulse,     accent: 'rose',    defaultTotal: 12 },
  BL:  { icon: HeartHandshake, accent: 'slate',   defaultTotal: 5 },
  ML:  { icon: Heart,          accent: 'rose',    defaultTotal: 3 },
  MAT: { icon: Baby,           accent: 'violet',  defaultTotal: 10 },
  PL:  { icon: CalendarDays,   accent: 'emerald', defaultTotal: 15 },
  COMP:{ icon: CalendarDays,   accent: 'violet',  defaultTotal: 5 },
};

const DEFAULT_META = { icon: CalendarDays, accent: 'indigo', defaultTotal: 10 };

// Tailwind class mapping per accent (ensures safelisting via static strings)
const ACCENT: Record<string, { iconBg: string; iconFg: string; text: string; bar: string; ring: string }> = {
  sky:     { iconBg: 'bg-sky-50 dark:bg-sky-950/40',         iconFg: 'text-sky-600 dark:text-sky-400',         text: 'text-sky-600 dark:text-sky-400',         bar: 'bg-sky-500',     ring: 'ring-sky-500/20' },
  rose:    { iconBg: 'bg-rose-50 dark:bg-rose-950/40',       iconFg: 'text-rose-600 dark:text-rose-400',       text: 'text-rose-600 dark:text-rose-400',       bar: 'bg-rose-500',    ring: 'ring-rose-500/20' },
  slate:   { iconBg: 'bg-slate-100 dark:bg-slate-800/60',    iconFg: 'text-slate-600 dark:text-slate-300',     text: 'text-slate-700 dark:text-slate-300',     bar: 'bg-slate-500',   ring: 'ring-slate-500/20' },
  emerald: { iconBg: 'bg-emerald-50 dark:bg-emerald-950/40', iconFg: 'text-emerald-600 dark:text-emerald-400', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500', ring: 'ring-emerald-500/20' },
  violet:  { iconBg: 'bg-violet-50 dark:bg-violet-950/40',   iconFg: 'text-violet-600 dark:text-violet-400',   text: 'text-violet-600 dark:text-violet-400',   bar: 'bg-violet-500',  ring: 'ring-violet-500/20' },
  indigo:  { iconBg: 'bg-indigo-50 dark:bg-indigo-950/40',   iconFg: 'text-indigo-600 dark:text-indigo-400',   text: 'text-indigo-600 dark:text-indigo-400',   bar: 'bg-indigo-500',  ring: 'ring-indigo-500/20' },
};

export default function LeaveBalancePage() {
  const { user } = useAuth();
  const isEmployee = user?._type === 'employee';

  // Pull leave types — backend has both admin and employee endpoints.
  const { data: types = [], isLoading: typesLoading } = useQuery({
    queryKey: ['leave-types-balance', isEmployee],
    queryFn: () =>
      (isEmployee
        ? leaveTypesApi.employeeGetAll({ limit: 100, isActive: true })
        : leaveTypesApi.getAll({ limit: 100, isActive: true })
      ).then((r) => r.data?.data ?? []),
    enabled: !!user,
  });

  // Pull this employee's own leave requests so we can compute "used" per type
  const { data: myLeaves = [], isLoading: leavesLoading } = useQuery({
    queryKey: ['my-leaves-balance'],
    queryFn: () => leaveRequestsApi.getMyLeaves({ limit: 200 }).then((r) => r.data?.data ?? []),
    enabled: !!user && isEmployee,
  });

  const usedByType = useMemo(() => {
    const map: Record<number, number> = {};
    for (const lr of myLeaves) {
      // Count only approved leaves (hr_approved is the final state in this system)
      if (lr.status === 'hr_approved') {
        map[lr.leaveReasonId] = (map[lr.leaveReasonId] ?? 0) + Number(lr.totalDays ?? 0);
      }
    }
    return map;
  }, [myLeaves]);

  const balances = useMemo(() => {
    const EXCLUDE_RE = /\b(sick|paid|public\s*holiday|work\s*from\s*home|wfh)\b/i;
    const isExcluded = (t: any) => {
      const code = String(t.reasonCode ?? '').toUpperCase();
      if (code === 'SL' || code === 'PL' || code === 'PH' || code === 'WFH') return true;
      const name = String(t.reasonName ?? '');
      return EXCLUDE_RE.test(name);
    };
    // Always-on synthetic types so the policy is visible even if HR hasn't created them yet.
    const ALWAYS_SHOW: { reasonCode: string; reasonName: string }[] = [
      { reasonCode: 'BL', reasonName: 'Bereavement Leave' },
      { reasonCode: 'ML', reasonName: 'Marriage Leave' },
      { reasonCode: 'MAT', reasonName: 'Maternity Leave' },
    ];
    const merged = [...(types as any[])];
    for (const fallback of ALWAYS_SHOW) {
      if (!merged.some((t) => String(t.reasonCode ?? '').toUpperCase() === fallback.reasonCode)) {
        merged.push({ id: `synthetic-${fallback.reasonCode}`, ...fallback });
      }
    }
    return merged.filter((t) => !isExcluded(t)).map((t) => {
      const meta = TYPE_META[t.reasonCode] ?? DEFAULT_META;
      const total = meta.defaultTotal;
      const used = Math.min(usedByType[t.id] ?? 0, total);
      const remaining = Math.max(0, total - used);
      return {
        id: t.id,
        code: t.reasonCode,
        name: t.reasonName,
        icon: meta.icon,
        accent: meta.accent,
        total,
        used,
        remaining,
        progress: total === 0 ? 0 : used / total,
      };
    });
  }, [types, usedByType]);

  const totalAllotted = balances.reduce((s, b) => s + b.total, 0);
  const totalUsed = balances.reduce((s, b) => s + b.used, 0);
  const totalRemaining = totalAllotted - totalUsed;

  const isLoading = typesLoading || (isEmployee && leavesLoading);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-br from-blue-600 to-blue-800" />
        <div className="relative px-5 sm:px-6 py-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Leave Balance</h1>
            <p className="text-sm text-white/70">Your annual allowance, what you&apos;ve used, and what&apos;s left</p>
          </div>
        </div>
      </div>

      {/* Summary card */}
      {/* {isLoading ? (
        <Skeleton className="h-24 w-full rounded-2xl" />
      ) : (
        <Card className="overflow-hidden border-0 bg-linear-to-br from-blue-600 to-blue-800 text-white shadow-md">
          <CardContent className="p-5 sm:p-6 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-medium text-white/80">Total Allowance</p>
              <p className="mt-0.5 text-2xl font-bold">{totalAllotted}<span className="ml-1 text-sm font-medium text-white/80">days</span></p>
            </div>
            <div>
              <p className="text-xs font-medium text-white/80">Used</p>
              <p className="mt-0.5 text-2xl font-bold">{totalUsed}<span className="ml-1 text-sm font-medium text-white/80">days</span></p>
            </div>
            <div>
              <p className="text-xs font-medium text-white/80">Remaining</p>
              <p className="mt-0.5 text-2xl font-bold">{totalRemaining}<span className="ml-1 text-sm font-medium text-white/80">days</span></p>
            </div>
          </CardContent>
        </Card>
      )} */}

      {/* Section heading */}
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pl-1">
        Leave Types
      </p>

      {/* Per-type cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : balances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No leave types configured yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {balances.map((b) => {
            const Icon = b.icon;
            const a = ACCENT[b.accent] ?? ACCENT.indigo;
            const pct = Math.round(b.progress * 100);
            return (
              <Card key={b.id} className="shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${a.iconBg}`}>
                      <Icon className={`h-5 w-5 ${a.iconFg}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold">{b.name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground tracking-wider">{b.code}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold tabular-nums">
                        <span className={a.text}>{b.remaining}</span>
                        <span className="text-xs font-medium text-muted-foreground"> / {b.total}</span>
                      </p>
                      <p className="text-[9px] text-muted-foreground">days left</p>
                    </div>
                  </div>

                  <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full ${a.bar} transition-all`}
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{b.used} used</span>
                    <span>{pct}%</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <p>
          Per-type allowance numbers are defaults until your company configures quotas.
          Used days are computed from your HR-approved leave requests.
        </p>
      </div>
    </div>
  );
}
