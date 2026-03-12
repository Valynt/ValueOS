import { apiClient } from "@/api/client/unified-api-client";

export interface PermissionDescriptor {
  key: string;
  description?: string;
}

export interface OrganizationRole {
  id: string;
  name: string;
  description: string;
  permissions: PermissionDescriptor[];
}

export interface RoleMatrixResponse {
  matrix: OrganizationRole[];
}

export interface CreateRoleInput {
  name: string;
  description: string;
  permissionKeys: string[];
}

export interface AuditLogItem {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  user_id: string;
  user_email: string;
  timestamp: string;
  ip_address?: string;
  details?: { description?: string; oldValue?: string; newValue?: string };
}

export interface AuditLogResponse {
  logs: AuditLogItem[];
}

export interface AuditLogQuery {
  search?: string;
  action?: string;
  resourceType?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  limit: number;
  offset: number;
}

export async function fetchRoleMatrix(): Promise<OrganizationRole[]> {
  const response = await apiClient.get<RoleMatrixResponse>("/api/admin/roles/matrix");

  if (!response.success || !response.data) {
    throw new Error(response.error?.message ?? "Unable to load roles");
  }

  return response.data.matrix;
}

export async function createRole(input: CreateRoleInput): Promise<void> {
  const response = await apiClient.post("/api/admin/roles", input);
  if (!response.success) {
    throw new Error(response.error?.message ?? "Unable to create role");
  }
}

export async function deleteRole(roleId: string): Promise<void> {
  const response = await apiClient.delete(`/api/admin/roles/${roleId}`);
  if (!response.success) {
    throw new Error(response.error?.message ?? "Unable to delete role");
  }
}

export async function fetchTeamAuditLogs(query: AuditLogQuery): Promise<AuditLogResponse> {
  const response = await apiClient.get<AuditLogResponse>("/api/admin/audit-logs", {
    search: query.search,
    action: query.action && query.action !== "all" ? query.action : undefined,
    resourceType: query.resourceType && query.resourceType !== "all" ? query.resourceType : undefined,
    userId: query.userId && query.userId !== "all" ? query.userId : undefined,
    startDate: query.startDate,
    endDate: query.endDate,
    limit: query.limit,
    offset: query.offset,
  });

  if (!response.success || !response.data) {
    throw new Error(response.error?.message ?? "Unable to load audit logs");
  }

  return response.data;
}
