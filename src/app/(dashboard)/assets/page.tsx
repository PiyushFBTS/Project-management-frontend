/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Laptop2,
  Plus,
  Search,
  ExternalLink,
} from 'lucide-react';
import { assetsApi, FilterAssetsDto } from '@/lib/api/assets';
import type {
  Asset,
  AssetCategory,
  AssetOwnership,
  AssetStatus,
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
  assigned:
    'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  in_repair:
    'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  retired:
    'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400',
  lost:
    'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
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

export default function AssetsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';
  const isHr = user?._type === 'employee' && !!(user as any)?.isHr;
  const canManage = isAdmin || isHr;

  useEffect(() => {
    if (user && !canManage) router.replace('/dashboard');
  }, [user, canManage, router]);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<AssetCategory | 'all'>('all');
  const [status, setStatus] = useState<AssetStatus | 'all'>('all');
  const [ownership, setOwnership] = useState<AssetOwnership | 'all'>('all');

  const filter: FilterAssetsDto = {
    page: 1,
    limit: 100,
    ...(search ? { search } : {}),
    ...(category !== 'all' ? { category } : {}),
    ...(status !== 'all' ? { status } : {}),
    ...(ownership !== 'all' ? { ownership } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['assets', filter],
    queryFn: () =>
      assetsApi.list(filter).then((r: any) => r.data?.data ?? r.data),
    enabled: canManage,
  });

  const list = (data ?? []) as Asset[];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-emerald-600 via-teal-600 to-cyan-600" />
        <div className="relative px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Laptop2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">
                Asset Inventory
              </h1>
              <p className="text-xs sm:text-sm text-white/60">
                {list.length} asset{list.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/assets/reports">
              <Button
                size="sm"
                variant="outline"
                className="bg-white/10 text-white border-white/30 hover:bg-white/20"
              >
                Reports
              </Button>
            </Link>
            <Link href="/asset-vendors">
              <Button
                size="sm"
                variant="outline"
                className="bg-white/10 text-white border-white/30 hover:bg-white/20"
              >
                Vendors
              </Button>
            </Link>
            {canManage && (
              <Link href="/assets/new">
                <Button
                  size="sm"
                  className="bg-white text-emerald-700 hover:bg-white/90 border-0 shadow-lg font-semibold"
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add Asset
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tag / serial / brand / model / holder…"
            className="pl-9 h-9"
          />
        </div>
        <Select
          value={category}
          onValueChange={(v) => setCategory(v as AssetCategory | 'all')}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="laptop">Laptop</SelectItem>
            <SelectItem value="desktop">Desktop</SelectItem>
            <SelectItem value="monitor">Monitor</SelectItem>
            <SelectItem value="phone">Phone</SelectItem>
            <SelectItem value="accessory">Accessory</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as AssetStatus | 'all')}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="in_repair">In Repair</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
            <SelectItem value="returned_to_vendor">Returned to Vendor</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-2">
        <Select
          value={ownership}
          onValueChange={(v) => setOwnership(v as AssetOwnership | 'all')}
        >
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="Ownership" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ownership</SelectItem>
            <SelectItem value="owned">Owned</SelectItem>
            <SelectItem value="rented">Rented</SelectItem>
            <SelectItem value="leased">Leased</SelectItem>
          </SelectContent>
        </Select>
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
            <Laptop2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No assets match these filters.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Tag</TableHead>
                <TableHead>Brand / Model</TableHead>
                <TableHead className="w-28">Category</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-28">Ownership</TableHead>
                <TableHead>Holder</TableHead>
                <TableHead className="w-16 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((a) => (
                <TableRow key={a.id} className="hover:bg-muted/40">
                  <TableCell className="font-mono text-xs font-semibold">
                    {a.assetTag}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">
                      {a.brand || '—'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {a.model || ''}
                      {a.serialNumber ? ` · SN ${a.serialNumber}` : ''}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {a.category === 'other'
                        ? a.categoryOtherName || 'Other'
                        : CATEGORY_LABEL[a.category]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${STATUS_COLORS[a.status]} text-[10px]`}>
                      {a.status.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs capitalize">
                    {a.ownership}
                  </TableCell>
                  <TableCell className="text-sm">
                    {a.currentHolder ? (
                      <span>{a.currentHolder.userName}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/assets/${a.id}`}>
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
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
