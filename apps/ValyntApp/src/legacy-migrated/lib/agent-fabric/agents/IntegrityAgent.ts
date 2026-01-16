/**
 * Integrity Agent
 *
 * Validates ROI models and ensures integrity of value calculations,
 * focusing on mathematical accuracy, data consistency, and compliance.
 */

import { BaseAgent } from "../BaseAgent";
import { AgentRequest, AgentResponse, AgentCapability } from "../../../services/agents/core/IAgent";
import { AgentConfig, AgentType, ConfidenceLevel } from "../../../types/agent";

export interface ROIModel {
  modelId: string;
  name: string;
  description: string;
  inputs: Array<{
    name: string;
    value: number;
    unit: string;
    source: string;
    confidence: number;
  }>;
  calculations: Array<{
    step: string;
    formula: string;
    result: number;
    assumptions: string[];
  }>;
  outputs: {
    roi: number;
    npv: number;
    irr: number;
    paybackPeriod: number;
    confidence: number;
  };
  validation: {
    mathematicalAccuracy: number; // 0-100
    dataConsistency: number; // 0-100
    assumptionValidity: number; // 0-100
    overallScore: number; // 0-100
    issues: Array<{
      severity: "error" | "warning" | "info";
      category: "math" | "data" | "assumption" | "logic";
      description: string;
      recommendation: string;
    }>;
  };
  compliance: {
    frameworks: string[];
    validated: boolean;
    exceptions: string[];
    auditTrail: Array<{
      timestamp: string;
      action: string;
      result: string;
    }>;
  };
}

export class IntegrityAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  getAgentType(): AgentType {
    return "integrity";
  }

  getCapabilities(): AgentCapability[] {
    return [
      {
        id: "roi_validation",
        name: "ROI Validation",
        description: "Validate ROI model calculations",
        enabled: true,
        category: "validation",
        inputTypes: ["object"],
        outputTypes: ["text"],
        requiredPermissions: ["llm_access"],
      },
      {
        id: "mathematical_accuracy",
        name: "Mathematical Accuracy",
        description: "Check mathematical accuracy of calculations",
        enabled: true,
        category: "analysis",
        inputTypes: ["object"],
        outputTypes: ["text"],
        requiredPermissions: ["llm_access"],
      },
      {
        id: "data_consistency",
        name: "Data Consistency",
        description: "Validate data consistency across models",
        enabled: true,
        category: "validation",
        inputTypes: ["object"],
        outputTypes: ["text"],
        requiredPermissions: ["llm_access"],
      },
      {
        id: "compliance_check",
        name: "Compliance Check",
        description: "Check compliance with financial frameworks",
        enabled: true,
        category: "validation",
        inputTypes: ["object"],
        outputTypes: ["text"],
        requiredPermissions: ["llm_access"],
      },
    ];
  }

  protected async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      // Extract ROI model data from request
      const inputData = this.extractROIModelData(request);

      // Validate and analyze the ROI model
      const validatedModel = await this.validateROIModel(inputData);

      // Store validation results in memory
      await this.storeValidationResults(validatedModel, request);

      // Generate response
      const response = this.createResponse(
        true,
        this.formatIntegrityResponse(validatedModel),
        validatedModel.validation.overallScore >= 70
          ? ("high" as ConfidenceLevel)
          : ("medium" as ConfidenceLevel),
        `ROI model validation completed with overall score ${validatedModel.validation.overallScore}/100. ${validatedModel.validation.overallScore >= 70 ? "Model is valid" : "Model needs improvement"}`
      );

      return response;
    } catch (error) {
      return this.createResponse(
        false,
        (error as Error).message,
        "low" as ConfidenceLevel,
        `Error validating ROI model: ${(error as Error).message}`
      );
    }
  }

  private extractROIModelData(request: AgentRequest): Record<string, any> {
    const data: Record<string, any> = {
      query: request.query,
      parameters: request.parameters || {},
      context: request.context || {},
    };

    // Extract ROI model information
    if (request.parameters) {
      data.modelId = request.parameters.modelId;
      data.modelName = request.parameters.modelName;
      data.description = request.parameters.description;
      data.inputs = request.parameters.inputs;
      data.calculations = request.parameters.calculations;
      data.outputs = request.parameters.outputs;
      data.frameworks = request.parameters.frameworks;
      data.assumptions = request.parameters.assumptions;
    }

    return data;
  }

  private async validateROIModel(data: Record<string, any>): Promise<ROIModel> {
    const model: ROIModel = {
      modelId: data.modelId || `roi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: data.modelName || "ROI Model",
      description: data.description || "ROI model validation",
      inputs: data.inputs || [],
      calculations: data.calculations || [],
      outputs: data.outputs || {
        roi: 0,
        npv: 0,
        irr: 0,
        paybackPeriod: 0,
        confidence: 0,
      },
      validation: await this.performValidation(data),
      compliance: await this.checkCompliance(data),
    };

    return model;
  }

  private async performValidation(data: Record<string, any>): Promise<ROIModel["validation"]> {
    const issues: ROIModel["validation"]["issues"] = [];

    // Mathematical accuracy validation
    const mathAccuracy = await this.validateMathematicalAccuracy(data, issues);

    // Data consistency validation
    const dataConsistency = await this.validateDataConsistency(data, issues);

    // Assumption validity validation
    const assumptionValidity = await this.validateAssumptions(data, issues);

    // Calculate overall score
    const overallScore = (mathAccuracy + dataConsistency + assumptionValidity) / 3;

    return {
      mathematicalAccuracy: mathAccuracy,
      dataConsistency: dataConsistency,
      assumptionValidity: assumptionValidity,
      overallScore,
      issues,
    };
  }

  private async validateMathematicalAccuracy(
    data: Record<string, any>,
    issues: ROIModel["validation"]["issues"]
  ): Promise<number> {
    let score = 100;

    // Check ROI calculation
    if (data.outputs && data.outputs.roi !== undefined) {
      const calculatedROI = this.calculateROI(data.inputs);
      if (Math.abs(calculatedROI - data.outputs.roi) > 0.01) {
        issues.push({
          severity: "error",
          category: "math",
          description: `ROI calculation mismatch: expected ${calculatedROI}, got ${data.outputs.roi}`,
          recommendation: "Review ROI calculation formula and input values",
        });
        score -= 30;
      }
    }

    // Check NPV calculation
    if (data.outputs && data.outputs.npv !== undefined) {
      // Simplified NPV validation - in practice would be more complex
      if (data.outputs.npv < -1000000) {
        // Unusually negative NPV
        issues.push({
          severity: "warning",
          category: "math",
          description: "NPV appears unusually negative",
          recommendation: "Verify cash flow projections and discount rate",
        });
        score -= 15;
      }
    }

    // Check IRR calculation
    if (data.outputs && data.outputs.irr !== undefined) {
      if (data.outputs.irr < 0 || data.outputs.irr > 1) {
        issues.push({
          severity: "error",
          category: "math",
          description: "IRR should be between 0% and 100%",
          recommendation: "Review IRR calculation methodology",
        });
        score -= 25;
      }
    }

    return Math.max(0, score);
  }

  private async validateDataConsistency(
    data: Record<string, any>,
    issues: ROIModel["validation"]["issues"]
  ): Promise<number> {
    let score = 100;

    // Check input data consistency
    if (data.inputs && Array.isArray(data.inputs)) {
      data.inputs.forEach((input: any, index: number) => {
        if (input.value === undefined || input.value === null) {
          issues.push({
            severity: "error",
            category: "data",
            description: `Input ${input.name || index} has no value`,
            recommendation: "Provide valid input values",
          });
          score -= 20;
        }

        if (
          input.value < 0 &&
          !["cost", "expense"].some((term) => input.name?.toLowerCase().includes(term))
        ) {
          issues.push({
            severity: "warning",
            category: "data",
            description: `Input ${input.name} has negative value`,
            recommendation: "Verify if negative value is intentional",
          });
          score -= 10;
        }
      });
    }

    // Check unit consistency
    const units = data.inputs?.map((input: any) => input.unit).filter(Boolean);
    if (units && units.length > 1) {
      const uniqueUnits = [...new Set(units)];
      if (uniqueUnits.length > 1) {
        issues.push({
          severity: "info",
          category: "data",
          description: "Multiple units detected in inputs",
          recommendation: "Ensure units are consistent or properly converted",
        });
        score -= 5;
      }
    }

    return Math.max(0, score);
  }

  private async validateAssumptions(
    data: Record<string, any>,
    issues: ROIModel["validation"]["issues"]
  ): Promise<number> {
    let score = 100;

    // Check if assumptions are documented
    const assumptions =
      data.assumptions || data.calculations?.flatMap((calc: any) => calc.assumptions) || [];

    if (assumptions.length === 0) {
      issues.push({
        severity: "warning",
        category: "assumption",
        description: "No assumptions documented",
        recommendation: "Document all key assumptions in the model",
      });
      score -= 25;
    }

    // Validate assumption reasonableness
    assumptions.forEach((assumption: string, index: number) => {
      if (typeof assumption !== "string" || assumption.length < 10) {
        issues.push({
          severity: "info",
          category: "assumption",
          description: `Assumption ${index + 1} is too brief`,
          recommendation: "Provide detailed assumption descriptions",
        });
        score -= 5;
      }
    });

    // Check for unrealistic assumptions
    const unrealisticPatterns = [/100% success/i, /no risk/i, /guaranteed/i, /certain/i];

    assumptions.forEach((assumption: string) => {
      if (unrealisticPatterns.some((pattern) => pattern.test(assumption))) {
        issues.push({
          severity: "warning",
          category: "assumption",
          description: "Potentially unrealistic assumption detected",
          recommendation: "Review assumption for realism and add appropriate caveats",
        });
        score -= 15;
      }
    });

    return Math.max(0, score);
  }

  private async checkCompliance(data: Record<string, any>): Promise<ROIModel["compliance"]> {
    const frameworks = data.frameworks || [];

    // Check common financial frameworks
    const standardFrameworks = ["GAAP", "IFRS", "Sarbanes-Oxley", "COSO"];
    const validatedFrameworks = frameworks.filter((fw: string) =>
      standardFrameworks.some((standard) => fw.toLowerCase().includes(standard.toLowerCase()))
    );

    const auditTrail = [
      {
        timestamp: new Date().toISOString(),
        action: "Model validation initiated",
        result: "Validation started",
      },
    ];

    return {
      frameworks: validatedFrameworks,
      validated: validatedFrameworks.length > 0,
      exceptions:
        frameworks.length > validatedFrameworks.length
          ? frameworks.filter((fw: string) => !validatedFrameworks.includes(fw))
          : [],
      auditTrail,
    };
  }

  private calculateROI(inputs: any[]): number {
    if (!inputs || inputs.length === 0) return 0;

    const investment =
      inputs.find(
        (input: any) =>
          input.name?.toLowerCase().includes("investment") ||
          input.name?.toLowerCase().includes("cost")
      )?.value || 0;

    const returns =
      inputs.find(
        (input: any) =>
          input.name?.toLowerCase().includes("return") ||
          input.name?.toLowerCase().includes("benefit")
      )?.value || 0;

    if (investment === 0) return 0;

    return ((returns - investment) / investment) * 100;
  }

  private async storeValidationResults(model: ROIModel, request: AgentRequest): Promise<void> {
    // Store the validation in episodic memory
    await this.storeMemory("episodic", `ROI Model Validation: ${model.name}`, {
      model,
      timestamp: new Date().toISOString(),
    });

    // Store validation score in semantic memory
    await this.storeMemory(
      "semantic",
      `ROI validation score for ${model.modelId}: ${model.validation.overallScore}`,
      {
        modelId: model.modelId,
        validationScore: model.validation.overallScore,
        isValid: model.validation.overallScore >= 70,
        issueCount: model.validation.issues.length,
      }
    );
  }

  private formatIntegrityResponse(model: ROIModel): string {
    const { validation, compliance } = model;

    return `
# ROI Model Integrity Validation

## Model Overview
**ID**: ${model.modelId}
**Name**: ${model.name}
**Description**: ${model.description}

## Validation Results
**Overall Score**: ${validation.overallScore}/100
**Status**: ${validation.overallScore >= 70 ? "✅ VALID" : "❌ NEEDS IMPROVEMENT"}

### Validation Breakdown
- **Mathematical Accuracy**: ${validation.mathematicalAccuracy}/100
- **Data Consistency**: ${validation.dataConsistency}/100
- **Assumption Validity**: ${validation.assumptionValidity}/100

## Issues Found
${
  validation.issues.length > 0
    ? validation.issues
        .map(
          (issue) =>
            `- **${issue.severity.toUpperCase()}** (${issue.category}): ${issue.description}\n  *Recommendation*: ${issue.recommendation}`
        )
        .join("\n\n")
    : "No issues detected. Model appears to be mathematically sound and consistent."
}

## Model Outputs
- **ROI**: ${(model.outputs.roi * 100).toFixed(2)}%
- **NPV**: $${model.outputs.npv.toLocaleString()}
- **IRR**: ${(model.outputs.irr * 100).toFixed(2)}%
- **Payback Period**: ${model.outputs.paybackPeriod} months
- **Confidence**: ${(model.outputs.confidence * 100).toFixed(1)}%

## Compliance Check
**Frameworks**: ${compliance.frameworks.join(", ") || "None specified"}
**Validated**: ${compliance.validated ? "✅ Yes" : "❌ No"}
${compliance.exceptions.length > 0 ? `**Exceptions**: ${compliance.exceptions.join(", ")}` : ""}

## Audit Trail
${compliance.auditTrail.map((entry) => `- **${entry.timestamp}**: ${entry.action} - ${entry.result}`).join("\n")}

## Recommendations
${
  validation.issues.length > 0
    ? validation.issues.map((issue) => `- ${issue.recommendation}`).join("\n")
    : "Model is well-structured. Consider regular reviews to maintain accuracy."
}

## Next Steps
1. Address any critical issues (severity: error)
2. Review warnings for potential improvements
3. Document any additional assumptions
4. Schedule regular validation reviews
5. Update model with new data as available
    `.trim();
  }

  // Additional utility methods
  async getModelValidationHistory(modelId?: string, limit: number = 10): Promise<any> {
    const query: any = {
      type: "episodic",
      limit,
    };

    if (modelId) {
      query.searchText = modelId;
    }

    return await this.searchMemory(query);
  }

  async revalidateModel(
    modelId: string,
    updatedData?: Partial<Record<string, any>>
  ): Promise<ROIModel | null> {
    try {
      // Retrieve original model data
      const memory = await this.retrieveMemory(modelId);
      if (!memory || memory.type !== "episodic") {
        return null;
      }

      const originalModel = memory.metadata?.model as ROIModel;
      if (!originalModel) {
        return null;
      }

      // Update data if provided
      const updatedDataRecord = {
        modelId: originalModel.modelId,
        modelName: originalModel.name,
        description: originalModel.description,
        inputs: originalModel.inputs,
        calculations: originalModel.calculations,
        outputs: originalModel.outputs,
        frameworks: originalModel.compliance.frameworks,
        assumptions: originalModel.calculations.flatMap((calc) => calc.assumptions),
        ...updatedData,
      };

      // Re-validate
      return await this.validateROIModel(updatedDataRecord);
    } catch (error) {
      return null;
    }
  }
}
