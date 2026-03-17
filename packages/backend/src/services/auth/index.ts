// AdminActor is defined in both AdminRoleService and AdminUserService (identical shape).
// Explicit named exports resolve the TS2308 ambiguity; AdminUserService is canonical.
export type { CustomRoleInput } from "./AdminRoleService.js";
export { AdminRoleService, adminRoleService } from "./AdminRoleService.js";
export * from "./AdminUserService.js";
export * from "./AuthDirectoryService.js";
export * from "./AuthPolicy.js";
export * from "./AuthService.js";
export * from "./MFAService.js";
// Permission and Role conflict with security/AgentSecurityService — security is canonical.
// Export everything from PermissionService except Permission and Role.
export type { UserRole } from "./PermissionService.js";
export { PermissionService, permissionService } from "./PermissionService.js";
export * from "./RbacService.js";
// AgentContext from SecureSharedContext conflicts with the canonical AgentContext in agent-types.
// Export everything except AgentContext; callers needing SecureSharedContext.AgentContext
// should import directly from the file.
// SecurityContext conflicts with security/AgentSecurityService — security is canonical.
export type {
  SharedContext,
  ContextShareRequest,
  ContextValidationResult,
  ContextCache,
} from "./SecureSharedContext.js";
export { SecureSharedContext, getSecureSharedContext, resetSecureSharedContext } from "./SecureSharedContext.js";
export * from "./SessionManager.js";
export * from "./SessionTimeoutService.js";
export * from "./SettingsService.js";
// SecurityEvent and SecurityEventType conflict with security/SecurityMonitor — security is canonical.
export type { TokenRotationResult, RotationPolicy, NotificationChannel, NotificationService } from "./TokenRotationService.js";
export { TokenRotationService, getTokenRotationService, resetTokenRotationService } from "./TokenRotationService.js";
export * from "./TrustedDeviceService.js";
export * from "./UserProfileDirectoryService.js";
export * from "./UserSettingsService.js";
export * from "./consentRegistry.js";
// ResourceType and PermissionCheckResult conflict with security — security is canonical.
export type { PermissionAction } from "./guestPermissions.js";
export { getGuestPermissionManager, checkGuestPermission, getGuestAllowedActions, createGuestPermissionPreset } from "./guestPermissions.js";
