/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, User, Loader2 } from 'lucide-react';
import { employeesApi } from '@/lib/api/employees';
import { apiErrorMessage } from '@/lib/utils';
import { CreateEmployeeDto, Employee } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';

const consultantTypes = [
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'functional', label: 'Functional Consultant' },
  { value: 'technical', label: 'Technical Consultant' },
  { value: 'management', label: 'Management' },
  { value: 'core_team', label: 'Core Team' },
];

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const maritalStatuses = ['single', 'married', 'divorced', 'widowed'];

const defaultForm = {
  empCode: '',
  empName: '',
  email: '',
  mobileNumber: '',
  password: '',
  consultantType: 'functional' as Employee['consultantType'],
  reportsTo: 'none', // encoded "emp-123" or "adm-456" or "none"
  isHr: false,
  isAccounts: false,
  dateOfBirth: '',
  joiningDate: '',
  fillDaysOverride: '',
  annualCTC: '',
  bloodGroup: 'none',
  maritalStatus: 'none',
};

export default function NewEmployeePage() {
  return (
    <Suspense>
      <NewEmployeeContent />
    </Suspense>
  );
}

function NewEmployeeContent() {
  const router = useRouter();
  const qc = useQueryClient();
  const searchParams = useSearchParams();

  // Edits no longer live here — redirect to the detail page's Profile tab in edit mode.
  const legacyEditId = searchParams.get('edit');
  useEffect(() => {
    if (legacyEditId) router.replace(`/employees/${legacyEditId}?tab=profile&edit=1`);
  }, [legacyEditId, router]);

  const [form, setForm] = useState({ ...defaultForm });
  const [error, setError] = useState<string | null>(null);

  // Match the detail page pattern: return the whole axios body and unwrap
  // defensively below. Creating an employee is admin-only, so the admin
  // endpoint is always the right call.
  const { data: employeesListRaw } = useQuery({
    queryKey: ['all-employees-for-reports-to'],
    queryFn: async () => {
      const r = await employeesApi.getAll({ limit: 100 });
      return r.data;
    },
  });
  const employeesList: any[] = (() => {
    const d = employeesListRaw as any;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.data)) return d.data;
    return [];
  })();

  const createMutation = useMutation({
    mutationFn: (dto: CreateEmployeeDto) => employeesApi.create(dto),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success(`"${res.data.data.empName}" added`);
      router.push('/employees');
    },
    onError: (e: unknown) => setError(apiErrorMessage(e, 'Failed to create employee')),
  });

  const saving = createMutation.isPending;

  function handleSave() {
    setError(null);
    if (!form.empName.trim()) { toast.error('Full name is required'); return; }
    if (!form.email.trim()) { toast.error('Email is required'); return; }
    if (!form.empCode.trim()) { toast.error('Employee code is required'); return; }
    if (!form.password.trim() || form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }

    const [kind, idStr] = form.reportsTo && form.reportsTo !== 'none' ? form.reportsTo.split('-') : [null, null];
    const reportsToId = kind === 'emp' ? Number(idStr) : null;
    const reportsToAdminId = kind === 'adm' ? Number(idStr) : null;
    const isReportToAdmin = kind === 'adm';

    createMutation.mutate({
      empCode: form.empCode.trim(),
      empName: form.empName.trim(),
      email: form.email.trim(),
      mobileNumber: form.mobileNumber.trim() || undefined,
      password: form.password,
      consultantType: form.consultantType,
      reportsToId,
      reportsToAdminId,
      isReportToAdmin,
      isHr: form.isHr,
      isAccounts: form.isAccounts,
      dateOfBirth: form.dateOfBirth || undefined,
      joiningDate: form.joiningDate || undefined,
      fillDaysOverride: form.fillDaysOverride ? Number(form.fillDaysOverride) : null,
      annualCTC: form.annualCTC ? Number(form.annualCTC) : null,
      bloodGroup: form.bloodGroup !== 'none' ? form.bloodGroup : undefined,
      maritalStatus: form.maritalStatus !== 'none' ? form.maritalStatus : undefined,
    } as CreateEmployeeDto);
  }

  // Reports-to options: active employees + admins of the current company.
  // Mirrors the dropdown on /employees/:id Profile tab exactly.
  const reportsToOptions = [
    { value: 'none', label: 'None' },
    ...employeesList
      .filter((e: any) => e.isActive !== false)
      .filter((e: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === e.id && x._type === e._type) === i)
      .map((e: any) => ({
        value: `${e._type === 'admin' ? 'adm' : 'emp'}-${e.id}`,
        label: `${e.empName}${e._type === 'admin' ? ' (Admin)' : ''} — ${e.empCode}`,
      })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/employees')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-blue-700 text-white shadow-sm">
            <User className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold">New Employee</h1>
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
          <Section title="Basic Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Employee Code" required>
                <Input value={form.empCode} onChange={(e) => setForm((p) => ({ ...p, empCode: e.target.value }))} placeholder="EMP-010" />
              </Field>
              <Field label="Full Name" required>
                <Input value={form.empName} onChange={(e) => setForm((p) => ({ ...p, empName: e.target.value }))} placeholder="Rahul Sharma" />
              </Field>
              <Field label="Email" required>
                <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="rahul@company.com" />
              </Field>
              <Field label="Phone">
                <Input value={form.mobileNumber} onChange={(e) => setForm((p) => ({ ...p, mobileNumber: e.target.value }))} placeholder="+91..." />
              </Field>
              <Field label="Password" required>
                <Input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="Min. 8 characters" />
              </Field>
            </div>
          </Section>

          <Section title="Role & Hierarchy">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Consultant Type" required>
                <Select value={form.consultantType} onValueChange={(v) => setForm((p) => ({ ...p, consultantType: v as Employee['consultantType'] }))}>
                  <SelectTrigger className='w-full'><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {consultantTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Reports To">
                <SearchableSelect value={form.reportsTo} onValueChange={(v) => setForm((p) => ({ ...p, reportsTo: v }))} options={reportsToOptions} placeholder="Select manager..." />
              </Field>
              <Field label="HR Access">
                <label className="flex items-center gap-2 h-9 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.isHr} onChange={(e) => setForm((p) => ({ ...p, isHr: e.target.checked }))} className="h-4 w-4 rounded border-gray-300" />
                  <span>This employee is HR</span>
                </label>
              </Field>
              <Field label="Accounts Access">
                <label className="flex items-center gap-2 h-9 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.isAccounts} onChange={(e) => setForm((p) => ({ ...p, isAccounts: e.target.checked }))} className="h-4 w-4 rounded border-gray-300" />
                  <span>Can mark expenses as paid</span>
                </label>
              </Field>
            </div>
          </Section>

          <Section title="Dates">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Date of Birth">
                <Input type="date" value={form.dateOfBirth} onChange={(e) => setForm((p) => ({ ...p, dateOfBirth: e.target.value }))} />
              </Field>
              <Field label="Joining Date">
                <Input type="date" value={form.joiningDate} onChange={(e) => setForm((p) => ({ ...p, joiningDate: e.target.value }))} />
              </Field>
              <Field label="Fill Days Override" hint="Blank = default (3 days). 30 days recommended for HR.">
                <Input type="number" min="1" max="90" value={form.fillDaysOverride} onChange={(e) => setForm((p) => ({ ...p, fillDaysOverride: e.target.value }))} placeholder="3" />
              </Field>
            </div>
          </Section>

          <Section title="Compensation & Personal">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Annual CTC (₹)">
                <Input type="number" min="0" value={form.annualCTC} onChange={(e) => setForm((p) => ({ ...p, annualCTC: e.target.value }))} placeholder="600000" />
              </Field>
              <Field label="Blood Group">
                <Select value={form.bloodGroup} onValueChange={(v) => setForm((p) => ({ ...p, bloodGroup: v }))}>
                  <SelectTrigger className='w-full'><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {bloodGroups.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Marital Status">
                <Select value={form.maritalStatus} onValueChange={(v) => setForm((p) => ({ ...p, maritalStatus: v }))}>
                  <SelectTrigger className='w-full'><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {maritalStatuses.map((m) => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </Section>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => router.push('/employees')} disabled={saving}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-linear-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white shadow-sm"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create employee
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

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
