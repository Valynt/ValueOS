export async function verifyTenant(_tenantId: string): Promise<boolean> { return true; }
export function getTenantId(): string | undefined { return undefined; }

export async function verifyTenantMembership(_tenantId: string, _userId: string): Promise<boolean> { return true; }
