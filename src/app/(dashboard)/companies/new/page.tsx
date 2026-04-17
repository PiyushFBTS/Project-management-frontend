/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Building2, Loader2, Upload, X } from 'lucide-react';
import { companiesApi, CreateCompanyDto } from '@/lib/api/companies';
import { lookupApi } from '@/lib/api/lookup';
import { LookupCountry, LookupState, LookupCity, LookupCurrency, LookupPostalCode } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const defaultForm = {
  name: '', slug: '', companyCode: '', contactPersonName: '', contactEmail: '', contactPhone: '', address: '',
  subscriptionPlan: 'trial', userLimit: '50', licenseExpiryDate: '',
  countryId: '', stateId: '', cityId: '', postalCode: '',
  gstNumber: '', panNumber: '', taxId: '', gstin: '', taxRegistrationNumber: '',
  gstEnabled: false, vatEnabled: false, baseCurrencyCode: '',
};

const extractArray = (res: any): any[] => {
  const d = res?.data;
  return Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
};

export default function NewCompanyPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const isEditing = !!editId;

  const [form, setForm] = useState({ ...defaultForm });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [countries, setCountries] = useState<LookupCountry[]>([]);
  const [states, setStates] = useState<LookupState[]>([]);
  const [cities, setCities] = useState<LookupCity[]>([]);
  const [currencies, setCurrencies] = useState<LookupCurrency[]>([]);
  const [postalCodes, setPostalCodes] = useState<LookupPostalCode[]>([]);

  // Load existing company data when editing
  const { data: existing } = useQuery({
    queryKey: ['company-for-edit', editId],
    queryFn: async () => {
      const res = await companiesApi.getAll({ limit: 200 });
      const all = extractArray(res) as any[];
      return all.find((c) => String(c.id) === editId) ?? null;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (existing) {
      const c = existing;
      const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';
      setForm({
        name: c.name, slug: c.slug,
        companyCode: c.companyCode ?? '',
        contactPersonName: c.contactPersonName ?? '',
        contactEmail: c.contactEmail ?? '', contactPhone: c.contactPhone ?? '',
        address: c.address ?? '', subscriptionPlan: c.subscriptionPlan,
        userLimit: String(c.userLimit), licenseExpiryDate: c.licenseExpiryDate,
        countryId: c.countryId ? String(c.countryId) : '',
        stateId: c.stateId ? String(c.stateId) : '',
        cityId: c.cityId ? String(c.cityId) : '',
        postalCode: c.postalCode ?? '',
        gstNumber: c.gstNumber ?? '', panNumber: c.panNumber ?? '',
        taxId: c.taxId ?? '', gstin: c.gstin ?? '',
        taxRegistrationNumber: c.taxRegistrationNumber ?? '',
        gstEnabled: c.gstEnabled ?? false, vatEnabled: c.vatEnabled ?? false,
        baseCurrencyCode: c.baseCurrencyCode ?? '',
      });
      setLogoPreview(c.logoUrl ? `${apiBase}${c.logoUrl}` : null);
    }
  }, [existing]);

  // Lookups
  useEffect(() => {
    lookupApi.getCountries().then((r) => setCountries(extractArray(r))).catch(() => {});
    lookupApi.getCurrencies().then((r) => setCurrencies(extractArray(r))).catch(() => {});
  }, []);
  useEffect(() => {
    if (form.countryId) lookupApi.getStates(Number(form.countryId)).then((r) => setStates(extractArray(r))).catch(() => {});
    else setStates([]);
  }, [form.countryId]);
  useEffect(() => {
    if (form.stateId) lookupApi.getCities(Number(form.stateId)).then((r) => setCities(extractArray(r))).catch(() => {});
    else setCities([]);
  }, [form.stateId]);
  useEffect(() => {
    if (form.cityId) lookupApi.getPostalCodes(Number(form.cityId)).then((r) => setPostalCodes(extractArray(r))).catch(() => {});
    else setPostalCodes([]);
  }, [form.cityId]);

  const countryOptions = countries.map((c) => ({ value: String(c.id), label: c.name }));
  const stateOptions = states.map((s) => ({ value: String(s.id), label: s.name }));
  const cityOptions = cities.map((c) => ({ value: String(c.id), label: c.name }));
  const currencyOptions = currencies.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }));
  const postalCodeOptions = postalCodes.map((p) => ({ value: p.code, label: `${p.code}${p.areaName ? ` — ${p.areaName}` : ''}` }));

  async function uploadLogoIfNeeded(companyId: number) {
    if (logoFile) {
      try { await companiesApi.uploadLogo(companyId, logoFile); } catch { toast.error('Saved, but logo upload failed'); }
    }
  }

  const createMutation = useMutation({
    mutationFn: (dto: CreateCompanyDto) => companiesApi.create(dto),
    onSuccess: async (res) => {
      const created = res?.data?.data ?? res?.data;
      if (created?.id) await uploadLogoIfNeeded(created.id);
      toast.success('Company created');
      qc.invalidateQueries({ queryKey: ['platform-companies'] });
      router.push('/companies');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create company'),
  });

  const updateMutation = useMutation({
    mutationFn: (dto: Partial<CreateCompanyDto>) => companiesApi.update(Number(editId), dto),
    onSuccess: async () => {
      await uploadLogoIfNeeded(Number(editId));
      toast.success('Company updated');
      qc.invalidateQueries({ queryKey: ['platform-companies'] });
      router.push('/companies');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update company'),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  function handleSave() {
    if (!form.name.trim()) { toast.error('Company name is required'); return; }
    if (!isEditing && !form.slug.trim()) { toast.error('Slug is required'); return; }
    if (!form.licenseExpiryDate) { toast.error('License expiry date is required'); return; }
    const dto: any = {
      name: form.name, slug: form.slug, companyCode: form.companyCode || undefined,
      contactPersonName: form.contactPersonName || undefined,
      contactEmail: form.contactEmail || undefined,
      contactPhone: form.contactPhone || undefined,
      address: form.address || undefined,
      subscriptionPlan: form.subscriptionPlan,
      userLimit: Number(form.userLimit) || 50,
      licenseExpiryDate: form.licenseExpiryDate,
      countryId: form.countryId ? Number(form.countryId) : undefined,
      stateId: form.stateId ? Number(form.stateId) : undefined,
      cityId: form.cityId ? Number(form.cityId) : undefined,
      postalCode: form.postalCode || undefined,
      gstNumber: form.gstNumber || undefined,
      panNumber: form.panNumber || undefined,
      taxId: form.taxId || undefined,
      gstin: form.gstin || undefined,
      taxRegistrationNumber: form.taxRegistrationNumber || undefined,
      gstEnabled: form.gstEnabled,
      vatEnabled: form.vatEnabled,
      baseCurrencyCode: form.baseCurrencyCode || undefined,
    };
    if (isEditing) updateMutation.mutate(dto);
    else createMutation.mutate(dto);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/companies')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 text-white shadow-sm">
            <Building2 className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold">{isEditing ? 'Edit Company' : 'New Company'}</h1>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-5 sm:p-6 space-y-6">
          {/* Basic Info */}
          <Section title="Basic Information">
            <div className="flex items-center gap-4">
              <div
                className="relative h-16 w-16 shrink-0 rounded-xl border-2 border-dashed border-muted-foreground/25 flex items-center justify-center overflow-hidden cursor-pointer hover:border-violet-400 transition-colors bg-muted/30"
                onClick={() => logoInputRef.current?.click()}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground/50" />
                )}
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 2 * 1024 * 1024) { toast.error('Logo must be under 2 MB'); return; }
                      setLogoFile(file);
                      setLogoPreview(URL.createObjectURL(file));
                    }
                  }}
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Company Logo</p>
                <p className="text-xs text-muted-foreground">JPG, PNG or SVG. Max 2 MB.</p>
                {logoPreview && (
                  <button type="button" className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                    onClick={() => { setLogoFile(null); setLogoPreview(null); if (logoInputRef.current) logoInputRef.current.value = ''; }}>
                    <X className="h-3 w-3" /> Remove
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Acme Corp" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Slug *</Label><Input value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} placeholder="acme" disabled={isEditing} /></div>
              <div className="space-y-1.5"><Label>Company Code</Label><Input value={form.companyCode} onChange={(e) => setForm((p) => ({ ...p, companyCode: e.target.value }))} placeholder="ACME-001" /></div>
            </div>
            <div className="space-y-1.5"><Label>Contact Person Name</Label><Input value={form.contactPersonName} onChange={(e) => setForm((p) => ({ ...p, contactPersonName: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Contact Email</Label><Input value={form.contactEmail} onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Contact Phone</Label><Input value={form.contactPhone} onChange={(e) => setForm((p) => ({ ...p, contactPhone: e.target.value }))} /></div>
            </div>
          </Section>

          {/* Location */}
          <Section title="Location">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Country</Label>
                <SearchableSelect options={countryOptions} value={form.countryId} onValueChange={(v) => setForm((p) => ({ ...p, countryId: v, stateId: '', cityId: '', postalCode: '' }))} placeholder="Select country" />
              </div>
              <div className="space-y-1.5"><Label>State</Label>
                <SearchableSelect options={stateOptions} value={form.stateId} onValueChange={(v) => setForm((p) => ({ ...p, stateId: v, cityId: '', postalCode: '' }))} placeholder="Select state" disabled={!form.countryId} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>City</Label>
                <SearchableSelect options={cityOptions} value={form.cityId} onValueChange={(v) => setForm((p) => ({ ...p, cityId: v, postalCode: '' }))} placeholder="Select city" disabled={!form.stateId} />
              </div>
              <div className="space-y-1.5"><Label>Pin / Postal Code</Label>
                {postalCodes.length > 0 ? (
                  <SearchableSelect options={postalCodeOptions} value={form.postalCode} onValueChange={(v) => setForm((p) => ({ ...p, postalCode: v }))} placeholder="Search pin code..." disabled={!form.cityId} />
                ) : (
                  <Input value={form.postalCode} onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))} placeholder={form.cityId ? 'Type manually' : '400001'} />
                )}
              </div>
            </div>
            <div className="space-y-1.5"><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} rows={2} placeholder="Street, Building, etc." /></div>
          </Section>

          {/* Tax */}
          <Section title="Tax & Registration">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>PAN Number</Label><Input value={form.panNumber} onChange={(e) => setForm((p) => ({ ...p, panNumber: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" /></div>
              <div className="space-y-1.5"><Label>GST Number</Label><Input value={form.gstNumber} onChange={(e) => setForm((p) => ({ ...p, gstNumber: e.target.value.toUpperCase() }))} placeholder="22AAAAA0000A1Z5" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>GSTIN</Label><Input value={form.gstin} onChange={(e) => setForm((p) => ({ ...p, gstin: e.target.value.toUpperCase() }))} /></div>
              <div className="space-y-1.5"><Label>Tax ID</Label><Input value={form.taxId} onChange={(e) => setForm((p) => ({ ...p, taxId: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Tax Reg. Number</Label><Input value={form.taxRegistrationNumber} onChange={(e) => setForm((p) => ({ ...p, taxRegistrationNumber: e.target.value }))} /></div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="checkbox" checked={form.gstEnabled} onChange={(e) => setForm((p) => ({ ...p, gstEnabled: e.target.checked }))} className="rounded" /> GST Enabled
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="checkbox" checked={form.vatEnabled} onChange={(e) => setForm((p) => ({ ...p, vatEnabled: e.target.checked }))} className="rounded" /> VAT Enabled
              </label>
            </div>
          </Section>

          {/* Currency & License */}
          <Section title="Currency & License">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Base Currency</Label>
                <SearchableSelect options={currencyOptions} value={form.baseCurrencyCode} onValueChange={(v) => setForm((p) => ({ ...p, baseCurrencyCode: v }))} placeholder="Select currency" />
              </div>
              <div className="space-y-1.5"><Label>Plan</Label>
                <Select value={form.subscriptionPlan} onValueChange={(v) => setForm((p) => ({ ...p, subscriptionPlan: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>User Limit</Label><Input type="number" value={form.userLimit} onChange={(e) => setForm((p) => ({ ...p, userLimit: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>License Expiry *</Label><Input type="date" value={form.licenseExpiryDate} onChange={(e) => setForm((p) => ({ ...p, licenseExpiryDate: e.target.value }))} /></div>
          </Section>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => router.push('/companies')}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-linear-to-r from-violet-500 to-purple-600 text-white hover:opacity-90 shadow-sm shadow-violet-500/25 border-0"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Update Company' : 'Create Company'}
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
