/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Laptop2,
  Loader2,
  Check,
  X,
  Tag,
  Calendar,
  Building2,
} from 'lucide-react';
import { assetsApi } from '@/lib/api/assets';
import type {
  AssetCategory,
  AssetCondition,
  AssetOwnership,
  AssetVendor,
} from '@/types';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';

// Static enum options. Pulled out of the JSX so the searchable picker
// can also do its own client-side filter on the same source list.
const CATEGORY_OPTIONS = [
  { value: 'laptop', label: 'Laptop' },
  { value: 'desktop', label: 'Desktop' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'phone', label: 'Phone' },
  { value: 'accessory', label: 'Accessory' },
  { value: 'other', label: 'Other (specify)' },
];
const CONDITION_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'damaged', label: 'Damaged' },
];
const OWNERSHIP_OPTIONS = [
  { value: 'owned', label: 'Owned' },
  { value: 'rented', label: 'Rented' },
  { value: 'leased', label: 'Leased' },
];

interface Draft {
  assetTag: string;
  category: AssetCategory;
  categoryOtherName: string;
  brand: string;
  model: string;
  serialNumber: string;
  ownership: AssetOwnership;
  vendorId: string;
  purchaseDate: string;
  purchasePrice: string;
  rentalStart: string;
  rentalEnd: string;
  rentalMonthlyAmount: string;
  warrantyExpiry: string;
  condition: AssetCondition;
  location: string;
  notes: string;
  // Spec bag (laptop-ish — applies to most categories too)
  specCpu: string;
  specRam: string;
  specStorage: string;
  specOs: string;
}

const initialDraft: Draft = {
  assetTag: '',
  category: 'laptop',
  categoryOtherName: '',
  brand: '',
  model: '',
  serialNumber: '',
  ownership: 'owned',
  vendorId: '',
  purchaseDate: '',
  purchasePrice: '',
  rentalStart: '',
  rentalEnd: '',
  rentalMonthlyAmount: '',
  warrantyExpiry: '',
  condition: 'good',
  location: '',
  notes: '',
  specCpu: '',
  specRam: '',
  specStorage: '',
  specOs: '',
};

export default function NewAssetPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';
  const isHr = user?._type === 'employee' && !!(user as any)?.isHr;
  const canManage = isAdmin || isHr;

  useEffect(() => {
    if (user && !canManage) router.replace('/dashboard');
  }, [user, canManage, router]);

  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const { data: vendors } = useQuery({
    queryKey: ['asset-vendors-flat'],
    queryFn: () =>
      assetsApi.listVendors().then((r: any) => r.data?.data ?? r.data ?? []),
    enabled: canManage,
  });

  const createMut = useMutation({
    mutationFn: () => {
      const specs: Record<string, string> = {};
      if (draft.specCpu.trim()) specs.cpu = draft.specCpu.trim();
      if (draft.specRam.trim()) specs.ram = draft.specRam.trim();
      if (draft.specStorage.trim()) specs.storage = draft.specStorage.trim();
      if (draft.specOs.trim()) specs.os = draft.specOs.trim();

      return assetsApi.create({
        assetTag: draft.assetTag.trim(),
        category: draft.category,
        categoryOtherName:
          draft.category === 'other'
            ? draft.categoryOtherName.trim()
            : undefined,
        brand: draft.brand.trim() || undefined,
        model: draft.model.trim() || undefined,
        serialNumber: draft.serialNumber.trim() || undefined,
        ownership: draft.ownership,
        vendorId: draft.vendorId ? Number(draft.vendorId) : undefined,
        purchaseDate:
          draft.ownership === 'owned' && draft.purchaseDate
            ? draft.purchaseDate
            : undefined,
        purchasePrice:
          draft.ownership === 'owned' && draft.purchasePrice
            ? Number(draft.purchasePrice)
            : undefined,
        rentalStart:
          draft.ownership !== 'owned' && draft.rentalStart
            ? draft.rentalStart
            : undefined,
        rentalEnd:
          draft.ownership !== 'owned' && draft.rentalEnd
            ? draft.rentalEnd
            : undefined,
        rentalMonthlyAmount:
          draft.ownership !== 'owned' && draft.rentalMonthlyAmount
            ? Number(draft.rentalMonthlyAmount)
            : undefined,
        warrantyExpiry: draft.warrantyExpiry || undefined,
        condition: draft.condition,
        location: draft.location.trim() || undefined,
        notes: draft.notes.trim() || undefined,
        specs: Object.keys(specs).length ? specs : undefined,
      });
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['assets'] });
      const created = res?.data?.data ?? res?.data;
      toast.success(`${created?.assetTag ?? 'Asset'} created`);
      router.push(`/assets/${created?.id}`);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? 'Failed to create asset'),
  });

  const validateAndSubmit = () => {
    const errs: Record<string, boolean> = {};
    if (!draft.assetTag.trim()) {
      errs.assetTag = true;
    }
    if (draft.category === 'other' && !draft.categoryOtherName.trim()) {
      errs.categoryOtherName = true;
    }
    if (draft.ownership !== 'owned') {
      // rental: monthly amount required
      if (
        !draft.rentalMonthlyAmount ||
        Number(draft.rentalMonthlyAmount) <= 0
      ) {
        errs.rentalMonthlyAmount = true;
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    createMut.mutate();
  };

  const isRental = draft.ownership !== 'owned';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Laptop2 className="h-5 w-5 text-emerald-600" />
            New Asset
          </h1>
          <p className="text-sm text-muted-foreground">
            Add a device to the inventory. Tag is auto-generated by category.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <X className="mr-1 h-3.5 w-3.5" /> Cancel
          </Button>
          <Button
            size="sm"
            onClick={validateAndSubmit}
            disabled={createMut.isPending}
            className="bg-linear-to-r from-emerald-500 to-teal-600 text-white hover:opacity-90 border-0"
          >
            {createMut.isPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="mr-1 h-3.5 w-3.5" />
            )}
            Create
          </Button>
        </div>
      </div>

      {/* Identity */}
      <Section title="Identity" icon={<Tag className="h-3 w-3" />}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Asset Tag *" error={errors.assetTag}>
            <Input
              value={draft.assetTag}
              onChange={(e) =>
                setDraft((p) => ({ ...p, assetTag: e.target.value }))
              }
              placeholder="e.g. LP-CEO-01"
              className={`font-mono ${errors.assetTag ? 'border-red-500' : ''}`}
              maxLength={50}
            />
          </Field>
          <Field label="Category *">
            <SearchableSelect
              value={draft.category}
              onValueChange={(v) =>
                setDraft((p) => ({ ...p, category: v as AssetCategory }))
              }
              options={CATEGORY_OPTIONS}
              placeholder="Search category..."
            />
          </Field>
          {draft.category === 'other' && (
            <Field label="Custom Type *" error={errors.categoryOtherName}>
              <Input
                value={draft.categoryOtherName}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, categoryOtherName: e.target.value }))
                }
                placeholder="e.g. VR headset"
                className={errors.categoryOtherName ? 'border-red-500' : ''}
              />
            </Field>
          )}
          <Field label="Brand">
            <Input
              value={draft.brand}
              onChange={(e) =>
                setDraft((p) => ({ ...p, brand: e.target.value }))
              }
              placeholder="Dell"
            />
          </Field>
          <Field label="Model">
            <Input
              value={draft.model}
              onChange={(e) =>
                setDraft((p) => ({ ...p, model: e.target.value }))
              }
              placeholder="Latitude 5440"
            />
          </Field>
          <Field label="Serial Number">
            <Input
              value={draft.serialNumber}
              onChange={(e) =>
                setDraft((p) => ({ ...p, serialNumber: e.target.value }))
              }
              className="font-mono"
            />
          </Field>
          <Field label="Condition">
            <SearchableSelect
              value={draft.condition}
              onValueChange={(v) =>
                setDraft((p) => ({ ...p, condition: v as AssetCondition }))
              }
              options={CONDITION_OPTIONS}
              placeholder="Search condition..."
            />
          </Field>
        </div>
      </Section>

      {/* Ownership + Vendor */}
      <Section
        title="Ownership"
        icon={<Building2 className="h-3 w-3" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Ownership *">
            <SearchableSelect
              value={draft.ownership}
              onValueChange={(v) =>
                setDraft((p) => ({ ...p, ownership: v as AssetOwnership }))
              }
              options={OWNERSHIP_OPTIONS}
              placeholder="Search ownership..."
            />
          </Field>
          <Field label="Vendor">
            <SearchableSelect
              value={draft.vendorId || 'none'}
              onValueChange={(v) =>
                setDraft((p) => ({ ...p, vendorId: v === 'none' ? '' : v }))
              }
              options={[
                { value: 'none', label: 'No vendor' },
                ...((vendors ?? []) as AssetVendor[]).map((v) => ({
                  value: String(v.id),
                  label: v.name,
                })),
              ]}
              placeholder="Search vendor..."
            />
          </Field>
          <Field label="Warranty Expiry">
            <Input
              type="date"
              value={draft.warrantyExpiry}
              onChange={(e) =>
                setDraft((p) => ({ ...p, warrantyExpiry: e.target.value }))
              }
            />
          </Field>

          {!isRental ? (
            <>
              <Field label="Purchase Date">
                <Input
                  type="date"
                  value={draft.purchaseDate}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, purchaseDate: e.target.value }))
                  }
                />
              </Field>
              <Field label="Purchase Price (₹)">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.purchasePrice}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, purchasePrice: e.target.value }))
                  }
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Rental Start">
                <Input
                  type="date"
                  value={draft.rentalStart}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, rentalStart: e.target.value }))
                  }
                />
              </Field>
              <Field label="Rental End">
                <Input
                  type="date"
                  value={draft.rentalEnd}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, rentalEnd: e.target.value }))
                  }
                />
              </Field>
              <Field
                label="Monthly Amount (₹) *"
                error={errors.rentalMonthlyAmount}
              >
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.rentalMonthlyAmount}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      rentalMonthlyAmount: e.target.value,
                    }))
                  }
                  className={
                    errors.rentalMonthlyAmount ? 'border-red-500' : ''
                  }
                />
              </Field>
            </>
          )}
        </div>
      </Section>

      {/* Specs (free-form) */}
      <Section title="Specs (optional)" icon={<Calendar className="h-3 w-3" />}>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Field label="CPU">
            <Input
              value={draft.specCpu}
              onChange={(e) =>
                setDraft((p) => ({ ...p, specCpu: e.target.value }))
              }
              placeholder="i7-13700"
            />
          </Field>
          <Field label="RAM">
            <Input
              value={draft.specRam}
              onChange={(e) =>
                setDraft((p) => ({ ...p, specRam: e.target.value }))
              }
              placeholder="16GB"
            />
          </Field>
          <Field label="Storage">
            <Input
              value={draft.specStorage}
              onChange={(e) =>
                setDraft((p) => ({ ...p, specStorage: e.target.value }))
              }
              placeholder="512GB SSD"
            />
          </Field>
          <Field label="OS">
            <Input
              value={draft.specOs}
              onChange={(e) =>
                setDraft((p) => ({ ...p, specOs: e.target.value }))
              }
              placeholder="Windows 11 Pro"
            />
          </Field>
        </div>
      </Section>

      {/* Location + Notes */}
      <Section title="Other" icon={<Tag className="h-3 w-3" />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Location">
            <Input
              value={draft.location}
              onChange={(e) =>
                setDraft((p) => ({ ...p, location: e.target.value }))
              }
              
              placeholder="HQ Floor 3"
            />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea
            value={draft.notes}
            onChange={(e) =>
              setDraft((p) => ({ ...p, notes: e.target.value }))
            }
            rows={3}
          />
        </Field>
      </Section>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className={`text-[10px] uppercase tracking-wider font-semibold mb-1 block ${
          error ? 'text-red-500' : 'text-muted-foreground'
        }`}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
