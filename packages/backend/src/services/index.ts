/**
 * Services Index
 * Central export point for all service classes
 */

// Base infrastructure
export * from "./errors.js"
export * from "./BaseService.js"

// Core services
export * from "./SettingsService.js"
export * from "./UserSettingsService.js"
export * from "./AuthService.js"
export * from "./PermissionService.js"
export * from "./AuditLogService.js"
export * from "./RbacService.js"
export * from "./SecretsService.js"
export * from "./ValueKernel.js"
export * from "./IntegrationControlService.js"

// Service instances (singletons)
export { settingsService } from "./SettingsService.js"
export { integrationControlService } from "./IntegrationControlService.js"
export { userSettingsService } from "./UserSettingsService.js"
export { authService } from "./AuthService.js"
export { permissionService } from "./PermissionService.js"
export { auditLogService } from "./AuditLogService.js"

export { ROIFormulaInterpreter } from "./ROIFormulaInterpreter.js"
export { ValueFabricService } from "./ValueFabricService.js"
export { BenchmarkService } from "./BenchmarkService.js"
export {
  RotationService,
  rotationService,
  type RotationContext,
  type RotationResult,
} from "./RotationService";
