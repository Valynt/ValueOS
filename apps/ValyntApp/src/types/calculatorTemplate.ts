export enum InputFieldType {
  NUMBER = "number",
  PERCENTAGE = "percentage",
  CURRENCY = "currency",
  TEXT = "text",
  SELECT = "select",
}

export enum MetricCategory {
  REVENUE = "revenue",
  COST = "cost",
  EFFICIENCY = "efficiency",
  GROWTH = "growth",
  RISK = "risk",
  CUSTOMER = "customer",
  QUALITY = "quality",
}

export enum Industry {
  SAAS = "saas",
  FINTECH = "fintech",
  HEALTHCARE = "healthcare",
  MANUFACTURING = "manufacturing",
  RETAIL = "retail",
  ECOMMERCE = "ecommerce",
  FINANCIAL_SERVICES = "financial_services",
  OTHER = "other",
}

export interface CalculatorMetric {
  id: string;
  name: string;
  category: MetricCategory;
  unit: string;
  description?: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  fieldType?: InputFieldType;
  inputType?: InputFieldType;
  [key: string]: unknown;
}

export interface CalculatorPainPoint {
  id: string;
  label: string;
  description: string;
  category: MetricCategory;
  impactLevel: "low" | "medium" | "high";
  commonSolutions: string[];
}

export interface CalculatorTemplate {
  id: string;
  industry: Industry;
  name: string;
  description: string;
  version: string;
  estimatedTimeMinutes: number;
  painPoints: CalculatorPainPoint[];
  metrics: CalculatorMetric[];
  formulas?: Record<string, string>;
  benchmarks?: Record<string, unknown>;
  [key: string]: unknown;
}
