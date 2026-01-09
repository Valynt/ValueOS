/**
 * Template Validator
 * 
 * Validates calculator templates and user inputs
 */

import type {
  CalculatorInput,
  CalculatorTemplate,
  MetricDefinition,
  ValidationRule,
} from '../../types/calculatorTemplate';
import { logger } from '../logger';

export interface ValidationError {
  field: string;
  message: string;
  rule: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

class TemplateValidator {
  /**
   * Validate template structure
   */
  public validateTemplate(template: CalculatorTemplate): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate required fields
    if (!template.id) {
      errors.push({
        field: 'id',
        message: 'Template ID is required',
        rule: 'required',
      });
    }

    if (!template.industry) {
      errors.push({
        field: 'industry',
        message: 'Industry is required',
        rule: 'required',
      });
    }

    if (!template.name) {
      errors.push({
        field: 'name',
        message: 'Template name is required',
        rule: 'required',
      });
    }

    // Validate pain points
    if (!template.painPoints || template.painPoints.length === 0) {
      errors.push({
        field: 'painPoints',
        message: 'At least one pain point is required',
        rule: 'required',
      });
    }

    // Validate metrics
    if (!template.metrics || template.metrics.length === 0) {
      errors.push({
        field: 'metrics',
        message: 'At least one metric is required',
        rule: 'required',
      });
    } else {
      // Check for required metrics
      const hasRequiredMetric = template.metrics.some((m) => m.required);
      if (!hasRequiredMetric) {
        errors.push({
          field: 'metrics',
          message: 'At least one required metric is needed',
          rule: 'required',
        });
      }

      // Validate each metric
      template.metrics.forEach((metric, index) => {
        if (!metric.id) {
          errors.push({
            field: `metrics[${index}].id`,
            message: 'Metric ID is required',
            rule: 'required',
          });
        }

        if (!metric.name) {
          errors.push({
            field: `metrics[${index}].name`,
            message: 'Metric name is required',
            rule: 'required',
          });
        }

        if (metric.min !== undefined && metric.max !== undefined) {
          if (metric.min > metric.max) {
            errors.push({
              field: `metrics[${index}]`,
              message: 'Min value cannot be greater than max value',
              rule: 'range',
            });
          }
        }
      });
    }

    // Validate ROI formulas
    if (template.roiFormulas) {
      template.roiFormulas.forEach((formula, index) => {
        if (!formula.id) {
          errors.push({
            field: `roiFormulas[${index}].id`,
            message: 'Formula ID is required',
            rule: 'required',
          });
        }

        if (!formula.formula) {
          errors.push({
            field: `roiFormulas[${index}].formula`,
            message: 'Formula expression is required',
            rule: 'required',
          });
        }

        // Validate dependencies exist in metrics
        if (formula.dependencies) {
          const metricIds = template.metrics.map((m) => m.id);
          formula.dependencies.forEach((dep) => {
            if (!metricIds.includes(dep)) {
              errors.push({
                field: `roiFormulas[${index}].dependencies`,
                message: `Dependency '${dep}' not found in metrics`,
                rule: 'custom',
              });
            }
          });
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate user input against template
   */
  public validateInput(
    input: CalculatorInput,
    template: CalculatorTemplate
  ): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate required fields
    if (!input.companyName) {
      errors.push({
        field: 'companyName',
        message: 'Company name is required',
        rule: 'required',
      });
    }

    if (!input.industry) {
      errors.push({
        field: 'industry',
        message: 'Industry is required',
        rule: 'required',
      });
    }

    if (input.industry !== template.industry) {
      errors.push({
        field: 'industry',
        message: 'Industry does not match template',
        rule: 'custom',
      });
    }

    // Validate pain points
    if (!input.selectedPainPoints || input.selectedPainPoints.length === 0) {
      errors.push({
        field: 'selectedPainPoints',
        message: 'At least one pain point must be selected',
        rule: 'required',
      });
    } else {
      const validPainPointIds = template.painPoints.map((p) => p.id);
      input.selectedPainPoints.forEach((ppId) => {
        if (!validPainPointIds.includes(ppId)) {
          errors.push({
            field: 'selectedPainPoints',
            message: `Invalid pain point ID: ${ppId}`,
            rule: 'custom',
          });
        }
      });
    }

    // Validate metric values
    template.metrics.forEach((metric) => {
      const value = input.metricValues[metric.id];

      // Check required
      if (metric.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field: `metricValues.${metric.id}`,
          message: `${metric.name} is required`,
          rule: 'required',
        });
        return;
      }

      // Skip validation if not provided and not required
      if (value === undefined || value === null || value === '') {
        return;
      }

      // Validate number type
      if (typeof value === 'number') {
        if (isNaN(value)) {
          errors.push({
            field: `metricValues.${metric.id}`,
            message: `${metric.name} must be a valid number`,
            rule: 'custom',
          });
          return;
        }

        // Check min
        if (metric.min !== undefined && value < metric.min) {
          errors.push({
            field: `metricValues.${metric.id}`,
            message: `${metric.name} must be at least ${metric.min}`,
            rule: 'min',
          });
        }

        // Check max
        if (metric.max !== undefined && value > metric.max) {
          errors.push({
            field: `metricValues.${metric.id}`,
            message: `${metric.name} must be at most ${metric.max}`,
            rule: 'max',
          });
        }
      }
    });

    // Apply custom validation rules
    template.validationRules.forEach((rule) => {
      const error = this.applyValidationRule(rule, input, template);
      if (error) {
        errors.push(error);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Apply a single validation rule
   */
  private applyValidationRule(
    rule: ValidationRule,
    input: CalculatorInput,
    template: CalculatorTemplate
  ): ValidationError | null {
    const value = input.metricValues[rule.field];

    switch (rule.rule) {
      case 'required':
        if (value === undefined || value === null || value === '') {
          return {
            field: rule.field,
            message: rule.message,
            rule: 'required',
          };
        }
        break;

      case 'min':
        if (typeof value === 'number' && typeof rule.value === 'number') {
          if (value < rule.value) {
            return {
              field: rule.field,
              message: rule.message,
              rule: 'min',
            };
          }
        }
        break;

      case 'max':
        if (typeof value === 'number' && typeof rule.value === 'number') {
          if (value > rule.value) {
            return {
              field: rule.field,
              message: rule.message,
              rule: 'max',
            };
          }
        }
        break;

      case 'range':
        if (typeof value === 'number' && typeof rule.value === 'string') {
          const [min, max] = rule.value.split('-').map(Number);
          if (value < min || value > max) {
            return {
              field: rule.field,
              message: rule.message,
              rule: 'range',
            };
          }
        }
        break;

      case 'custom':
        if (rule.customValidator) {
          const isValid = rule.customValidator(value, input.metricValues);
          if (!isValid) {
            return {
              field: rule.field,
              message: rule.message,
              rule: 'custom',
            };
          }
        }
        break;
    }

    return null;
  }

  /**
   * Validate metric definition
   */
  public validateMetric(metric: MetricDefinition): ValidationResult {
    const errors: ValidationError[] = [];

    if (!metric.id) {
      errors.push({
        field: 'id',
        message: 'Metric ID is required',
        rule: 'required',
      });
    }

    if (!metric.name) {
      errors.push({
        field: 'name',
        message: 'Metric name is required',
        rule: 'required',
      });
    }

    if (!metric.category) {
      errors.push({
        field: 'category',
        message: 'Metric category is required',
        rule: 'required',
      });
    }

    if (!metric.inputType) {
      errors.push({
        field: 'inputType',
        message: 'Input type is required',
        rule: 'required',
      });
    }

    if (metric.min !== undefined && metric.max !== undefined) {
      if (metric.min > metric.max) {
        errors.push({
          field: 'range',
          message: 'Min value cannot be greater than max value',
          rule: 'range',
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Log validation errors
   */
  public logValidationErrors(errors: ValidationError[]): void {
    errors.forEach((error) => {
      logger.warn('Validation error', {
        field: error.field,
        message: error.message,
        rule: error.rule,
      });
    });
  }
}

// Singleton instance
let validatorInstance: TemplateValidator | null = null;

/**
 * Get validator instance
 */
export function getTemplateValidator(): TemplateValidator {
  if (!validatorInstance) {
    validatorInstance = new TemplateValidator();
  }
  return validatorInstance;
}

// Export singleton instance getter
export default getTemplateValidator;
