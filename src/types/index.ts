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

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: AdminRole;
  companyId: number | null;
  isActive: boolean;
  createdAt: string;
}

export type AdminRole = 'super_admin' | 'admin';

// ── Company ──────────────────────────────────────────────────────────────

export type SubscriptionPlan = 'trial' | 'basic' | 'professional' | 'enterprise';

export interface Company {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  userLimit: number;
  licenseExpiryDate: string;
  isActive: boolean;
  subscriptionPlan: SubscriptionPlan;
  subscriptionStart?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Projects ─────────────────────────────────────────────────────────────

export type ProjectType = 'project' | 'support' | 'development' | 'consulting' | 'migration' | 'maintenance';
export type ProjectStatus = 'active' | 'inactive' | 'completed';

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
}

export type UpdateProjectDto = Partial<CreateProjectDto>;

// ── Task Types ────────────────────────────────────────────────────────────

export type TaskCategory = 'project_customization' | 'support_customization' | 'cr';

export interface TaskType {
  id: number;
  typeCode: string;
  typeName: string;
  category: TaskCategory;
  isActive: boolean;
  createdAt: string;
}

export interface CreateTaskTypeDto {
  typeCode: string;
  typeName: string;
  category: TaskCategory;
}

export type UpdateTaskTypeDto = Partial<CreateTaskTypeDto>;

// ── Employees ─────────────────────────────────────────────────────────────

export type ConsultantType = 'project_manager' | 'functional' | 'technical' | 'management' | 'core_team';

export interface Employee {
  id: number;
  empCode: string;
  empName: string;
  email: string;
  phone?: string;
  consultantType: ConsultantType;
  assignedProjectId?: number;
  assignedProject?: Project;
  reportsToId?: number | null;
  reportsTo?: { id: number; empName: string; empCode: string } | null;
  isHr: boolean;
  isActive: boolean;
  joinDate: string;
  createdAt: string;
}

export interface CreateEmployeeDto {
  empCode: string;
  empName: string;
  email: string;
  phone?: string;
  password: string;
  consultantType: ConsultantType;
  assignedProjectId?: number;
  reportsToId?: number;
  isHr?: boolean;
  joinDate: string;
}

export interface UpdateEmployeeDto {
  empName?: string;
  email?: string;
  phone?: string;
  consultantType?: ConsultantType;
  assignedProjectId?: number;
  reportsToId?: number | null;
  isHr?: boolean;
  isActive?: boolean;
}

// ── Daily Task Sheets ─────────────────────────────────────────────────────

export type TaskStatus = 'in_progress' | 'finished' | 'failed';

export interface TaskEntry {
  id: number;
  taskSheetId: number;
  taskTypeId?: number;
  taskType?: TaskType;
  projectId?: number | null;
  project?: Project;
  otherProjectName?: string | null;
  taskDescription: string;
  fromTime: string;
  toTime: string;
  durationHours: number;
  status: TaskStatus;
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
  emp_name: string;
  emp_code: string;
  total_hours: number;
  total_man_days: number;
}

// ── Notifications ─────────────────────────────────────────────────────────

// ── Leave Reasons ────────────────────────────────────────────────────────

export interface LeaveReason {
  id: number;
  reasonCode: string;
  reasonName: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeaveReasonDto {
  reasonCode: string;
  reasonName: string;
  description?: string;
}

export type UpdateLeaveReasonDto = Partial<CreateLeaveReasonDto>;

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
  employeeId: number;
  employee?: Employee;
  leaveReasonId: number;
  leaveReason?: LeaveReason;
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
  | 'leave_request_submitted'
  | 'leave_request_manager_approved'
  | 'leave_request_manager_rejected'
  | 'leave_request_hr_approved'
  | 'leave_request_hr_rejected'
  | 'leave_request_cancelled'
  | 'task_assigned'
  | 'task_status_changed'
  | 'task_commented';

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
  emp_name: string;
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
  emp_name: string;
  consultant_type: string;
  is_filled: number;
  total_hours: number;
  sheet_id?: number;
  entry_count: number;
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
