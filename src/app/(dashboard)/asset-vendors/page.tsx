/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2,
  Plus,
  Trash2,
  Pencil,
  Check,
  Loader2,
  Search,
} from 'lucide-react';
import { assetsApi } from '@/lib/api/assets';
import type { AssetVendor } from '@/types';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type VendorDraft = {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  gst: string;
  paymentTerms: string;
  notes: string;
};

const emptyDraft: VendorDraft = {
  name: '',
  contactName: '',
  email: '',
  phone: '',
  address: '',
  gst: '',
  paymentTerms: '',
  notes: '',
};

export default function AssetVendorsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';
  const isHr = user?._type === 'employee' && !!(user as any)?.isHr;
  const canManage = isAdmin || isHr;

  // Admin / HR only — everyone else bounces.
  useEffect(() => {
    if (user && !canManage) router.replace('/dashboard');
  }, [user, canManage, router]);

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AssetVendor | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<VendorDraft>(emptyDraft);

  const { data: vendors, isLoading } = useQuery({
    queryKey: ['asset-vendors', search],
    queryFn: () =>
      assetsApi
        .listVendors(search || undefined)
        .then((r: any) => r.data?.data ?? r.data ?? []),
    enabled: canManage,
  });

  const createMut = useMutation({
    mutationFn: (dto: VendorDraft) =>
      assetsApi.createVendor({
        name: dto.name.trim(),
        contactName: dto.contactName.trim() || undefined,
        email: dto.email.trim() || undefined,
        phone: dto.phone.trim() || undefined,
        address: dto.address.trim() || undefined,
        gst: dto.gst.trim() || undefined,
        paymentTerms: dto.paymentTerms.trim() || undefined,
        notes: dto.notes.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-vendors'] });
      toast.success('Vendor created');
      setDialogOpen(false);
      setDraft(emptyDraft);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? 'Failed to create vendor'),
  });

  const updateMut = useMutation({
    mutationFn: (vars: { id: number; dto: VendorDraft }) =>
      assetsApi.updateVendor(vars.id, {
        name: vars.dto.name.trim(),
        contactName: vars.dto.contactName.trim() || undefined,
        email: vars.dto.email.trim() || undefined,
        phone: vars.dto.phone.trim() || undefined,
        address: vars.dto.address.trim() || undefined,
        gst: vars.dto.gst.trim() || undefined,
        paymentTerms: vars.dto.paymentTerms.trim() || undefined,
        notes: vars.dto.notes.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-vendors'] });
      toast.success('Vendor updated');
      setEditing(null);
      setDialogOpen(false);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? 'Failed to update vendor'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => assetsApi.removeVendor(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-vendors'] });
      toast.success('Vendor deleted');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? 'Failed to delete vendor'),
  });

  const startCreate = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setDialogOpen(true);
  };

  const startEdit = (v: AssetVendor) => {
    setEditing(v);
    setDraft({
      name: v.name ?? '',
      contactName: v.contactName ?? '',
      email: v.email ?? '',
      phone: v.phone ?? '',
      address: v.address ?? '',
      gst: v.gst ?? '',
      paymentTerms: v.paymentTerms ?? '',
      notes: v.notes ?? '',
    });
    setDialogOpen(true);
  };

  const list = (vendors ?? []) as AssetVendor[];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-emerald-600 via-teal-600 to-cyan-600" />
        <div className="relative px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">
                Asset Vendors
              </h1>
              <p className="text-xs sm:text-sm text-white/60">
                {list.length} vendor{list.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          {canManage && (
            <Button
              size="sm"
              className="bg-white text-emerald-700 hover:bg-white/90 border-0 shadow-lg font-semibold"
              onClick={startCreate}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add Vendor
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vendors by name…"
          className="pl-9 h-9"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No vendors yet. Add one to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map((v) => (
            <div
              key={v.id}
              className="group rounded-xl border bg-card p-4 hover:shadow-lg hover:-translate-y-0.5 hover:border-emerald-300/60 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{v.name}</p>
                  {v.contactName && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {v.contactName}
                    </p>
                  )}
                </div>
                {canManage && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-blue-600"
                      onClick={() => startEdit(v)}
                      title="Edit"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-500"
                      onClick={() => {
                        if (confirm(`Delete vendor "${v.name}"?`))
                          deleteMut.mutate(v.id);
                      }}
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                {v.email && <p className="truncate">{v.email}</p>}
                {v.phone && <p>{v.phone}</p>}
                {v.paymentTerms && (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 text-[10px] mt-1">
                    {v.paymentTerms}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / edit dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(v) => {
          if (!v) {
            setDialogOpen(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${editing.name}` : 'New Asset Vendor'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <Field label="Name *">
              <Input
                value={draft.name}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="e.g. Dell India Pvt Ltd"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact Name">
                <Input
                  value={draft.contactName}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, contactName: e.target.value }))
                  }
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={draft.email}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, email: e.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <Input
                  value={draft.phone}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, phone: e.target.value }))
                  }
                />
              </Field>
              <Field label="GST">
                <Input
                  value={draft.gst}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, gst: e.target.value }))
                  }
                />
              </Field>
            </div>
            <Field label="Payment Terms">
              <Input
                value={draft.paymentTerms}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, paymentTerms: e.target.value }))
                }
                placeholder="Net 30"
              />
            </Field>
            <Field label="Address">
              <Textarea
                rows={2}
                value={draft.address}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, address: e.target.value }))
                }
              />
            </Field>
            <Field label="Notes">
              <Textarea
                rows={2}
                value={draft.notes}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, notes: e.target.value }))
                }
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={
                !draft.name.trim() ||
                createMut.isPending ||
                updateMut.isPending
              }
              onClick={() => {
                if (editing) updateMut.mutate({ id: editing.id, dto: draft });
                else createMut.mutate(draft);
              }}
            >
              {createMut.isPending || updateMut.isPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-1 h-3.5 w-3.5" />
              )}
              {editing ? 'Save' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
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
