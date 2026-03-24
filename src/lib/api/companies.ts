import { api } from './axios-instance';
import { ApiResponse, Company, AdminUser, PaginationMeta } from '@/types';

export interface CreateCompanyDto {
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
  gstEnabled?: boolean;
  vatEnabled?: boolean;
  baseCurrencyCode?: string;
  userLimit?: number;
  licenseExpiryDate: string;
  subscriptionPlan?: string;
}

export interface UpdateLicenseDto {
  licenseExpiryDate?: string;
  userLimit?: number;
  subscriptionPlan?: string;
  subscriptionStart?: string;
}

export interface CreateCompanyAdminDto {
  name: string;
  email: string;
  password: string;
}

export interface CompanyWithCounts extends Company {
  adminCount: number;
  employeeCount: number;
}

export interface PlatformDashboard {
  totalCompanies: number;
  activeCompanies: number;
  totalAdmins: number;
  totalEmployees: number;
  expiringSoon: number;
}

export const companiesApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; subscriptionPlan?: string; isActive?: boolean }) =>
    api.get<{ data: CompanyWithCounts[]; meta: PaginationMeta }>('/platform/companies', { params }),

  getOne: (id: number) =>
    api.get<ApiResponse<Company>>(`/platform/companies/${id}`),

  create: (dto: CreateCompanyDto) =>
    api.post<ApiResponse<Company>>('/platform/companies', dto),

  update: (id: number, dto: Partial<CreateCompanyDto>) =>
    api.patch<ApiResponse<Company>>(`/platform/companies/${id}`, dto),

  deactivate: (id: number) =>
    api.delete<ApiResponse<null>>(`/platform/companies/${id}`),

  toggleActive: (id: number) =>
    api.post<ApiResponse<{ message: string }>>(`/platform/companies/${id}/toggle-active`),

  updateLicense: (id: number, dto: UpdateLicenseDto) =>
    api.patch<ApiResponse<Company>>(`/platform/companies/${id}/license`, dto),

  getAdmins: (id: number) =>
    api.get<ApiResponse<AdminUser[]>>(`/platform/companies/${id}/admins`),

  createAdmin: (id: number, dto: CreateCompanyAdminDto) =>
    api.post<ApiResponse<AdminUser>>(`/platform/companies/${id}/admins`, dto),

  uploadLogo: (id: number, file: File) => {
    const formData = new FormData();
    formData.append('logo', file);
    return api.post<ApiResponse<{ logoUrl: string }>>(`/platform/companies/${id}/logo`, formData);
  },

  getPlatformDashboard: () =>
    api.get<ApiResponse<PlatformDashboard>>('/platform/dashboard'),
};
