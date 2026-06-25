import { api } from './axios-instance';

export type RequestStatus = 'pending' | 'in_progress' | 'resolved' | 'rejected';

export type RequestTeam = {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
};

export type RequestTeamMember = {
  id: number;
  teamId: number;
  employeeId: number;
  employee?: { id: number; name: string; email?: string };
};

// Employee endpoints — raise and manage own requests.
export const requestsApi = {
  // Active teams for the request picker — open to every employee.
  getTeams: () => api.get('/employee/requests/teams'),

  // Teams the current employee belongs to (for action gating + "My Team").
  getMyTeams: () => api.get('/employee/requests/teams/mine'),

  // Requests routed to the current employee's team(s).
  getTeamQueue: (params?: { page?: number; limit?: number; status?: string; teamId?: number }) =>
    api.get('/employee/requests/team-queue', { params }),

  getMyRequests: (params?: { page?: number; limit?: number }) =>
    api.get('/employee/requests', { params }),

  getOne: (id: number) =>
    api.get(`/employee/requests/${id}`),

  create: (data: FormData) =>
    api.post('/employee/requests', data),

  update: (id: number, data: FormData) =>
    api.patch(`/employee/requests/${id}`, data),

  delete: (id: number) =>
    api.delete(`/employee/requests/${id}`),
};

// HR endpoints — same `/employee/requests` mount point, gated server-side
// behind the `isHr` flag. HR can read every request and drive its status.
export const hrRequestsApi = {
  getAll: (params?: { page?: number; limit?: number; employeeId?: number; status?: string; teamId?: number }) =>
    api.get('/employee/requests/all', { params }),

  updateStatus: (id: number, status: Exclude<RequestStatus, 'pending'>, remarks?: string) =>
    api.patch(`/employee/requests/${id}/status`, { status, ...(remarks ? { remarks } : {}) }),

  // Team management (HR-gated server-side).
  createTeam: (data: { name: string; description?: string }) =>
    api.post('/employee/requests/teams', data),
  updateTeam: (teamId: number, data: { name?: string; description?: string; isActive?: boolean }) =>
    api.patch(`/employee/requests/teams/${teamId}`, data),
  deleteTeam: (teamId: number) =>
    api.delete(`/employee/requests/teams/${teamId}`),

  // Team member management (HR-gated server-side).
  getMembers: (teamId: number) =>
    api.get(`/employee/requests/teams/${teamId}/members`),
  addMember: (teamId: number, employeeId: number) =>
    api.post(`/employee/requests/teams/${teamId}/members`, { employeeId }),
  removeMember: (teamId: number, employeeId: number) =>
    api.delete(`/employee/requests/teams/${teamId}/members/${employeeId}`),
};

// Admin endpoints — full company view and lifecycle control.
export const adminRequestsApi = {
  getAll: (params?: { page?: number; limit?: number; employeeId?: number; status?: string; teamId?: number }) =>
    api.get('/admin/requests', { params }),

  getOne: (id: number) =>
    api.get(`/admin/requests/${id}`),

  updateStatus: (id: number, status: Exclude<RequestStatus, 'pending'>, remarks?: string) =>
    api.patch(`/admin/requests/${id}/status`, { status, ...(remarks ? { remarks } : {}) }),

  delete: (id: number) =>
    api.delete(`/admin/requests/${id}`),

  // Team management — admin sees the full list (incl. inactive).
  getTeams: () => api.get('/admin/requests/teams'),
  createTeam: (data: { name: string; description?: string }) =>
    api.post('/admin/requests/teams', data),
  updateTeam: (teamId: number, data: { name?: string; description?: string; isActive?: boolean }) =>
    api.patch(`/admin/requests/teams/${teamId}`, data),
  deleteTeam: (teamId: number) =>
    api.delete(`/admin/requests/teams/${teamId}`),

  // Team member management.
  getMembers: (teamId: number) =>
    api.get(`/admin/requests/teams/${teamId}/members`),
  addMember: (teamId: number, employeeId: number) =>
    api.post(`/admin/requests/teams/${teamId}/members`, { employeeId }),
  removeMember: (teamId: number, employeeId: number) =>
    api.delete(`/admin/requests/teams/${teamId}/members/${employeeId}`),
};
