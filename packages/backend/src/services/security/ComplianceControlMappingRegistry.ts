import {
  ALL_COMPLIANCE_FRAMEWORKS,
  complianceFrameworkCapabilityGate,
  type ComplianceFramework,
} from "./ComplianceFrameworkCapabilityGate.js";

/* eslint-disable security/detect-object-injection -- Typed array/object access with controlled indices */

export type EvidenceType =
  | "audit_logs"
  | "security_audit_log"
  | "audit_logs_archive"
  | "security_audit_log_archive"
  | "control_status";

export interface ControlMapping {
  control_id: string;
  required_evidence_types: EvidenceType[];
  retention_requirement: {
    minimum_days: number;
    policy_source: string;
    legal_hold_supported: boolean;
  };
}

export interface FrameworkControlMapping {
  framework: ComplianceFramework;
  controls: ControlMapping[];
}

export interface RetentionSummary {
  framework: ComplianceFramework;
  retention_days: number;
  legal_hold_supported: boolean;
  controls_covered: number;
  policy_source: string;
}

const CONTROL_MAPPINGS: Record<ComplianceFramework, FrameworkControlMapping> = {
  GDPR: {
    framework: "GDPR",
    controls: [
      {
        control_id: "gdpr_art_30_records_of_processing",
        required_evidence_types: ["audit_logs", "control_status"],
        retention_requirement: {
          minimum_days: 2190,
          policy_source: "policy://gdpr/art30",
          legal_hold_supported: true,
        },
      },
      {
        control_id: "gdpr_art_32_security_processing",
        required_evidence_types: ["security_audit_log", "control_status"],
        retention_requirement: {
          minimum_days: 2190,
          policy_source: "policy://gdpr/art32",
          legal_hold_supported: true,
        },
      },
    ],
  },
  HIPAA: {
    framework: "HIPAA",
    controls: [
      {
        control_id: "hipaa_164_312_b_audit_controls",
        required_evidence_types: ["security_audit_log", "security_audit_log_archive", "control_status"],
        retention_requirement: {
          minimum_days: 2190,
          policy_source: "policy://hipaa/164.316",
          legal_hold_supported: true,
        },
      },
      {
        control_id: "hipaa_164_312_c_integrity",
        required_evidence_types: ["audit_logs", "control_status"],
        retention_requirement: {
          minimum_days: 2190,
          policy_source: "policy://hipaa/164.316",
          legal_hold_supported: true,
        },
      },
    ],
  },
  CCPA: {
    framework: "CCPA",
    controls: [
      {
        control_id: "ccpa_1798_105_deletion_requests",
        required_evidence_types: ["audit_logs", "audit_logs_archive"],
        retention_requirement: {
          minimum_days: 1095,
          policy_source: "policy://ccpa/1798.105",
          legal_hold_supported: true,
        },
      },
      {
        control_id: "ccpa_1798_110_disclosure",
        required_evidence_types: ["audit_logs", "control_status"],
        retention_requirement: {
          minimum_days: 1095,
          policy_source: "policy://ccpa/1798.110",
          legal_hold_supported: true,
        },
      },
    ],
  },
  SOC2: {
    framework: "SOC2",
    controls: [
      {
        control_id: "soc2_cc7_monitoring",
        required_evidence_types: ["security_audit_log", "security_audit_log_archive", "control_status"],
        retention_requirement: {
          minimum_days: 2555,
          policy_source: "policy://soc2/cc7",
          legal_hold_supported: true,
        },
      },
      {
        control_id: "soc2_cc6_change_mgmt",
        required_evidence_types: ["audit_logs", "control_status"],
        retention_requirement: {
          minimum_days: 2555,
          policy_source: "policy://soc2/cc6",
          legal_hold_supported: true,
        },
      },
    ],
  },
  ISO27001: {
    framework: "ISO27001",
    controls: [
      {
        control_id: "iso27001_a8_information_classification",
        required_evidence_types: ["audit_logs", "audit_logs_archive"],
        retention_requirement: {
          minimum_days: 2555,
          policy_source: "policy://iso27001/a8",
          legal_hold_supported: true,
        },
      },
      {
        control_id: "iso27001_a12_logging_monitoring",
        required_evidence_types: ["security_audit_log", "security_audit_log_archive", "control_status"],
        retention_requirement: {
          minimum_days: 2555,
          policy_source: "policy://iso27001/a12",
          legal_hold_supported: true,
        },
      },
    ],
  },
};

export class ComplianceControlMappingRegistry {
  getFrameworkMapping(framework: ComplianceFramework): FrameworkControlMapping {
    complianceFrameworkCapabilityGate.assertFrameworksSupported([framework]);
    return CONTROL_MAPPINGS[framework];
  }

  listFrameworkMappings(frameworks?: ComplianceFramework[]): FrameworkControlMapping[] {
    const selected = frameworks ?? complianceFrameworkCapabilityGate.getSupportedFrameworks();
    complianceFrameworkCapabilityGate.assertFrameworksSupported(selected);
    return selected.map((framework) => this.getFrameworkMapping(framework));
  }

  getRetentionSummary(frameworks?: ComplianceFramework[]): RetentionSummary[] {
    return this.listFrameworkMappings(frameworks).map((mapping) => {
      const highestRetention = mapping.controls.reduce((current, control) => Math.max(current, control.retention_requirement.minimum_days), 0);
      return {
        framework: mapping.framework,
        retention_days: highestRetention,
        legal_hold_supported: mapping.controls.some((control) => control.retention_requirement.legal_hold_supported),
        controls_covered: mapping.controls.length,
        policy_source: mapping.controls[0]?.retention_requirement.policy_source ?? "policy://unknown",
      };
    });
  }
}

export const complianceControlMappingRegistry = new ComplianceControlMappingRegistry();
export { ALL_COMPLIANCE_FRAMEWORKS };
