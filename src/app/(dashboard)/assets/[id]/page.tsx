/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Laptop2,
  Pencil,
  UserPlus,
  UserMinus,
  Wrench,
  Loader2,
  Check,
  Trash2,
  Plus,
  Undo2,
} from 'lucide-react';
import { assetsApi } from '@/lib/api/assets';
import { employeesApi } from '@/lib/api/employees';
import type {
  Asset,
  AssetAssignment,
  AssetCondition,
  AssetMaintenance,
  AssetMaintenanceStatus,
  AssetMaintenanceStatusChange,
  AssetMaintenanceType,
  AssetStatus,
  AssetVendor,
} from '@/types';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';

const ASSET_CONDITION_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'damaged', label: 'Damaged' },
];

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

const M_STATUS_COLORS: Record<AssetMaintenanceStatus, string> = {
  scheduled:
    'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400',
  in_progress:
    'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  completed:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
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

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';
  const isHr = user?._type === 'employee' && !!(user as any)?.isHr;
  const canManage = isAdmin || isHr;

  useEffect(() => {
    if (user && !canManage) router.replace('/dashboard');
  }, [user, canManage, router]);

  const [tab, setTab] = useState<'overview' | 'assignments' | 'maintenance'>(
    'overview',
  );

  const { data: asset, isLoading } = useQuery({
    queryKey: ['asset', id],
    queryFn: () =>
      assetsApi.getOne(Number(id)).then((r: any) => r.data?.data ?? r.data),
    enabled: canManage,
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (!asset) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Asset not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <DetailHeader asset={asset} onBack={() => router.back()} />

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(['overview', 'assignments', 'maintenance'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-semibold capitalize border-b-2 ${
              tab === t
                ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <OverviewTab asset={asset} canManage={canManage} qc={qc} />
      )}
      {tab === 'assignments' && (
        <AssignmentsTab asset={asset} canManage={canManage} qc={qc} />
      )}
      {tab === 'maintenance' && (
        <MaintenanceTab asset={asset} canManage={canManage} qc={qc} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────
function DetailHeader({ asset, onBack }: { asset: Asset; onBack: () => void }) {
  return (
    <div className="flex items-start gap-3">
      <Button variant="ghost" size="icon" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Laptop2 className="h-5 w-5 text-emerald-600" />
            <span className="font-mono">{asset.assetTag}</span>
          </h1>
          <Badge className={`${STATUS_COLORS[asset.status]} text-[10px]`}>
            {asset.status.replace(/_/g, ' ')}
          </Badge>
          <Badge variant="outline" className="text-[10px] capitalize">
            {asset.ownership}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {asset.brand} {asset.model}
          {asset.serialNumber ? ` · SN ${asset.serialNumber}` : ''}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Overview tab
// ─────────────────────────────────────────────────────────────────────
function OverviewTab({
  asset,
  canManage,
  qc,
}: {
  asset: Asset;
  canManage: boolean;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    assetTag: asset.assetTag,
    brand: asset.brand ?? '',
    model: asset.model ?? '',
    serialNumber: asset.serialNumber ?? '',
    location: asset.location ?? '',
    notes: asset.notes ?? '',
    condition: asset.condition,
    status: asset.status,
  });

  const updateMut = useMutation({
    mutationFn: () =>
      assetsApi.update(asset.id, {
        assetTag: form.assetTag,
        brand: form.brand,
        model: form.model,
        serialNumber: form.serialNumber,
        location: form.location,
        notes: form.notes,
        condition: form.condition,
        status: form.status,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset', String(asset.id)] });
      toast.success('Asset updated');
      setEditing(false);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? 'Failed to update'),
  });

  const retireMut = useMutation({
    mutationFn: () => assetsApi.remove(asset.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset', String(asset.id)] });
      toast.success('Asset retired');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? 'Failed to retire'),
  });

  const recallMut = useMutation({
    mutationFn: () => assetsApi.update(asset.id, { status: 'available' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset', String(asset.id)] });
      toast.success('Asset recalled — now available');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? 'Failed to recall'),
  });

  const specs = asset.specs ?? {};

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Details</h2>
          {canManage && !editing && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
            </Button>
          )}
          {editing && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => updateMut.mutate()}
                disabled={updateMut.isPending}
              >
                {updateMut.isPending ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="mr-1 h-3.5 w-3.5" />
                )}
                Save
              </Button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SmallField label="Asset Tag">
              <Input
                value={form.assetTag}
                onChange={(e) =>
                  setForm((p) => ({ ...p, assetTag: e.target.value }))
                }
                className="font-mono"
                maxLength={50}
              />
            </SmallField>
            <SmallField label="Brand">
              <Input
                value={form.brand}
                onChange={(e) =>
                  setForm((p) => ({ ...p, brand: e.target.value }))
                }
              />
            </SmallField>
            <SmallField label="Model">
              <Input
                value={form.model}
                onChange={(e) =>
                  setForm((p) => ({ ...p, model: e.target.value }))
                }
              />
            </SmallField>
            <SmallField label="Serial Number">
              <Input
                value={form.serialNumber}
                onChange={(e) =>
                  setForm((p) => ({ ...p, serialNumber: e.target.value }))
                }
              />
            </SmallField>
            <SmallField label="Condition">
              <SearchableSelect
                value={form.condition}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, condition: v as AssetCondition }))
                }
                options={ASSET_CONDITION_OPTIONS}
                placeholder="Search condition..."
              />
            </SmallField>
            <SmallField label="Status">
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, status: v as AssetStatus }))
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
            </SmallField>
            <SmallField label="Location">
              <Input
                value={form.location}
                onChange={(e) =>
                  setForm((p) => ({ ...p, location: e.target.value }))
                }
              />
            </SmallField>
            <div className="sm:col-span-3">
              <SmallField label="Notes">
                <Textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, notes: e.target.value }))
                  }
                />
              </SmallField>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
            <KV k="Category">
              {asset.category === 'other'
                ? asset.categoryOtherName || 'Other'
                : asset.category}
            </KV>
            <KV k="Condition">{asset.condition}</KV>
            <KV k="Vendor">{asset.vendor?.name ?? '—'}</KV>
            <KV k="Location">{asset.location || '—'}</KV>
            <KV k="Warranty">{formatDate(asset.warrantyExpiry)}</KV>
            {asset.ownership === 'owned' ? (
              <>
                <KV k="Purchase Date">{formatDate(asset.purchaseDate)}</KV>
                <KV k="Purchase Price">
                  {asset.purchasePrice
                    ? `₹${Number(asset.purchasePrice).toLocaleString('en-IN')}`
                    : '—'}
                </KV>
              </>
            ) : (
              <>
                <KV k="Rental Start">{formatDate(asset.rentalStart)}</KV>
                <KV k="Rental End">{formatDate(asset.rentalEnd)}</KV>
                <KV k="Monthly Amount">
                  {asset.rentalMonthlyAmount
                    ? `₹${Number(asset.rentalMonthlyAmount).toLocaleString(
                        'en-IN',
                      )}`
                    : '—'}
                </KV>
              </>
            )}
            {asset.notes && (
              <div className="sm:col-span-3">
                <KV k="Notes">{asset.notes}</KV>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Specs */}
      {Object.keys(specs).length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">Specs</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {Object.entries(specs).map(([k, v]) => (
              <KV key={k} k={k}>
                {String(v ?? '—')}
              </KV>
            ))}
          </div>
        </div>
      )}

      {canManage && asset.status !== 'retired' && (
        <div className="rounded-xl border bg-card p-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Retiring marks this asset as out of service. Assignment history is
            preserved.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm('Retire this asset?')) retireMut.mutate();
            }}
            className="text-red-600 border-red-300 hover:bg-red-50"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Retire
          </Button>
        </div>
      )}

      {canManage && asset.status === 'retired' && (
        <div className="rounded-xl border bg-emerald-50/40 dark:bg-emerald-500/5 border-emerald-300 dark:border-emerald-500/30 p-4 flex items-center justify-between">
          <p className="text-sm text-emerald-800 dark:text-emerald-200">
            This asset is retired. Recall it to put it back in active service.
          </p>
          <Button
            size="sm"
            onClick={() => {
              if (confirm('Recall this asset and mark it available?'))
                recallMut.mutate();
            }}
            disabled={recallMut.isPending}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Undo2 className="mr-1 h-3.5 w-3.5" /> Recall
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Assignments tab
// ─────────────────────────────────────────────────────────────────────
function AssignmentsTab({
  asset,
  canManage,
  qc,
}: {
  asset: Asset;
  canManage: boolean;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnNotes, setReturnNotes] = useState('');
  const [userId, setUserId] = useState('');
  const [notes, setNotes] = useState('');

  const { data: assignments } = useQuery({
    queryKey: ['asset-assignments', asset.id],
    queryFn: () =>
      assetsApi
        .getAssignments(asset.id)
        .then((r: any) => r.data?.data ?? r.data ?? []),
    enabled: canManage,
  });

  const { data: employees } = useQuery({
    queryKey: ['employees-for-asset-assign'],
    queryFn: () =>
      employeesApi
        .getAll({ limit: 100, isActive: true })
        .then((r: any) => r.data?.data ?? r.data ?? []),
    enabled: assignOpen,
  });

  const assignMut = useMutation({
    mutationFn: () =>
      assetsApi.assign(asset.id, {
        userId: Number(userId),
        notes: notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset', String(asset.id)] });
      qc.invalidateQueries({ queryKey: ['asset-assignments', asset.id] });
      toast.success('Asset assigned');
      setAssignOpen(false);
      setUserId('');
      setNotes('');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? 'Failed to assign'),
  });

  const unassignMut = useMutation({
    mutationFn: () =>
      assetsApi.unassign(asset.id, {
        returnNotes: returnNotes.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset', String(asset.id)] });
      qc.invalidateQueries({ queryKey: ['asset-assignments', asset.id] });
      toast.success('Asset returned');
      setReturnOpen(false);
      setReturnNotes('');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? 'Failed to unassign'),
  });

  const list = (assignments ?? []) as AssetAssignment[];
  const isAssigned = asset.status === 'assigned';

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="rounded-xl border bg-card p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">
              {isAssigned ? 'Currently assigned' : 'No active assignment'}
            </p>
            {isAssigned && asset.currentHolder && (
              <p className="text-xs text-muted-foreground mt-0.5">
                With {asset.currentHolder.userName} since{' '}
                {formatDate(asset.currentHolder.assignedAt)}
              </p>
            )}
          </div>
          {isAssigned ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setReturnOpen(true)}
              disabled={unassignMut.isPending}
            >
              <UserMinus className="mr-1 h-3.5 w-3.5" /> Return
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setAssignOpen(true)}
              disabled={
                asset.status === 'retired' ||
                asset.status === 'lost' ||
                asset.status === 'in_repair'
              }
            >
              <UserPlus className="mr-1 h-3.5 w-3.5" /> Assign
            </Button>
          )}
        </div>
      )}

      <div className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold mb-3">History</h2>
        {list.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            No assignment history.
          </p>
        ) : (
          <div className="space-y-2">
            {list.map((a) => (
              <div
                key={a.id}
                className="rounded-lg border bg-background p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    {a.user?.name ?? `User #${a.userId}`}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      a.returnedAt
                        ? 'text-slate-500'
                        : 'text-emerald-700 border-emerald-300'
                    }`}
                  >
                    {a.returnedAt ? 'Returned' : 'Active'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Assigned {formatDate(a.assignedAt)}
                  {a.assignedBy ? ` by ${a.assignedBy.name}` : ''}
                </p>
                {a.returnedAt && (
                  <p className="text-xs text-muted-foreground">
                    Returned {formatDate(a.returnedAt)}
                    {a.user ? ` by ${a.user.name}` : ''}
                    {a.returnCondition ? ` · condition: ${a.returnCondition}` : ''}
                  </p>
                )}
                {(a.notes || a.returnNotes) && (
                  <p className="text-xs mt-1 italic">
                    {a.notes && <>“{a.notes}”</>}
                    {a.returnNotes && (
                      <>
                        {a.notes && ' · '}
                        return: “{a.returnNotes}”
                      </>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign asset</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <SmallField label="Assign to *">
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Pick an employee" />
                </SelectTrigger>
                <SelectContent>
                  {((employees ?? []) as any[]).map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.name} {e.empCode ? `· ${e.empCode}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SmallField>
            <SmallField label="Notes">
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </SmallField>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => assignMut.mutate()}
              disabled={!userId || assignMut.isPending}
            >
              {assignMut.isPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-1 h-3.5 w-3.5" />
              )}
              Assign
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Return confirmation dialog */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Return asset?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">
              Return{' '}
              <span className="font-mono font-semibold">{asset.assetTag}</span>
              {asset.currentHolder
                ? ` from ${asset.currentHolder.userName}`
                : ''}
              ? The asset will become available for re-assignment.
            </p>
            <SmallField label="Return notes (optional)">
              <Textarea
                rows={2}
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="Condition, accessories handed back, …"
              />
            </SmallField>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setReturnOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => unassignMut.mutate()}
              disabled={unassignMut.isPending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {unassignMut.isPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserMinus className="mr-1 h-3.5 w-3.5" />
              )}
              Return
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Maintenance tab
// ─────────────────────────────────────────────────────────────────────
function MaintenanceTab({
  asset,
  canManage,
  qc,
}: {
  asset: Asset;
  canManage: boolean;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<AssetMaintenanceType>('repair');
  const [vendorId, setVendorId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [status, setStatus] = useState<AssetMaintenanceStatus>('scheduled');

  const { data: jobs } = useQuery({
    queryKey: ['asset-maintenance', asset.id],
    queryFn: () =>
      assetsApi
        .getMaintenance(asset.id)
        .then((r: any) => r.data?.data ?? r.data ?? []),
    enabled: canManage,
  });

  const { data: vendors } = useQuery({
    queryKey: ['asset-vendors-flat'],
    queryFn: () =>
      assetsApi.listVendors().then((r: any) => r.data?.data ?? r.data ?? []),
    enabled: open,
  });

  const createMut = useMutation({
    mutationFn: () =>
      assetsApi.createMaintenance(asset.id, {
        type,
        vendorId: vendorId ? Number(vendorId) : undefined,
        startDate,
        description,
        cost: cost ? Number(cost) : undefined,
        status,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset', String(asset.id)] });
      qc.invalidateQueries({ queryKey: ['asset-maintenance', asset.id] });
      toast.success('Maintenance job created');
      setOpen(false);
      setStartDate('');
      setDescription('');
      setCost('');
      setVendorId('');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? 'Failed to create job'),
  });

  const updateStatusMut = useMutation({
    mutationFn: (vars: { mId: number; status: AssetMaintenanceStatus }) =>
      assetsApi.updateMaintenance(asset.id, vars.mId, { status: vars.status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset', String(asset.id)] });
      qc.invalidateQueries({ queryKey: ['asset-maintenance', asset.id] });
      toast.success('Status updated');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (mId: number) => assetsApi.deleteMaintenance(asset.id, mId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset', String(asset.id)] });
      qc.invalidateQueries({ queryKey: ['asset-maintenance', asset.id] });
      toast.success('Removed');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const list = (jobs ?? []) as AssetMaintenance[];

  // Active: jobs currently in scheduled / in_progress — one card per
  // job, fully editable, status pill matches the live row.
  const active = list.filter(
    (j) => j.status === 'scheduled' || j.status === 'in_progress',
  );

  // History: jobs that have reached a terminal state. Each statusHistory
  // entry on those jobs becomes its own read-only card so the timeline
  // shows every transition (e.g. one card for in_progress and one for
  // completed when a single job moved through both).
  const terminalJobs = list.filter(
    (j) => j.status === 'completed' || j.status === 'cancelled',
  );
  type HistoryCard = { job: AssetMaintenance; entry: AssetMaintenanceStatusChange };
  const history: HistoryCard[] = terminalJobs
    .flatMap((j) =>
      (j.statusHistory ?? []).map((entry) => ({ job: j, entry })),
    )
    .sort(
      (a, b) =>
        new Date(b.entry.changedAt).getTime() -
        new Date(a.entry.changedAt).getTime(),
    );

  // Aggregate stats — count terminal jobs once, sum cost from the live
  // row (historical cost snapshots aren't stored).
  const completed = terminalJobs.filter((j) => j.status === 'completed');
  const totalCost = completed.reduce(
    (s, j) => s + (Number(j.cost) || 0),
    0,
  );
  const lastCompletedDate =
    completed.length > 0
      ? completed
          .map((j) => j.endDate ?? j.startDate)
          .sort()
          .pop() ?? null
      : null;

  // Read-only card for a historical status snapshot. Shows the job's
  // current data (vendor / cost / description) overlaid with the
  // historical status pill + when/who changed it. Cancel actions are
  // hidden — past events aren't editable.
  const renderHistoryCard = (h: HistoryCard) => {
    const { job: j, entry } = h;
    return (
      <div
        key={`${j.id}-${entry.id}`}
        className="rounded-lg border bg-background p-3 text-sm"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-semibold capitalize">{j.type}</span>
            <Badge className={`${M_STATUS_COLORS[entry.toStatus]} text-[10px]`}>
              {entry.toStatus.replace(/_/g, ' ')}
            </Badge>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {formatDate(entry.changedAt)}
            {entry.changedBy ? ` · ${entry.changedBy.name}` : ''}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDate(j.startDate)}
          {j.endDate ? ` → ${formatDate(j.endDate)}` : ''}
          {j.vendor ? ` · ${j.vendor.name}` : ''}
          {j.cost
            ? ` · ₹${Number(j.cost).toLocaleString('en-IN')}`
            : ''}
        </p>
        <p className="text-xs mt-1">{j.description}</p>
      </div>
    );
  };

  const renderJob = (j: AssetMaintenance) => (
    <div
      key={j.id}
      className="rounded-lg border bg-background p-3 text-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-3.5 w-3.5 text-emerald-600" />
          <span className="font-semibold capitalize">{j.type}</span>
          <Badge className={`${M_STATUS_COLORS[j.status]} text-[10px]`}>
            {j.status.replace(/_/g, ' ')}
          </Badge>
        </div>
        {canManage && (
          <div className="flex items-center gap-1">
            <Select
              value={j.status}
              onValueChange={(v) =>
                updateStatusMut.mutate({
                  mId: j.id,
                  status: v as AssetMaintenanceStatus,
                })
              }
            >
              <SelectTrigger className="h-7 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">scheduled</SelectItem>
                <SelectItem value="in_progress">in_progress</SelectItem>
                <SelectItem value="completed">completed</SelectItem>
                <SelectItem value="cancelled">cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-red-500"
              onClick={() => {
                if (confirm('Delete this job?')) deleteMut.mutate(j.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {formatDate(j.startDate)}
        {j.endDate ? ` → ${formatDate(j.endDate)}` : ''}
        {j.vendor ? ` · ${j.vendor.name}` : ''}
        {j.cost
          ? ` · ₹${Number(j.cost).toLocaleString('en-IN')}`
          : ''}
      </p>
      <p className="text-xs mt-1">{j.description}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold">Maintenance</h2>
        {canManage && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> New Job
          </Button>
        )}
      </div>

      {/* Summary stats — only meaningful once there's at least one row */}
      {list.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard label="Total Jobs" value={list.length.toString()} />
          <StatCard
            label="Completed"
            value={completed.length.toString()}
            tint="emerald"
          />
          <StatCard
            label="Total Cost"
            value={`₹${totalCost.toLocaleString('en-IN')}`}
            tint="blue"
          />
          <StatCard
            label="Last Completed"
            value={lastCompletedDate ? formatDate(lastCompletedDate) : '—'}
            tint="violet"
          />
        </div>
      )}

      {/* Active jobs (scheduled + in_progress) */}
      <div>
        <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
          Active {active.length > 0 && `(${active.length})`}
        </h3>
        <div className="rounded-xl border bg-card p-4">
          {active.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No active jobs.
            </p>
          ) : (
            <div className="space-y-2">{active.map(renderJob)}</div>
          )}
        </div>
      </div>

      {/* History — one card per status transition on completed/cancelled
          jobs, newest first */}
      <div>
        <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
          History {history.length > 0 && `(${history.length})`}
        </h3>
        <div className="rounded-xl border bg-card p-4">
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No completed or cancelled jobs yet.
            </p>
          ) : (
            <div className="space-y-2">{history.map(renderHistoryCard)}</div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New maintenance job</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <SmallField label="Type *">
              <Select
                value={type}
                onValueChange={(v) =>
                  setType(v as AssetMaintenanceType)
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="repair">Repair</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                  <SelectItem value="upgrade">Upgrade</SelectItem>
                </SelectContent>
              </Select>
            </SmallField>
            <SmallField label="Vendor">
              <Select
                value={vendorId || 'none'}
                onValueChange={(v) => setVendorId(v === 'none' ? '' : v)}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Optional vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No vendor</SelectItem>
                  {((vendors ?? []) as AssetVendor[]).map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SmallField>
            <SmallField label="Start Date *">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </SmallField>
            <SmallField label="Status">
              <Select
                value={status}
                onValueChange={(v) =>
                  setStatus(v as AssetMaintenanceStatus)
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </SmallField>
            <SmallField label="Cost (₹)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </SmallField>
            <SmallField label="Description *">
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </SmallField>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={
                !startDate || !description.trim() || createMut.isPending
              }
            >
              {createMut.isPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-1 h-3.5 w-3.5" />
              )}
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────
function KV({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        {k}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint?: 'emerald' | 'blue' | 'violet';
}) {
  const accent =
    tint === 'emerald'
      ? 'text-emerald-700 dark:text-emerald-400'
      : tint === 'blue'
        ? 'text-blue-700 dark:text-blue-400'
        : tint === 'violet'
          ? 'text-violet-700 dark:text-violet-400'
          : 'text-foreground';
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-base font-bold ${accent}`}>{value}</div>
    </div>
  );
}

function SmallField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">
        {label}
      </label>
      {children}
    </div>
  );
}
