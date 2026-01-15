export type SDUIComponentType =
  | "text"
  | "heading"
  | "button"
  | "input"
  | "select"
  | "card"
  | "table"
  | "form"
  | "list"
  | "grid"
  | "tabs"
  | "modal"
  | "chart"
  | "metric"
  | "progress"
  | "alert"
  | "custom";

export interface SDUIComponent {
  id: string;
  type: SDUIComponentType;
  props: Record<string, unknown>;
  children?: SDUIComponent[];
  actions?: SDUIAction[];
  conditions?: SDUICondition[];
}

export interface SDUIAction {
  type: "navigate" | "submit" | "api" | "modal" | "custom";
  target: string;
  params?: Record<string, unknown>;
}

export interface SDUICondition {
  field: string;
  operator: "eq" | "ne" | "gt" | "lt" | "contains" | "empty";
  value: unknown;
}

export interface SDUIPage {
  id: string;
  title: string;
  components: SDUIComponent[];
  layout?: "single" | "sidebar" | "split";
  metadata?: Record<string, unknown>;
}

export interface SDUISchema {
  version: string;
  pages: SDUIPage[];
}
