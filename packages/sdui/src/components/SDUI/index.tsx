import { AlertTriangle, ChevronDown, ChevronRight, X } from "lucide-react";
import React, { useState } from "react";

export interface AgentResponseCardProps {
  title?: string;
  response?: string;
  reasoning?: string;
  confidence?: number;
  showReasoning?: boolean;
  className?: string;
}

export function AgentResponseCard({
  title = "Agent Response",
  response,
  reasoning,
  confidence,
  showReasoning = false,
  className = "",
}: AgentResponseCardProps) {
  const [expanded, setExpanded] = useState(showReasoning);

  return (
    <article className={`bg-card border border-border rounded-lg p-4 space-y-2 ${className}`}>
      <header className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{title}</h3>
        {typeof confidence === "number" ? <ConfidenceIndicator value={confidence} size="sm" /> : null}
      </header>
      <p className="text-sm text-muted-foreground">{response ?? "No response provided."}</p>
      {reasoning ? (
        <div>
          <button className="text-xs text-primary" onClick={() => setExpanded((v) => !v)} type="button">
            {expanded ? "Hide reasoning" : "Show reasoning"}
          </button>
          {expanded ? <p className="mt-1 text-xs text-muted-foreground">{reasoning}</p> : null}
        </div>
      ) : null}
    </article>
  );
}

export interface AgentWorkflowItem {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
}

export interface AgentWorkflowPanelProps {
  agents: AgentWorkflowItem[];
  messages?: string[];
  showMessages?: boolean;
  className?: string;
}

export function AgentWorkflowPanel({ agents, messages = [], showMessages = false, className = "" }: AgentWorkflowPanelProps) {
  return (
    <section className={`bg-card border border-border rounded-lg p-4 ${className}`}>
      <h3 className="font-semibold text-sm mb-2">Agent Workflow</h3>
      <ul className="space-y-1 text-sm">
        {agents.map((agent) => (
          <li key={agent.id} className="flex items-center justify-between">
            <span>{agent.name}</span>
            <MetricBadge label="status" value={agent.status} tone={agent.status === "failed" ? "danger" : "default"} />
          </li>
        ))}
      </ul>
      {showMessages && messages.length > 0 ? (
        <div className="mt-3 text-xs text-muted-foreground">
          {messages.map((message, index) => (
            <p key={`${message}-${index}`}>{message}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export interface BreadcrumbItem {
  id: string;
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate?: (item: BreadcrumbItem) => void;
  className?: string;
}

export function Breadcrumbs({ items, onNavigate, className = "" }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={`text-sm ${className}`}>
      <ol className="flex items-center gap-2">
        {items.map((item, index) => (
          <li key={item.id} className="flex items-center gap-2">
            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => onNavigate?.(item)}>
              {item.label}
            </button>
            {index < items.length - 1 ? <span>/</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export interface ConfidenceIndicatorProps {
  value: number;
  variant?: "bar" | "text";
  size?: "sm" | "md";
  className?: string;
}

export function ConfidenceIndicator({ value, variant = "bar", size = "md", className = "" }: ConfidenceIndicatorProps) {
  const safeValue = Math.min(100, Math.max(0, value));
  if (variant === "text") {
    return <span className={`text-xs font-medium ${className}`}>{safeValue}% confidence</span>;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`w-20 ${size === "sm" ? "h-1.5" : "h-2"} bg-secondary rounded-full overflow-hidden`}>
        <div className="h-full bg-primary" style={{ width: `${safeValue}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{safeValue}%</span>
    </div>
  );
}

export interface DataTableColumn {
  key: string;
  header: string;
}

export interface DataTableProps {
  columns?: DataTableColumn[];
  headers?: string[];
  data: Array<Record<string, string | number>> | Array<Array<string | number>>;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

export function DataTable({ columns, headers, data, className = "", ...ariaProps }: DataTableProps) {
  const normalizedColumns: DataTableColumn[] = columns ?? (headers ? headers.map((header, index) => ({ key: String(index), header })) : []);
  const rows = Array.isArray(data) ? data : [];

  return (
    <div className={`overflow-auto ${className}`}>
      <table className="w-full border-collapse text-sm" {...ariaProps}>
        <thead>
          <tr>
            {normalizedColumns.map((column) => (
              <th key={column.key} className="border-b border-border text-left p-2 font-medium">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const cells = Array.isArray(row)
              ? row
              : normalizedColumns.map((column) => row[column.key] ?? "");

            return (
              <tr key={rowIndex}>
                {cells.map((cell, cellIndex) => (
                  <td key={cellIndex} className="border-b border-border/60 p-2">
                    {String(cell)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export interface ExpansionBlockProps {
  title: string;
  content: string;
  defaultExpanded?: boolean;
}

export function ExpansionBlock({ title, content, defaultExpanded = false }: ExpansionBlockProps) {
  const [open, setOpen] = useState(defaultExpanded);
  return (
    <section className="border border-border rounded-lg p-3">
      <button type="button" className="text-sm font-medium" onClick={() => setOpen((v) => !v)}>
        {open ? "▾" : "▸"} {title}
      </button>
      {open ? <p className="text-sm text-muted-foreground mt-2">{content}</p> : null}
    </section>
  );
}

export interface InfoBannerProps {
  title: string;
  description?: string;
  tone?: "info" | "success" | "warning" | "error";
}

export function InfoBanner({ title, description, tone = "info" }: InfoBannerProps) {
  const toneClasses: Record<NonNullable<InfoBannerProps["tone"]>, string> = {
    info: "bg-blue-50 border-blue-200 text-blue-900",
    success: "bg-green-50 border-green-200 text-green-900",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-900",
    error: "bg-red-50 border-red-200 text-red-900",
  };

  return (
    <section className={`border rounded-lg p-3 ${toneClasses[tone]}`}>
      <h3 className="font-medium text-sm">{title}</h3>
      {description ? <p className="text-sm mt-1 opacity-90">{description}</p> : null}
    </section>
  );
}

export interface IntegrityIssue {
  id: string;
  message: string;
  severity: "low" | "medium" | "high";
}

export interface IntegrityReviewPanelProps {
  issues: IntegrityIssue[];
  onResolve?: (id: string) => void;
}

export function IntegrityReviewPanel({ issues, onResolve }: IntegrityReviewPanelProps) {
  return (
    <section className="bg-card border border-border rounded-lg p-4">
      <h3 className="font-semibold text-sm mb-2">Integrity Review</h3>
      {issues.map((issue) => (
        <div key={issue.id} className="flex items-center justify-between text-sm py-1">
          <span>{issue.message}</span>
          <button type="button" onClick={() => onResolve?.(issue.id)} className="text-primary text-xs">
            Resolve
          </button>
        </div>
      ))}
    </section>
  );
}

export interface LifecycleStageItem {
  id: string;
  label: string;
}

export interface LifecyclePanelProps {
  stages: LifecycleStageItem[];
  currentStageId?: string;
}

export function LifecyclePanel({ stages, currentStageId }: LifecyclePanelProps) {
  return (
    <ol className="space-y-2">
      {stages.map((stage) => (
        <li key={stage.id} className={stage.id === currentStageId ? "font-semibold" : "text-muted-foreground"}>
          {stage.label}
        </li>
      ))}
    </ol>
  );
}

export interface MetricBadgeProps {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "danger";
}

export function MetricBadge({ label, value, tone = "default" }: MetricBadgeProps) {
  const classes = {
    default: "bg-secondary text-secondary-foreground",
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    danger: "bg-red-100 text-red-800",
  };

  return <span className={`inline-flex text-xs px-2 py-1 rounded ${classes[tone]}`}>{label}: {value}</span>;
}

export interface RealizationDashboardProps {
  metrics: Array<{ label: string; value: string | number; tone?: MetricBadgeProps["tone"] }>;
}

export function RealizationDashboard({ metrics }: RealizationDashboardProps) {
  return (
    <section className="grid gap-2 sm:grid-cols-2">
      {metrics.map((metric) => (
        <MetricBadge key={metric.label} label={metric.label} value={metric.value} tone={metric.tone} />
      ))}
    </section>
  );
}

export interface ScenarioOption {
  id: string;
  label: string;
}

export interface ScenarioSelectorProps {
  scenarios: ScenarioOption[];
  selectedId?: string;
  onChange?: (id: string) => void;
}

export function ScenarioSelector({ scenarios, selectedId, onChange }: ScenarioSelectorProps) {
  return (
    <label className="text-sm flex flex-col gap-1">
      Scenario
      <select value={selectedId} onChange={(event) => onChange?.(event.target.value)} className="border border-border rounded px-2 py-1">
        {scenarios.map((scenario) => (
          <option key={scenario.id} value={scenario.id}>
            {scenario.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export interface SDUIFormField {
  name: string;
  label: string;
  type: "text" | "number";
  required?: boolean;
}

export interface SDUIFormProps {
  fields: SDUIFormField[];
  submitText?: string;
  onSubmit?: (values: Record<string, string>) => void;
}

export function SDUIForm({ fields, submitText = "Submit", onSubmit }: SDUIFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(values);
      }}
    >
      {fields.map((field) => (
        <label key={field.name} className="flex flex-col text-sm gap-1">
          {field.label}
          <input
            type={field.type}
            required={field.required}
            value={values[field.name] ?? ""}
            onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.value }))}
            className="border border-border rounded px-2 py-1"
          />
        </label>
      ))}
      <button type="submit" className="bg-primary text-primary-foreground px-3 py-1 rounded text-sm">
        {submitText}
      </button>
    </form>
  );
}

export interface SectionErrorFallbackProps {
  componentName?: string;
  error?: string;
  children?: React.ReactNode;
}

export function SectionErrorFallback({ componentName, error, children }: SectionErrorFallbackProps) {
  if (!error) return <>{children}</>;

  return (
    <section className="border border-red-300 bg-red-50 rounded-lg p-3 text-sm text-red-800">
      <p className="font-medium">Failed to render {componentName ?? "component"}</p>
      <p>{error}</p>
    </section>
  );
}

export interface SideNavigationItem {
  id: string;
  label: string;
}

export interface SideNavigationProps {
  items: SideNavigationItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
}

export function SideNavigation({ items, activeId, onSelect }: SideNavigationProps) {
  return (
    <nav aria-label="Side navigation">
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              className={`w-full text-left px-2 py-1 rounded text-sm ${activeId === item.id ? "bg-secondary font-medium" : ""}`}
              onClick={() => onSelect?.(item.id)}
              type="button"
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export interface TabBarItem {
  id: string;
  label: string;
}

export interface TabBarProps {
  tabs: TabBarItem[];
  activeId?: string;
  onChange?: (id: string) => void;
}

export function TabBar({ tabs, activeId, onChange }: TabBarProps) {
  return (
    <div role="tablist" className="flex gap-2 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeId === tab.id}
          className={`px-3 py-2 text-sm ${activeId === tab.id ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}
          type="button"
          onClick={() => onChange?.(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export interface ValueCommitFormProps {
  onSubmit?: (payload: { owner: string; commitment: string }) => void;
}

export function ValueCommitForm({ onSubmit }: ValueCommitFormProps) {
  const [owner, setOwner] = useState("");
  const [commitment, setCommitment] = useState("");

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.({ owner, commitment });
      }}
    >
      <input className="w-full border border-border rounded px-2 py-1 text-sm" placeholder="Owner" value={owner} onChange={(event) => setOwner(event.target.value)} />
      <textarea className="w-full border border-border rounded px-2 py-1 text-sm" placeholder="Commitment" value={commitment} onChange={(event) => setCommitment(event.target.value)} />
      <button type="submit" className="bg-primary text-primary-foreground rounded px-3 py-1 text-sm">Save</button>
    </form>
  );
}

export interface JsonViewerProps {
  data: unknown;
}

export function JsonViewer({ data }: JsonViewerProps) {
  return <pre className="bg-secondary/40 rounded p-3 text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre>;
}

export interface TextBlockProps {
  text: string;
  variant?: "body" | "caption" | "heading";
}

export function TextBlock({ text, variant = "body" }: TextBlockProps) {
  if (variant === "heading") return <h3 className="text-base font-semibold">{text}</h3>;
  if (variant === "caption") return <p className="text-xs text-muted-foreground">{text}</p>;
  return <p className="text-sm">{text}</p>;
}

export interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function ConfirmationDialog({ open, title, description, onConfirm, onCancel }: ConfirmationDialogProps) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" className="border border-border rounded-lg p-4 bg-card space-y-2">
      <div className="flex justify-between items-start">
        <h3 className="font-semibold text-sm">{title}</h3>
        <button type="button" onClick={onCancel} aria-label="Close"><X className="w-4 h-4" /></button>
      </div>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      <div className="flex gap-2 justify-end">
        <button type="button" className="px-3 py-1 text-sm border border-border rounded" onClick={onCancel}>Cancel</button>
        <button type="button" className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded" onClick={onConfirm}>Confirm</button>
      </div>
    </div>
  );
}

export interface ValueHypothesisCardProps {
  title: string;
  hypothesis: string;
  confidence?: number;
}

export function ValueHypothesisCard({ title, hypothesis, confidence }: ValueHypothesisCardProps) {
  return (
    <article className="bg-card border border-border rounded-lg p-4 space-y-2">
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-sm text-muted-foreground">{hypothesis}</p>
      {typeof confidence === "number" ? <ConfidenceIndicator value={confidence} /> : null}
    </article>
  );
}

export interface ProgressBarProps {
  value?: number;
  max?: number;
  label?: string;
  "aria-valuenow"?: string;
  "aria-valuemin"?: string;
  "aria-valuemax"?: string;
  "aria-label"?: string;
}

export function ProgressBar({ value = 0, max = 100, label, ...ariaProps }: ProgressBarProps) {
  const filteredAria = Object.fromEntries(
    Object.entries(ariaProps).filter(([, v]) => v !== undefined)
  ) as Record<string, string>;
  return (
    <div className="space-y-1">
      {label ? <p className="text-sm">{label}</p> : null}
      <progress value={value} max={max} className="w-full" {...filteredAria} />
    </div>
  );
}

export interface ComponentPreviewProps {
  componentName: string;
  props?: Record<string, unknown>;
}

export function ComponentPreview({ componentName, props }: ComponentPreviewProps) {
  return (
    <section className="border border-border rounded-lg p-3 space-y-2">
      <p className="text-sm font-medium">Preview: {componentName}</p>
      <JsonViewer data={props ?? {}} />
    </section>
  );
}

// Re-export implemented components from their own files
export { DiscoveryCard } from "./DiscoveryCard";
export { KPIForm } from "./KPIForm";
export { InteractiveChart } from "./InteractiveChart";
export { ValueTreeCard } from "./ValueTreeCard";
export { NarrativeBlock } from "./NarrativeBlock";

export interface UnknownComponentFallbackProps {
  componentName?: string;
  props?: Record<string, unknown>;
  className?: string;
}

const isDev = typeof process !== "undefined" && process.env?.NODE_ENV === "development";

export function UnknownComponentFallback({ componentName = "Unknown", props, className = "" }: UnknownComponentFallbackProps) {
  const [showProps, setShowProps] = useState(false);

  return (
    <div
      data-testid="unknown-component-fallback"
      className={`bg-card border border-border rounded-lg p-4 ${className}`}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
        <span className="text-sm font-medium">
          Unknown component: <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">{componentName}</code>
        </span>
      </div>
      {isDev && props && Object.keys(props).length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowProps(!showProps)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showProps ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Requested props
          </button>
          {showProps && (
            <pre className="mt-2 text-xs bg-secondary/50 rounded p-2 overflow-auto max-h-48 text-muted-foreground">
              {JSON.stringify(props, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
