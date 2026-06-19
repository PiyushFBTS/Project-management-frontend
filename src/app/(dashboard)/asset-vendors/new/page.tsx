/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Building2, Loader2 } from 'lucide-react';
import { assetsApi } from '@/lib/api/assets';
import { apiErrorMessage } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

const defaultDraft = {
  name: '',
  contactName: '',
  email: '',
  phone: '',
  address: '',
  gst: '',
  paymentTerms: '',
  notes: '',
};

export default function NewAssetVendorPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';
  const isHr = user?._type === 'employee' && !!(user as any)?.isHr;
  const canManage = isAdmin || isHr;

  // Vendors are admin/HR only — bounce others. Mirrors the gate on
  // the listing page so a direct link can't bypass it.
  useEffect(() => {
    if (user && !canManage) router.replace('/dashboard');
  }, [user, canManage, router]);

  const [draft, setDraft] = useState({ ...defaultDraft });
  const [error, setError] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () =>
      assetsApi.createVendor({
        name: draft.name.trim(),
        contactName: draft.contactName.trim() || undefined,
        email: draft.email.trim() || undefined,
        phone: draft.phone.trim() || undefined,
        address: draft.address.trim() || undefined,
        gst: draft.gst.trim() || undefined,
        paymentTerms: draft.paymentTerms.trim() || undefined,
        notes: draft.notes.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-vendors'] });
      toast.success('Vendor created');
      router.push('/asset-vendors');
    },
    onError: (e: any) => setError(apiErrorMessage(e) ?? 'Failed to create vendor'),
  });

  const handleSave = () => {
    setError(null);
    if (!draft.name.trim()) {
      setError('Vendor name is required');
      return;
    }
    createMut.mutate();
  };

  const saving = createMut.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/asset-vendors')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-emerald-500 to-teal-700 text-white shadow-sm">
            <Building2 className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold">New Asset Vendor</h1>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-950/20">
          <CardContent className="p-3 text-xs text-red-600 dark:text-red-400">
            <p className="font-semibold mb-1">Please fix the following:</p>
            {error.split('\n').map((line, i) => <p key={i}>• {line}</p>)}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardContent className="p-5 sm:p-6 space-y-6">
          <Section title="Vendor Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label="Name" required>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Enter name"
                />
              </Field>
              <Field label="Contact Name">
                <Input
                  value={draft.contactName}
                  onChange={(e) => setDraft((p) => ({ ...p, contactName: e.target.value }))}
                  placeholder="Enter contact name"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))}
                  placeholder="Enter email"
                />
              </Field>
              <Field label="Phone">
                <Input
                  value={draft.phone}
                  onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="Enter phone"
                />
              </Field>
              <Field label="GST">
                <Input
                  value={draft.gst}
                  onChange={(e) => setDraft((p) => ({ ...p, gst: e.target.value }))}
                  placeholder="Enter GST"
                />
              </Field>
              <Field label="Payment Terms">
                <Input
                  value={draft.paymentTerms}
                  onChange={(e) => setDraft((p) => ({ ...p, paymentTerms: e.target.value }))}
                  placeholder="Enter payment terms"
                />
              </Field>
            </div>
          </Section>

          <Section title="Address & Notes">
            <div className="grid grid-cols-1 gap-3">
              <Field label="Address">
                <Textarea
                  rows={2}
                  value={draft.address}
                  onChange={(e) => setDraft((p) => ({ ...p, address: e.target.value }))}
                  placeholder="Enter address"
                />
              </Field>
              <Field label="Notes">
                <Textarea
                  rows={3}
                  value={draft.notes}
                  onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Preferred supplier for laptops; ships next-day."
                />
              </Field>
            </div>
          </Section>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => router.push('/asset-vendors')} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-linear-to-r from-emerald-500 to-teal-700 hover:from-emerald-600 hover:to-teal-800 text-white shadow-sm"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create vendor
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}
