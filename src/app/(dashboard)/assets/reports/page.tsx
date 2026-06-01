/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  BarChart3,
  Laptop2,
  Building2,
  IndianRupee,
  AlertTriangle,
  CalendarClock,
  ArrowLeft,
} from 'lucide-react';
import { assetsApi, type AssetReportsSummary } from '@/lib/api/assets';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const CATEGORY_COLOR: Record<string, string> = {
  laptop: 'bg-emerald-500',
  desktop: 'bg-blue-500',
  monitor: 'bg-amber-500',
  phone: 'bg-violet-500',
  accessory: 'bg-pink-500',
  other: 'bg-slate-500',
};

const STATUS_COLOR: Record<string, string> = {
  available: 'bg-emerald-500',
  assigned: 'bg-blue-500',
  in_repair: 'bg-amber-500',
  retired: 'bg-slate-500',
  lost: 'bg-red-500',
  returned_to_vendor: 'bg-violet-500',
};

const OWNERSHIP_COLOR: Record<string, string> = {
  owned: 'bg-emerald-500',
  rented: 'bg-amber-500',
  leased: 'bg-violet-500',
};

function formatINR(v: number) {
  return `₹${Number(v ?? 0).toLocaleString('en-IN')}`;
}

export default function AssetsReportsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';
  const isHr = user?._type === 'employee' && !!(user as any)?.isHr;
  const canManage = isAdmin || isHr;

  useEffect(() => {
    if (user && !canManage) router.replace('/dashboard');
  }, [user, canManage, router]);

  const { data, isLoading } = useQuery<AssetReportsSummary>({
    queryKey: ['asset-reports'],
    queryFn: () =>
      assetsApi.reportsSummary(30).then((r: any) => r.data?.data ?? r.data),
    enabled: canManage,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  const t = data.totals;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/assets">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-600" /> Asset Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Inventory rollup · upcoming events within {data.horizonDays} days
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          icon={<Laptop2 className="h-4 w-4" />}
          label="Total Assets"
          value={t.totalAssets.toString()}
          tint="from-emerald-500 to-teal-500"
        />
        <KpiCard
          icon={<Building2 className="h-4 w-4" />}
          label="Owned"
          value={t.ownedCount.toString()}
          tint="from-blue-500 to-cyan-500"
        />
        <KpiCard
          icon={<IndianRupee className="h-4 w-4" />}
          label="Purchase Value"
          value={formatINR(t.purchaseValue)}
          tint="from-violet-500 to-purple-500"
        />
        <KpiCard
          icon={<IndianRupee className="h-4 w-4" />}
          label="Monthly Rent"
          value={formatINR(t.monthlyRent)}
          tint="from-amber-500 to-orange-500"
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label={`Warranty < ${data.horizonDays}d`}
          value={t.warrantyExpiringSoon.toString()}
          tint="from-rose-500 to-pink-500"
        />
        <KpiCard
          icon={<CalendarClock className="h-4 w-4" />}
          label={`Rental < ${data.horizonDays}d`}
          value={t.rentalExpiringSoon.toString()}
          tint="from-fuchsia-500 to-violet-500"
        />
      </div>

      {/* Breakdown bars */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BreakdownCard
          title="By Category"
          rows={data.byCategory.map((r) => ({
            label: r.category.replace(/_/g, ' '),
            value: r.count,
            color: CATEGORY_COLOR[r.category] ?? 'bg-slate-500',
          }))}
        />
        <BreakdownCard
          title="By Status"
          rows={data.byStatus.map((r) => ({
            label: r.status.replace(/_/g, ' '),
            value: r.count,
            color: STATUS_COLOR[r.status] ?? 'bg-slate-500',
          }))}
        />
        <BreakdownCard
          title="By Ownership"
          rows={data.byOwnership.map((r) => ({
            label: r.ownership.replace(/_/g, ' '),
            value: r.count,
            color: OWNERSHIP_COLOR[r.ownership] ?? 'bg-slate-500',
          }))}
        />
      </div>

      {(t.warrantyExpiringSoon > 0 || t.rentalExpiringSoon > 0) && (
        <div className="rounded-xl border bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              Upcoming events
            </p>
            <p className="text-amber-800 dark:text-amber-200/80 mt-1">
              {t.warrantyExpiringSoon > 0 && (
                <>
                  <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400 mr-2">
                    {t.warrantyExpiringSoon} warranty
                  </Badge>
                </>
              )}
              {t.rentalExpiringSoon > 0 && (
                <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400 mr-2">
                  {t.rentalExpiringSoon} rental
                </Badge>
              )}
              event{t.warrantyExpiringSoon + t.rentalExpiringSoon === 1 ? '' : 's'}{' '}
              expiring within {data.horizonDays} days. Recipients with HR/admin
              access also receive in-app reminders at 30 and 7 days out.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-4">
      <div
        className={`absolute -top-4 -right-4 h-16 w-16 rounded-full opacity-20 bg-linear-to-br ${tint}`}
      />
      <div className="relative">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon} <span className="whitespace-nowrap">{label}</span>
        </div>
        <p className="mt-2 text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number; color: string }[];
}) {
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No data.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const pct = Math.round((r.value / total) * 100);
            return (
              <div key={r.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="capitalize">{r.label}</span>
                  <span className="text-muted-foreground">
                    {r.value} <span className="opacity-60">({pct}%)</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${r.color}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
