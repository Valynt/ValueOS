import { readComplianceRetentionPolicy } from "./complianceRetentionPolicy.js";

export const SECURITY_AUDIT_RETENTION_CLASS_ID = "audit-events";

export interface RetentionResolutionOptions {
  classId: string;
  framework?: string;
}

export function resolveOperationalRetentionDays(options: RetentionResolutionOptions): number {
  const policy = readComplianceRetentionPolicy();
  const retentionClass = policy.classes.find((entry) => entry.id === options.classId);

  if (!retentionClass) {
    throw new Error(`Retention policy class not found: ${options.classId}`);
  }

  if (options.framework) {
    const frameworkWindow = retentionClass.framework_windows[options.framework];
    if (frameworkWindow) {
      return frameworkWindow.operational_days;
    }
  }

  return retentionClass.default_window.operational_days;
}
