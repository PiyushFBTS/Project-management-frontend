/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from './axios-instance';

/**
 * Wrapper for the Sprint-1 salary-slip endpoints. Mirrors the backend
 * routes 1:1 so the call sites stay terse. Admin / HR / accounts hit
 * the `/admin/salary-slips/*` group; the recipient employee hits
 * `/employee/salary-slips/*` (self-scoped server-side — no employeeId
 * parameter exposed to the wire).
 */
export const salarySlipsApi = {
  // ── Admin / HR / Accounts ─────────────────────────────────────────────────

  listForEmployee: (employeeId: number, year?: number) =>
    api.get('/admin/salary-slips', {
      params: { employeeId, year },
    }),

  /**
   * Admin hub list — any combination of filters. Both omitted returns
   * everything in the tenant, but the UI should encourage a month.
   */
  listByFilters: (params: {
    month?: string;
    employeeId?: number;
    year?: number;
    isPublished?: boolean;
  }) =>
    api.get('/admin/salary-slips', {
      params: {
        month: params.month,
        employeeId: params.employeeId,
        year: params.year,
        isPublished:
          params.isPublished === undefined ? undefined : String(params.isPublished),
      },
    }),

  /** Bulk-generate draft slips for the given employees in one month. */
  bulkCreate: (dto: { slipMonth: string; employeeIds: number[] }) =>
    api.post('/admin/salary-slips/bulk', dto),

  /** Stream the .xlsx export — blob response so the caller can save it. */
  exportXlsx: (params: {
    month?: string;
    employeeId?: number;
    isPublished?: boolean;
  }) =>
    api.get('/admin/salary-slips/export/xlsx', {
      params: {
        month: params.month,
        employeeId: params.employeeId,
        isPublished:
          params.isPublished === undefined ? undefined : String(params.isPublished),
      },
      responseType: 'blob',
    }),

  /**
   * Most-recent slip for an employee — used by the create form to
   * carry over recurring fields (designation, salary breakdown,
   * deductions) so HR doesn't have to retype them each month. Returns
   * `data: null` when no prior slip exists; the form then falls back
   * to the employee record.
   */
  getLatestForEmployee: (employeeId: number, excludeMonth?: string) =>
    api.get('/admin/salary-slips/latest', {
      params: { employeeId, excludeMonth },
    }),

  getOne: (id: number) => api.get(`/admin/salary-slips/${id}`),

  create: (dto: CreateSalarySlipDto) =>
    api.post('/admin/salary-slips', dto),

  update: (id: number, dto: UpdateSalarySlipDto) =>
    api.patch(`/admin/salary-slips/${id}`, dto),

  publish: (id: number) => api.post(`/admin/salary-slips/${id}/publish`),

  unpublish: (id: number) =>
    api.post(`/admin/salary-slips/${id}/unpublish`),

  remove: (id: number) => api.delete(`/admin/salary-slips/${id}`),

  // ── Recipient (self) ──────────────────────────────────────────────────────

  listMine: () => api.get('/employee/salary-slips'),

  getMyForMonth: (month: string) =>
    api.get('/employee/salary-slips/me', { params: { month } }),

  getOneMine: (id: number) => api.get(`/employee/salary-slips/${id}`),

  // ── PDF download ──────────────────────────────────────────────────────────
  // Both routes return application/pdf — the admin variant accepts any
  // slip (including drafts) for HR preview, the self variant rejects
  // drafts and slips owned by other users.
  downloadPdfAsAdmin: (id: number) =>
    api.get(`/admin/salary-slips/${id}/pdf`, { responseType: 'blob' }),
  downloadPdfAsSelf: (id: number) =>
    api.get(`/employee/salary-slips/${id}/pdf`, { responseType: 'blob' }),

  /**
   * Live preview PDF from the form's current state. Server doesn't
   * write anything — same DTO shape as create, but it bypasses the
   * uniqueness + persistence path entirely.
   */
  previewPdf: (dto: CreateSalarySlipDto) =>
    api.post('/admin/salary-slips/preview', dto, { responseType: 'blob' }),
};

/**
 * Triggers a PDF download for a salary slip. Uses the admin endpoint
 * when the caller is a manager (admin / HR / accounts), the self
 * endpoint otherwise.
 *
 * We can't link to the PDF endpoint via a plain `<a href>` because the
 * server expects an `Authorization: Bearer …` header. The axios call
 * picks that up automatically; we then turn the response blob into an
 * object-URL and click a synthetic anchor so the browser handles the
 * file save.
 */
export async function downloadSalarySlipPdf(opts: {
  slipId: number;
  asManager: boolean;
  filenameHint?: string;
}): Promise<void> {
  const { slipId, asManager } = opts;
  const res = asManager
    ? await salarySlipsApi.downloadPdfAsAdmin(slipId)
    : await salarySlipsApi.downloadPdfAsSelf(slipId);

  // Prefer the filename the server suggested via Content-Disposition.
  // Fall back to whatever the caller hinted, then a generic name.
  const cd: string =
    (res.headers as any)?.['content-disposition'] ??
    (res.headers as any)?.get?.('content-disposition') ??
    '';
  const m = /filename="([^"]+)"/i.exec(cd);
  const filename = m?.[1] ?? opts.filenameHint ?? `salary-slip-${slipId}.pdf`;

  const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revoke so Safari's late open-in-tab path doesn't lose the
  // blob mid-download.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Opens a *saved* slip's PDF inline in a new browser tab (view, not
 * download). Same auth-header constraint as the download helper, so we
 * fetch the blob via axios and hand the object-URL to `window.open`.
 * Managers hit the admin route (drafts allowed); everyone else the self
 * route (published + owned only).
 */
export async function previewSalarySlipPdfById(opts: {
  slipId: number;
  asManager: boolean;
}): Promise<void> {
  const { slipId, asManager } = opts;
  // Open the tab *synchronously* inside the click gesture so pop-up
  // blockers don't swallow it (opening after the `await` below is what
  // gets blocked). We point it at the blob once the PDF arrives. Note:
  // no `noopener` here — that flag makes window.open return null, so we
  // couldn't navigate the tab afterwards.
  const win = typeof window !== 'undefined' ? window.open('', '_blank') : null;
  try {
    const res = asManager
      ? await salarySlipsApi.downloadPdfAsAdmin(slipId)
      : await salarySlipsApi.downloadPdfAsSelf(slipId);

    const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    if (win) {
      win.location.href = url;
    } else {
      // Pop-up was blocked — fall back to a synthetic anchor click.
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e: any) {
    if (win) win.close();
    // With responseType:'blob', axios returns the error body as a Blob,
    // so the JSON message isn't directly reachable — decode it to give
    // a real reason instead of a generic failure.
    const errBlob = e?.response?.data;
    let msg: string | null = null;
    if (errBlob instanceof Blob) {
      try {
        const parsed = JSON.parse(await errBlob.text());
        if (typeof parsed?.message === 'string') msg = parsed.message;
      } catch {
        /* not JSON — keep generic */
      }
    }
    throw msg ? new Error(msg) : e;
  }
}

/**
 * Renders the current form state as a preview PDF and opens it in a
 * new browser tab. Skips the download dance — `window.open(blobUrl)`
 * lets the browser handle the PDF viewer + tab title naturally. We
 * still hold the object URL alive for a few seconds before revoking
 * so slower viewers (Safari, mobile Chrome) finish loading first.
 */
/**
 * Triggers an .xlsx download of the salary-slip export endpoint. Same
 * blob-download dance as the PDF helper — we can't link to the route
 * directly because it expects an Authorization header.
 */
export async function downloadSalarySlipsXlsx(filters: {
  month?: string;
  employeeId?: number;
  isPublished?: boolean;
}): Promise<void> {
  const res = await salarySlipsApi.exportXlsx(filters);
  const cd: string =
    (res.headers as any)?.['content-disposition'] ??
    (res.headers as any)?.get?.('content-disposition') ??
    '';
  const m = /filename="([^"]+)"/i.exec(cd);
  const filename = m?.[1] ?? `salary_slips_${filters.month ?? 'all'}.xlsx`;

  const blob = new Blob([res.data as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function previewSalarySlipPdf(dto: CreateSalarySlipDto): Promise<void> {
  const res = await salarySlipsApi.previewPdf(dto);
  const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) {
    // Pop-up blockers can swallow window.open from a non-direct user
    // gesture. Fall back to forcing a click on a synthetic anchor —
    // browsers usually honour that path when window.open is blocked.
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}

// ── Shared types ────────────────────────────────────────────────────────────

/** Wire-format payslip row. Numbers come back as JS numbers (the
 *  backend's DECIMAL transformer coerces strings before serialisation). */
export interface SalarySlip {
  id: number;
  companyId: number;
  employeeId: number;
  slipMonth: string; // 'YYYY-MM'

  // Header
  designation: string | null;
  department: string | null;
  dateOfJoining: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  paymentMode: string | null;
  bankIfsc: string | null;
  panNumber: string | null;
  uanNumber: string | null;
  monthlyCtc: number;

  // Attendance
  totalWorkingDays: number;
  lopDays: number;
  paidDays: number;

  // Earnings (gross is computed)
  basicSalary: number;
  hra: number;
  conveyance: number;
  otherAllowances: number;
  grossSalary: number;

  // Deductions (total is computed)
  epfEmployer: number;
  pfEmployee: number;
  medicalInsurance: number;
  tds: number;
  advance: number;
  totalDeductions: number;

  // Summary
  netPay: number;
  amountInWords: string | null;

  // Status / audit
  isPublished: boolean;
  publishedAt: string | null;
  createdById: number;
  createdByName: string;
  createdAt: string;
  updatedAt: string;

  // Optional relation when the backend joined it (admin findOne does)
  employee?: { id: number; name: string; email: string; empCode?: string | null };
}

/** Payload for creating a draft slip. Computed fields are server-owned. */
export interface CreateSalarySlipDto {
  employeeId: number;
  slipMonth: string;
  designation?: string;
  department?: string;
  dateOfJoining?: string;
  bankName?: string;
  bankAccountNo?: string;
  paymentMode?: string;
  bankIfsc?: string;
  panNumber?: string;
  uanNumber?: string;
  monthlyCtc?: number;
  totalWorkingDays?: number;
  lopDays?: number;
  paidDays?: number;
  basicSalary?: number;
  hra?: number;
  conveyance?: number;
  otherAllowances?: number;
  epfEmployer?: number;
  pfEmployee?: number;
  medicalInsurance?: number;
  tds?: number;
  advance?: number;
}

/** Patch payload — all create fields except the immutable identity pair. */
export type UpdateSalarySlipDto = Partial<
  Omit<CreateSalarySlipDto, 'employeeId' | 'slipMonth'>
>;
