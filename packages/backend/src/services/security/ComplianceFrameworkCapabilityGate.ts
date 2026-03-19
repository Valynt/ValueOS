const HIPAA_FRAMEWORK = "HIPAA" as const;

const ALL_COMPLIANCE_FRAMEWORKS = ["GDPR", HIPAA_FRAMEWORK, "CCPA", "SOC2", "ISO27001"] as const;

export type ComplianceFramework = typeof ALL_COMPLIANCE_FRAMEWORKS[number];
export type ExposedComplianceFramework = Exclude<ComplianceFramework, typeof HIPAA_FRAMEWORK> | typeof HIPAA_FRAMEWORK;

interface CapabilityRequirement {
  key: string;
  description: string;
  envVar: string;
}

export interface FrameworkCapabilityStatus {
  framework: ComplianceFramework;
  supported: boolean;
  missingPrerequisites: string[];
}

const HIPAA_REQUIREMENTS: CapabilityRequirement[] = [
  {
    key: "phi_data_classification",
    description: "Data classification for PHI-bearing assets",
    envVar: "HIPAA_PHI_DATA_CLASSIFICATION_ENABLED",
  },
  {
    key: "disclosure_accounting_and_audit_retention",
    description: "Disclosure accounting and audit retention for PHI access",
    envVar: "HIPAA_DISCLOSURE_ACCOUNTING_AND_AUDIT_RETENTION_ENABLED",
  },
  {
    key: "phi_store_and_backup_encryption",
    description: "Encryption requirements for PHI data stores and backups",
    envVar: "HIPAA_PHI_STORE_AND_BACKUP_ENCRYPTION_ENABLED",
  },
  {
    key: "break_glass_access_logging",
    description: "Break-glass access logging",
    envVar: "HIPAA_BREAK_GLASS_ACCESS_LOGGING_ENABLED",
  },
  {
    key: "retention_and_deletion_policies",
    description: "Documented retention and deletion policies for PHI",
    envVar: "HIPAA_RETENTION_AND_DELETION_POLICIES_DOCUMENTED",
  },
];

function isEnabled(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export class UnsupportedComplianceFrameworkError extends Error {
  constructor(
    public readonly unsupportedFrameworks: string[],
    public readonly capabilityStatus: FrameworkCapabilityStatus[],
  ) {
    super(`Unsupported compliance frameworks requested: ${unsupportedFrameworks.join(", ")}`);
  }
}

export class ComplianceFrameworkCapabilityGate {
  private getHipaaStatus(): FrameworkCapabilityStatus {
    const missingPrerequisites = HIPAA_REQUIREMENTS
      .filter((requirement) => !isEnabled(process.env[requirement.envVar]))
      .map((requirement) => requirement.description);

    return {
      framework: HIPAA_FRAMEWORK,
      supported: missingPrerequisites.length === 0,
      missingPrerequisites,
    };
  }

  getCapabilityStatus(framework: ComplianceFramework): FrameworkCapabilityStatus {
    if (framework === HIPAA_FRAMEWORK) {
      return this.getHipaaStatus();
    }

    return {
      framework,
      supported: true,
      missingPrerequisites: [],
    };
  }

  getSupportedFrameworks(): ComplianceFramework[] {
    return ALL_COMPLIANCE_FRAMEWORKS.filter((framework) => this.getCapabilityStatus(framework).supported);
  }

  getExposedFrameworks(): ExposedComplianceFramework[] {
    return this.getSupportedFrameworks() as ExposedComplianceFramework[];
  }

  isSupportedFramework(framework: string): framework is ComplianceFramework {
    return ALL_COMPLIANCE_FRAMEWORKS.includes(framework as ComplianceFramework)
      && this.getCapabilityStatus(framework as ComplianceFramework).supported;
  }

  assertFrameworksSupported(frameworks: string[]): asserts frameworks is ComplianceFramework[] {
    const statuses = frameworks
      .filter((framework): framework is ComplianceFramework =>
        ALL_COMPLIANCE_FRAMEWORKS.includes(framework as ComplianceFramework))
      .map((framework) => this.getCapabilityStatus(framework));

    const unsupportedFrameworks = frameworks.filter((framework) => !this.isSupportedFramework(framework));
    if (unsupportedFrameworks.length > 0) {
      throw new UnsupportedComplianceFrameworkError(unsupportedFrameworks, statuses);
    }
  }
}

export const complianceFrameworkCapabilityGate = new ComplianceFrameworkCapabilityGate();
export { ALL_COMPLIANCE_FRAMEWORKS, HIPAA_REQUIREMENTS };
