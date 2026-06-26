/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, Loader2, Send, Save, AlertTriangle, Receipt, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/providers/auth-provider';
import { employeesApi } from '@/lib/api/employees';
import {
  salarySlipsApi,
  previewSalarySlipPdf,
  type SalarySlip,
  type CreateSalarySlipDto,
  type UpdateSalarySlipDto,
} from '@/lib/api/salary-slips';

/**
 * Shared full-page form used by both /new and /[slipId]/edit.
 *
 *   - In create mode: caller passes `employeeId` and a target type so we
 *     can pre-fill header context from the user record (designation,
 *     department, DOJ, bank info, monthly CTC = annualCTC / 12).
 *   - In edit mode: caller passes the existing `slip` and we hydrate
 *     state from it.
 *
 * Totals (gross / total_deductions / net / amount-in-words) are computed
 * live in the UI for instant feedback, then re-computed authoritatively
 * by the backend on save — keep both in sync by using the same rounding
 * rule (round to 2 dp).
 */
export function SalarySlipForm(props: {
  employeeId: number;
  targetType: string;
  slip?: SalarySlip; // present in edit mode
  /**
   * Optional carry-over template — when present, the create form seeds
   * its earnings/deductions/header context from this slip instead of
   * the (much sparser) user record. The slip month is NOT copied so HR
   * still picks the new period explicitly.
   */
  templateSlip?: SalarySlip | null;
}) {
  const { employeeId, targetType, slip, templateSlip } = props;
  const router = useRouter();
  const qc = useQueryClient();
  const isEditMode = !!slip;
  // Carry-over only applies on create — in edit mode we always show
  // the slip's own data and never pull from elsewhere.
  const carryOver = !isEditMode ? templateSlip ?? null : null;

  // ── Pull employee snapshot to pre-fill header context on Create ──
  // In edit mode we still load it so the header card on the form shows
  // the recipient's name/code, but we don't auto-fill the form fields
  // (those should already be set from the slip itself).
  // Caller role drives which employee-read endpoint we use. Admins hit the
  // admin routes; HR / Accounts are `_type === 'employee'` and CANNOT call
  // the admin-only `/employees/:id` (it 403s, leaving the form blank), so
  // they read via `/employee/employees/:id`, which exposes payroll identity
  // to HR/Accounts.
  const { user } = useAuth();
  const callerIsAdmin = user?._type === 'admin';

  const { data: empRaw } = useQuery({
    queryKey: ['employee-for-slip', targetType, employeeId, callerIsAdmin],
    queryFn: async () => {
      // Response shape is `{ data: ... }` so unwrap defensively.
      const r = callerIsAdmin
        ? targetType === 'admin'
          ? await employeesApi.getAdmin(employeeId)
          : await employeesApi.getOne(employeeId)
        : await employeesApi.employeeGetOne(employeeId);
      return r.data?.data ?? r.data;
    },
    enabled: !!employeeId,
  });
  const emp: any = empRaw ?? {};

  // ── Form state ────────────────────────────────────────────────────────────
  // The seed row is the slip itself in edit mode, otherwise the
  // carry-over template (latest slip for this employee). slipMonth is
  // intentionally NOT carried over — HR picks the new period.
  const seed = slip ?? carryOver;
  const initialMonth = slip?.slipMonth ?? defaultMonth();
  const [slipMonth, setSlipMonth] = useState<string>(initialMonth);
  // Header
  const [designation, setDesignation] = useState(seed?.designation ?? '');
  const [department, setDepartment] = useState(seed?.department ?? '');
  const [dateOfJoining, setDateOfJoining] = useState(toDateInputValue(seed?.dateOfJoining));
  const [bankName, setBankName] = useState(seed?.bankName ?? '');
  const [bankAccountNo, setBankAccountNo] = useState(seed?.bankAccountNo ?? '');
  const [paymentMode, setPaymentMode] = useState(seed?.paymentMode ?? '');
  const [bankIfsc, setBankIfsc] = useState(seed?.bankIfsc ?? '');
  const [panNumber, setPanNumber] = useState(seed?.panNumber ?? '');
  const [uanNumber, setUanNumber] = useState(seed?.uanNumber ?? '');
  const [monthlyCtc, setMonthlyCtc] = useState<string>(numStr(seed?.monthlyCtc));
  // Attendance
  // Total Working Days defaults to the calendar length of the slip
  // month (Feb→28/29, Apr→30, May→31, …) and re-derives whenever HR
  // changes the month — unless they've manually overridden it. Edit
  // mode shows the slip's stored value. LOP resets to 0 on a new slip
  // (most months have none; silently reusing last month's is a
  // foot-gun). `twdManual` flips true once HR types a custom value so
  // the month-driven auto-update stops clobbering their figure.
  const [totalWorkingDays, setTotalWorkingDays] = useState<string>(
    isEditMode ? numStr(seed?.totalWorkingDays) : String(daysInMonth(initialMonth) || ''),
  );
  const [twdManual, setTwdManual] = useState(false);
  const [lopDays, setLopDays] = useState<string>(slip ? numStr(slip.lopDays) : '0');
  const [paidDaysManual, setPaidDaysManual] = useState<string>(
    slip ? numStr(slip.paidDays) : '',
  );
  // Earnings — full carry-over (salary structure is the recurring bit).
  const [basicSalary, setBasicSalary] = useState<string>(numStr(seed?.basicSalary));
  const [hra, setHra] = useState<string>(numStr(seed?.hra));
  const [conveyance, setConveyance] = useState<string>(numStr(seed?.conveyance));
  const [otherAllowances, setOtherAllowances] = useState<string>(numStr(seed?.otherAllowances));
  // Deductions — full carry-over too. TDS and Advance often vary month
  // to month, but copying them as a starting point is still helpful;
  // HR overrides when the actual numbers differ.
  const [epfEmployer, setEpfEmployer] = useState<string>(numStr(seed?.epfEmployer));
  const [pfEmployee, setPfEmployee] = useState<string>(numStr(seed?.pfEmployee));
  const [medicalInsurance, setMedicalInsurance] = useState<string>(numStr(seed?.medicalInsurance));
  const [tds, setTds] = useState<string>(numStr(seed?.tds));
  const [advance, setAdvance] = useState<string>(numStr(seed?.advance));

  // ── Auto-fill blanks from the employee record + standard payroll defaults ──
  // We use a derived flag instead of useEffect so the prefill respects
  // any user edits in flight — `seeded` flips to true once we've seeded
  // from the response, never overwriting the user's typing.
  //
  // Runs in both create AND edit mode but every set is `!field` guarded,
  // so an existing slip's saved values are never overwritten — only
  // fields HR never filled in get auto-populated. Carry-over slips (where
  // the previous month is the source) already populate state via `seed`,
  // so the salary-structure derivation below is naturally skipped.
  const [seeded, setSeeded] = useState(false);
  if (!seeded && empRaw) {
    setSeeded(true);
    if (!designation && emp.consultantType) {
      setDesignation(humaniseConsultantType(emp.consultantType));
    }
    // Department is now an employee-profile field — source it from the
    // profile on a new slip (override stale carry-over), backfill-only
    // in edit mode so a saved snapshot isn't clobbered.
    if (emp.department && (!isEditMode || !department)) {
      setDepartment(emp.department);
    }
    // Date of Joining is employee identity (not slip-specific), so on a
    // NEW slip we always source it from the profile — overriding any
    // stale / empty value carried over from the previous slip. In edit
    // mode we only backfill when the saved slip left it blank, so an
    // intentional historical snapshot isn't clobbered.
    //
    // Falls back to the account-created date when the profile has no
    // explicit joining date — this matches what the profile tab's
    // "Joined" field displays, so the slip shows the same date the user
    // sees on the profile. Normalised to YYYY-MM-DD for the date input.
    const profileDoj =
      toDateInputValue(emp.joiningDate) || toDateInputValue(emp.createdAt);
    if (profileDoj && (!isEditMode || !dateOfJoining)) {
      setDateOfJoining(profileDoj);
    }

    // ── Payroll identity ──
    // Pulled from the employee profile now that we store these on the
    // user row. The carry-over slip would also populate them via `seed`;
    // the `!field` guards make sure we only fill blanks.
    if (!panNumber && emp.panNumber) setPanNumber(emp.panNumber);
    if (!uanNumber && emp.uanNumber) setUanNumber(emp.uanNumber);
    if (!bankName && emp.bankName) setBankName(emp.bankName);
    if (!bankAccountNo && emp.bankAccountNo) setBankAccountNo(emp.bankAccountNo);
    if (!bankIfsc && emp.bankIfsc) setBankIfsc(emp.bankIfsc);
    if (!paymentMode && emp.paymentMode) setPaymentMode(emp.paymentMode);

    // Compute monthly CTC up front so the earnings derivation below can
    // use it. Prefer whatever's already in state (carry-over slip or HR
    // typed it). If it's blank or zero, pull from the employee's annual
    // CTC — covers both first-slip and "prior slip never had CTC set".
    const numIsEmpty = (s: string) => !s || Number(s) === 0;
    // The user record serializes the column as `annualCtc`; tolerate the
    // legacy `annualCTC` casing too.
    const annualCtc = emp.annualCtc ?? emp.annualCTC;
    let derivedCtc = monthlyCtc ? Number(monthlyCtc) : 0;
    if (numIsEmpty(monthlyCtc) && annualCtc) {
      derivedCtc = Math.round(Number(annualCtc) / 12);
      setMonthlyCtc(String(derivedCtc));
    }

    // (Total Working Days is initialised from the slip month directly
    // and kept in sync by `handleMonthChange` below, so it no longer
    // needs seeding here.)

    // Salary-structure breakdown — fill when the basic-salary field is
    // empty or zero AND we know monthly CTC. Treating `'0'` as empty is
    // intentional: a freshly-created carry-over slip that never had its
    // earnings set still surfaces as zeros, and HR expects the form to
    // back-fill standard defaults rather than show a row of ₹0.
    //
    // Standard Indian PSU-style split:
    //   Basic = 50% of CTC
    //   HRA   = 25% of CTC (40% for metros — HR re-keys if needed)
    //   Conveyance = ₹1600 (standard fixed amount)
    //   Other Allowances = whatever's left so Gross = CTC exactly
    // Edit mode is skipped — HR may have intentionally saved zeros
    // (e.g. an employee fully on LOP), and we don't overwrite that.
    if (!isEditMode && numIsEmpty(basicSalary) && derivedCtc > 0) {
      const basic = Math.round(derivedCtc * 0.5);
      const hraDerived = Math.round(derivedCtc * 0.25);
      const conveyanceDerived = 1600;
      const otherDerived = Math.max(
        0,
        derivedCtc - basic - hraDerived - conveyanceDerived,
      );
      setBasicSalary(String(basic));
      setHra(String(hraDerived));
      setConveyance(String(conveyanceDerived));
      setOtherAllowances(String(otherDerived));

      // Statutory PF is 12% of Basic, capped at ₹1800 (the ₹15k Basic
      // ceiling). Employer share matches.
      if (numIsEmpty(pfEmployee)) {
        const pf = Math.round(Math.min(basic, 15000) * 0.12);
        setPfEmployee(String(pf));
        if (numIsEmpty(epfEmployer)) setEpfEmployer(String(pf));
      }
    }
  }

  // ── Live totals (mirror the backend's recompute) ──────────────────────────
  const totals = useMemo(() => {
    const n = (s: string) => {
      const v = Number(s);
      return Number.isFinite(v) ? v : 0;
    };
    const gross = round2(n(basicSalary) + n(hra) + n(conveyance) + n(otherAllowances));
    const deductions = round2(
      n(epfEmployer) + n(pfEmployee) + n(medicalInsurance) + n(tds) + n(advance),
    );
    const net = round2(gross - deductions);
    const paidDaysAuto = round2(Math.max(0, n(totalWorkingDays) - n(lopDays)));
    const paidDays = paidDaysManual.trim() === '' ? paidDaysAuto : n(paidDaysManual);
    return { gross, deductions, net, paidDays };
  }, [
    basicSalary, hra, conveyance, otherAllowances,
    epfEmployer, pfEmployee, medicalInsurance, tds, advance,
    totalWorkingDays, lopDays, paidDaysManual,
  ]);

  // Changing the slip month re-derives Total Working Days to the
  // calendar length of the new month (28/29/30/31), unless HR has
  // manually overridden the figure. Paid Days then auto-recomputes via
  // the totals memo (working − LOP).
  const handleMonthChange = (newMonth: string) => {
    setSlipMonth(newMonth);
    if (!twdManual) {
      const days = daysInMonth(newMonth);
      if (days) setTotalWorkingDays(String(days));
    }
  };

  // ── Save mutations ────────────────────────────────────────────────────────
  const buildDto = (): CreateSalarySlipDto | UpdateSalarySlipDto => {
    const n = (s: string) => {
      const v = Number(s);
      return Number.isFinite(v) ? v : 0;
    };
    const common = {
      designation: designation || undefined,
      department: department || undefined,
      dateOfJoining: dateOfJoining || undefined,
      bankName: bankName || undefined,
      bankAccountNo: bankAccountNo || undefined,
      paymentMode: paymentMode || undefined,
      bankIfsc: bankIfsc || undefined,
      panNumber: panNumber || undefined,
      uanNumber: uanNumber || undefined,
      monthlyCtc: monthlyCtc ? n(monthlyCtc) : undefined,
      totalWorkingDays: totalWorkingDays ? n(totalWorkingDays) : 0,
      lopDays: lopDays ? n(lopDays) : 0,
      paidDays: paidDaysManual.trim() === '' ? undefined : n(paidDaysManual),
      basicSalary: n(basicSalary),
      hra: n(hra),
      conveyance: n(conveyance),
      otherAllowances: n(otherAllowances),
      epfEmployer: n(epfEmployer),
      pfEmployee: n(pfEmployee),
      medicalInsurance: n(medicalInsurance),
      tds: n(tds),
      advance: n(advance),
    };
    if (isEditMode) return common as UpdateSalarySlipDto;
    return { employeeId, slipMonth, ...common } as CreateSalarySlipDto;
  };

  const saveMut = useMutation({
    mutationFn: async (publishAfter: boolean) => {
      const dto = buildDto();
      if (isEditMode) {
        await salarySlipsApi.update(slip!.id, dto as UpdateSalarySlipDto);
        if (publishAfter && !slip!.isPublished) {
          await salarySlipsApi.publish(slip!.id);
        }
        return slip!.id;
      } else {
        const r = await salarySlipsApi.create(dto as CreateSalarySlipDto);
        const created = r.data?.data ?? r.data;
        if (publishAfter && created?.id) {
          await salarySlipsApi.publish(created.id);
        }
        return created?.id;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salary-slips', targetType, String(employeeId)] });
      toast.success(isEditMode ? 'Salary slip updated' : 'Salary slip created');
      router.push(`/employees/${employeeId}?tab=salary-slips${targetType === 'admin' ? '&type=admin' : ''}`);
    },
    onError: (e: any) => {
      // The backend returns 409 with `data.existingId` when a duplicate
      // (employee, month) already exists. Help the user out by linking
      // straight to that row's edit page.
      const existingId = e?.response?.data?.data?.existingId;
      if (e?.response?.status === 409 && existingId) {
        toast.error(
          `A slip for ${slipMonth} already exists for this employee — opening it for edit.`,
        );
        router.push(`/employees/${employeeId}/salary-slips/${existingId}/edit?targetType=${targetType}`);
        return;
      }
      toast.error(e?.response?.data?.message ?? 'Save failed');
    },
  });

  const saving = saveMut.isPending;
  const isPublished = slip?.isPublished ?? false;

  // ── Preview ───────────────────────────────────────────────────────────────
  // Hits the server-side renderer with the current form state (no
  // save). Server returns application/pdf which we open in a new tab.
  // Server-rendered so the preview matches the published artefact 1:1
  // — no risk of a client-side mockup drifting from the actual layout.
  const [previewing, setPreviewing] = useState(false);
  const handlePreview = async () => {
    setPreviewing(true);
    try {
      // The preview endpoint accepts the create DTO shape, so reuse
      // `buildDto` and force the identity fields (employeeId, slipMonth)
      // even when we're in edit mode (where buildDto would omit them).
      const dto: CreateSalarySlipDto = {
        ...(buildDto() as any),
        employeeId,
        slipMonth,
      };
      await previewSalarySlipPdf(dto);
    } catch (e: any) {
      // axios returns the error body as a Blob when responseType
      // is 'blob', so JSON.message isn't reachable directly. Decode
      // the blob back to text and parse to surface the server message.
      let msg = 'Preview failed';
      const blob = e?.response?.data;
      if (blob instanceof Blob) {
        try {
          const text = await blob.text();
          const parsed = JSON.parse(text);
          if (typeof parsed?.message === 'string') msg = parsed.message;
        } catch {
          /* not JSON — keep default */
        }
      } else if (typeof e?.response?.data?.message === 'string') {
        msg = e.response.data.message;
      }
      toast.error(msg);
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href={`/employees/${employeeId}?tab=salary-slips${targetType === 'admin' ? '&type=admin' : ''}`}>
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <div className="flex items-center gap-2 ml-auto">
          {isPublished && (
            <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-400/50">
              <AlertTriangle className="mr-1 h-3 w-3" /> Published — read-only
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
          <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">
            {isEditMode ? 'Edit Salary Slip' : 'New Salary Slip'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {emp?.name ? <span className="font-medium">{emp.name}</span> : 'Recipient'}
            {emp?.empCode ? <span className="text-muted-foreground"> · {emp.empCode}</span> : null}
          </p>
        </div>
      </div>

      {/* Carry-over banner — only shown on create when we seeded from a
          previous slip. Makes the source month visible so HR knows what
          they're about to copy. */}
      {carryOver && (
        <div className="rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
          <Receipt className="h-4 w-4 shrink-0" />
          <span>
            Pre-filled from the{' '}
            <span className="font-semibold">{prettyMonth(carryOver.slipMonth)}</span> slip
            (LOP reset to 0). Adjust any numbers that changed this month.
          </span>
        </div>
      )}

      {/* Period + status */}
      <Card>
        <CardContent className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Slip Month *" hint="Format YYYY-MM (e.g. 2026-05)">
            <Input
              type="month"
              value={slipMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              disabled={isEditMode || isPublished}
            />
            {isEditMode && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Month is immutable. Delete and recreate if you picked the wrong one.
              </p>
            )}
          </Field>
          <Field label="Status">
            <div className="h-9 flex items-center">
              {isPublished ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">Published</Badge>
              ) : (
                <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-400/50">Draft</Badge>
              )}
            </div>
          </Field>
        </CardContent>
      </Card>

      {/* Header context */}
      <Section title="Employee Info" subtitle="Snapshot stored on the slip — does not edit the user record.">
        <Field label="Designation"><Input value={designation} onChange={(e) => setDesignation(e.target.value)} disabled={isPublished} /></Field>
        <Field label="Department"><Input value={department} onChange={(e) => setDepartment(e.target.value)} disabled={isPublished} /></Field>
        <Field label="Date of Joining"><Input type="date" value={dateOfJoining} onChange={(e) => setDateOfJoining(e.target.value)} disabled={isPublished} /></Field>
        <Field label="Bank Name"><Input value={bankName} onChange={(e) => setBankName(e.target.value)} disabled={isPublished} /></Field>
        <Field label="Bank A/C No"><Input value={bankAccountNo} onChange={(e) => setBankAccountNo(e.target.value)} disabled={isPublished} /></Field>
        <Field label="IFSC"><Input value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} disabled={isPublished} placeholder="e.g. HDFC0004017" /></Field>
        <Field label="Payment Mode"><Input value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} disabled={isPublished} placeholder="e.g. Bank Transfer" /></Field>
        <Field label="PAN Number"><Input value={panNumber} onChange={(e) => setPanNumber(e.target.value)} disabled={isPublished} placeholder="e.g. ABCDE1234F" /></Field>
        <Field label="UAN Number"><Input value={uanNumber} onChange={(e) => setUanNumber(e.target.value)} disabled={isPublished} placeholder="Universal Account Number" /></Field>
      </Section>

      {/* Attendance */}
      <Section title="Attendance" subtitle="Paid Days auto-computes as Total Working Days − LOP unless you override.">
        <Field label="Total Working Days" hint="Auto-set from the slip month; edit to override."><Input type="number" inputMode="decimal" value={totalWorkingDays} onChange={(e) => { setTwdManual(true); setTotalWorkingDays(e.target.value); }} disabled={isPublished} /></Field>
        <Field label="LOP Days"><Input type="number" inputMode="decimal" value={lopDays} onChange={(e) => setLopDays(e.target.value)} disabled={isPublished} /></Field>
        <Field label="Paid Days" hint="Leave blank to auto-compute.">
          <Input
            type="number"
            inputMode="decimal"
            value={paidDaysManual}
            onChange={(e) => setPaidDaysManual(e.target.value)}
            disabled={isPublished}
            placeholder={totals.paidDays.toString()}
          />
        </Field>
      </Section>

      {/* Earnings */}
      <Section title="Earnings" subtitle="Gross is the sum of the four lines below.">
        <Field label="Basic Salary"><Input type="number" inputMode="decimal" value={basicSalary} onChange={(e) => setBasicSalary(e.target.value)} disabled={isPublished} /></Field>
        <Field label="House Rent Allowance"><Input type="number" inputMode="decimal" value={hra} onChange={(e) => setHra(e.target.value)} disabled={isPublished} /></Field>
        <Field label="Conveyance"><Input type="number" inputMode="decimal" value={conveyance} onChange={(e) => setConveyance(e.target.value)} disabled={isPublished} /></Field>
        <Field label="Other Allowances"><Input type="number" inputMode="decimal" value={otherAllowances} onChange={(e) => setOtherAllowances(e.target.value)} disabled={isPublished} /></Field>
        <ReadOnlyTotal label="Gross Salary" value={totals.gross} />
      </Section>

      {/* Deductions */}
      <Section title="Deductions" subtitle="Total Deductions is the sum of the five lines below.">
        <Field label="EPF (Employer)"><Input type="number" inputMode="decimal" value={epfEmployer} onChange={(e) => setEpfEmployer(e.target.value)} disabled={isPublished} /></Field>
        <Field label="PF (Employee)"><Input type="number" inputMode="decimal" value={pfEmployee} onChange={(e) => setPfEmployee(e.target.value)} disabled={isPublished} /></Field>
        <Field label="Medical Insurance"><Input type="number" inputMode="decimal" value={medicalInsurance} onChange={(e) => setMedicalInsurance(e.target.value)} disabled={isPublished} /></Field>
        <Field label="TDS"><Input type="number" inputMode="decimal" value={tds} onChange={(e) => setTds(e.target.value)} disabled={isPublished} /></Field>
        <Field label="Advance"><Input type="number" inputMode="decimal" value={advance} onChange={(e) => setAdvance(e.target.value)} disabled={isPublished} /></Field>
        <ReadOnlyTotal label="Total Deductions" value={totals.deductions} accent="text-rose-600 dark:text-rose-400" />
      </Section>

      {/* Summary */}
      <Card>
        <CardContent className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-blue-500/5">
          <ReadOnlyTotal label="Net Pay" value={totals.net} accent="text-blue-700 dark:text-blue-300" big />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Amount in Words</p>
            <p className="text-sm font-medium leading-snug">
              {rupeesInWords(totals.net)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Footer actions */}
      <div className="flex flex-wrap gap-2 justify-end pt-2">
        <Link href={`/employees/${employeeId}?tab=salary-slips${targetType === 'admin' ? '&type=admin' : ''}`}>
          <Button variant="outline" disabled={saving || previewing}>Cancel</Button>
        </Link>
        {/* Preview opens a new tab with the server-rendered PDF using
            the current form values — no DB write, available on both
            drafts and published slips so HR can re-verify the layout
            of a published slip without unpublishing it first. */}
        <Button
          variant="outline"
          disabled={saving || previewing}
          onClick={handlePreview}
        >
          {previewing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Eye className="mr-1.5 h-4 w-4" />}
          Preview
        </Button>
        {!isPublished && (
          <>
            <Button variant="outline" disabled={saving || previewing} onClick={() => saveMut.mutate(false)}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Save Draft
            </Button>
            <Button disabled={saving || previewing} onClick={() => saveMut.mutate(true)}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
              Save + Publish
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Small layout helpers ────────────────────────────────────────────────────

function Section(props: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="px-5 py-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold">{props.title}</h2>
          {props.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{props.subtitle}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {props.children}
        </div>
      </CardContent>
    </Card>
  );
}

function Field(props: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{props.label}</p>
      {props.children}
      {props.hint && <p className="text-[10px] text-muted-foreground mt-1">{props.hint}</p>}
    </div>
  );
}

function ReadOnlyTotal(props: { label: string; value: number; accent?: string; big?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{props.label}</p>
      <p
        className={`font-semibold tabular-nums ${props.accent ?? 'text-emerald-700 dark:text-emerald-400'} ${props.big ? 'text-2xl' : 'text-base'}`}
      >
        ₹{props.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

// ── Pure helpers ────────────────────────────────────────────────────────────

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function numStr(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return '';
  return String(v);
}

function defaultMonth(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
}

/**
 * Normalise any date-ish value to the `YYYY-MM-DD` an <input type="date">
 * needs. Accepts a clean date string, a full ISO datetime
 * (`2025-04-01T00:00:00.000Z`), or a Date — returns '' for anything
 * unparseable so the input stays empty rather than showing garbage.
 */
function toDateInputValue(v: string | Date | null | undefined): string {
  if (!v) return '';
  const s = String(v);
  // Already a clean date string — use as-is.
  const m = /^(\d{4}-\d{2}-\d{2})$/.exec(s);
  if (m) return m[1];
  // Full ISO datetime / Date → take local date parts so it matches the
  // profile tab's `format(new Date(...))` display (avoids off-by-one
  // from a UTC slice).
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** `'2026-05'` → 31. Returns 0 for malformed input so callers can skip. */
function daysInMonth(yyyyMm: string): number {
  const [y, m] = (yyyyMm || '').split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return 0;
  // Day 0 of next month = last day of current month.
  return new Date(y, m, 0).getDate();
}

/** `'2026-05'` → `'May 2026'`. Used by the carry-over banner copy. */
function prettyMonth(yyyyMm: string): string {
  const [y, m] = (yyyyMm || '').split('-').map(Number);
  if (!y || !m) return yyyyMm;
  const months = [
    'January','February','March','April','May','June','July',
    'August','September','October','November','December',
  ];
  return `${months[m - 1]} ${y}`;
}

function humaniseConsultantType(slug: string): string {
  return slug
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

/**
 * Live preview of the backend's `rupeesInWords` so the user sees the
 * "Amount in Words" update as they type. The backend computes the
 * authoritative value on save — keep both implementations identical.
 */
function rupeesInWords(amount: number): string {
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
    'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
    'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    const t = Math.floor(n / 10);
    const o = n % 10;
    return o === 0 ? tens[t] : `${tens[t]} ${ones[o]}`;
  };
  const three = (n: number): string => {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    const parts: string[] = [];
    if (h > 0) parts.push(`${ones[h]} Hundred`);
    if (rest > 0) parts.push(two(rest));
    return parts.join(' and ').trim();
  };
  const indian = (n: number): string => {
    if (n === 0) return 'Zero';
    let r = n;
    const parts: string[] = [];
    const cr = Math.floor(r / 10000000); r %= 10000000;
    if (cr > 0) parts.push(`${three(cr)} Crore`);
    const lk = Math.floor(r / 100000); r %= 100000;
    if (lk > 0) parts.push(`${three(lk)} Lakh`);
    const th = Math.floor(r / 1000); r %= 1000;
    if (th > 0) parts.push(`${two(th)} Thousand`);
    if (r > 0) parts.push(three(r));
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  };

  const rupees = Math.floor(Math.max(0, amount));
  const paise = Math.round((Math.max(0, amount) - rupees) * 100);
  let out = `Rupees ${indian(rupees)}`;
  if (paise > 0) out += ` and ${indian(paise)} Paise`;
  return `${out} Only`;
}
