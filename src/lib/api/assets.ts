import { api } from './axios-instance';
import { tokenStorage } from '@/lib/auth/token-storage';
import {
  ApiResponse,
  Asset,
  AssetAssignment,
  AssetCategory,
  AssetCondition,
  AssetMaintenance,
  AssetMaintenanceStatus,
  AssetMaintenanceType,
  AssetOwnership,
  AssetStatus,
  AssetVendor,
  PaginationParams,
} from '@/types';

/**
 * Asset & inventory management API. Admin routes live at `/assets` and
 * `/asset-vendors`; HR uses the parallel `/employee/...` routes. Plain
 * employees only get `/employee/my-assets` self-service.
 *
 * The helper auto-prefixes admin/employee paths based on the stored
 * login type so a single function works for both audiences.
 */

function assetsBase() {
  // HR has the same scope as admin but goes through /employee/assets.
  return tokenStorage.getLoginType() === 'admin' ? '/assets' : '/employee/assets';
}

function vendorsBase() {
  return tokenStorage.getLoginType() === 'admin'
    ? '/asset-vendors'
    : '/employee/asset-vendors';
}

export interface CreateAssetDto {
  category: AssetCategory;
  categoryOtherName?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  specs?: Record<string, unknown>;
  ownership: AssetOwnership;
  vendorId?: number;
  purchaseDate?: string;
  purchasePrice?: number;
  rentalStart?: string;
  rentalEnd?: string;
  rentalMonthlyAmount?: number;
  warrantyExpiry?: string;
  condition?: AssetCondition;
  location?: string;
  notes?: string;
}

export type UpdateAssetDto = Partial<CreateAssetDto> & {
  status?: AssetStatus;
};

export interface FilterAssetsDto extends PaginationParams {
  search?: string;
  category?: AssetCategory;
  status?: AssetStatus;
  ownership?: AssetOwnership;
  vendorId?: number;
  assignedUserId?: number;
}

export interface CreateAssetVendorDto {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  gst?: string;
  paymentTerms?: string;
  notes?: string;
  isActive?: boolean;
}

export type UpdateAssetVendorDto = Partial<CreateAssetVendorDto>;

export interface AssignAssetDto {
  userId: number;
  notes?: string;
}

export interface UnassignAssetDto {
  returnCondition?: AssetCondition;
  returnNotes?: string;
}

export interface CreateAssetMaintenanceDto {
  type: AssetMaintenanceType;
  vendorId?: number;
  startDate: string;
  endDate?: string;
  cost?: number;
  description: string;
  notes?: string;
  status?: AssetMaintenanceStatus;
}

export type UpdateAssetMaintenanceDto = Partial<CreateAssetMaintenanceDto>;

export interface AssetReportsSummary {
  totals: {
    totalAssets: number;
    ownedCount: number;
    purchaseValue: number;
    monthlyRent: number;
    warrantyExpiringSoon: number;
    rentalExpiringSoon: number;
  };
  byCategory: { category: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byOwnership: { ownership: string; count: number }[];
  horizonDays: number;
}

export const assetsApi = {
  // ── Assets ────────────────────────────────────────────────────────
  list: (params?: FilterAssetsDto) =>
    api.get<ApiResponse<Asset[]>>(assetsBase(), { params }),

  getOne: (id: number) =>
    api.get<ApiResponse<Asset>>(`${assetsBase()}/${id}`),

  create: (dto: CreateAssetDto) =>
    api.post<ApiResponse<Asset>>(assetsBase(), dto),

  update: (id: number, dto: UpdateAssetDto) =>
    api.patch<ApiResponse<Asset>>(`${assetsBase()}/${id}`, dto),

  remove: (id: number) =>
    api.delete<ApiResponse<null>>(`${assetsBase()}/${id}`),

  // ── Assign / unassign ─────────────────────────────────────────────
  assign: (id: number, dto: AssignAssetDto) =>
    api.post<ApiResponse<AssetAssignment>>(
      `${assetsBase()}/${id}/assign`,
      dto,
    ),

  unassign: (id: number, dto: UnassignAssetDto = {}) =>
    api.post<ApiResponse<AssetAssignment>>(
      `${assetsBase()}/${id}/unassign`,
      dto,
    ),

  getAssignments: (id: number) =>
    api.get<ApiResponse<AssetAssignment[]>>(
      `${assetsBase()}/${id}/assignments`,
    ),

  // ── Maintenance ───────────────────────────────────────────────────
  getMaintenance: (id: number) =>
    api.get<ApiResponse<AssetMaintenance[]>>(
      `${assetsBase()}/${id}/maintenance`,
    ),

  createMaintenance: (id: number, dto: CreateAssetMaintenanceDto) =>
    api.post<ApiResponse<AssetMaintenance>>(
      `${assetsBase()}/${id}/maintenance`,
      dto,
    ),

  updateMaintenance: (
    id: number,
    mId: number,
    dto: UpdateAssetMaintenanceDto,
  ) =>
    api.patch<ApiResponse<AssetMaintenance>>(
      `${assetsBase()}/${id}/maintenance/${mId}`,
      dto,
    ),

  deleteMaintenance: (id: number, mId: number) =>
    api.delete<ApiResponse<null>>(`${assetsBase()}/${id}/maintenance/${mId}`),

  // ── Per-user views (employee profile tab) ─────────────────────────
  getUserActive: (userId: number) => {
    const base = tokenStorage.getLoginType() === 'admin'
      ? `/assets/users/${userId}/active`
      : `/employee/users/${userId}/assets/active`;
    return api.get<ApiResponse<Asset[]>>(base);
  },

  getUserHistory: (userId: number) => {
    const base = tokenStorage.getLoginType() === 'admin'
      ? `/assets/users/${userId}/history`
      : `/employee/users/${userId}/assets/history`;
    return api.get<ApiResponse<AssetAssignment[]>>(base);
  },

  // ── Self-service ──────────────────────────────────────────────────
  myActive: () =>
    api.get<ApiResponse<Asset[]>>('/employee/my-assets'),

  myHistory: () =>
    api.get<ApiResponse<AssetAssignment[]>>('/employee/my-assets/history'),

  myAssetDetail: (assetId: number) =>
    api.get<ApiResponse<Asset>>(`/employee/my-assets/${assetId}`),

  // ── Reports ───────────────────────────────────────────────────────
  reportsSummary: (daysAhead?: number) => {
    const base = tokenStorage.getLoginType() === 'admin'
      ? '/assets/reports/summary'
      : '/employee/assets/reports/summary';
    return api.get<ApiResponse<AssetReportsSummary>>(base, {
      params: daysAhead ? { daysAhead } : undefined,
    });
  },

  // ── Vendors ───────────────────────────────────────────────────────
  listVendors: (search?: string) =>
    api.get<ApiResponse<AssetVendor[]>>(vendorsBase(), {
      params: search ? { search } : undefined,
    }),

  getVendor: (id: number) =>
    api.get<ApiResponse<AssetVendor>>(`${vendorsBase()}/${id}`),

  createVendor: (dto: CreateAssetVendorDto) =>
    api.post<ApiResponse<AssetVendor>>(vendorsBase(), dto),

  updateVendor: (id: number, dto: UpdateAssetVendorDto) =>
    api.patch<ApiResponse<AssetVendor>>(`${vendorsBase()}/${id}`, dto),

  removeVendor: (id: number) =>
    api.delete<ApiResponse<null>>(`${vendorsBase()}/${id}`),
};
