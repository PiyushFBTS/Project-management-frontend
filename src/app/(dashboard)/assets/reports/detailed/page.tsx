/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BarChart3,
  Download,
  ExternalLink,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  assetsApi,
  type AssetDetailedReportRow,
  type DetailedReportFilters,
} from '@/lib/api/assets';
import { employeesApi } from '@/lib/api/employees';
import type {
  AssetCategory,
  AssetStatus,
  AssetVendor,
  Employee,
} from '@/types';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

const CATEGORY_LABEL: Record<AssetCategory, string> = {
  laptop: 'Laptop',
  desktop: 'Desktop',
  monitor: 'Monitor',
  phone: 'Phone',
  accessory: 'Accessory',
  other: 'Other',
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

function formatINR(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return `₹${Number(v).toLocaleString('en-IN')}`;
}

export default function DetailedAssetsReportPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';
  const isHr = user?._type === 'employee' && !!(user as any)?.isHr;
  const canManage = isAdmin || isHr;

  useEffect(() => {
    if (user && !canManage) router.replace('/dashboard');
  }, [user, canManage, router]);

  // ── Filter state ────────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [vendorId, setVendorId] = useState<string>('all');
  const [employeeId, setEmployeeId] = useState<string>('all');
  const [category, setCategory] = useState<AssetCategory | 'all'>('all');
  const [status, setStatus] = useState<AssetStatus | 'all'>('all');

  const filters: DetailedReportFilters = useMemo(
    () => ({
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(vendorId !== 'all' ? { vendorId: Number(vendorId) } : {}),
      ...(employeeId !== 'all' ? { employeeId: Number(employeeId) } : {}),
      ...(category !== 'all' ? { category } : {}),
      ...(status !== 'all' ? { status } : {}),
    }),
    [dateFrom, dateTo, vendorId, employeeId, category, status],
  );

  const { data: vendors } = useQuery({
    queryKey: ['asset-vendors-flat'],
    queryFn: () =>
      assetsApi.listVendors().then((r: any) => r.data?.data ?? r.data ?? []),
    enabled: canManage,
  });

  const { data: employees } = useQuery({
    queryKey: ['employees-for-asset-report'],
    queryFn: () =>
      employeesApi
        .getAll({ limit: 100, isActive: true })
        .then((r: any) => r.data?.data ?? r.data ?? []),
    enabled: canManage,
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ['assets-detailed-report', filters],
    queryFn: () =>
      assetsApi
        .reportsDetailed(filters)
        .then((r: any) => r.data?.data ?? r.data ?? []),
    enabled: canManage,
  });

  const list = (rows ?? []) as AssetDetailedReportRow[];

  // Totals footer
  const totals = useMemo(() => {
    const totalCost = list.reduce(
      (s, r) => s + Number(r.maintenanceTotalCost ?? 0),
      0,
    );
    const totalJobs = list.reduce(
      (s, r) => s + Number(r.maintenanceCount ?? 0),
      0,
    );
    // Monthly rental obligation across rented + leased rows
    const totalMonthlyRent = list.reduce(
      (s, r) =>
        s +
        (r.ownership === 'owned' ? 0 : Number(r.rentalMonthlyAmount ?? 0)),
      0,
    );
    return { totalCost, totalJobs, totalMonthlyRent };
  }, [list]);

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setVendorId('all');
    setEmployeeId('all');
    setCategory('all');
    setStatus('all');
  };

  const [downloading, setDownloading] = useState(false);
  const downloadCsv = async () => {
    setDownloading(true);
    try {
      const res = await assetsApi.reportsDetailedCsv(filters);
      // Axios returns the Blob in res.data when responseType: 'blob'.
      const blob = res.data as unknown as Blob;
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assets-detailed-${date}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded');
    } catch (e: any) {
      // With responseType: 'blob' axios returns the error body as a
      // Blob too. Read + parse it so the user sees the real message
      // (validation errors, 4xx/5xx) instead of the generic fallback.
      let msg = 'CSV download failed';
      const data = e?.response?.data;
      if (data instanceof Blob) {
        try {
          const text = await data.text();
          const parsed = JSON.parse(text);
          if (parsed?.message) {
            msg = Array.isArray(parsed.message)
              ? parsed.message.join(', ')
              : String(parsed.message);
          }
        } catch {
          /* leave default */
        }
      } else if (data?.message) {
        msg = data.message;
      }
      toast.error(msg);
    } finally {
      setDownloading(false);
    }
  };

  const activeFilterCount =
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (vendorId !== 'all' ? 1 : 0) +
    (employeeId !== 'all' ? 1 : 0) +
    (category !== 'all' ? 1 : 0) +
    (status !== 'all' ? 1 : 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/assets/reports">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-600" />
            Detailed Asset Report
          </h1>
          <p className="text-sm text-muted-foreground">
            One row per asset — vendor, latest assignment, holder, and
            maintenance rollup
          </p>
        </div>
        {activeFilterCount > 0 && (
          <Button variant="outline" size="sm" onClick={resetFilters}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
          </Button>
        )}
        <Button
          size="sm"
          onClick={downloadCsv}
          disabled={downloading || list.length === 0}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {downloading ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="mr-1 h-3.5 w-3.5" />
          )}
          CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border bg-card p-4">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">
          Filters {activeFilterCount > 0 && `(${activeFilterCount} active)`}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">
              From Date
            </label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">
              To Date
            </label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">
              Vendor
            </label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All vendors</SelectItem>
                {((vendors ?? []) as AssetVendor[]).map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">
              Employee
            </label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {((employees ?? []) as Employee[]).map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">
              Category
            </label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as AssetCategory | 'all')}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="laptop">Laptop</SelectItem>
                <SelectItem value="desktop">Desktop</SelectItem>
                <SelectItem value="monitor">Monitor</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="accessory">Accessory</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">
              Status
            </label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as AssetStatus | 'all')}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_repair">In Repair</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
                <SelectItem value="returned_to_vendor">
                  Returned to Vendor
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No assets match these filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-24">Tag</TableHead>
                  <TableHead className="min-w-40">Asset</TableHead>
                  <TableHead className="w-24">Category</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="min-w-32">Vendor</TableHead>
                  <TableHead className="min-w-32">Holder</TableHead>
                  <TableHead className="w-28">Assigned</TableHead>
                  <TableHead className="w-28">Returned</TableHead>
                  <TableHead className="w-24">Condition</TableHead>
                  <TableHead className="w-28 text-right">Rent / mo</TableHead>
                  <TableHead className="w-24 text-center">
                    Maint. Jobs
                  </TableHead>
                  <TableHead className="w-28 text-right">
                    Maint. Cost
                  </TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((r) => (
                  <TableRow key={r.assetId} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-xs font-semibold">
                      {r.assetTag}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.assetName || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {CATEGORY_LABEL[r.category] ?? r.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${STATUS_COLORS[r.status]} text-[10px]`}
                      >
                        {r.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.vendorName || '—'}
                      {r.vendorId && (
                        <span className="block text-[10px] text-muted-foreground font-mono">
                          #{r.vendorId}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.employeeName || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDate(r.assignedAt)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.assignmentId == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : r.returnedAt ? (
                        formatDate(r.returnedAt)
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 text-[10px]">
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs capitalize">
                      {r.returnCondition || r.condition}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {r.ownership === 'owned'
                        ? r.purchasePrice
                          ? (
                              <span className="text-muted-foreground">
                                {formatINR(r.purchasePrice)}
                                <span className="block text-[10px]">
                                  purchase
                                </span>
                              </span>
                            )
                          : '—'
                        : formatINR(r.rentalMonthlyAmount)}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {r.maintenanceCount > 0 ? (
                        <span>
                          {r.maintenanceCount}
                          {r.lastMaintenanceType && (
                            <span className="block text-[10px] text-muted-foreground">
                              last: {r.lastMaintenanceType}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatINR(r.maintenanceTotalCost)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/assets/${r.assetId}`}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          title="Open"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals footer */}
                <TableRow className="bg-muted/30 font-semibold">
                  <TableCell colSpan={9} className="text-right text-xs">
                    Total ({list.length} asset{list.length === 1 ? '' : 's'})
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatINR(totals.totalMonthlyRent)}
                    <span className="block text-[10px] font-normal text-muted-foreground">
                      monthly rent
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {totals.totalJobs}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatINR(totals.totalCost)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
