/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Plus, Pencil, Loader2, Shield, LogIn, Upload, X,
  Building2, Key, ToggleLeft, Mail, Search as SearchIcon,
} from 'lucide-react';
import { companiesApi, CompanyWithCounts, CreateCompanyDto, UpdateLicenseDto, CreateCompanyAdminDto } from '@/lib/api/companies';
import { lookupApi } from '@/lib/api/lookup';
import { smtpApi } from '@/lib/api/smtp';
import { SmtpConfigForm } from '@/components/shared/smtp-config-form';
import { useCompany } from '@/providers/company-provider';
import { useAuth } from '@/providers/auth-provider';
import { AdminUser, LookupCountry, LookupState, LookupCity, LookupCurrency, LookupPostalCode } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const planLabels: Record<string, string> = {
  trial: 'Trial',
  basic: 'Basic',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

const planColors: Record<string, string> = {
  trial: 'bg-slate-500/15 text-slate-600 ring-slate-500/30',
  basic: 'bg-blue-500/15 text-blue-600 ring-blue-500/30',
  professional: 'bg-violet-500/15 text-violet-600 ring-violet-500/30',
  enterprise: 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30',
};

const defaultForm = {
  name: '', slug: '', companyCode: '', contactPersonName: '', contactEmail: '', contactPhone: '', address: '',
  subscriptionPlan: 'trial', userLimit: '50', licenseExpiryDate: '',
  countryId: '', stateId: '', cityId: '', postalCode: '',
  gstNumber: '', panNumber: '', taxId: '', gstin: '', taxRegistrationNumber: '',
  gstEnabled: false, vatEnabled: false, baseCurrencyCode: '',
};

export default function CompaniesPage() {
  const { user } = useAuth();
  const { selectCompany } = useCompany();
  const router = useRouter();
  const qc = useQueryClient();

  const isSuperAdmin = user?._type === 'admin' && user.role === 'super_admin';

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyWithCounts | null>(null);
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [licenseCompany, setLicenseCompany] = useState<CompanyWithCounts | null>(null);
  const [adminsOpen, setAdminsOpen] = useState(false);
  const [adminsCompany, setAdminsCompany] = useState<CompanyWithCounts | null>(null);
  const [editingAdminId, setEditingAdminId] = useState<number | null>(null);
  const [editAdminForm, setEditAdminForm] = useState({ name: '', email: '', password: '', isActive: true });
  const [smtpOpen, setSmtpOpen] = useState(false);
  const [smtpCompany, setSmtpCompany] = useState<CompanyWithCounts | null>(null);

  // Form state
  const [form, setForm] = useState({ ...defaultForm });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // License form state
  const [licenseForm, setLicenseForm] = useState({
    licenseExpiryDate: '', userLimit: '', subscriptionPlan: '',
  });

  // Admin form state
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '' });

  // Lookup data
  const [countries, setCountries] = useState<LookupCountry[]>([]);
  const [states, setStates] = useState<LookupState[]>([]);
  const [cities, setCities] = useState<LookupCity[]>([]);
  const [currencies, setCurrencies] = useState<LookupCurrency[]>([]);
  const [postalCodes, setPostalCodes] = useState<LookupPostalCode[]>([]);

  // Extract array from axios response — handles both raw array and { data: [...] } wrapper
  const extractArray = (res: any): any[] => {
    const d = res?.data;
    return Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
  };

  // Load countries and currencies once when dialog opens
  useEffect(() => {
    if (formOpen) {
      lookupApi.getCountries().then((r) => setCountries(extractArray(r))).catch(() => {});
      lookupApi.getCurrencies().then((r) => setCurrencies(extractArray(r))).catch(() => {});
    }
  }, [formOpen]);

  // Load states when country changes
  useEffect(() => {
    if (form.countryId) {
      lookupApi.getStates(Number(form.countryId)).then((r) => setStates(extractArray(r))).catch(() => {});
    } else {
      setStates([]);
    }
  }, [form.countryId]);

  // Load cities when state changes
  useEffect(() => {
    if (form.stateId) {
      lookupApi.getCities(Number(form.stateId)).then((r) => setCities(extractArray(r))).catch(() => {});
    } else {
      setCities([]);
    }
  }, [form.stateId]);

  // Load postal codes when city changes
  useEffect(() => {
    if (form.cityId) {
      lookupApi.getPostalCodes(Number(form.cityId)).then((r) => setPostalCodes(extractArray(r))).catch(() => {});
    } else {
      setPostalCodes([]);
    }
  }, [form.cityId]);

  const { data, isLoading } = useQuery({
    queryKey: ['platform-companies', search],
    queryFn: () => companiesApi.getAll({ search: search || undefined, limit: 100 }),
    enabled: isSuperAdmin,
  });

  const { data: adminsData, isLoading: adminsLoading } = useQuery({
    queryKey: ['company-admins', adminsCompany?.id],
    queryFn: () => companiesApi.getAdmins(adminsCompany!.id),
    enabled: !!adminsCompany,
  });

  const raw = data?.data;
  const companies: CompanyWithCounts[] = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];

  // Upload logo helper
  async function uploadLogoIfNeeded(companyId: number) {
    if (logoFile) {
      try {
        await companiesApi.uploadLogo(companyId, logoFile);
      } catch {
        toast.error('Company saved, but logo upload failed');
      }
    }
  }

  // CRUD mutations
  const createMutation = useMutation({
    mutationFn: (dto: CreateCompanyDto) => companiesApi.create(dto),
    onSuccess: async (res) => {
      const created = res?.data?.data ?? res?.data;
      if (created?.id) await uploadLogoIfNeeded(created.id);
      toast.success('Company created'); closeForm(); qc.invalidateQueries({ queryKey: ['platform-companies'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create company'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<CreateCompanyDto> }) => companiesApi.update(id, dto),
    onSuccess: async () => {
      if (editing?.id) await uploadLogoIfNeeded(editing.id);
      toast.success('Company updated'); closeForm(); qc.invalidateQueries({ queryKey: ['platform-companies'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update company'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => companiesApi.toggleActive(id),
    onSuccess: () => { toast.success('Status toggled'); qc.invalidateQueries({ queryKey: ['platform-companies'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to toggle status'),
  });

  const licenseMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: UpdateLicenseDto }) => companiesApi.updateLicense(id, dto),
    onSuccess: () => { toast.success('License updated'); setLicenseOpen(false); qc.invalidateQueries({ queryKey: ['platform-companies'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update license'),
  });

  const createAdminMutation = useMutation({
    mutationFn: ({ companyId, dto }: { companyId: number; dto: CreateCompanyAdminDto }) => companiesApi.createAdmin(companyId, dto),
    onSuccess: () => { toast.success('Admin created'); setAdminForm({ name: '', email: '', password: '' }); qc.invalidateQueries({ queryKey: ['company-admins'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create admin'),
  });

  const updateAdminMutation = useMutation({
    mutationFn: ({ companyId, adminId, dto }: { companyId: number; adminId: number; dto: { name?: string; email?: string; password?: string; isActive?: boolean } }) =>
      companiesApi.updateAdmin(companyId, adminId, dto),
    onSuccess: () => {
      toast.success('Admin updated');
      setEditingAdminId(null);
      qc.invalidateQueries({ queryKey: ['company-admins'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update admin'),
  });

  function startEditAdmin(a: any) {
    setEditingAdminId(a.id);
    setEditAdminForm({ name: a.name ?? '', email: a.email ?? '', password: '', isActive: a.isActive !== false });
  }

  function handleSaveEditedAdmin() {
    if (!adminsCompany || editingAdminId == null) return;
    const dto: { name?: string; email?: string; password?: string; isActive?: boolean } = {
      name: editAdminForm.name.trim() || undefined,
      email: editAdminForm.email.trim() || undefined,
      isActive: editAdminForm.isActive,
    };
    if (editAdminForm.password.trim()) dto.password = editAdminForm.password;
    updateAdminMutation.mutate({ companyId: adminsCompany.id, adminId: editingAdminId, dto });
  }

  function closeForm() { setFormOpen(false); setEditing(null); resetForm(); }

  function resetForm() {
    setForm({ ...defaultForm });
    setStates([]);
    setCities([]);
    setPostalCodes([]);
    setLogoFile(null);
    setLogoPreview(null);
  }

  function openCreate() { router.push('/companies/new'); }

  function openEdit(c: CompanyWithCounts) { router.push(`/companies/new?edit=${c.id}`); }

  function openLicense(c: CompanyWithCounts) {
    setLicenseCompany(c);
    setLicenseForm({
      licenseExpiryDate: c.licenseExpiryDate, userLimit: String(c.userLimit),
      subscriptionPlan: c.subscriptionPlan,
    });
    setLicenseOpen(true);
  }

  function openAdmins(c: CompanyWithCounts) {
    setAdminsCompany(c);
    setAdminForm({ name: '', email: '', password: '' });
    setAdminsOpen(true);
  }

  function openSmtp(c: CompanyWithCounts) {
    setSmtpCompany(c);
    setSmtpOpen(true);
  }

  function handleSaveCompany() {
    if (!form.name || !form.slug || !form.licenseExpiryDate) {
      toast.error('Name, slug, and license expiry are required');
      return;
    }
    const dto: CreateCompanyDto = {
      name: form.name, slug: form.slug,
      companyCode: form.companyCode || undefined,
      contactPersonName: form.contactPersonName || undefined,
      contactEmail: form.contactEmail || undefined,
      contactPhone: form.contactPhone || undefined,
      address: form.address || undefined,
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
      subscriptionPlan: form.subscriptionPlan,
      userLimit: parseInt(form.userLimit) || 50,
      licenseExpiryDate: form.licenseExpiryDate,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, dto });
    } else {
      createMutation.mutate(dto);
    }
  }

  function handleSaveLicense() {
    if (!licenseCompany) return;
    const dto: UpdateLicenseDto = {
      licenseExpiryDate: licenseForm.licenseExpiryDate || undefined,
      userLimit: parseInt(licenseForm.userLimit) || undefined,
      subscriptionPlan: licenseForm.subscriptionPlan || undefined,
    };
    licenseMutation.mutate({ id: licenseCompany.id, dto });
  }

  function handleCreateAdmin() {
    if (!adminsCompany) return;
    if (!adminForm.name || !adminForm.email || !adminForm.password) {
      toast.error('All fields are required'); return;
    }
    createAdminMutation.mutate({ companyId: adminsCompany.id, dto: adminForm });
  }

  function handleEnterCompany(c: CompanyWithCounts) {
    selectCompany({ id: c.id, name: c.name, slug: c.slug, logoUrl: c.logoUrl });
    router.push('/dashboard');
  }

  if (!isSuperAdmin) {
    return <p className="text-muted-foreground">Access restricted to super admins.</p>;
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isLicenseSaving = licenseMutation.isPending;
  const isAdminSaving = createAdminMutation.isPending;
  const admins = (adminsData?.data as any)?.data ?? adminsData?.data ?? [];

  const countryOptions = countries.map((c) => ({ value: String(c.id), label: `${c.name} (${c.code})` }));
  const stateOptions = states.map((s) => ({ value: String(s.id), label: s.name }));
  const cityOptions = cities.map((c) => ({ value: String(c.id), label: c.name }));
  const postalCodeOptions = postalCodes.map((p) => ({
    value: p.code,
    label: p.areaName ? `${p.code} — ${p.areaName}` : p.code,
  }));
  const currencyOptions = currencies.map((c) => ({ value: c.code, label: `${c.code} - ${c.name} (${c.symbol})` }));

  return (
    <div className="space-y-4">
      {/* Gradient Header */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-linear-to-r from-violet-600 via-purple-600 to-indigo-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoNnptMC0zMHY2aC02VjRoNnptMCAzMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Companies</h1>
              <p className="text-sm text-white/60">Manage all companies on the platform</p>
            </div>
          </div>
          <Button size="sm" onClick={openCreate} className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-0 shadow-lg">
            <Plus className="mr-1.5 h-4 w-4" /> Add Company
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search companies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto shadow-sm">
          <div className="h-1.5 rounded-t-[inherit] bg-linear-to-r from-violet-500 via-purple-500 to-indigo-500" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                {/* <TableHead className="w-20">Code</TableHead> */}
                <TableHead className="w-28">Plan</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-20 text-center">Admins</TableHead>
                <TableHead className="w-24 text-center">Employees</TableHead>
                {/* <TableHead className="w-20">Currency</TableHead> */}
                <TableHead className="w-28">License</TableHead>
                <TableHead className="w-60">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/10 mb-3">
                        <Building2 className="h-6 w-6 text-violet-500" />
                      </div>
                      <p className="text-sm font-medium text-foreground">No companies found</p>
                      <p className="text-xs text-muted-foreground mt-1">Try a different search term</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                companies.map((c) => {
                  const isExpired = c.licenseExpiryDate < new Date().toISOString().split('T')[0];
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.slug}</p>
                        </div>
                      </TableCell>
                      {/* <TableCell>
                        <span className="text-xs font-mono text-muted-foreground">{c.companyCode || '—'}</span>
                      </TableCell> */}
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${planColors[c.subscriptionPlan] ?? planColors.trial}`}>
                          {planLabels[c.subscriptionPlan] ?? c.subscriptionPlan}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${c.isActive ? 'border-emerald-500/30 text-emerald-600' : 'border-red-500/30 text-red-500'}`}>
                          {c.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm">{c.adminCount}</TableCell>
                      <TableCell className="text-center text-sm">{c.employeeCount} / {c.userLimit}</TableCell>
                      {/* <TableCell>
                        <span className="text-xs font-mono">{c.baseCurrencyCode || '—'}</span>
                      </TableCell> */}
                      <TableCell>
                        <span className={`text-xs ${isExpired ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                          {c.licenseExpiryDate}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1.5 flex-wrap">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Enter company" onClick={() => handleEnterCompany(c)}>
                            <LogIn className="h-4 w-4 text-indigo-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => openEdit(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="License" onClick={() => openLicense(c)}>
                            <Key className="h-4 w-4 text-amber-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Admins" onClick={() => openAdmins(c)}>
                            <Shield className="h-4 w-4 text-emerald-500" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8" title="Toggle active"
                            disabled={toggleMutation.isPending}
                            onClick={() => toggleMutation.mutate(c.id)}
                          >
                            <ToggleLeft className={`h-4 w-4 ${c.isActive ? 'text-emerald-500' : 'text-red-500'}`} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit Company Dialog */}
      <Dialog open={formOpen} onOpenChange={(v) => { if (!v) closeForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-violet-500 via-purple-500 to-indigo-500" />
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-violet-500" />
              {editing ? 'Edit Company' : 'Create Company'}
            </DialogTitle>
          </DialogHeader>

          {/* Basic Info */}
          <div className="space-y-4 overflow-y-auto flex-1 pr-1 scrollbar-hide">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</p>

            {/* Logo Upload */}
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
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
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
                  <button
                    type="button"
                    className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                    onClick={() => { setLogoFile(null); setLogoPreview(null); if (logoInputRef.current) logoInputRef.current.value = ''; }}
                  >
                    <X className="h-3 w-3" /> Remove
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Acme Corp" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Slug *</Label>
                <Input value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} placeholder="acme" disabled={!!editing} />
              </div>
              <div className="space-y-1.5">
                <Label>Company Code</Label>
                <Input value={form.companyCode} onChange={(e) => setForm((p) => ({ ...p, companyCode: e.target.value }))} placeholder="ACME-001" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Contact Person Name</Label>
              <Input value={form.contactPersonName} onChange={(e) => setForm((p) => ({ ...p, contactPersonName: e.target.value }))} placeholder="John Doe" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contact Email</Label>
                <Input value={form.contactEmail} onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))} placeholder="admin@acme.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Contact Phone</Label>
                <Input value={form.contactPhone} onChange={(e) => setForm((p) => ({ ...p, contactPhone: e.target.value }))} placeholder="+91..." />
              </div>
            </div>

            {/* Location */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Location</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Country</Label>
                <SearchableSelect
                  options={countryOptions}
                  value={form.countryId}
                  onValueChange={(v) => setForm((p) => ({ ...p, countryId: v, stateId: '', cityId: '', postalCode: '' }))}
                  placeholder="Select country"
                />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <SearchableSelect
                  options={stateOptions}
                  value={form.stateId}
                  onValueChange={(v) => setForm((p) => ({ ...p, stateId: v, cityId: '', postalCode: '' }))}
                  placeholder="Select state"
                  disabled={!form.countryId}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>City</Label>
                <SearchableSelect
                  options={cityOptions}
                  value={form.cityId}
                  onValueChange={(v) => setForm((p) => ({ ...p, cityId: v, postalCode: '' }))}
                  placeholder="Select city"
                  disabled={!form.stateId}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Pin / Postal Code</Label>
                {postalCodes.length > 0 ? (
                  <SearchableSelect
                    options={postalCodeOptions}
                    value={form.postalCode}
                    onValueChange={(v) => setForm((p) => ({ ...p, postalCode: v }))}
                    placeholder="Search pin code..."
                    disabled={!form.cityId}
                  />
                ) : (
                  <Input
                    value={form.postalCode}
                    onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))}
                    placeholder={form.cityId ? 'No pin codes found — type manually' : '400001'}
                  />
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Textarea value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} rows={2} placeholder="Street, Building, etc." />
            </div>

            {/* Tax & Registration */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Tax & Registration</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>PAN Number</Label>
                <Input value={form.panNumber} onChange={(e) => setForm((p) => ({ ...p, panNumber: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" />
              </div>
              <div className="space-y-1.5">
                <Label>GST Number</Label>
                <Input value={form.gstNumber} onChange={(e) => setForm((p) => ({ ...p, gstNumber: e.target.value.toUpperCase() }))} placeholder="22AAAAA0000A1Z5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>GSTIN</Label>
                <Input value={form.gstin} onChange={(e) => setForm((p) => ({ ...p, gstin: e.target.value.toUpperCase() }))} placeholder="GSTIN" />
              </div>
              <div className="space-y-1.5">
                <Label>Tax ID</Label>
                <Input value={form.taxId} onChange={(e) => setForm((p) => ({ ...p, taxId: e.target.value }))} placeholder="Tax ID" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tax Reg. Number</Label>
              <Input value={form.taxRegistrationNumber} onChange={(e) => setForm((p) => ({ ...p, taxRegistrationNumber: e.target.value }))} placeholder="TRN" />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="checkbox" checked={form.gstEnabled} onChange={(e) => setForm((p) => ({ ...p, gstEnabled: e.target.checked }))} className="rounded" />
                GST Enabled
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="checkbox" checked={form.vatEnabled} onChange={(e) => setForm((p) => ({ ...p, vatEnabled: e.target.checked }))} className="rounded" />
                VAT Enabled
              </label>
            </div>

            {/* Currency & License */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Currency & License</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Base Currency</Label>
                <SearchableSelect
                  options={currencyOptions}
                  value={form.baseCurrencyCode}
                  onValueChange={(v) => setForm((p) => ({ ...p, baseCurrencyCode: v }))}
                  placeholder="Select currency"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Select value={form.subscriptionPlan} onValueChange={(v) => setForm((p) => ({ ...p, subscriptionPlan: v }))}>
                  <SelectTrigger className='w-full'><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>User Limit</Label>
              <Input type="number" value={form.userLimit} onChange={(e) => setForm((p) => ({ ...p, userLimit: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>License Expiry *</Label>
              <Input type="date" value={form.licenseExpiryDate} onChange={(e) => setForm((p) => ({ ...p, licenseExpiryDate: e.target.value }))} />
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t pt-4">
            <Button variant="outline" size="sm" onClick={closeForm}>Cancel</Button>
            <Button size="sm" className="bg-linear-to-r from-violet-500 to-purple-600 text-white hover:opacity-90 shadow-sm shadow-violet-500/25 border-0" disabled={isSaving} onClick={handleSaveCompany}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update License Dialog */}
      <Dialog open={licenseOpen} onOpenChange={(v) => { if (!v) setLicenseOpen(false); }}>
        <DialogContent className="max-w-sm overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-amber-500 via-orange-500 to-rose-500" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-amber-500" />
              Update License — {licenseCompany?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>License Expiry</Label>
              <Input type="date" value={licenseForm.licenseExpiryDate} onChange={(e) => setLicenseForm((p) => ({ ...p, licenseExpiryDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>User Limit</Label>
              <Input type="number" value={licenseForm.userLimit} onChange={(e) => setLicenseForm((p) => ({ ...p, userLimit: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select value={licenseForm.subscriptionPlan} onValueChange={(v) => setLicenseForm((p) => ({ ...p, subscriptionPlan: v }))}>
                <SelectTrigger className='w-full'><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setLicenseOpen(false)}>Cancel</Button>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={isLicenseSaving} onClick={handleSaveLicense}>
              {isLicenseSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admins Dialog */}
      <Dialog open={adminsOpen} onOpenChange={(v) => { if (!v) setAdminsOpen(false); }}>
        <DialogContent className="max-w-md overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-emerald-500 via-teal-500 to-cyan-500" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-500" />
              Admins — {adminsCompany?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Existing admins */}
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {adminsLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (Array.isArray(admins) && admins.length > 0) ? (
                admins.map((a: any) => (
                  <div key={a.id} className="rounded-lg border px-3 py-2 text-sm">
                    {editingAdminId === a.id ? (
                      <div className="space-y-2">
                        <Input placeholder="Name" value={editAdminForm.name} onChange={(e) => setEditAdminForm((p) => ({ ...p, name: e.target.value }))} />
                        <Input placeholder="Email" type="email" value={editAdminForm.email} onChange={(e) => setEditAdminForm((p) => ({ ...p, email: e.target.value }))} />
                        <Input placeholder="New password (optional, min 6 chars)" type="password" value={editAdminForm.password} onChange={(e) => setEditAdminForm((p) => ({ ...p, password: e.target.value }))} />
                        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={editAdminForm.isActive}
                            onChange={(e) => setEditAdminForm((p) => ({ ...p, isActive: e.target.checked }))}
                            className="h-3.5 w-3.5 rounded border-gray-300"
                          />
                          Active (can log in)
                        </label>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 bg-linear-to-r from-emerald-500 to-teal-600 text-white hover:opacity-90 border-0"
                            disabled={updateAdminMutation.isPending}
                            onClick={handleSaveEditedAdmin}
                          >
                            {updateAdminMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingAdminId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{a.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="outline" className={`text-[10px] ${a.isActive ? 'border-emerald-500/30 text-emerald-600' : 'border-red-500/30 text-red-500'}`}>
                            {a.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          {a.role !== 'super_admin' && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit admin" onClick={() => startEditAdmin(a)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No admins yet</p>
              )}
            </div>

            {/* Create admin form */}
            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-medium">Add Admin</p>
              <Input placeholder="Name" value={adminForm.name} onChange={(e) => setAdminForm((p) => ({ ...p, name: e.target.value }))} />
              <Input placeholder="Email" type="email" value={adminForm.email} onChange={(e) => setAdminForm((p) => ({ ...p, email: e.target.value }))} />
              <Input placeholder="Password (min 6 chars)" type="password" value={adminForm.password} onChange={(e) => setAdminForm((p) => ({ ...p, password: e.target.value }))} />
              <Button size="sm" className="w-full bg-linear-to-r from-emerald-500 to-teal-600 text-white hover:opacity-90 shadow-sm shadow-emerald-500/25 border-0" disabled={isAdminSaving} onClick={handleCreateAdmin}>
                {isAdminSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
                Create Admin
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* SMTP Config Dialog */}
      <Dialog open={smtpOpen} onOpenChange={(v) => { if (!v) setSmtpOpen(false); }}>
        <DialogContent className="max-w-lg overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-sky-500 via-blue-500 to-indigo-500" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-sky-500" />
              SMTP Configuration — {smtpCompany?.name}
            </DialogTitle>
          </DialogHeader>
          {smtpCompany && (
            <SmtpConfigForm
              queryKey={['company-smtp', String(smtpCompany.id)]}
              fetchConfigs={() => smtpApi.getCompanyConfigs(smtpCompany.id)}
              createConfig={(dto) => smtpApi.createCompanyConfig(smtpCompany.id, dto)}
              updateConfig={(smtpId, dto) => smtpApi.updateCompanyConfig(smtpCompany.id, smtpId, dto)}
              deleteConfig={(smtpId) => smtpApi.deleteCompanyConfig(smtpCompany.id, smtpId)}
              testConfig={(smtpId, dto) => smtpApi.testCompanyConfig(smtpCompany.id, smtpId, dto)}
              sendEmail={(smtpId, to, subject, body, files) => smtpApi.sendCompanyEmail(smtpCompany.id, smtpId, to, subject, body, files)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
