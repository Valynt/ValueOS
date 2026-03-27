import {
  complianceControlStatusService,
  type FrameworkControlVerificationStatus,
} from "./ComplianceControlStatusService.js";

const HIPAA_FRAMEWORK = "HIPAA" as const;

const ALL_COMPLIANCE_FRAMEWORKS = [
  "GDPR",
  HIPAA_FRAMEWORK,
  "CCPA",
  "SOC2",
  "ISO27001",
] as const;

export type ComplianceFramework = (typeof ALL_COMPLIANCE_FRAMEWORKS)[number];
export type ExposedComplianceFramework = ComplianceFramework;
export type FrameworkAvailability = "available" | "gated";

export interface FrameworkCapabilityStatus {
  framework: ComplianceFramework;
  declared: boolean;
  verified: boolean;
  supported: boolean;
  prerequisites_met: boolean;
  availability: FrameworkAvailability;
  gate_label: "prerequisite_gating";
  missingPrerequisites: string[];
  required_signals: string[];
  signal_statuses: Array<{
    key: string;
    status: "pass" | "fail";
    description: string;
    evidence_pointer: string;
    observed_at: string;
  }>;
}

export type FrameworkPrerequisiteStatus = FrameworkCapabilityStatus;

export class UnsupportedComplianceFrameworkError extends Error {
  constructor(
    public readonly unsupportedFrameworks: string[],
    public readonly capabilityStatus: FrameworkCapabilityStatus[]
  ) {
    super(
      `Compliance framework prerequisites not met for: ${unsupportedFrameworks.join(", ")}`
    );
  }

  get prerequisiteStatus(): FrameworkPrerequisiteStatus[] {
    return this.capabilityStatus;
  }
}

export class ComplianceFrameworkCapabilityGate {
  constructor(
    private readonly controlStatusSource: {
      getFrameworkVerificationStatuses(
        tenantId: string
      ): Promise<FrameworkControlVerificationStatus[]>;
    } = complianceControlStatusService
  ) {}

  async getCapabilityStatus(
    tenantId: string,
    framework: ComplianceFramework
  ): Promise<FrameworkCapabilityStatus> {
    const statuses =
      await this.controlStatusSource.getFrameworkVerificationStatuses(tenantId);
    const frameworkStatus = statuses.find(
      status => status.framework === framework
    );
    if (!frameworkStatus) {
      throw new Error(`Missing framework verification state for ${framework}`);
    }

    const prerequisitesMet = frameworkStatus.verified;
    return {
      framework,
      declared: frameworkStatus.declared,
      verified: frameworkStatus.verified,
      supported: prerequisitesMet,
      prerequisites_met: prerequisitesMet,
      availability: prerequisitesMet ? "available" : "gated",
      gate_label: "prerequisite_gating",
      missingPrerequisites: frameworkStatus.missingPrerequisites,
      required_signals: frameworkStatus.requiredSignals,
      signal_statuses: frameworkStatus.signalStatuses,
    };
  }

  async getPrerequisiteStatus(
    tenantId: string,
    framework: ComplianceFramework
  ): Promise<FrameworkPrerequisiteStatus> {
    return this.getCapabilityStatus(tenantId, framework);
  }

  async getCapabilityStatuses(
    tenantId: string
  ): Promise<FrameworkCapabilityStatus[]> {
    return Promise.all(
      ALL_COMPLIANCE_FRAMEWORKS.map(framework =>
        this.getCapabilityStatus(tenantId, framework)
      )
    );
  }

  isKnownFramework(framework: string): framework is ComplianceFramework {
    return ALL_COMPLIANCE_FRAMEWORKS.includes(framework as ComplianceFramework);
  }

  async getSupportedFrameworks(
    tenantId: string
  ): Promise<ComplianceFramework[]> {
    const statuses = await this.getCapabilityStatuses(tenantId);
    return statuses
      .filter(framework => framework.supported)
      .map(framework => framework.framework);
  }

  async getExposedFrameworks(
    tenantId: string
  ): Promise<ExposedComplianceFramework[]> {
    return this.getSupportedFrameworks(tenantId);
  }

  async isSupportedFramework(
    tenantId: string,
    framework: string
  ): Promise<boolean> {
    if (!this.isKnownFramework(framework)) return false;
    const status = await this.getCapabilityStatus(tenantId, framework);
    return status.supported;
  }

  async assertFrameworksSupported(
    tenantId: string,
    frameworks: string[]
  ): Promise<void> {
    const statuses = await Promise.all(
      frameworks
        .filter((framework): framework is ComplianceFramework =>
          ALL_COMPLIANCE_FRAMEWORKS.includes(framework as ComplianceFramework)
        )
        .map(framework => this.getCapabilityStatus(tenantId, framework))
    );

    const unsupportedFrameworks: string[] = [];
    for (const framework of frameworks) {
      if (!(await this.isSupportedFramework(tenantId, framework))) {
        unsupportedFrameworks.push(framework);
      }
    }
    if (unsupportedFrameworks.length > 0) {
      throw new UnsupportedComplianceFrameworkError(
        unsupportedFrameworks,
        statuses
      );
    }
  }
}

export const complianceFrameworkCapabilityGate =
  new ComplianceFrameworkCapabilityGate();
export { ALL_COMPLIANCE_FRAMEWORKS, HIPAA_FRAMEWORK };
export const HIPAA_REQUIREMENTS = HIPAA_FRAMEWORK;
