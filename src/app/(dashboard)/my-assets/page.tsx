/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery } from '@tanstack/react-query';
import { Laptop2 } from 'lucide-react';
import { assetsApi } from '@/lib/api/assets';
import type { Asset, AssetAssignment, AssetStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_COLORS: Record<AssetStatus, string> = {
  available:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  assigned: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  in_repair:
    'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  retired:
    'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400',
  lost: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  returned_to_vendor:
    'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
};

function formatDate(s: string | null | undefined) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function MyAssetsPage() {
  const { data: active, isLoading: loadingActive } = useQuery({
    queryKey: ['my-assets-active'],
    queryFn: () =>
      assetsApi.myActive().then((r: any) => r.data?.data ?? r.data ?? []),
  });

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ['my-assets-history'],
    queryFn: () =>
      assetsApi.myHistory().then((r: any) => r.data?.data ?? r.data ?? []),
  });

  const activeList = (active ?? []) as Asset[];
  const historyList = (history ?? []) as AssetAssignment[];
  const past = historyList.filter((h) => !!h.returnedAt);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-cyan-600 via-emerald-600 to-teal-600" />
        <div className="relative px-4 sm:px-6 py-4 sm:py-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Laptop2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white">My Assets</h1>
            <p className="text-xs sm:text-sm text-white/60">
              Devices currently assigned to you
            </p>
          </div>
        </div>
      </div>

      {/* Active */}
      <div>
        <h2 className="text-sm font-semibold mb-2">Currently Assigned</h2>
        {loadingActive ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : activeList.length === 0 ? (
          <div className="rounded-xl border bg-card text-center py-10">
            <Laptop2 className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No assets are currently assigned to you.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeList.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono text-sm font-semibold">
                    {a.assetTag}
                  </span>
                  <Badge className={`${STATUS_COLORS[a.status]} text-[10px]`}>
                    {a.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <p className="text-sm font-semibold">
                  {a.brand} {a.model}
                </p>
                {a.serialNumber && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    SN {a.serialNumber}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-1 mt-3 text-[11px] text-muted-foreground">
                  <span>Category</span>
                  <span className="capitalize">
                    {a.category === 'other'
                      ? a.categoryOtherName || 'Other'
                      : a.category}
                  </span>
                  <span>Condition</span>
                  <span className="capitalize">{a.condition}</span>
                  {a.warrantyExpiry && (
                    <>
                      <span>Warranty</span>
                      <span>{formatDate(a.warrantyExpiry)}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      <div>
        <h2 className="text-sm font-semibold mb-2">Previously Held</h2>
        {loadingHistory ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : past.length === 0 ? (
          <div className="rounded-xl border bg-card text-center py-8 text-xs text-muted-foreground">
            No previous assignments.
          </div>
        ) : (
          <div className="rounded-xl border bg-card divide-y">
            {past.map((h) => (
              <div key={h.id} className="px-4 py-3 text-sm flex items-center gap-3">
                <span className="font-mono text-xs font-semibold w-20">
                  {h.asset?.assetTag ?? '—'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate">
                    {h.asset?.brand} {h.asset?.model}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDate(h.assignedAt)} → {formatDate(h.returnedAt)}
                  </p>
                </div>
                {h.returnCondition && (
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {h.returnCondition}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
