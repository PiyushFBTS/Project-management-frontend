import { api } from './axios-instance';

export const expensesApi = {
  // Employee endpoints
  getMyExpenses: (params?: { page?: number; limit?: number }) =>
    api.get('/employee/expenses', { params }),

  getOne: (id: number) =>
    api.get(`/employee/expenses/${id}`),

  create: (data: FormData) =>
    api.post('/employee/expenses', data),

  update: (id: number, data: FormData) =>
    api.patch(`/employee/expenses/${id}`, data),

  delete: (id: number) =>
    api.delete(`/employee/expenses/${id}`),
};

// HR / Accounts endpoints — same `/employee/expenses` mount point but the
// backend gates these behind permission flags. HR (`isHr`) approves /
// rejects; Accounts (`isAccounts`) marks as paid; both can read the full
// list. Self-action is blocked server-side.
export const hrExpensesApi = {
  getAll: (params?: { page?: number; limit?: number; employeeId?: number; status?: string; projectId?: number; fromDate?: string; toDate?: string }) =>
    api.get('/employee/expenses/all', { params }),

  updateStatus: (id: number, status: 'approved' | 'rejected', remarks?: string, approvedAmount?: number) =>
    api.patch(`/employee/expenses/${id}/status`, { status, ...(approvedAmount !== undefined ? { approvedAmount } : {}), ...(remarks ? { remarks } : {}) }),

  // Accounts-permissioned employees flip paid/unpaid here.
  markPaid: (id: number, paid: boolean) =>
    api.patch(`/employee/expenses/${id}/paid`, { paid }),
};

export const adminExpensesApi = {
  // Admin endpoints
  getAll: (params?: { page?: number; limit?: number; employeeId?: number; status?: string; projectId?: number; fromDate?: string; toDate?: string }) =>
    api.get('/admin/expenses', { params }),

  getOne: (id: number) =>
    api.get(`/admin/expenses/${id}`),

  create: (data: FormData) =>
    api.post('/admin/expenses', data),

  updateStatus: (id: number, status: 'approved' | 'rejected', remarks?: string, approvedAmount?: number) =>
    api.patch(`/admin/expenses/${id}/status`, { status, ...(approvedAmount !== undefined ? { approvedAmount } : {}), ...(remarks ? { remarks } : {}) }),

  markPaid: (id: number, paid: boolean) =>
    api.patch(`/admin/expenses/${id}/paid`, { paid }),

  delete: (id: number) =>
    api.delete(`/admin/expenses/${id}`),
};
