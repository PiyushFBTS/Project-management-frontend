// ── API Response shapes ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// ── Auth ──────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Post-merge: `AdminUser` is gone — admins are rows in the unified
// `users` table with `userType: 'admin'`. The Company-admins screens
// import `MergedUser` from `@/lib/api/auth` directly; legacy callers can
// alias `MergedUser` if they need a name like `AdminUser`.

// ── Company ──────────────────────────────────────────────────────────────

export type SubscriptionPlan = 'trial' | 'basic' | 'professional' | 'enterprise';

export interface Company {
  id: number;
  name: string;
  slug: string;
  companyCode?: string;
  logoUrl?: string;
  address?: string;
  countryId?: number;
  stateId?: number;
  cityId?: number;
  postalCode?: string;
  contactPersonName?: string;
  contactEmail?: string;
  contactPhone?: string;
  gstNumber?: string;
  panNumber?: string;
  taxId?: string;
  gstin?: string;
  taxRegistrationNumber?: string;
  gstEnabled: boolean;
  vatEnabled: boolean;
  baseCurrencyCode?: string;
  userLimit: number;
  licenseExpiryDate: string;
  isActive: boolean;
  subscriptionPlan: SubscriptionPlan;
  subscriptionStart?: string;
  /** Platform-controlled AI master toggle. Only super admin can change. */
  aiEnabled: boolean;
  createdBy?: number;
  updatedBy?: number;
  createdAt: string;
  updatedAt: string;
}

// ── Email Logs ────────────────────────────────────────────────────────────

export type EmailLogStatus = 'sent' | 'failed';

export interface EmailLogAttachment {
  filename: string;
  path: string;
  mimetype: string;
  size: number;
}

export interface EmailLog {
  id: number;
  subject?: string | null;
  body?: string | null;
  toEmail: string;
  fromEmail?: string | null;
  fromName?: string | null;
  triggeredBy?: string | null;
  status: EmailLogStatus;
  errorMessage?: string | null;
  companyId?: number | null;
  attachments?: EmailLogAttachment[] | null;
  sentAt: string;
}

// ── Location & Currency ──────────────────────────────────────────────────

export interface LookupCountry {
  id: number;
  name: string;
  code: string;
  phoneCode?: string;
}

export interface LookupState {
  id: number;
  name: string;
  code?: string;
  countryId: number;
}

export interface LookupCity {
  id: number;
  name: string;
  stateId: number;
}

export interface LookupPostalCode {
  id: number;
  code: string;
  areaName?: string;
  cityId: number;
}

export interface LookupCurrency {
  id: number;
  code: string;
  name: string;
  symbol: string;
  isActive: boolean;
}

// ── Projects ─────────────────────────────────────────────────────────────

export type ProjectType = 'project' | 'support' | 'development' | 'consulting' | 'migration' | 'maintenance';
export type ProjectStatus = 'active' | 'inactive' | 'completed';

/** A row from the dynamic `project_types` catalog. */
export interface ProjectTypeDef {
  id: number;
  value: string;
  label: string;
  description?: string;
  /** Marks this type as recurring-billing (e.g. Support). Projects of a
   *  recurring type use recurring billing rows instead of milestones;
   *  the cadence (monthly / quarterly / half-yearly / yearly) is chosen
   *  per project via {@link RecurringPeriod}. */
  isRecurring?: boolean;
  isActive?: boolean;
}

export type ProjectRecurringStatus = 'pending' | 'billed' | 'received';

/**
 * Cadence selector for a recurring-type project (Sprint 1).
 *   monthly      → step 1 month, label "Apr 2026"
 *   quarterly    → step 3 months, label "Q2 2026 (Apr–Jun)"
 *   half_yearly  → step 6 months, label "H1 2026 (Jan–Jun)"
 *   yearly       → step 12 months, label "2026"
 *
 * Per-project; chosen at create-time and locked once any
 * project_recurrings row exists (backend returns 409 otherwise).
 */
export type RecurringPeriod = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';

/** One billing period for a recurring-type project (parallels Milestone). */
export interface ProjectRecurring {
  id: number;
  projectId: number;
  /** First day of the period being billed (YYYY-MM-01). For wider cadences
   *  this is the first month of the period — Q2 2026 → 2026-04-01. */
  billingMonth: string;
  /** Cadence-aware display string generated server-side. Nullable for
   *  legacy rows pre-Sprint 1 (the UI should fall back to billingMonth). */
  periodLabel: string | null;
  expectedAmount: number;
  receivedAmount: number;
  receivedAt: string | null;
  status: ProjectRecurringStatus;
  companyId: number;
  createdAt: string;
  updatedAt: string;
}

// ── Asset & Inventory Management ─────────────────────────────────────
export type AssetCategory =
  | 'laptop'
  | 'desktop'
  | 'monitor'
  | 'phone'
  | 'accessory'
  | 'other';

export type AssetOwnership = 'owned' | 'rented' | 'leased';

export type AssetCondition = 'new' | 'good' | 'fair' | 'damaged';

export type AssetStatus =
  | 'available'
  | 'assigned'
  | 'in_repair'
  | 'retired'
  | 'lost'
  | 'returned_to_vendor';

export type AssetMaintenanceType =
  | 'repair'
  | 'maintenance'
  | 'inspection'
  | 'upgrade';

export type AssetMaintenanceStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface AssetVendor {
  id: number;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  gst?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  isActive: boolean;
  companyId: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssetAssignmentSummary {
  id: number;
  userId: number;
  userName: string;
  assignedAt: string;
}

export interface Asset {
  id: number;
  assetTag: string;
  category: AssetCategory;
  categoryOtherName?: string | null;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  specs?: Record<string, unknown> | null;
  ownership: AssetOwnership;
  vendorId?: number | null;
  vendor?: Pick<AssetVendor, 'id' | 'name'> | null;
  purchaseDate?: string | null;
  purchasePrice?: number | null;
  rentalStart?: string | null;
  rentalEnd?: string | null;
  rentalMonthlyAmount?: number | null;
  warrantyExpiry?: string | null;
  condition: AssetCondition;
  status: AssetStatus;
  location?: string | null;
  notes?: string | null;
  currentAssignmentId?: number | null;
  currentHolder?: AssetAssignmentSummary | null;
  companyId: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssetAssignment {
  id: number;
  assetId: number;
  userId: number;
  user?: { id: number; name: string; email?: string } | null;
  assignedAt: string;
  assignedById?: number | null;
  assignedBy?: { id: number; name: string } | null;
  returnedAt: string | null;
  returnedById?: number | null;
  returnedBy?: { id: number; name: string } | null;
  returnCondition?: AssetCondition | null;
  returnNotes?: string | null;
  notes?: string | null;
  asset?: Asset;
  companyId: number;
}

export interface AssetMaintenanceStatusChange {
  id: number;
  fromStatus: AssetMaintenanceStatus | null;
  toStatus: AssetMaintenanceStatus;
  changedAt: string;
  changedById?: number | null;
  changedBy?: { id: number; name: string } | null;
}

export interface AssetMaintenance {
  id: number;
  assetId: number;
  type: AssetMaintenanceType;
  vendorId?: number | null;
  vendor?: Pick<AssetVendor, 'id' | 'name'> | null;
  startDate: string;
  endDate: string | null;
  cost?: number | null;
  description: string;
  notes?: string | null;
  status: AssetMaintenanceStatus;
  reportedById?: number | null;
  reportedBy?: { id: number; name: string } | null;
  completedById?: number | null;
  completedBy?: { id: number; name: string } | null;
  /** Audit trail — one entry per status transition, newest first. */
  statusHistory?: AssetMaintenanceStatusChange[];
  companyId: number;
  createdAt: string;
  updatedAt: string;
}

// A "primary project name" umbrella that groups several typed projects.
export interface ProjectGroup {
  id: number;
  name: string;
  code?: string | null;
  clientName?: string | null;
  description?: string | null;
  isActive?: boolean;
  projectCount?: number;
  projects?: Array<Pick<Project, 'id' | 'projectCode' | 'projectName' | 'projectType' | 'status'>>;
  createdAt?: string;
  updatedAt?: string;
}

export interface Project {
  id: number;
  projectCode: string;
  projectName: string;
  projectType: ProjectType;
  clientName: string;
  status: ProjectStatus;
  startDate: string;
  endDate?: string;
  description?: string;
  projectManagerId?: number;
  projectManager?: { id: number; name: string; empCode: string };
  groupId?: number | null;
  group?: { id: number; name: string } | null;
  /** Cadence for recurring-type projects (Sprint 1). NULL on
   *  non-recurring projects. */
  recurringPeriod?: RecurringPeriod | null;
  /** Total project cost (₹). Required by the UI on non-recurring
   *  project types so milestones can be expressed as percentages of
   *  the budget. NULL on recurring projects (their billing comes from
   *  the per-period recurring rows instead). */
  projectBudget?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectDto {
  projectCode: string;
  projectName: string;
  projectType: ProjectType;
  clientName: string;
  status?: ProjectStatus;
  startDate: string;
  endDate?: string;
  description?: string;
  projectManagerId?: number;
  groupId?: number | null;
  recurringPeriod?: RecurringPeriod;
  projectBudget?: number | null;
}

export type UpdateProjectDto = Partial<CreateProjectDto>;

// ── Employees ─────────────────────────────────────────────────────────────

// 'management' + 'core_team' were retired from the picker; the backend
// enum still has them for any historical employee row, but UI flows
// (forms, label maps, reports) only deal with the active values.
// Roster refreshed 2026-06-10 (migration 1716900000009) — see the
// backend `ConsultantType` enum for the canonical list.
export type ConsultantType =
  | 'co_founder'
  | 'technical_director'
  | 'pmo'
  | 'senior_project_manager'
  | 'project_lead'
  | 'senior_technical'
  | 'technical'
  | 'retail_functional'
  | 'functional'
  | 'account_manager'
  | 'dotnet_developer'
  | 'full_stack_developer'
  | 'intern'
  | 'brand_manager';

export interface Employee {
  id: number;
  empCode: string;
  name: string;
  email: string;
  mobileNumber?: string;
  consultantType: ConsultantType;
  department?: string | null;
  assignedProjectId?: number;
  assignedProject?: Project;
  reportsToId?: number | null;
  reportsTo?: { id: number; name: string; empCode: string } | null;
  isHr: boolean;
  isAccounts: boolean;
  isActive: boolean;
  dateOfBirth?: string | null;
  joiningDate?: string | null;
  fillDaysOverride?: number | null;
  annualCTC?: number | null;
  bloodGroup?: string | null;
  maritalStatus?: string | null;
  // Payroll identity — captured once on the profile, auto-fills slips
  panNumber?: string | null;
  uanNumber?: string | null;
  pfNumber?: string | null;
  bankName?: string | null;
  bankAccountNo?: string | null;
  bankIfsc?: string | null;
  paymentMode?: string | null;
  createdAt: string;
}

export interface UpcomingEvent {
  id: number;
  name: string;
  type: 'birthday' | 'anniversary';
  date: string;
  daysUntil: number;
  _type: 'employee' | 'admin';
}

export interface TodayEvent {
  id: number;
  name: string;
  empCode?: string;
  email: string;
  phone?: string;
  type: 'birthday' | 'anniversary';
  _type: 'employee' | 'admin';
  dateOfBirth?: string | null;
  joiningDate?: string | null;
  reportsTo?: { id: number; name: string } | null;
}

export interface CreateEmployeeDto {
  empCode: string;
  name: string;
  email: string;
  mobileNumber?: string;
  password: string;
  consultantType: ConsultantType;
  department?: string;
  assignedProjectId?: number;
  reportsToId?: number | null;
  isHr?: boolean;
  isAccounts?: boolean;
  dateOfBirth?: string;
  joiningDate?: string;
  fillDaysOverride?: number | null;
  annualCTC?: number | null;
  bloodGroup?: string;
  maritalStatus?: string;
  panNumber?: string;
  uanNumber?: string;
  pfNumber?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  paymentMode?: string;
}

export interface UpdateEmployeeDto {
  name?: string;
  email?: string;
  mobileNumber?: string;
  consultantType?: ConsultantType;
  department?: string;
  assignedProjectId?: number | null;
  reportsToId?: number | null;
  isHr?: boolean;
  isAccounts?: boolean;
  isActive?: boolean;
  dateOfBirth?: string | null;
  joiningDate?: string | null;
  fillDaysOverride?: number | null;
  annualCTC?: number | null;
  bloodGroup?: string | null;
  maritalStatus?: string | null;
  panNumber?: string | null;
  uanNumber?: string | null;
  pfNumber?: string | null;
  bankName?: string | null;
  bankAccountNo?: string | null;
  bankIfsc?: string | null;
  paymentMode?: string | null;
}

// ── Daily Task Sheets ─────────────────────────────────────────────────────

export type TaskStatus = 'in_progress' | 'finished' | 'failed' | 'awaiting_response';

export interface TaskEntry {
  id: number;
  taskSheetId: number;
  projectId?: number | null;
  project?: Project;
  otherProjectName?: string | null;
  ticketId?: number | null;
  // Backend now joins the project_task row when ticketId is set so the
  // sheet detail can show the ticket number + title alongside the entry.
  ticket?: { id: number; ticketNumber?: string | null; title?: string | null; status?: string | null } | null;
  activityType?: string | null;
  taskDescription: string;
  /** Optional free-text notes about anything that blocked progress. */
  blockers?: string | null;
  fromTime: string;
  toTime: string;
  durationHours: number;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

// ── Task sheet PM approvals ────────────────────────────────────────────────
export type TaskSheetApprovalRowStatus = 'pending' | 'approved' | 'rejected';
export type TaskSheetOverallApprovalStatus =
  | 'no_approvals'
  | 'pending'
  | 'partial'
  | 'approved'
  | 'rejected';

export interface TaskSheetApproval {
  id: number;
  taskSheetId: number;
  /**
   * The entry this row decides. Per-entry granularity (see migration
   * 1716900000005) — one row per (sheet, entry, round). Joined on
   * every PM-inbox + sheet-detail read so the UI can render ticket /
   * description / hours without a second fetch.
   */
  taskEntryId: number;
  taskEntry?: {
    id: number;
    taskDescription: string;
    fromTime?: string;
    toTime?: string;
    durationHours?: number | string;
    activityType?: string | null;
    otherProjectName?: string | null;
    status?: string;
    blockers?: string | null;
    ticket?: { id: number; ticketNumber?: string; title?: string } | null;
  } | null;
  /**
   * Joined sheet metadata — present in PM inbox list responses
   * (`/pm/task-approvals`) so the table can render employee/date/hours
   * without a second fetch. Not always populated on mutation responses.
   */
  taskSheet?: {
    id: number;
    sheetDate: string;
    totalHours?: number;
    submittedAt?: string | null;
    employeeId?: number;
    employee?: { id: number; name: string } | null;
  } | null;
  projectId: number | null;
  project?: { id: number; projectName: string; projectCode?: string } | null;
  pmId: number | null;
  pm?: { id: number; name: string } | null;
  round: number;
  status: TaskSheetApprovalRowStatus;
  notes: string | null;
  decidedAt: string | null;
  decidedById: number | null;
  decidedBy?: { id: number; name: string } | null;
  companyId: number;
  createdAt: string;
  updatedAt: string;
}

export interface DailyTaskSheet {
  id: number;
  employeeId: number;
  employee?: Employee;
  sheetDate: string;
  totalHours: number;
  manDays: number;
  isSubmitted: boolean;
  submittedAt?: string;
  remarks?: string;
  taskEntries?: TaskEntry[];
  /** Derived field — attached by `getByIdWithApproval` on the backend. */
  overallApprovalStatus?: TaskSheetOverallApprovalStatus;
  createdAt: string;
  updatedAt: string;
}

// ── Dashboard ─────────────────────────────────────────────────────────────

export interface DashboardSummary {
  totalEmployees: number;
  activeProjects: number;
  totalManDaysThisMonth: number;
  fillRateToday: number;
  filledToday: number;
  totalActiveEmployees: number;
}

export interface ManDaysByType {
  consultant_type: string;
  total_man_days: number;
  employee_count: number;
}

export interface ManDaysByProject {
  project_id: number;
  project_name: string;
  total_man_days: number;
  employee_count: number;
}

export interface FillRateTrend {
  date: string;
  fill_rate: number;
  filled_count: number;
  total_count: number;
}

export interface TopEmployee {
  employee_id: number;
  name: string;
  emp_code: string;
  total_hours: number;
  total_man_days: number;
}

// ── Announcements ─────────────────────────────────────────────────────────

export interface AnnouncementAttachment {
  id: number;
  announcementId: number;
  fileName: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedByName: string;
  createdAt: string;
}

export interface Announcement {
  id: number;
  title: string;
  description: string;
  expiresOn: string;
  isActive: boolean;
  createdById: number;
  createdByType: 'admin' | 'employee';
  createdByName: string;
  companyId: number;
  createdAt: string;
  updatedAt: string;
  attachments?: AnnouncementAttachment[];
}

export interface CreateAnnouncementDto {
  title: string;
  description: string;
  expiresOn: string;
}

export interface UpdateAnnouncementDto {
  title?: string;
  description?: string;
  expiresOn?: string;
  isActive?: boolean;
}

// ── Leave Types ─────────────────────────────────────────────────────────

export interface LeaveType {
  id: number;
  reasonCode: string;
  reasonName: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeaveTypeDto {
  reasonCode: string;
  reasonName: string;
  description?: string;
}

export type UpdateLeaveTypeDto = Partial<CreateLeaveTypeDto>;

// ── Leave Requests ───────────────────────────────────────────────────────

export type LeaveRequestStatus =
  | 'pending'
  | 'manager_approved'
  | 'manager_rejected'
  | 'hr_approved'
  | 'hr_rejected'
  | 'cancelled';

export interface LeaveRequest {
  id: number;
  // Either employeeId (employee-submitted) or adminId (admin-submitted) is
  // set; the other is null. Admin-submitted leaves come back through the
  // same admin list and are recognised by `adminId`.
  employeeId: number | null;
  adminId?: number | null;
  employee?: Employee;
  leaveReasonId: number;
  leaveReason?: LeaveType;
  dateFrom: string;
  dateTo: string;
  totalDays: number;
  remarks?: string | null;
  status: LeaveRequestStatus;
  managerId?: number | null;
  manager?: Employee | null;
  managerActionAt?: string | null;
  managerRemarks?: string | null;
  hrId?: number | null;
  hr?: Employee | null;
  hrActionAt?: string | null;
  hrRemarks?: string | null;
  hrApproverName?: string | null;
  // Audit trail of who actually filed the request — for self-submission
  // this matches the subject; for HR/admin on-behalf submissions it's
  // the actual filer.
  appliedById?: number | null;
  appliedByType?: 'employee' | 'admin' | null;
  appliedByName?: string | null;
  watchers?: { id: number; employeeId: number; employee?: Employee }[];
  createdAt: string;
  updatedAt: string;
}

// ── WFH Requests ─────────────────────────────────────────────────────────
// Same shape as LeaveRequest minus leaveReason; reason is required text.

export type WfhRequestStatus = LeaveRequestStatus;

export interface WfhRequest {
  id: number;
  employeeId: number | null;
  adminId?: number | null;
  employee?: Employee;
  dateFrom: string;
  dateTo: string;
  totalDays: number;
  reason: string;
  status: WfhRequestStatus;
  managerId?: number | null;
  manager?: Employee | null;
  managerActionAt?: string | null;
  managerRemarks?: string | null;
  hrId?: number | null;
  hr?: Employee | null;
  hrActionAt?: string | null;
  hrRemarks?: string | null;
  hrApproverName?: string | null;
  appliedById?: number | null;
  appliedByType?: 'employee' | 'admin' | null;
  appliedByName?: string | null;
  watchers?: { id: number; employeeId: number; employee?: Employee }[];
  createdAt: string;
  updatedAt: string;
}

// ── Notifications ─────────────────────────────────────────────────────────

export type NotificationType =
  | 'employee_created'
  | 'employee_deactivated'
  | 'project_created'
  | 'project_updated'
  | 'task_sheet_submitted'
  | 'task_sheet_pm_approval_pending'
  | 'task_sheet_pm_approved'
  | 'task_sheet_pm_rejected'
  | 'task_sheet_resubmitted'
  | 'leave_request_submitted'
  | 'leave_request_manager_approved'
  | 'leave_request_manager_rejected'
  | 'leave_request_hr_approved'
  | 'leave_request_hr_rejected'
  | 'leave_request_cancelled'
  | 'wfh_request_submitted'
  | 'wfh_request_manager_approved'
  | 'wfh_request_manager_rejected'
  | 'wfh_request_hr_approved'
  | 'wfh_request_hr_rejected'
  | 'wfh_request_cancelled'
  | 'task_assigned'
  | 'task_status_changed'
  | 'task_commented'
  | 'task_mention'
  | 'birthday'
  | 'work_anniversary';

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationMeta {
  total: number;
  unreadCount: number;
}

export interface NotificationsResponse {
  data: Notification[];
  total: number;
  unreadCount: number;
}

// ── Reports ───────────────────────────────────────────────────────────────

export interface EmployeeWiseReport {
  id: number;
  emp_code: string;
  name: string;
  consultant_type: string;
  assigned_project: string;
  days_filled: number;
  total_hours: number;
  total_man_days: number;
  avg_hours_per_day: number;
}

export interface ProjectWiseReport {
  project_id: number;
  project_code: string;
  project_name: string;
  project_type: string;
  pm_man_days: number;
  functional_man_days: number;
  technical_man_days: number;
  management_man_days: number;
  core_team_man_days: number;
  total_man_days: number;
  employee_count: number;
}

export interface DailyFillReport {
  date: string;
  filledCount: number;
  totalCount: number;
  fillRate: number;
  rows: DailyFillRow[];
}

export interface DailyFillRow {
  id: number;
  emp_code: string;
  name: string;
  consultant_type: string;
  is_filled: number;
  total_hours: number;
  sheet_id?: number;
  entry_count: number;
}

export interface LastFilledRow {
  id: number;
  emp_code: string;
  name: string;
  consultant_type: string;
  assigned_project: string | null;
  last_filled_date: string | null;
  last_filled_hours: number | null;
  last_submitted_at: string | null;
  days_since_last_fill: number | null;
}

// ── Project Planning ──────────────────────────────────────────────────

export type PhaseStatus = 'not_started' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type ProjectTaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'closed';
export type AuthorType = 'admin' | 'employee';

export interface ProjectPhase {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  status: PhaseStatus;
  sortOrder: number;
  companyId: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTask {
  id: number;
  ticketNumber: string | null;
  projectId: number;
  project?: Project;
  phaseId: number | null;
  phase?: ProjectPhase | null;
  title: string;
  description: string | null;
  assigneeId: number | null;
  assignee?: Employee | null;
  assignedAdminId?: number | null;
  assignedAdmin?: { id: number; name: string; email: string } | null;
  priority: TaskPriority;
  status: ProjectTaskStatus;
  dueDate: string | null;
  estimatedHours: number | null;
  sortOrder: number;
  companyId: number;
  comments?: ProjectTaskComment[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTaskComment {
  id: number;
  taskId: number;
  authorId: number;
  authorType: AuthorType;
  content: string;
  companyId: number;
  createdAt: string;
  /** Set when the comment body has been edited at least once. */
  editedAt?: string | null;
}

export type TaskHistoryAction = 'created' | 'status_changed' | 'assigned' | 'reassigned' | 'closed' | 'priority_changed' | 'updated';

export interface ProjectTaskHistory {
  id: number;
  taskId: number;
  action: TaskHistoryAction;
  performedById: number;
  performedByType: 'admin' | 'employee';
  performedByName: string;
  oldValue: string | null;
  newValue: string | null;
  details: string | null;
  companyId: number;
  createdAt: string;
}

export interface ProjectSummary {
  totalTasks: number;
  doneTasks: number;
  progress: number;
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
}

export interface CreatePhaseDto {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: PhaseStatus;
}

export type UpdatePhaseDto = Partial<CreatePhaseDto>;

export interface CreateTaskDto {
  title: string;
  description?: string;
  phaseId?: number;
  assigneeId?: number;
  priority?: TaskPriority;
  status?: ProjectTaskStatus;
  dueDate?: string;
  estimatedHours?: number;
}

export type UpdateTaskDto = Partial<CreateTaskDto>;

export interface CreateCommentDto {
  content: string;
}

// ── SMTP Configuration ──────────────────────────────────────────────────

export type SmtpEncryption = 'tls' | 'ssl' | 'none';

export interface SmtpConfig {
  id: number;
  companyId: number | null;
  label: string | null;
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string | null;
  encryption: SmtpEncryption;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaveSmtpConfigDto {
  label?: string;
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName?: string;
  encryption?: SmtpEncryption;
  isActive?: boolean;
}

export interface TestSmtpDto {
  recipientEmail: string;
}

export interface SendEmailDto {
  recipientEmail: string;
  subject: string;
  body: string;
}
