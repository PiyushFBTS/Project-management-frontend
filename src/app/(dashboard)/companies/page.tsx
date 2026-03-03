/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, Loader2, Shield, LogIn, RefreshCw,
  Building2, Users, Key, ToggleLeft, Mail, Search as SearchIcon,
} from 'lucide-react';
import { companiesApi, CompanyWithCounts, CreateCompanyDto, UpdateLicenseDto, CreateCompanyAdminDto } from '@/lib/api/companies';
import { smtpApi } from '@/lib/api/smtp';
import { SmtpConfigForm } from '@/components/shared/smtp-config-form';
import { useCompany } from '@/providers/company-provider';
import { useAuth } from '@/providers/auth-provider';
import { AdminUser } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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
  const [smtpOpen, setSmtpOpen] = useState(false);
  const [smtpCompany, setSmtpCompany] = useState<CompanyWithCounts | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: '', slug: '', contactEmail: '', contactPhone: '', address: '',
    subscriptionPlan: 'trial', userLimit: '50', licenseExpiryDate: '',
  });

  // License form state
  const [licenseForm, setLicenseForm] = useState({
    licenseExpiryDate: '', userLimit: '', subscriptionPlan: '',
  });

  // Admin form state
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '' });

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

  const companies = data?.data?.data ?? [];

  // CRUD mutations
  const createMutation = useMutation({
    mutationFn: (dto: CreateCompanyDto) => companiesApi.create(dto),
    onSuccess: () => { toast.success('Company created'); closeForm(); qc.invalidateQueries({ queryKey: ['platform-companies'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create company'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<CreateCompanyDto> }) => companiesApi.update(id, dto),
    onSuccess: () => { toast.success('Company updated'); closeForm(); qc.invalidateQueries({ queryKey: ['platform-companies'] }); },
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

  function closeForm() { setFormOpen(false); setEditing(null); resetForm(); }

  function resetForm() {
    setForm({ name: '', slug: '', contactEmail: '', contactPhone: '', address: '', subscriptionPlan: 'trial', userLimit: '50', licenseExpiryDate: '' });
  }

  function openCreate() { resetForm(); setEditing(null); setFormOpen(true); }

  function openEdit(c: CompanyWithCounts) {
    setEditing(c);
    setForm({
      name: c.name, slug: c.slug,
      contactEmail: c.contactEmail ?? '', contactPhone: c.contactPhone ?? '',
      address: c.address ?? '', subscriptionPlan: c.subscriptionPlan,
      userLimit: String(c.userLimit), licenseExpiryDate: c.licenseExpiryDate,
    });
    setFormOpen(true);
  }

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
      contactEmail: form.contactEmail || undefined,
      contactPhone: form.contactPhone || undefined,
      address: form.address || undefined,
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
    selectCompany({ id: c.id, name: c.name, slug: c.slug });
    router.push('/dashboard');
  }

  if (!isSuperAdmin) {
    return <p className="text-muted-foreground">Access restricted to super admins.</p>;
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isLicenseSaving = licenseMutation.isPending;
  const isAdminSaving = createAdminMutation.isPending;
  const admins = (adminsData?.data as any)?.data ?? adminsData?.data ?? [];

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
                <TableHead className="w-28">Plan</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-20 text-center">Admins</TableHead>
                <TableHead className="w-24 text-center">Employees</TableHead>
                <TableHead className="w-28">License</TableHead>
                <TableHead className="w-60">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32">
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
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="SMTP" onClick={() => openSmtp(c)}>
                            <Mail className="h-4 w-4 text-sky-500" />
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
        <DialogContent className="max-w-lg overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-violet-500 via-purple-500 to-indigo-500" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-violet-500" />
              {editing ? 'Edit Company' : 'Create Company'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Acme Corp" />
            </div>
            <div className="space-y-1.5">
              <Label>Slug *</Label>
              <Input value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} placeholder="acme" disabled={!!editing} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Email</Label>
              <Input value={form.contactEmail} onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))} placeholder="admin@acme.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Phone</Label>
              <Input value={form.contactPhone} onChange={(e) => setForm((p) => ({ ...p, contactPhone: e.target.value }))} placeholder="+91..." />
            </div>
            <div className="space-y-1.5">
              <Label>Plan</Label>
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
            <div className="space-y-1.5">
              <Label>User Limit</Label>
              <Input type="number" value={form.userLimit} onChange={(e) => setForm((p) => ({ ...p, userLimit: e.target.value }))} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>License Expiry *</Label>
              <Input type="date" value={form.licenseExpiryDate} onChange={(e) => setForm((p) => ({ ...p, licenseExpiryDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Address</Label>
              <Textarea value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
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
                  <div key={a.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${a.isActive ? 'border-emerald-500/30 text-emerald-600' : 'border-red-500/30 text-red-500'}`}>
                      {a.isActive ? 'Active' : 'Inactive'}
                    </Badge>
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
